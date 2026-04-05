import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

export async function GET(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return new NextResponse("Unauthorized", { status: 401 })
        if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
            return new NextResponse("Forbidden", { status: 403 })
        }

        const asset = await prisma.asset.findUnique({
            where: { id: params.id },
            include: {
                assignments: {
                    include: {
                        employee: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                employeeId: true,
                            },
                        },
                    },
                },
            },
        })

        if (!asset) return new NextResponse("Asset not found", { status: 404 })
        return NextResponse.json(asset)
    } catch (error) {
        console.error("[ASSET_GET]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}

export async function PUT(
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
        const { name, category, serialNo, totalQty } = body

        const existing = await prisma.asset.findUnique({ where: { id: params.id } })
        if (!existing) return new NextResponse("Asset not found", { status: 404 })

        const updateData: Record<string, unknown> = {}
        if (name !== undefined) updateData.name = name
        if (category !== undefined) updateData.category = category
        if (serialNo !== undefined) updateData.serialNo = serialNo || null
        if (totalQty !== undefined) {
            const newTotal = parseInt(totalQty)
            if (isNaN(newTotal) || newTotal < 1) {
                return new NextResponse("totalQty must be a positive integer", { status: 400 })
            }
            const assigned = existing.totalQty - existing.availableQty
            if (newTotal < assigned) {
                return new NextResponse(`Cannot reduce totalQty below assigned count (${assigned})`, { status: 400 })
            }
            updateData.totalQty = newTotal
            updateData.availableQty = newTotal - assigned
        }

        const asset = await prisma.asset.update({
            where: { id: params.id },
            data: updateData,
        })

        return NextResponse.json(asset)
    } catch (error) {
        console.error("[ASSET_PUT]", error)
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

        const existing = await prisma.asset.findUnique({
            where: { id: params.id },
            include: { assignments: { where: { returnedAt: null } } },
        })
        if (!existing) return new NextResponse("Asset not found", { status: 404 })
        if (existing.assignments.length > 0) {
            return new NextResponse("Cannot delete asset with active assignments", { status: 400 })
        }

        await prisma.asset.delete({ where: { id: params.id } })
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("[ASSET_DELETE]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
