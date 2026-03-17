import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { Role } from "@prisma/client"
import { startOfMonth, endOfMonth } from "date-fns"

export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== Role.ADMIN) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const now = new Date()
        const monthStart = startOfMonth(now)
        const monthEnd = endOfMonth(now)

        const [
            totalCompanies,
            totalProjects,
            pendingApprovals,
            totalUsers,
            recentInspections,
            monthInspections
        ] = await Promise.all([
            prisma.company.count(),
            prisma.project.count(),
            prisma.inspection.count({ where: { status: "pending" } }),
            prisma.user.count(),
            prisma.inspection.findMany({
                take: 5,
                orderBy: { submittedAt: "desc" },
                where: { status: { not: "draft" } },
                include: {
                    assignment: {
                        include: {
                            project: true
                        }
                    },
                    submitter: {
                        select: { name: true }
                    }
                }
            }),
            prisma.inspection.findMany({
                where: {
                    submittedAt: {
                        gte: monthStart,
                        lte: monthEnd
                    }
                },
                select: { status: true }
            })
        ])

        const approved = monthInspections.filter(i => i.status === "approved").length
        const rejected = monthInspections.filter(i => i.status === "rejected").length
        const totalThisMonth = monthInspections.length
        const approvalRate = totalThisMonth > 0 ? (approved / totalThisMonth) * 100 : 0

        return NextResponse.json({
            totalCompanies,
            totalProjects,
            pendingApprovals,
            totalUsers,
            recentInspections: recentInspections.map(i => ({
                id: i.id,
                projectName: i.assignment.project.name,
                inspectorName: i.submitter.name,
                submittedAt: i.submittedAt,
                status: i.status
            })),
            thisMonth: {
                totalInspections: totalThisMonth,
                approved,
                rejected,
                approvalRate: Math.round(approvalRate)
            }
        }, {
            headers: {
                // Cache for 30s, serve stale up to 60s while revalidating in background
                "Cache-Control": "private, s-maxage=30, stale-while-revalidate=60"
            }
        })
    } catch (error) {
        console.error("ADMIN_STATS_ERROR", error)
        return NextResponse.json({
            error: "Database Connection Error",
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 })
    }
}
