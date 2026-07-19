/**
 * Push mapped employees to a Dahua device as user records.
 * POST /api/hardware/enroll — { deviceId: string }
 *
 * This creates the User (UserID + Name) on the device so that when the
 * employee physically enrols their fingerprint ON the device, their name
 * is already present. Fingerprint templates themselves are captured on the
 * device hardware — they cannot be pushed over CGI.
 */

import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { canAccessModule } from "@/lib/modules"
import { enrollUserOnDevice } from "@/lib/dahua"

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return new NextResponse("Unauthorized", { status: 401 })
    if (!canAccessModule(session.user, "hardware")) {
        return new NextResponse("Forbidden", { status: 403 })
    }

    const { deviceId } = await req.json().catch(() => ({}))
    if (!deviceId) return new NextResponse("deviceId required", { status: 400 })

    const device = await prisma.hardwareDevice.findFirst({
        where: { id: deviceId, enabled: true },
    })
    if (!device) {
        return NextResponse.json({ error: "Device not found or disabled" }, { status: 404 })
    }

    // Only employees that have a hardwareUserId mapped can be pushed
    const employees = await prisma.employee.findMany({
        where: { status: "ACTIVE", hardwareUserId: { not: null } },
        select: { id: true, firstName: true, lastName: true, hardwareUserId: true },
        orderBy: { firstName: "asc" },
    })

    if (employees.length === 0) {
        return NextResponse.json({
            ok: true,
            message: "No employees have a Hardware ID mapped. Map them first.",
            pushed: 0, failed: 0, results: [],
        })
    }

    const dev = { ip: device.ip, port: device.port, username: device.username, password: device.password }
    const results: { name: string; userId: string; ok: boolean; error?: string }[] = []
    let pushed = 0, failed = 0

    for (const emp of employees) {
        const userId = emp.hardwareUserId as string
        const name = `${emp.firstName} ${emp.lastName}`.trim()
        try {
            const ok = await enrollUserOnDevice(dev, userId, name)
            if (ok) pushed++; else failed++
            results.push({ name, userId, ok })
        } catch (e) {
            failed++
            results.push({ name, userId, ok: false, error: e instanceof Error ? e.message : "Error" })
        }
    }

    return NextResponse.json({
        ok: true,
        message: `Pushed ${pushed} of ${employees.length} employees to ${device.name}`,
        pushed, failed, results,
    })
}
