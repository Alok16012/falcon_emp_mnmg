import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

const VALID_STATUS = ["ACTIVE", "INACTIVE", "PENDING"] as const

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return new NextResponse("Unauthorized", { status: 401 })
        if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
            return new NextResponse("Forbidden", { status: 403 })
        }

        const { searchParams } = new URL(req.url)
        const status = searchParams.get("status")

        const inquiries = await prisma.productInquiry.findMany({
            where: status && VALID_STATUS.includes(status as never) ? { status: status as never } : {},
            orderBy: { createdAt: "desc" },
        })

        return NextResponse.json(inquiries)
    } catch (error) {
        console.error("[INQUIRIES_GET]", error)
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
        const { name, productName, quantity, rate, location, partyName, status } = body

        if (!name || !productName || quantity == null || rate == null || !location || !partyName) {
            return new NextResponse("Missing required fields", { status: 400 })
        }

        const inquiry = await prisma.productInquiry.create({
            data: {
                name: String(name).trim(),
                productName: String(productName).trim(),
                quantity: parseInt(quantity, 10),
                rate: parseFloat(rate),
                location: String(location).trim(),
                partyName: String(partyName).trim(),
                status: VALID_STATUS.includes(status) ? status : "PENDING",
            },
        })

        return NextResponse.json(inquiry, { status: 201 })
    } catch (error) {
        console.error("[INQUIRIES_POST]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
