/**
 * Channel-based auto pipeline for Dahua auto-registration devices.
 * For every device currently connected over the auto-reg socket:
 *   1) import its users  → create/link employees (hardwareUserId = device UserID)
 *   2) sync its punches  → create attendance
 *
 * Works through the Railway TCP proxy (no LAN access needed).
 */

import prisma from "@/lib/prisma"
import { sendToDeviceAwait, getConnectedDevices } from "@/lib/dahuaAutoReg"
import { processHardwareRecord } from "@/app/api/hardware/sync/route"

function parseRecords(body: string): Record<string, string>[] {
    const map = new Map<string, Record<string, string>>()
    for (const raw of body.split("\n")) {
        const m = raw.trim().match(/^records\[(\d+)\]\.([\w[\]]+)=(.*)$/)
        if (!m) continue
        const [, idx, key, val] = m
        if (!map.has(idx)) map.set(idx, {})
        map.get(idx)![key] = val
    }
    return Array.from(map.values())
}

function unixToUtcStr(unix: number): string {
    return new Date(unix * 1000).toISOString().slice(0, 19).replace("T", " ")
}

async function nextEmployeeId(): Promise<string> {
    const last = await prisma.employee.findFirst({ orderBy: { createdAt: "desc" }, select: { employeeId: true } })
    let n = 1
    if (last?.employeeId) {
        const m = last.employeeId.match(/\d+$/)
        if (m) n = parseInt(m[0]) + 1
    }
    let id = `EMP-${String(n).padStart(4, "0")}`
    while (await prisma.employee.findUnique({ where: { employeeId: id } })) {
        n++
        id = `EMP-${String(n).padStart(4, "0")}`
    }
    return id
}

export async function importDeviceUsers(deviceId: string): Promise<{ imported: number; linked: number }> {
    const res = await sendToDeviceAwait(deviceId, "GET", "/cgi-bin/recordFinder.cgi?action=find&name=AccessControlCard&count=1000", "", 30000)
    if (!res.ok) return { imported: 0, linked: 0 }

    let imported = 0, linked = 0
    for (const r of parseRecords(res.body)) {
        const userId = (r["UserID"] || "").trim()
        if (!userId) continue
        const name = (r["CardName"] || "").trim()

        const existing = await prisma.employee.findFirst({ where: { hardwareUserId: userId }, select: { id: true } })
        if (existing) continue

        const parts = name.split(/\s+/).filter(Boolean)
        const first = parts[0] || name || `User ${userId}`
        const last = parts.slice(1).join(" ") || "."

        const byName = name
            ? await prisma.employee.findFirst({
                  where: { hardwareUserId: null, firstName: { equals: first, mode: "insensitive" } },
                  select: { id: true },
              })
            : null

        if (byName) {
            await prisma.employee.update({ where: { id: byName.id }, data: { hardwareUserId: userId } })
            linked++
        } else {
            await prisma.employee.create({
                data: {
                    employeeId: await nextEmployeeId(),
                    hardwareUserId: userId,
                    firstName: first,
                    lastName: last,
                    phone: "",
                    status: "ACTIVE",
                    employeeCategory: "LABOUR",
                },
            })
            imported++
        }
    }
    return { imported, linked }
}

export async function syncPunches(
    deviceId: string,
    window?: { start: number; end: number },
): Promise<{ newPunches: number; scanned: number }> {
    // Device quirks (verified live):
    //  - StartTime/EndTime work ONLY as UNIX EPOCH seconds (date strings = 0/Bad Request).
    //  - The time filter is honoured ONLY with a MODEST count. With a large count
    //    (e.g. 5000) the device IGNORES the filter and returns the OLDEST ~1024
    //    records, truncating today's latest punches (people who punched later in
    //    the day wrongly show absent). count=1000 keeps the filter working.
    //  - Records come oldest-first, capped at `count`. So the window must hold
    //    fewer than `count` records — a ~30h window (< ~1000 punches/day) ensures
    //    every recent/today punch is returned, newest included.
    // An explicit `window` (epoch seconds) is used by the backfill to pull older
    // days one at a time (each day < 1000 records, so the filter keeps working).
    const now = Math.floor(Date.now() / 1000)
    const start = window ? window.start : now - 30 * 60 * 60       // default: last ~30 hours
    const end = window ? window.end : now + 24 * 60 * 60           // +1 day buffer for any device clock skew
    const uri = `/cgi-bin/recordFinder.cgi?action=find&name=AccessControlCardRec&StartTime=${start}&EndTime=${end}&count=1000`
    const res = await sendToDeviceAwait(deviceId, "GET", uri, "", 30000)
    if (!res.ok) return { newPunches: 0, scanned: 0 }

    let newPunches = 0, scanned = 0
    for (const r of parseRecords(res.body)) {
        const userId = (r["UserID"] || "").trim()
        const ct = parseInt(r["CreateTime"] || r["CreateTimeRealUTC"] || "0")
        if (!userId || !ct) continue
        scanned++
        try {
            const created = await processHardwareRecord({
                UserID: userId,
                CardNo: r["CardNo"] || userId,
                CardName: r["CardName"] || "",
                CreateTime: unixToUtcStr(ct),
                RecNo: parseInt(r["RecNo"] || "0"),
                Door: parseInt(r["Door"] || "0"),
                Direction: r["Type"] === "Exit" ? 1 : 0,
                Method: parseInt(r["Method"] || "0"),
            })
            if (created) newPunches++
        } catch { /* ignore individual record errors */ }
    }
    return { newPunches, scanned }
}

let channelBusy = false
let channelTimer: ReturnType<typeof setInterval> | null = null

export function startChannelSyncScheduler(intervalMs = 90_000) {
    if (channelTimer) return
    console.log(`[CHANNEL_SYNC] 🔁 Auto import+punch sync every ${intervalMs / 1000}s`)
    channelTimer = setInterval(() => {
        runChannelSyncAll().catch(e => console.error("[CHANNEL_SYNC] error:", e))
    }, intervalMs)
}

export async function runChannelSyncAll(): Promise<{ devices: number; imported: number; linked: number; newPunches: number }> {
    if (channelBusy) return { devices: 0, imported: 0, linked: 0, newPunches: 0 }
    channelBusy = true
    let imported = 0, linked = 0, newPunches = 0
    try {
        const devices = getConnectedDevices().filter(d => d.connected)
        for (const d of devices) {
            const imp = await importDeviceUsers(d.deviceId)
            imported += imp.imported; linked += imp.linked
            const sync = await syncPunches(d.deviceId)
            newPunches += sync.newPunches

            // Log to Sync Logs only when real new punches were recorded — keeps
            // the tab meaningful (no 90s spam) and replaces the old "fetch failed".
            try {
                const dev = await prisma.hardwareDevice.findFirst({ where: { name: d.deviceId }, select: { id: true } })
                if (dev) await prisma.hardwareDevice.update({ where: { id: dev.id }, data: { lastSyncAt: new Date() } })
                if (sync.newPunches > 0) {
                    await prisma.hardwareSyncLog.create({
                        data: {
                            deviceId: d.deviceId,
                            deviceName: d.deviceId,
                            recordCount: sync.scanned,
                            newPunches: sync.newPunches,
                            errors: null,
                        },
                    })
                }
            } catch { /* log table optional */ }
        }
        if (imported || linked || newPunches) {
            console.log(`[CHANNEL_SYNC] devices=${devices.length} imported=${imported} linked=${linked} newPunches=${newPunches}`)
        }
        return { devices: devices.length, imported, linked, newPunches }
    } finally {
        channelBusy = false
    }
}
