/**
 * Import users that exist ON the device into the web app as employees.
 * POST /api/hardware/import-device-users  { deviceId? }
 *
 * Reads AccessControlCard records from the connected device and, for every
 * device user, ensures an employee exists with hardwareUserId = device UserID.
 * This makes attendance auto-link — no manual mapping needed.
 */

import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { canAccessModule } from "@/lib/modules"
import { sendToDeviceAwait, getConnectedDevices } from "@/lib/dahuaAutoReg"

type DevUser = { userId: string; name: string }

function parseUsers(body: string): DevUser[] {
    const map = new Map<string, Record<string, string>>()
    for (const raw of body.split("\n")) {
        const m = raw.trim().match(/^records\[(\d+)\]\.([\w[\]]+)=(.*)$/)
        if (!m) continue
        const [, idx, key, val] = m
        if (!map.has(idx)) map.set(idx, {})
        map.get(idx)![key] = val
    }
    return Array.from(map.values())
        .map((r) => ({ userId: (r["UserID"] || "").trim(), name: (r["CardName"] || "").trim() }))
        .filter((u) => u.userId)
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

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return new NextResponse("Unauthorized", { status: 401 })
    if (!canAccessModule(session.user, "hardware")) {
        return new NextResponse("Forbidden", { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    let deviceId: string | undefined = body.deviceId
    if (!deviceId) {
        const conn = getConnectedDevices()
        if (conn.length === 0) {
            return NextResponse.json({ ok: false, error: "No device connected" }, { status: 200 })
        }
        deviceId = conn[0].deviceId
    }

    const res = await sendToDeviceAwait(
        deviceId,
        "GET",
        "/cgi-bin/recordFinder.cgi?action=find&name=AccessControlCard&count=1000"
    )
    if (!res.ok) {
        return NextResponse.json({ ok: false, error: res.body || "device not reachable" }, { status: 200 })
    }

    const users = parseUsers(res.body)
    let imported = 0, linked = 0, skipped = 0
    const results: { userId: string; name: string; action: string }[] = []

    for (const u of users) {
        // Already linked to an employee?
        const existing = await prisma.employee.findFirst({
            where: { hardwareUserId: u.userId },
            select: { id: true },
        })
        if (existing) {
            skipped++
            results.push({ userId: u.userId, name: u.name, action: "already linked" })
            continue
        }

        // Try to match an existing employee by name (case-insensitive)
        const parts = u.name.split(/\s+/).filter(Boolean)
        const first = parts[0] || u.name || `User ${u.userId}`
        const last = parts.slice(1).join(" ") || "."

        const byName = u.name
            ? await prisma.employee.findFirst({
                  where: {
                      hardwareUserId: null,
                      firstName: { equals: first, mode: "insensitive" },
                  },
                  select: { id: true },
              })
            : null

        if (byName) {
            await prisma.employee.update({ where: { id: byName.id }, data: { hardwareUserId: u.userId } })
            linked++
            results.push({ userId: u.userId, name: u.name, action: "linked to existing" })
            continue
        }

        // Create a fresh employee linked to this device user
        const employeeId = await nextEmployeeId()
        await prisma.employee.create({
            data: {
                employeeId,
                hardwareUserId: u.userId,
                firstName: first,
                lastName: last,
                phone: "",
                status: "ACTIVE",
                employeeCategory: "LABOUR",
            },
        })
        imported++
        results.push({ userId: u.userId, name: u.name, action: "created" })
    }

    return NextResponse.json({
        ok: true,
        deviceUsers: users.length,
        imported, linked, skipped,
        message: `${imported} created, ${linked} linked, ${skipped} already linked`,
        results,
    })
}
