import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { testDeviceConnection } from "@/lib/dahua"

// GET all devices
export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session) return new NextResponse("Unauthorized", { status: 401 })
    if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
        return new NextResponse("Forbidden", { status: 403 })
    }

    const devices = await prisma.hardwareDevice.findMany({
        orderBy: { createdAt: "asc" },
    })
    // Mask passwords
    return NextResponse.json(devices.map(d => ({ ...d, password: "••••••••" })))
}

// POST create device
export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return new NextResponse("Unauthorized", { status: 401 })
    if (session.user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 })

    const body = await req.json()
    const { name, ip, port, username, password } = body

    if (!name || !ip || !password) {
        return new NextResponse("name, ip, password required", { status: 400 })
    }

    const device = await prisma.hardwareDevice.create({
        data: {
            name,
            ip,
            port: port ? parseInt(port) : 80,
            username: username || "admin",
            password,
        },
    })

    return NextResponse.json({ ...device, password: "••••••••" })
}

// PUT update device
export async function PUT(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return new NextResponse("Unauthorized", { status: 401 })
    if (session.user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 })

    const body = await req.json()
    const { id, name, ip, port, username, password, enabled, testConn } = body

    if (!id) return new NextResponse("id required", { status: 400 })

    // Test connection only
    if (testConn) {
        const existing = await prisma.hardwareDevice.findUnique({ where: { id } })
        if (!existing) return new NextResponse("Not found", { status: 404 })
        const ok = await testDeviceConnection({
            ip: ip || existing.ip,
            port: port || existing.port,
            username: username || existing.username,
            password: password && password !== "••••••••" ? password : existing.password,
        })
        return NextResponse.json({ ok })
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (ip !== undefined) updateData.ip = ip
    if (port !== undefined) updateData.port = parseInt(port)
    if (username !== undefined) updateData.username = username
    if (password && password !== "••••••••") updateData.password = password
    if (enabled !== undefined) updateData.enabled = enabled

    const updated = await prisma.hardwareDevice.update({
        where: { id },
        data: updateData,
    })

    return NextResponse.json({ ...updated, password: "••••••••" })
}

// DELETE device
export async function DELETE(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return new NextResponse("Unauthorized", { status: 401 })
    if (session.user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")
    if (!id) return new NextResponse("id required", { status: 400 })

    await prisma.hardwareDevice.delete({ where: { id } })
    return NextResponse.json({ ok: true })
}
