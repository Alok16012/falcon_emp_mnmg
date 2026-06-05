/**
 * GET /api/hardware/sessions
 * Returns list of devices currently connected via Auto-Registration TCP
 */

import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { getConnectedDevices } from "@/lib/dahuaAutoReg"

export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    const devices = getConnectedDevices()
    return NextResponse.json({ devices, count: devices.length })
}
