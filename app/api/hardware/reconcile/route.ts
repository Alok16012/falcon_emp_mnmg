/**
 * Reconcile employee hardwareUserId against the device's own enrolment.
 * Key-protected (DAHUA_DEBUG_KEY) so it can be run without a browser session.
 *
 * The device (AccessControlCard) is the source of truth: each enrolled user has
 * a UserID + CardName. Employees added via the form get an auto-assigned
 * hardwareUserId that won't match the device's UserID, so their punches never
 * link and they show absent. This endpoint matches by NAME and sets each
 * employee's hardwareUserId = device UserID.
 *
 *   GET  /api/hardware/reconcile?key=...            → dry-run report (no writes)
 *   GET  /api/hardware/reconcile?key=...&apply=1    → apply the fixes
 */

import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { sendToDeviceAwait, getConnectedDevices } from "@/lib/dahuaAutoReg"

function parseUsers(body: string): { userId: string; name: string }[] {
    const map = new Map<string, Record<string, string>>()
    for (const raw of body.split("\n")) {
        const m = raw.trim().match(/^records\[(\d+)\]\.([\w[\]]+)=(.*)$/)
        if (!m) continue
        const [, idx, key, val] = m
        if (!map.has(idx)) map.set(idx, {})
        map.get(idx)![key] = val
    }
    return Array.from(map.values())
        .map(r => ({ userId: (r["UserID"] || "").trim(), name: (r["CardName"] || "").trim() }))
        .filter(u => u.userId && u.name)
}

export async function GET(req: Request) {
    const url = new URL(req.url)
    if (url.searchParams.get("key") !== process.env.DAHUA_DEBUG_KEY) {
        return new NextResponse("Unauthorized", { status: 401 })
    }
    const apply = url.searchParams.get("apply") === "1"

    // Diagnostic: ?check=<name> → dump matching employees + their recent attendance
    const check = url.searchParams.get("check")
    if (check) {
        const parts = check.trim().split(/\s+/)
        const emps = await prisma.employee.findMany({
            where: {
                OR: [
                    { AND: [{ firstName: { equals: parts[0], mode: "insensitive" } }, { lastName: { equals: parts.slice(1).join(" "), mode: "insensitive" } }] },
                    { firstName: { equals: check.trim(), mode: "insensitive" } },
                ],
            },
            select: {
                id: true, employeeId: true, firstName: true, lastName: true, hardwareUserId: true, status: true,
                attendances: {
                    orderBy: { date: "desc" }, take: 5,
                    select: { date: true, status: true, checkIn: true, checkOut: true, punchCount: true, workingHrs: true, markedBy: true },
                },
            },
        })
        return NextResponse.json({ check, found: emps.length, employees: emps })
    }

    const conn = getConnectedDevices().filter(d => d.connected)
    if (conn.length === 0) return NextResponse.json({ error: "no device connected" }, { status: 200 })

    // Diagnostic: ?missing=1 → list today's punchers who have NO attendance row
    if (url.searchParams.get("missing") === "1") {
        const now = Math.floor(Date.now() / 1000)
        const q = `/cgi-bin/recordFinder.cgi?action=find&name=AccessControlCardRec&StartTime=${now - 30 * 3600}&EndTime=${now + 86400}&count=1000`
        const rr = await sendToDeviceAwait(conn[0].deviceId, "GET", q, "", 30000)
        const map = new Map<string, Record<string, string>>()
        for (const raw of rr.body.split("\n")) {
            const m = raw.trim().match(/^records\[(\d+)\]\.([\w[\]]+)=(.*)$/)
            if (!m) continue
            if (!map.has(m[1])) map.set(m[1], {})
            map.get(m[1])![m[2]] = m[3]
        }
        // distinct punchers today (IST day = the day the attendance page shows)
        const istDay = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10)
        const punchers = new Map<string, string>() // uid -> name
        for (const r of map.values()) {
            const uid = (r["UserID"] || "").trim(); const ct = parseInt(r["CreateTime"] || "0")
            if (!uid || !ct) continue
            const d = new Date((ct + 5.5 * 3600) * 1000).toISOString().slice(0, 10)
            if (d === istDay) punchers.set(uid, (r["CardName"] || "").trim())
        }
        // today's attendance date range (UTC midnight of IST today)
        const dayStart = new Date(istDay + "T00:00:00.000Z")
        const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1)
        const missing: unknown[] = []
        let present = 0
        for (const [uid, name] of punchers) {
            const stripped = uid.replace(/^0+/, "") || "0"
            const cands = Array.from(new Set([uid, stripped, stripped.padStart(2, "0"), stripped.padStart(3, "0"), stripped.padStart(4, "0")]))
            let emp = await prisma.employee.findFirst({ where: { hardwareUserId: { in: cands } }, select: { id: true, employeeId: true, firstName: true, lastName: true } })
            if (!emp && name) {
                const parts = name.split(/\s+/)
                emp = await prisma.employee.findFirst({ where: { OR: [{ AND: [{ firstName: { equals: parts[0], mode: "insensitive" } }, { lastName: { equals: parts.slice(1).join(" "), mode: "insensitive" } }] }, { firstName: { equals: name, mode: "insensitive" } }] }, select: { id: true, employeeId: true, firstName: true, lastName: true } })
            }
            if (!emp) { missing.push({ uid, name, reason: "no employee record" }); continue }
            const att = await prisma.attendance.findFirst({ where: { employeeId: emp.id, date: { gte: dayStart, lt: dayEnd } }, select: { id: true } })
            if (att) present++
            else missing.push({ uid, name, employeeId: emp.employeeId, reason: "employee exists but no attendance row" })
        }
        return NextResponse.json({ istDay, punchedToday: punchers.size, present, missingCount: missing.length, missing })
    }

    // Diagnostic: ?testrec=<userId> → fetch that user's latest punch and run
    // processHardwareRecord on it directly, surfacing any thrown error.
    const testrec = url.searchParams.get("testrec")
    if (testrec) {
        const now = Math.floor(Date.now() / 1000)
        const q = `/cgi-bin/recordFinder.cgi?action=find&name=AccessControlCardRec&StartTime=${now - 3 * 86400}&EndTime=${now + 86400}&count=5000`
        const rr = await sendToDeviceAwait(conn[0].deviceId, "GET", q, "", 30000)
        const map = new Map<string, Record<string, string>>()
        for (const raw of rr.body.split("\n")) {
            const m = raw.trim().match(/^records\[(\d+)\]\.([\w[\]]+)=(.*)$/)
            if (!m) continue
            if (!map.has(m[1])) map.set(m[1], {})
            map.get(m[1])![m[2]] = m[3]
        }
        const recs = Array.from(map.values()).filter(r => (r["UserID"] || "").trim() === testrec)
        recs.sort((a, b) => parseInt(b["CreateTime"] || "0") - parseInt(a["CreateTime"] || "0"))
        const r = recs[0]
        if (!r) return NextResponse.json({ testrec, error: "no punch found for this user in window", totalRecs: map.size })
        const ct = parseInt(r["CreateTime"] || "0")
        const rec = {
            UserID: testrec, CardNo: r["CardNo"] || testrec, CardName: r["CardName"] || "",
            CreateTime: new Date(ct * 1000).toISOString().slice(0, 19).replace("T", " "),
            RecNo: parseInt(r["RecNo"] || "0"), Door: 0, Direction: 0, Method: 0,
        }
        try {
            const { processHardwareRecord } = await import("@/app/api/hardware/sync/route")
            const result = await processHardwareRecord(rec)
            return NextResponse.json({ testrec, rec, result })
        } catch (e) {
            return NextResponse.json({ testrec, rec, error: e instanceof Error ? e.message : String(e), stack: e instanceof Error ? e.stack?.split("\n").slice(0, 6) : undefined })
        }
    }

    // Backfill: ?backfill=1&from=YYYY-MM-DD[&to=YYYY-MM-DD] → pull older punches the
    // normal 30h sync missed (e.g. after the device was offline for days). Fetches
    // ONE DAY at a time so each window stays under the device's ~1000-record cap and
    // its time filter keeps working. Default range: last 7 days up to today.
    // `to` bounds the loop — recovering a 2-day gap should not walk 20 days of
    // device queries and time the request out.
    if (url.searchParams.get("backfill") === "1") {
        try {
            const { syncPunches } = await import("@/lib/channelSync")
            const fromParam = url.searchParams.get("from")
            const toParam = url.searchParams.get("to")
            const DAY = 86400
            const now = Math.floor(Date.now() / 1000)
            // Start at 00:00 of `from` (IST≈UTC+5:30; we use UTC-day windows with a
            // ±buffer so boundary punches aren't missed). Default: 7 days back.
            let startEpoch: number
            if (fromParam && /^\d{4}-\d{2}-\d{2}$/.test(fromParam)) {
                startEpoch = Math.floor(new Date(fromParam + "T00:00:00Z").getTime() / 1000)
            } else {
                startEpoch = now - 7 * DAY
            }
            // Inclusive last day; never past today.
            const endEpoch = toParam && /^\d{4}-\d{2}-\d{2}$/.test(toParam)
                ? Math.min(Math.floor(new Date(toParam + "T00:00:00Z").getTime() / 1000) + DAY, now + DAY)
                : now + DAY
            const days: { window: string; newPunches: number; scanned: number }[] = []
            let totalNew = 0, totalScanned = 0
            // Each iteration covers a 24h window with a small overlap buffer.
            for (let s = startEpoch; s < endEpoch; s += DAY) {
                const start = s - 3600            // 1h back-buffer for clock skew
                const end = s + DAY + 3600        // 1h forward-buffer
                const r = await syncPunches(conn[0].deviceId, { start, end })
                days.push({ window: new Date(s * 1000).toISOString().slice(0, 10), newPunches: r.newPunches, scanned: r.scanned })
                totalNew += r.newPunches
                totalScanned += r.scanned
            }
            return NextResponse.json({
                ran: "backfill",
                from: new Date(startEpoch * 1000).toISOString().slice(0, 10),
                to: new Date((endEpoch - DAY) * 1000).toISOString().slice(0, 10),
                totalNew, totalScanned, days,
            })
        } catch (e) {
            return NextResponse.json({ ran: "backfill", error: e instanceof Error ? e.message : String(e) }, { status: 200 })
        }
    }

    // Diagnostic: ?sync=1 → run punch sync directly and report the raw result
    if (url.searchParams.get("sync") === "1") {
        try {
            const { syncPunches } = await import("@/lib/channelSync")
            const r = await syncPunches(conn[0].deviceId)
            return NextResponse.json({ ran: "syncPunches", deviceId: conn[0].deviceId, ...r })
        } catch (e) {
            return NextResponse.json({ ran: "syncPunches", error: e instanceof Error ? e.message : String(e), stack: e instanceof Error ? e.stack : undefined })
        }
    }

    const res = await sendToDeviceAwait(conn[0].deviceId, "GET",
        "/cgi-bin/recordFinder.cgi?action=find&name=AccessControlCard&count=2000", "", 30000)
    if (!res.ok) return NextResponse.json({ error: "device fetch failed", detail: res.body }, { status: 200 })

    const users = parseUsers(res.body)
    const changed: unknown[] = []
    const ambiguous: unknown[] = []
    const alreadyOk: string[] = []
    const noMatch: unknown[] = []

    for (const u of users) {
        const parts = u.name.split(/\s+/)
        const first = parts[0]
        const last = parts.slice(1).join(" ")

        const matches = await prisma.employee.findMany({
            where: {
                OR: [
                    { AND: [{ firstName: { equals: first, mode: "insensitive" } }, { lastName: { equals: last, mode: "insensitive" } }] },
                    { firstName: { equals: u.name, mode: "insensitive" } },
                ],
            },
            select: { id: true, employeeId: true, firstName: true, lastName: true, hardwareUserId: true },
        })

        if (matches.length === 0) { noMatch.push({ userId: u.userId, name: u.name }); continue }
        if (matches.length > 1) {
            ambiguous.push({ userId: u.userId, name: u.name, matches: matches.map(m => ({ employeeId: m.employeeId, hwid: m.hardwareUserId })) })
            continue
        }
        const emp = matches[0]
        if (emp.hardwareUserId === u.userId) { alreadyOk.push(u.userId); continue }

        changed.push({ userId: u.userId, name: u.name, employeeId: emp.employeeId, was: emp.hardwareUserId, now: u.userId })
        if (apply) {
            await prisma.employee.update({ where: { id: emp.id }, data: { hardwareUserId: u.userId } }).catch(() => {})
        }
    }

    return NextResponse.json({
        applied: apply,
        deviceUsers: users.length,
        willFix: changed.length,
        alreadyCorrect: alreadyOk.length,
        ambiguousCount: ambiguous.length,
        noMatchCount: noMatch.length,
        changed,
        ambiguous,
        noMatch,
    })
}
