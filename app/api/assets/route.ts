import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return new NextResponse("Unauthorized", { status: 401 })
        if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
            return new NextResponse("Forbidden", { status: 403 })
        }

        const { searchParams } = new URL(req.url)
        const search = searchParams.get("search")
        const category = searchParams.get("category")

        const where: Record<string, unknown> = {}
        if (category && category !== "All") where.category = category
        if (search) {
            where.OR = [
                { name: { contains: search, mode: "insensitive" } },
                { serialNo: { contains: search, mode: "insensitive" } },
            ]
        }

        const assets = await prisma.asset.findMany({
            where,
            orderBy: { createdAt: "desc" },
        })

        return NextResponse.json(assets)
    } catch (error) {
        console.error("[ASSETS_GET]", error)
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
        const { name, category, serialNo, totalQty } = body

        if (!name || !category || !totalQty) {
            return new NextResponse("name, category, and totalQty are required", { status: 400 })
        }

        const qty = parseInt(totalQty)
        if (isNaN(qty) || qty < 1) {
            return new NextResponse("totalQty must be a positive integer", { status: 400 })
        }

        const asset = await prisma.asset.create({
            data: {
                name,
                category,
                serialNo: serialNo || null,
                totalQty: qty,
                availableQty: qty,
            },
        })

        return NextResponse.json(asset)
    } catch (error) {
        console.error("[ASSETS_POST]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
