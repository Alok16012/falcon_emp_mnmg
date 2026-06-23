import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

export async function PATCH(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return new NextResponse("Unauthorized", { status: 401 })
        if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
            return new NextResponse("Forbidden", { status: 403 })
        }

        const body = await req.json()

        // Quantity adjustment via delta (+/- buttons): { adjust: number }
        if (body.adjust !== undefined) {
            const delta = parseFloat(body.adjust)
            if (Number.isNaN(delta)) {
                return new NextResponse("Invalid adjust value", { status: 400 })
            }
            const current = await prisma.stockItem.findUnique({ where: { id: params.id } })
            if (!current) return new NextResponse("Not found", { status: 404 })
            const next = current.quantity + delta
            const item = await prisma.stockItem.update({
                where: { id: params.id },
                data: { quantity: next < 0 ? 0 : next },
            })
            return NextResponse.json(item)
        }

        const data: Record<string, unknown> = {}
        if (body.itemCode !== undefined) data.itemCode = String(body.itemCode).trim()
        if (body.itemName !== undefined) data.itemName = String(body.itemName).trim()
        if (body.color !== undefined) data.color = body.color ? String(body.color).trim() : null
        if (body.size !== undefined) data.size = body.size ? String(body.size).trim() : null
        if (body.sizeUnit !== undefined) data.sizeUnit = body.sizeUnit ? String(body.sizeUnit).trim() : null
        if (body.quantity !== undefined) data.quantity = parseFloat(body.quantity)
        if (body.quantityUnit !== undefined) data.quantityUnit = String(body.quantityUnit).trim()
        if (body.minStock !== undefined) data.minStock = parseFloat(body.minStock)

        if (Object.keys(data).length === 0) {
            return new NextResponse("No fields to update", { status: 400 })
        }

        const item = await prisma.stockItem.update({
            where: { id: params.id },
            data,
        })

        return NextResponse.json(item)
    } catch (error) {
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
        if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
            return new NextResponse("Forbidden", { status: 403 })
        }

        await prisma.stockItem.delete({ where: { id: params.id } })
        return new NextResponse(null, { status: 204 })
    } catch (error) {
        console.error("[STOCK_DELETE]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
