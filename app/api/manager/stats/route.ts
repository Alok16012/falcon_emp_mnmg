import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { Role } from "@prisma/client"
import { startOfMonth, endOfMonth, subDays } from "date-fns"

export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session || (session.user.role !== Role.MANAGER && session.user.role !== Role.ADMIN)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const now = new Date()
        const monthStart = startOfMonth(now)
        const monthEnd = endOfMonth(now)
        const sevenDaysAgo = subDays(now, 7)

        const [
            pendingApprovals,
            activeAssignments,
            completedThisMonth,
            recentPending,
            recentAssignments,
            overdueInspections,
            projectsWithStats
        ] = await Promise.all([
            prisma.inspection.count({ where: { status: "pending" } }),
            prisma.assignment.count({ where: { status: "active" } }),
            prisma.inspection.count({ where: { status: "approved", approvedAt: { gte: monthStart, lte: monthEnd } } }),
            prisma.inspection.findMany({
                where: { status: "pending" },
                take: 5,
                orderBy: { submittedAt: "desc" },
                include: {
                    assignment: { include: { project: { include: { company: true } } } },
                    submitter: { select: { name: true } }
                }
            }),
            prisma.assignment.findMany({
                take: 5,
                orderBy: { createdAt: "desc" },
                include: {
                    project: true,
                    inspectionBoy: { select: { name: true } }
                }
            }),
            // Inspections pending > 7 days = overdue
            prisma.inspection.count({
                where: { status: "pending", submittedAt: { lte: sevenDaysAgo } }
            }),
            // Projects with high sent-back rates (risk indicator)
            prisma.project.findMany({
                take: 10,
                select: {
                    id: true,
                    name: true,
                    company: { select: { name: true } },
                    assignments: {
                        select: {
                            inspections: {
                                select: { status: true, sentBackCount: true }
                            }
                        }
                    }
                }
            })
        ])

        // Calculate risk alerts
        const riskAlerts = projectsWithStats
            .map(p => {
                const allInspections = p.assignments.flatMap(a => a.inspections)
                const total = allInspections.length
                const rejected = allInspections.filter(i => i.status === "rejected").length
                const avgSentBack = total > 0
                    ? allInspections.reduce((s, i) => s + (i.sentBackCount || 0), 0) / total
                    : 0
                const rejectionRate = total > 0 ? (rejected / total) * 100 : 0

                return {
                    projectId: p.id,
                    projectName: p.name,
                    companyName: p.company.name,
                    total,
                    rejected,
                    rejectionRate: parseFloat(rejectionRate.toFixed(1)),
                    avgSentBack: parseFloat(avgSentBack.toFixed(1)),
                    isAtRisk: rejectionRate > 20 || avgSentBack > 1.5
                }
            })
            .filter(p => p.isAtRisk && p.total > 0)
            .sort((a, b) => b.rejectionRate - a.rejectionRate)
            .slice(0, 5)

        return NextResponse.json({
            pendingApprovals,
            activeAssignments,
            completedThisMonth,
            overdueInspections,
            riskAlerts,
            recentPending: recentPending.map(i => ({
                id: i.id,
                projectName: i.assignment.project.name,
                companyName: i.assignment.project.company.name,
                inspectorName: i.submitter.name,
                submittedAt: i.submittedAt
            })),
            recentAssignments: recentAssignments.map(a => ({
                id: a.id,
                projectName: a.project.name,
                inspectorName: a.inspectionBoy.name,
                status: a.status,
                createdAt: a.createdAt
            }))
        })
    } catch (error) {
        console.error("MANAGER_STATS_ERROR", error)
        return NextResponse.json({ error: "Internal Error" }, { status: 500 })
    }
}
