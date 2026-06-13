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

    const conn = getConnectedDevices().filter(d => d.connected)
    if (conn.length === 0) return NextResponse.json({ error: "no device connected" }, { status: 200 })

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
