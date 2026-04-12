import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return new NextResponse("Unauthorized", { status: 401 })

        const { searchParams } = new URL(req.url)
        const employeeId = searchParams.get("employeeId")
        const status = searchParams.get("status")
        const month = searchParams.get("month") // MM
        const year = searchParams.get("year")   // YYYY

        const where: Record<string, unknown> = { type: "ADVANCE" }
        if (employeeId) where.employeeId = employeeId
        if (status) where.status = status
        if (month) where.monthToImpact = parseInt(month)
        if (year) where.yearToImpact = parseInt(year)

        const advances = await prisma.advanceAndReimbursement.findMany({
            where,
            include: {
                employee: {
                    select: {
                        id: true, firstName: true, lastName: true,
                        employeeId: true, designation: true,
                        employeeCategory: true,
                        department: { select: { name: true } },
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        })

        return NextResponse.json(advances)
    } catch (err) {
        console.error("[ADVANCES_GET]", err)
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

        const { employeeId, amount, reason, monthToImpact, yearToImpact } = await req.json()

        if (!employeeId || !amount || !monthToImpact || !yearToImpact) {
            return new NextResponse("employeeId, amount, monthToImpact, yearToImpact required", { status: 400 })
        }

        const advance = await prisma.advanceAndReimbursement.create({
            data: {
                employeeId,
                type: "ADVANCE",
                amount: parseFloat(amount),
                reason: reason || null,
                monthToImpact: parseInt(monthToImpact),
                yearToImpact: parseInt(yearToImpact),
                status: "APPROVED",
                approvedBy: session.user.id,
            },
            include: {
                employee: { select: { firstName: true, lastName: true, employeeId: true } },
            },
        })

        return NextResponse.json(advance)
    } catch (err) {
        console.error("[ADVANCES_POST]", err)
        return new NextResponse("Internal Error", { status: 500 })
    }
}

export async function DELETE(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return new NextResponse("Unauthorized", { status: 401 })
        if (session.user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 })

        const { searchParams } = new URL(req.url)
        const id = searchParams.get("id")
        if (!id) return new NextResponse("id required", { status: 400 })

        await prisma.advanceAndReimbursement.delete({ where: { id } })
        return NextResponse.json({ ok: true })
    } catch (err) {
        console.error("[ADVANCES_DELETE]", err)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
