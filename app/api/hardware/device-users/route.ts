/**
 * Live list of users enrolled ON a connected Dahua device.
 * GET /api/hardware/device-users?deviceId=FALCON-GATE-1
 *
 * Pulls AccessControlCard records over the auto-reg socket and parses them.
 */

import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { sendToDeviceAwait, getConnectedDevices } from "@/lib/dahuaAutoReg"

type DeviceUser = {
    userId: string
    name: string
    cardNo: string
    valid: boolean
    userType: string
}

function parseRecords(body: string): DeviceUser[] {
    const map = new Map<string, Record<string, string>>()
    for (const raw of body.split("\n")) {
        const m = raw.trim().match(/^records\[(\d+)\]\.([\w[\]]+)=(.*)$/)
        if (!m) continue
        const [, idx, key, val] = m
        if (!map.has(idx)) map.set(idx, {})
        map.get(idx)![key] = val
    }
    return Array.from(map.values()).map((r) => ({
        userId: r["UserID"] || "",
        name: r["CardName"] || "",
        cardNo: r["CardNo"] || "",
        valid: r["IsValid"] === "true",
        userType: r["UserType"] || "0",
    }))
}

export async function GET(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    const deviceId = new URL(req.url).searchParams.get("deviceId")
    if (!deviceId) {
        // If no deviceId given, default to the first connected device
        const conn = getConnectedDevices()
        if (conn.length === 0) {
            return NextResponse.json({ connected: false, users: [], count: 0 })
        }
        return queryDevice(conn[0].deviceId)
    }
    return queryDevice(deviceId)
}

async function queryDevice(deviceId: string) {
    const res = await sendToDeviceAwait(
        deviceId,
        "GET",
        "/cgi-bin/recordFinder.cgi?action=find&name=AccessControlCard&count=1000"
    )
    if (!res.ok) {
        return NextResponse.json(
            { connected: false, users: [], count: 0, error: res.body || "device not reachable" },
            { status: 200 }
        )
    }
    const users = parseRecords(res.body)
    return NextResponse.json({ connected: true, deviceId, count: users.length, users })
}
