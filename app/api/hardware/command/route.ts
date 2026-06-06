/**
 * Send a raw CGI command to a connected Dahua device over the auto-reg socket.
 *
 * Two auth modes:
 *  - Logged-in ADMIN/MANAGER session, OR
 *  - ?key=<DAHUA_DEBUG_KEY> (used for live CGI discovery during setup).
 *
 * POST /api/hardware/command
 * body: { deviceId, method?, uri, body? }
 */

import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { sendToDeviceAwait, getConnectedDevices } from "@/lib/dahuaAutoReg"

async function authorized(req: Request): Promise<boolean> {
    const url = new URL(req.url)
    const key = url.searchParams.get("key")
    if (key && process.env.DAHUA_DEBUG_KEY && key === process.env.DAHUA_DEBUG_KEY) return true
    const session = await getServerSession(authOptions)
    return !!session && (session.user.role === "ADMIN" || session.user.role === "MANAGER")
}

export async function GET(req: Request) {
    if (!(await authorized(req))) return new NextResponse("Unauthorized", { status: 401 })
    return NextResponse.json({ connected: getConnectedDevices() })
}

export async function POST(req: Request) {
    if (!(await authorized(req))) return new NextResponse("Unauthorized", { status: 401 })

    const { deviceId, method = "GET", uri, body = "" } = await req.json().catch(() => ({}))
    if (!deviceId || !uri) {
        return NextResponse.json({ error: "deviceId and uri required" }, { status: 400 })
    }

    const result = await sendToDeviceAwait(deviceId, method, uri, body)
    return NextResponse.json(result)
}
