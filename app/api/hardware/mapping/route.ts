/**
 * Employee ↔ Hardware UserID mapping
 * GET  /api/hardware/mapping          — all employees with their hardwareUserId
 * POST /api/hardware/mapping          — bulk update mappings
 * PUT  /api/hardware/mapping          — update single employee mapping
 */

import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { canAccessModule } from "@/lib/modules"

// GET all employee mappings
export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    const employees = await prisma.employee.findMany({
        where: { status: "ACTIVE" },
        select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            designation: true,
            hardwareUserId: true,
            department: { select: { name: true } },
            branch: { select: { name: true } },
        },
        orderBy: { firstName: "asc" },
    })

    return NextResponse.json(employees)
}

// PUT update single employee hardwareUserId
export async function PUT(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return new NextResponse("Unauthorized", { status: 401 })
    if (!canAccessModule(session.user, "hardware")) {
        return new NextResponse("Forbidden", { status: 403 })
    }

    const { employeeId, hardwareUserId } = await req.json()
    if (!employeeId) return new NextResponse("employeeId required", { status: 400 })

    // Check uniqueness
    if (hardwareUserId) {
        const existing = await prisma.employee.findFirst({
            where: { hardwareUserId, NOT: { id: employeeId } },
            select: { id: true, firstName: true, lastName: true },
        })
        if (existing) {
            return NextResponse.json(
                { error: `Hardware ID already assigned to ${existing.firstName} ${existing.lastName}` },
                { status: 409 }
            )
        }
    }

    const updated = await prisma.employee.update({
        where: { id: employeeId },
        data: { hardwareUserId: hardwareUserId || null },
        select: { id: true, employeeId: true, firstName: true, lastName: true, hardwareUserId: true },
    })

    return NextResponse.json(updated)
}

// POST bulk mapping (auto-map by name or upload from device user list)
export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return new NextResponse("Unauthorized", { status: 401 })
    if (session.user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 })

    const { mappings } = await req.json()
    // mappings: Array<{ employeeId: string, hardwareUserId: string }>

    if (!Array.isArray(mappings)) return new NextResponse("mappings array required", { status: 400 })

    let updated = 0
    for (const { employeeId, hardwareUserId } of mappings) {
        if (!employeeId) continue
        await prisma.employee.update({
            where: { id: employeeId },
            data: { hardwareUserId: hardwareUserId || null },
        })
        updated++
    }

    return NextResponse.json({ ok: true, updated })
}
