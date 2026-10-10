import { getServerSession } from "next-auth"
import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { canAccessModule } from "@/lib/modules"
import { StockError, actorFromSession, adjustStock, cleanRemarks, cleanRequestId, parseAmount, updateStockItem } from "@/lib/stockLedger"

export async function PATCH(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return new NextResponse("Unauthorized", { status: 401 })
        if (!canAccessModule(session.user, "stock")) {
            return new NextResponse("Forbidden", { status: 403 })
        }

        const body = await req.json()

        // Quantity adjustment via delta (+/- buttons): { adjust: number, remarks?, requestId? }
        // Locked + logged atomically in lib/stockLedger.
        if (body.adjust !== undefined) {
            const delta = parseAmount(body.adjust)
            const { item, duplicate } = await adjustStock({
                itemId: params.id,
                delta,
                actor: actorFromSession(session.user),
                remarks: cleanRemarks(body.remarks),
                requestId: cleanRequestId(body.requestId),
            })
            return NextResponse.json({ ...item, duplicate })
        }

        const data: Record<string, unknown> = {}
        if (body.itemCode !== undefined) data.itemCode = String(body.itemCode).trim()
        if (body.itemName !== undefined) data.itemName = String(body.itemName).trim()
        if (body.color !== undefined) data.color = body.color ? String(body.color).trim() : null
        if (body.size !== undefined) data.size = body.size ? String(body.size).trim() : null
        if (body.sizeUnit !== undefined) data.sizeUnit = body.sizeUnit ? String(body.sizeUnit).trim() : null
        if (body.quantity !== undefined && body.quantity !== "") {
            const q = parseAmount(body.quantity)
            if (q < 0) return new NextResponse("Quantity cannot be negative", { status: 400 })
            data.quantity = q
        }
        if (body.quantityUnit !== undefined) data.quantityUnit = String(body.quantityUnit).trim()
        if (body.minStock !== undefined) data.minStock = parseFloat(body.minStock)
        if (body.rackNumber !== undefined) data.rackNumber = body.rackNumber ? String(body.rackNumber).trim() : null
        if (body.ratePerUnit !== undefined) data.ratePerUnit = body.ratePerUnit !== null && body.ratePerUnit !== "" ? parseFloat(body.ratePerUnit) : null

        if (Object.keys(data).length === 0) {
            return new NextResponse("No fields to update", { status: 400 })
        }

        const item = await updateStockItem(
            params.id,
            data as Prisma.StockItemUpdateInput & { quantity?: number },
            actorFromSession(session.user),
        )

        return NextResponse.json(item)
    } catch (error) {
        if (error instanceof StockError) return new NextResponse(error.message, { status: error.status })
        console.error("[STOCK_PATCH]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return new NextResponse("Unauthorized", { status: 401 })
        if (!canAccessModule(session.user, "stock")) {
            return new NextResponse("Forbidden", { status: 403 })
        }

        // StockTransaction.stockItemId is ON DELETE SET NULL, so the item's
        // audit history (with its snapshotted code/name) survives the delete.
        await prisma.stockItem.delete({ where: { id: params.id } })
        return new NextResponse(null, { status: 204 })
    } catch (error) {
        console.error("[STOCK_DELETE]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
