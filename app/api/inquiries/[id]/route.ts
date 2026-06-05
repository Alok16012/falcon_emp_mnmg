import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

const VALID_STATUS = ["ACTIVE", "INACTIVE", "PENDING"] as const

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
        const data: Record<string, unknown> = {}

        if (body.status !== undefined) {
            if (!VALID_STATUS.includes(body.status)) {
                return new NextResponse("Invalid status", { status: 400 })
            }
            data.status = body.status
        }
        if (body.name !== undefined) data.name = String(body.name).trim()
        if (body.productName !== undefined) data.productName = String(body.productName).trim()
        if (body.quantity !== undefined) data.quantity = parseInt(body.quantity, 10)
        if (body.rate !== undefined) data.rate = parseFloat(body.rate)
        if (body.location !== undefined) data.location = String(body.location).trim()
        if (body.partyName !== undefined) data.partyName = String(body.partyName).trim()

        if (Object.keys(data).length === 0) {
            return new NextResponse("No fields to update", { status: 400 })
        }

        const inquiry = await prisma.productInquiry.update({
            where: { id: params.id },
            data,
        })

        return NextResponse.json(inquiry)
    } catch (error) {
        console.error("[INQUIRY_PATCH]", error)
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

        await prisma.productInquiry.delete({ where: { id: params.id } })
        return new NextResponse(null, { status: 204 })
    } catch (error) {
        console.error("[INQUIRY_DELETE]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
