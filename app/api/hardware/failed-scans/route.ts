/**
 * Failed-scan report for a single day.
 *
 * The Dahua device logs EVERY scan attempt. A successful one carries
 * Status=1, ErrorCode=0 and the person's UserID/CardName. A scan the device
 * could not match against any enrolled face/card is logged with Status=0,
 * ErrorCode=16 and an EMPTY UserID — so the punch pipeline has no one to
 * attribute it to and silently drops it (channelSync skips records with no
 * UserID). Those people then show ABSENT even though they stood at the gate.
 *
 * This endpoint surfaces exactly those dropped scans, alongside the ACTIVE
 * employees who have no attendance row for the day, so the office can match
 * "someone tried at 08:41" against "these 6 people are missing".
 *
 * Reads the device live — no writes, no DB schema of its own.
 *
 *   GET /api/hardware/failed-scans?date=YYYY-MM-DD
 */

import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { canAccessModule } from "@/lib/modules"
import { sendToDeviceAwait, getConnectedDevices } from "@/lib/dahuaAutoReg"

const IST_OFFSET = 5.5 * 60 * 60 // seconds

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

/** Epoch seconds → "HH:MM" in IST. */
function istTime(epoch: number): string {
    const d = new Date((epoch + IST_OFFSET) * 1000)
    return d.toISOString().slice(11, 16)
}

export async function GET(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return new NextResponse("Unauthorized", { status: 401 })
    if (!canAccessModule(session.user, "attendance")) {
        return new NextResponse("Forbidden", { status: 403 })
    }

    const url = new URL(req.url)
    const dateParam = url.searchParams.get("date")
    const day = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
        ? dateParam
        : new Date(Date.now() + IST_OFFSET * 1000).toISOString().slice(0, 10)

    const conn = getConnectedDevices().filter(d => d.connected)
    if (conn.length === 0) {
        return NextResponse.json({ date: day, deviceConnected: false, total: 0, matched: 0, failed: 0, failedTimes: [], byHour: {}, noAttendance: [] })
    }

    // The IST day as an epoch window (device filters want UNIX seconds).
    const start = Math.floor(new Date(day + "T00:00:00Z").getTime() / 1000) - IST_OFFSET
    const end = start + 86400
    const uri = `/cgi-bin/recordFinder.cgi?action=find&name=AccessControlCardRec&StartTime=${start}&EndTime=${end}&count=1000`
    const res = await sendToDeviceAwait(conn[0].deviceId, "GET", uri, "", 30000)
    if (!res.ok) {
        return NextResponse.json({ date: day, deviceConnected: true, error: "device did not respond", total: 0, matched: 0, failed: 0, failedTimes: [], byHour: {}, noAttendance: [] })
    }

    const records = parseRecords(res.body)
    const failed: number[] = []
    let matched = 0
    for (const r of records) {
        const ct = parseInt(r["CreateTime"] || r["CreateTimeRealUTC"] || "0")
        if (!ct) continue
        if ((r["UserID"] || "").trim()) matched++
        else failed.push(ct)
    }
    failed.sort((a, b) => a - b)

    // Failures bucketed by IST hour — the office cares about the morning rush.
    const byHour: Record<string, number> = {}
    for (const t of failed) {
        const h = istTime(t).slice(0, 2)
        byHour[h] = (byHour[h] || 0) + 1
    }

    // ACTIVE employees with no attendance row for the day — the likely victims.
    const dayStart = new Date(day + "T00:00:00")
    const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1)
    const [employees, present] = await Promise.all([
        prisma.employee.findMany({
            where: { status: "ACTIVE" },
            select: { id: true, employeeId: true, firstName: true, lastName: true, hardwareUserId: true },
            orderBy: { employeeId: "asc" },
        }),
        prisma.attendance.findMany({
            where: { date: { gte: dayStart, lt: dayEnd } },
            select: { employeeId: true },
        }),
    ])
    const presentIds = new Set(present.map(a => a.employeeId))
    const noAttendance = employees
        .filter(e => !presentIds.has(e.id))
        .map(e => ({ employeeId: e.employeeId, name: `${e.firstName} ${e.lastName}`.trim(), hardwareUserId: e.hardwareUserId }))

    return NextResponse.json({
        date: day,
        deviceConnected: true,
        total: matched + failed.length,
        matched,
        failed: failed.length,
        failedTimes: failed.map(istTime),
        byHour,
        noAttendance,
    })
}
