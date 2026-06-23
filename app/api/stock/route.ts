import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return new NextResponse("Unauthorized", { status: 401 })
        if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
            return new NextResponse("Forbidden", { status: 403 })
        }

        const items = await prisma.stockItem.findMany({
            orderBy: { createdAt: "desc" },
        })

        return NextResponse.json(items)
    } catch (error) {
        console.error("[STOCK_GET]", error)
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
        const { itemCode, itemName, color, size, sizeUnit, quantity, quantityUnit, minStock, rackNumber, ratePerUnit } = body

        if (!itemCode || !itemName) {
            return new NextResponse("Item code and name are required", { status: 400 })
        }

        const existing = await prisma.stockItem.findUnique({
            where: { itemCode: String(itemCode).trim() },
        })
        if (existing) {
            return new NextResponse("Item code already exists", { status: 409 })
        }

        const item = await prisma.stockItem.create({
            data: {
                itemCode: String(itemCode).trim(),
                itemName: String(itemName).trim(),
                color: color ? String(color).trim() : null,
                size: size ? String(size).trim() : null,
                sizeUnit: sizeUnit ? String(sizeUnit).trim() : null,
                quantity: quantity != null ? parseFloat(quantity) : 0,
                quantityUnit: quantityUnit ? String(quantityUnit).trim() : "pcs",
                minStock: minStock != null ? parseFloat(minStock) : 0,
                rackNumber: rackNumber ? String(rackNumber).trim() : null,
                ratePerUnit: ratePerUnit != null && ratePerUnit !== "" ? parseFloat(ratePerUnit) : null,
            },
        })

        return NextResponse.json(item, { status: 201 })
    } catch (error) {
        console.error("[STOCK_POST]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
