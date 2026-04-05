import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return new NextResponse("Unauthorized", { status: 401 })
        if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
            return new NextResponse("Forbidden", { status: 403 })
        }

        const { searchParams } = new URL(req.url)
        const period = searchParams.get("period")
        const rating = searchParams.get("rating")
        const employeeId = searchParams.get("employeeId")

        const where: Record<string, unknown> = {}
        if (period) where.period = period
        if (rating) where.rating = rating
        if (employeeId) where.employeeId = employeeId

        const reviews = await prisma.performanceReview.findMany({
            where,
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
            orderBy: { createdAt: "desc" },
        })

        return NextResponse.json(reviews)
    } catch (error) {
        console.error("[PERFORMANCE_GET]", error)
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
        const { employeeId, period, reviewType, kpis, strengths, improvements, goals } = body

        if (!employeeId || !period) {
            return new NextResponse("employeeId and period are required", { status: 400 })
        }

        // Calculate total score from kpis
        const kpiArray = Array.isArray(kpis) ? kpis : []
        const totalScore = kpiArray.reduce((sum: number, kpi: { score?: number; weight?: number }) => {
            const score = kpi.score || 0
            const weight = kpi.weight || 20
            return sum + (score * weight) / 100
        }, 0)

        const rating = totalScore >= 80 ? "Excellent" :
            totalScore >= 60 ? "Good" :
            totalScore >= 40 ? "Average" :
            totalScore >= 20 ? "Below Average" : "Poor"

        const review = await prisma.performanceReview.create({
            data: {
                employeeId,
                reviewerId: session.user.id,
                period,
                reviewType: reviewType || "QUARTERLY",
                kpis,
                totalScore,
                rating,
                strengths,
                improvements,
                goals,
                status: "DRAFT",
            },
        })

        return NextResponse.json(review)
    } catch (error) {
        console.error("[PERFORMANCE_POST]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
