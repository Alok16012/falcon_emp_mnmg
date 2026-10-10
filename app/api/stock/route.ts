import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { canAccessModule } from "@/lib/modules"
import { StockError, actorFromSession, createStockItem, parseAmount } from "@/lib/stockLedger"

export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return new NextResponse("Unauthorized", { status: 401 })
        if (!canAccessModule(session.user, "stock")) {
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
        if (!canAccessModule(session.user, "stock")) {
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

        const initialQty = quantity != null && quantity !== "" ? parseAmount(quantity) : 0
        if (initialQty < 0) return new NextResponse("Quantity cannot be negative", { status: 400 })

        const item = await createStockItem({
            itemCode: String(itemCode).trim(),
            itemName: String(itemName).trim(),
            color: color ? String(color).trim() : null,
            size: size ? String(size).trim() : null,
            sizeUnit: sizeUnit ? String(sizeUnit).trim() : null,
            quantity: initialQty,
            quantityUnit: quantityUnit ? String(quantityUnit).trim() : "pcs",
            minStock: minStock != null ? parseFloat(minStock) : 0,
            rackNumber: rackNumber ? String(rackNumber).trim() : null,
            ratePerUnit: ratePerUnit != null && ratePerUnit !== "" ? parseFloat(ratePerUnit) : null,
        }, actorFromSession(session.user))

        return NextResponse.json(item, { status: 201 })
    } catch (error) {
        if (error instanceof StockError) return new NextResponse(error.message, { status: error.status })
        console.error("[STOCK_POST]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
