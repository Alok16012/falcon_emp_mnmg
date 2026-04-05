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

        const review = await prisma.performanceReview.findUnique({
            where: { id: params.id },
            include: {
                employee: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        employeeId: true,
                        designation: true,
                        photo: true,
                        branch: { select: { name: true } },
                    },
                },
            },
        })

        if (!review) return new NextResponse("Not Found", { status: 404 })

        return NextResponse.json(review)
    } catch (error) {
        console.error("[PERFORMANCE_GET_ID]", error)
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
        const { status, kpis, strengths, improvements, goals, rating, totalScore } = body

        const updateData: Record<string, unknown> = {}
        if (kpis !== undefined) updateData.kpis = kpis
        if (strengths !== undefined) updateData.strengths = strengths
        if (improvements !== undefined) updateData.improvements = improvements
        if (goals !== undefined) updateData.goals = goals
        if (rating !== undefined) updateData.rating = rating
        if (totalScore !== undefined) updateData.totalScore = totalScore
        if (status !== undefined) {
            updateData.status = status
            if (status === "SUBMITTED") updateData.submittedAt = new Date()
            if (status === "ACKNOWLEDGED") updateData.acknowledgedAt = new Date()
        }

        const review = await prisma.performanceReview.update({
            where: { id: params.id },
            data: updateData,
        })

        return NextResponse.json(review)
    } catch (error) {
        console.error("[PERFORMANCE_PUT]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
