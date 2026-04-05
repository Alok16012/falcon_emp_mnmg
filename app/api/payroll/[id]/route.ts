import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

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
        const { status } = body

        if (!status || !["DRAFT", "PROCESSED", "PAID"].includes(status)) {
            return new NextResponse("Valid status required", { status: 400 })
        }

        const payroll = await prisma.payroll.update({
            where: { id: params.id },
            data: { status },
        })

        return NextResponse.json(payroll)
    } catch (error) {
        console.error("[PAYROLL_PUT]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
