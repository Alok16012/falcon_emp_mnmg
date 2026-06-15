/**
 * Dahua Hardware Sync API
 * Polls Dahua device for new access control records and creates Attendance entries.
 * POST /api/hardware/sync  — { deviceId?: string, hours?: number }
 * GET  /api/hardware/sync  — recent sync logs
 */

import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { fetchAccessRecords, AccessControlRecord } from "@/lib/dahua"

// GET: recent sync logs
export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    const logs = await prisma.hardwareSyncLog.findMany({
        orderBy: { syncedAt: "desc" },
        take: 50,
    })
    return NextResponse.json(logs)
}

// POST: trigger sync
export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return new NextResponse("Unauthorized", { status: 401 })
    if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
        return new NextResponse("Forbidden", { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const { deviceId, hours = 24 } = body

    // Get devices to sync
    const devices = deviceId
        ? await prisma.hardwareDevice.findMany({ where: { id: deviceId, enabled: true } })
        : await prisma.hardwareDevice.findMany({ where: { enabled: true } })

    if (devices.length === 0) {
        return NextResponse.json({ ok: true, message: "No enabled devices found", results: [] })
    }

    const results = []

    for (const device of devices) {
        const syncResult = {
            deviceId: device.id,
            deviceName: device.name,
            recordCount: 0,
            newPunches: 0,
            errors: null as string | null,
        }

        try {
            const endTime = new Date()
            const startTime = new Date(endTime.getTime() - hours * 60 * 60 * 1000)

            // Fetch records from device
            const records = await fetchAccessRecords(
                { ip: device.ip, port: device.port, username: device.username, password: device.password },
                startTime,
                endTime,
                500
            )

            syncResult.recordCount = records.length

            // Process each record
            let newPunches = 0
            for (const rec of records) {
                try {
                    const processed = await processHardwareRecord(rec)
                    if (processed) newPunches++
                } catch (e) {
                    console.error(`[HW_SYNC] Error processing record ${rec.RecNo}:`, e)
                }
            }

            syncResult.newPunches = newPunches

            // Update device lastSyncAt
            await prisma.hardwareDevice.update({
                where: { id: device.id },
                data: { lastSyncAt: new Date() },
            })

        } catch (e) {
            syncResult.errors = e instanceof Error ? e.message : "Unknown error"
        }

        // Save sync log
        await prisma.hardwareSyncLog.create({
            data: {
                deviceId: device.id,
                deviceName: device.name,
                recordCount: syncResult.recordCount,
                newPunches: syncResult.newPunches,
                errors: syncResult.errors,
            },
        })

        results.push(syncResult)
    }

    return NextResponse.json({ ok: true, results })
}

// ─── Core: process a single hardware punch record ─────────────────────────────

export async function processHardwareRecord(rec: AccessControlRecord): Promise<boolean> {
    if (!rec.UserID || !rec.CreateTime) return false

    // Find employee by hardwareUserId (exact, then zero-pad/strip variants)
    const raw = String(rec.UserID).trim()
    const stripped = raw.replace(/^0+/, "") || "0"
    const idCandidates = Array.from(new Set([
        raw, stripped, stripped.padStart(2, "0"), stripped.padStart(3, "0"), stripped.padStart(4, "0"),
    ]))
    let employee = await prisma.employee.findFirst({
        where: { hardwareUserId: { in: idCandidates } },
        select: { id: true, shiftHours: true },
    })

    // Fallback: match by the punch record's name (CardName). Employees added via
    // the form get an auto-assigned hardwareUserId from their EMP number, which
    // won't match the device's own enrolment ID. Match on name, then bind the
    // device UserID so future punches match directly (self-healing mapping).
    if (!employee && rec.CardName && rec.CardName.trim()) {
        const full = rec.CardName.trim()
        const parts = full.split(/\s+/)
        const first = parts[0]
        const last = parts.slice(1).join(" ")
        employee = await prisma.employee.findFirst({
            where: {
                hardwareUserId: { notIn: idCandidates },
                OR: [
                    { AND: [{ firstName: { equals: first, mode: "insensitive" } }, { lastName: { equals: last, mode: "insensitive" } }] },
                    { firstName: { equals: full, mode: "insensitive" } },
                ],
            },
            select: { id: true, shiftHours: true },
        })
        if (employee) {
            await prisma.employee.update({ where: { id: employee.id }, data: { hardwareUserId: raw } }).catch(() => {})
        }
    }

    if (!employee) return false // not mapped

    // Parse punch time (device time is local IST, stored as naive string)
    const punchTime = parseDeviceTime(rec.CreateTime)
    if (!punchTime) return false

    const todayStart = new Date(punchTime.getFullYear(), punchTime.getMonth(), punchTime.getDate())
    const todayEnd = new Date(todayStart); todayEnd.setDate(todayEnd.getDate() + 1)

    // Check for duplicate (same RecNo would be re-synced)
    // We use a unique combo: employeeId + exact punchTime
    const existingPunchLog = await prisma.punchLog.findFirst({
        where: {
            employeeId: employee.id,
            punchTime: punchTime,
        },
    })
    if (existingPunchLog) return false // already processed

    // Get or create today's attendance
    let attendance = await prisma.attendance.findFirst({
        where: { employeeId: employee.id, date: { gte: todayStart, lt: todayEnd } },
    })
    if (!attendance) {
        attendance = await prisma.attendance.create({
            data: { employeeId: employee.id, date: todayStart, status: "PRESENT", punchCount: 0 },
        })
    }

    const newPunchCount = (attendance.punchCount ?? 0) + 1
    // Prefer the device's real direction (0=Enter→IN, 1=Exit→OUT). Only fall back
    // to count parity when the device reports 2/None — otherwise an extra morning
    // punch flips the parity and the genuine evening OUT gets mislabelled as IN
    // (which is why out-time punches were not showing up).
    const punchType: "IN" | "OUT" =
        rec.Direction === 0 ? "IN" :
        rec.Direction === 1 ? "OUT" :
        (newPunchCount % 2 === 1 ? "IN" : "OUT")

    // checkIn = earliest IN, checkOut = latest OUT — order-independent so it stays
    // correct even if the device returns records out of chronological order.
    const newCheckIn = punchType === "IN"
        ? (!attendance.checkIn || punchTime < attendance.checkIn ? punchTime : attendance.checkIn)
        : attendance.checkIn
    const newCheckOut = punchType === "OUT"
        ? (!attendance.checkOut || punchTime > attendance.checkOut ? punchTime : attendance.checkOut)
        : attendance.checkOut

    // Late check: IN after 09:15 (only when recording the first IN of the day)
    const SHIFT_H = 9, SHIFT_M = 15
    const isLate = punchType === "IN" && !attendance.checkIn &&
        (punchTime.getHours() > SHIFT_H || (punchTime.getHours() === SHIFT_H && punchTime.getMinutes() > SHIFT_M))

    // Working hours = full span (last OUT − first IN). The 35-min lunch is paid by
    // the company, so it counts as working time and is NOT deducted.
    // Span-based so re-syncing the same punches never double-counts.
    let newWorkingHrs = attendance.workingHrs ?? 0
    if (newCheckIn && newCheckOut && newCheckOut > newCheckIn) {
        const spanHrs = (newCheckOut.getTime() - newCheckIn.getTime()) / (1000 * 60 * 60)
        newWorkingHrs = parseFloat(spanHrs.toFixed(2))
    }

    // Update attendance
    await prisma.attendance.update({
        where: { id: attendance.id },
        data: {
            punchCount: newPunchCount,
            lastPunchTime: punchTime,
            workingHrs: newWorkingHrs,
            checkIn: newCheckIn,
            checkOut: newCheckOut,
            status: "PRESENT",
            markedBy: "HARDWARE",
            ...(isLate ? {
                remarks: `Late arrival: ${String(punchTime.getHours()).padStart(2, "0")}:${String(punchTime.getMinutes()).padStart(2, "0")}`
            } : {})
        },
    })

    // Save punch log
    await prisma.punchLog.create({
        data: {
            employeeId: employee.id,
            attendanceId: attendance.id,
            punchNumber: newPunchCount,
            punchType,
            punchTime,
        },
    })

    return true
}

// ─── Parse Dahua time string ──────────────────────────────────────────────────
// Device sends: "2024-01-15 09:30:00" in local time (IST +5:30)
function parseDeviceTime(timeStr: string): Date | null {
    try {
        // Replace space with T for ISO parsing, treat as local time
        const iso = timeStr.replace(" ", "T")
        const d = new Date(iso)
        if (isNaN(d.getTime())) return null
        return d
    } catch {
        return null
    }
}
