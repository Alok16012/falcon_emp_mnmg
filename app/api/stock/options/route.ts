import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

const VALID_TYPES = ["color", "sizeUnit", "qtyUnit"] as const

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return new NextResponse("Unauthorized", { status: 401 })
        if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
            return new NextResponse("Forbidden", { status: 403 })
        }

        const { searchParams } = new URL(req.url)
        const type = searchParams.get("type")

        const options = await prisma.stockOption.findMany({
            where: type && VALID_TYPES.includes(type as never) ? { type } : {},
            orderBy: { value: "asc" },
        })

        return NextResponse.json(options)
    } catch (error) {
        console.error("[STOCK_OPTIONS_GET]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return new NextResponse("Unauthorized", { status: 401 })
        if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
            return new NextResponse("Forbidden", { status: 403 })
        }

        const body = await req.json()
        const { type, value } = body

        if (!type || !VALID_TYPES.includes(type)) {
            return new NextResponse("Invalid option type", { status: 400 })
        }
        if (!value || !String(value).trim()) {
            return new NextResponse("Value is required", { status: 400 })
        }

        const option = await prisma.stockOption.upsert({
            where: { type_value: { type, value: String(value).trim() } },
            update: {},
            create: { type, value: String(value).trim() },
        })

        return NextResponse.json(option, { status: 201 })
    } catch (error) {
        console.error("[STOCK_OPTIONS_POST]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}

export async function DELETE(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return new NextResponse("Unauthorized", { status: 401 })
        if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
            return new NextResponse("Forbidden", { status: 403 })
        }

        const { searchParams } = new URL(req.url)
        const type = searchParams.get("type")
        const value = searchParams.get("value")

        if (!type || !VALID_TYPES.includes(type as never) || !value) {
            return new NextResponse("type and value are required", { status: 400 })
        }

        await prisma.stockOption.deleteMany({ where: { type, value } })
        return new NextResponse(null, { status: 204 })
    } catch (error) {
        console.error("[STOCK_OPTIONS_DELETE]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
