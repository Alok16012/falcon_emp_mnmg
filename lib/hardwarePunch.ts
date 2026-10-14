/**
 * Core punch processing: turns one device access record into PunchLog +
 * Attendance rows. Pure Prisma (no Next.js imports) so it is shared by the
 * API routes and the standalone biometric agent (biometric-agent/).
 */

import prisma from "@/lib/prisma"
import type { AccessControlRecord } from "@/lib/dahua"

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

    // The device records EVERY punch as an "entry" (Direction is always 0 / no
    // Exit), so direction/parity can't tell IN from OUT. Use TIME instead: the
    // first punch of the day is the check-IN and the latest punch is the
    // check-OUT. Save the punch log, then recompute from all of the day's punches.
    await prisma.punchLog.create({
        data: {
            employeeId: employee.id,
            attendanceId: attendance.id,
            punchNumber: newPunchCount,
            punchType: newPunchCount === 1 ? "IN" : "OUT",
            punchTime,
        },
    })

    const dayPunches = await prisma.punchLog.findMany({
        where: { attendanceId: attendance.id },
        orderBy: { punchTime: "asc" },
        select: { punchTime: true },
    })
    const firstPunch = new Date(dayPunches[0].punchTime)
    const lastPunch = new Date(dayPunches[dayPunches.length - 1].punchTime)
    const hasOut = dayPunches.length >= 2
    // Total hours = last punch − first punch (full span). The 35-min lunch is
    // company-paid so it stays counted, not deducted.
    const newWorkingHrs = hasOut
        ? parseFloat(((lastPunch.getTime() - firstPunch.getTime()) / (1000 * 60 * 60)).toFixed(2))
        : 0

    // Late check: first punch of the day after 09:15
    const SHIFT_H = 9, SHIFT_M = 15
    const isLate = firstPunch.getHours() > SHIFT_H || (firstPunch.getHours() === SHIFT_H && firstPunch.getMinutes() > SHIFT_M)

    await prisma.attendance.update({
        where: { id: attendance.id },
        data: {
            punchCount: newPunchCount,
            lastPunchTime: punchTime,
            workingHrs: newWorkingHrs,
            checkIn: firstPunch,
            checkOut: hasOut ? lastPunch : null,
            status: "PRESENT",
            markedBy: "HARDWARE",
            ...(isLate ? {
                remarks: `Late arrival: ${String(firstPunch.getHours()).padStart(2, "0")}:${String(firstPunch.getMinutes()).padStart(2, "0")}`
            } : {})
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
