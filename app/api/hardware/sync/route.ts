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
import { canAccessModule } from "@/lib/modules"
import { fetchAccessRecords } from "@/lib/dahua"
import { processHardwareRecord } from "@/lib/hardwarePunch"

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
    if (!canAccessModule(session.user, "hardware")) {
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
