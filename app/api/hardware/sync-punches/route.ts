/**
 * Pull punch records from a connected device over the auto-reg socket and
 * turn them into attendance. Works through the Railway TCP proxy (unlike the
 * legacy HTTP sync which needs LAN access).
 *
 * POST /api/hardware/sync-punches  { deviceId? }
 */

import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { sendToDeviceAwait, getConnectedDevices } from "@/lib/dahuaAutoReg"
import { processHardwareRecord } from "@/app/api/hardware/sync/route"

// Device CreateTime is unix epoch seconds (a true instant). We store it as the
// real UTC wall-clock string; the browser (IST) then renders the correct local
// time via getHours(). Adding the offset here would double-shift it.
function unixToLocalStr(unix: number): string {
    const d = new Date(unix * 1000)
    return d.toISOString().slice(0, 19).replace("T", " ")
}

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

export async function POST(req: Request) {
    const url = new URL(req.url)
    const key = url.searchParams.get("key")
    const keyOk = key && process.env.DAHUA_DEBUG_KEY && key === process.env.DAHUA_DEBUG_KEY
    if (!keyOk) {
        const session = await getServerSession(authOptions)
        if (!session) return new NextResponse("Unauthorized", { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    let deviceId: string | undefined = body.deviceId
    if (!deviceId) {
        const conn = getConnectedDevices()
        if (conn.length === 0) return NextResponse.json({ ok: false, error: "No device connected" })
        deviceId = conn[0].deviceId
    }

    // First import any new device users so their punches can attach to an employee
    const { importDeviceUsers } = await import("@/lib/channelSync")
    const imp = await importDeviceUsers(deviceId)

    const res = await sendToDeviceAwait(
        deviceId,
        "GET",
        "/cgi-bin/recordFinder.cgi?action=find&name=AccessControlCardRec&count=500"
    )
    if (!res.ok) return NextResponse.json({ ok: false, error: res.body || "device not reachable" })

    const records = parseRecords(res.body)
    let scanned = 0, newPunches = 0, skippedNoUser = 0

    for (const r of records) {
        const userId = (r["UserID"] || "").trim()
        const ct = parseInt(r["CreateTime"] || r["CreateTimeRealUTC"] || "0")
        if (!userId) { skippedNoUser++; continue }
        if (!ct) continue
        scanned++
        try {
            const created = await processHardwareRecord({
                UserID: userId,
                CardNo: r["CardNo"] || userId,
                CardName: r["CardName"] || "",
                CreateTime: unixToLocalStr(ct),
                RecNo: parseInt(r["RecNo"] || "0"),
                Door: parseInt(r["Door"] || "0"),
                Direction: r["Type"] === "Exit" ? 1 : 0,
                Method: parseInt(r["Method"] || "0"),
            })
            if (created) newPunches++
        } catch {
            /* ignore individual record errors */
        }
    }

    return NextResponse.json({
        ok: true,
        deviceId,
        totalRecords: records.length,
        withUser: scanned,
        skippedNoUser,
        newPunches,
        imported: imp.imported + imp.linked,
        message: `${imp.imported + imp.linked} new employee(s), ${newPunches} new punch(es)`,
    })
}
