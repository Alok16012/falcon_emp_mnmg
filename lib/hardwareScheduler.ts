/**
 * Hardware Auto-Sync Scheduler
 * Runs every 30 minutes in the background.
 * Polls all enabled Dahua devices and creates Attendance records.
 *
 * Works in:
 *  - Local dev (via instrumentation.ts setInterval)
 *  - Self-hosted production (PM2 / Node server)
 *  - Vercel (via vercel.json cron → /api/hardware/cron)
 */

import prisma from "@/lib/prisma"
import { fetchAccessRecords } from "@/lib/dahua"
import { processHardwareRecord } from "@/app/api/hardware/sync/route"

const SYNC_INTERVAL_MS = 30 * 60 * 1000 // 30 minutes
let isRunning = false
let timerRef: ReturnType<typeof setInterval> | null = null

// ─── Main sync function (reused by scheduler + cron API) ─────────────────────

export async function runHardwareSync(hours = 1): Promise<{
    totalRecords: number
    totalNewPunches: number
    deviceResults: { name: string; records: number; newPunches: number; error?: string }[]
}> {
    if (isRunning) {
        console.log("[HW_SCHEDULER] Sync already running, skipping")
        return { totalRecords: 0, totalNewPunches: 0, deviceResults: [] }
    }

    isRunning = true
    const deviceResults = []
    let totalRecords = 0
    let totalNewPunches = 0

    try {
        const devices = await prisma.hardwareDevice.findMany({ where: { enabled: true } })

        if (devices.length === 0) {
            console.log("[HW_SCHEDULER] No enabled devices")
            return { totalRecords: 0, totalNewPunches: 0, deviceResults: [] }
        }

        const endTime = new Date()
        const startTime = new Date(endTime.getTime() - hours * 60 * 60 * 1000)

        for (const device of devices) {
            const result = { name: device.name, records: 0, newPunches: 0, error: undefined as string | undefined }

            try {
                const records = await fetchAccessRecords(
                    { ip: device.ip, port: device.port, username: device.username, password: device.password },
                    startTime,
                    endTime,
                    500
                )

                result.records = records.length
                totalRecords += records.length

                let newPunches = 0
                for (const rec of records) {
                    try {
                        const created = await processHardwareRecord(rec)
                        if (created) newPunches++
                    } catch (e) {
                        console.error(`[HW_SCHEDULER] Record error (${device.name}):`, e)
                    }
                }

                result.newPunches = newPunches
                totalNewPunches += newPunches

                await prisma.hardwareDevice.update({
                    where: { id: device.id },
                    data: { lastSyncAt: new Date() },
                })

            } catch (e) {
                result.error = e instanceof Error ? e.message : "Unknown error"
                console.error(`[HW_SCHEDULER] Device error (${device.name}):`, e)
            }

            // Save log
            await prisma.hardwareSyncLog.create({
                data: {
                    deviceId: device.id,
                    deviceName: device.name,
                    recordCount: result.records,
                    newPunches: result.newPunches,
                    errors: result.error || null,
                },
            })

            deviceResults.push(result)
        }

        if (totalNewPunches > 0) {
            console.log(`[HW_SCHEDULER] ✅ Sync done — ${totalNewPunches} new punches from ${devices.length} device(s)`)
        }

    } finally {
        isRunning = false
    }

    return { totalRecords, totalNewPunches, deviceResults }
}

// ─── Scheduler (for local/self-hosted) ────────────────────────────────────────

export function startHardwareSyncScheduler() {
    if (timerRef) return // already started

    console.log(`[HW_SCHEDULER] 🕐 Auto-sync started — every ${SYNC_INTERVAL_MS / 60000} minutes`)

    // Run immediately on startup (catch up any missed punches)
    setTimeout(() => {
        console.log("[HW_SCHEDULER] Running initial sync on startup...")
        runHardwareSync(2).catch(e => console.error("[HW_SCHEDULER] Initial sync error:", e))
    }, 15_000) // 15s delay after startup (let DB connect first)

    // Then run every 30 minutes
    timerRef = setInterval(() => {
        console.log("[HW_SCHEDULER] Running scheduled sync...")
        runHardwareSync(1).catch(e => console.error("[HW_SCHEDULER] Scheduled sync error:", e))
    }, SYNC_INTERVAL_MS)
}

export function stopHardwareSyncScheduler() {
    if (timerRef) {
        clearInterval(timerRef)
        timerRef = null
        console.log("[HW_SCHEDULER] Scheduler stopped")
    }
}
