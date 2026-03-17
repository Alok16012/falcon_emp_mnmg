import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { Role } from "@prisma/client"
import { startOfMonth, endOfMonth } from "date-fns"

export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session || (session.user.role !== Role.MANAGER && session.user.role !== Role.ADMIN)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const now = new Date()
        const monthStart = startOfMonth(now)
        const monthEnd = endOfMonth(now)

        const [
            pendingApprovals,
            activeAssignments,
            completedThisMonth,
            recentPending,
            recentAssignments
        ] = await Promise.all([
            prisma.inspection.count({ where: { status: "pending" } }),
            prisma.assignment.count({ where: { status: "active" } }),
            prisma.inspection.count({
                where: {
                    status: "approved",
                    approvedAt: { gte: monthStart, lte: monthEnd }
                }
            }),
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
            })
        ])

        return NextResponse.json({
            pendingApprovals,
            activeAssignments,
            completedThisMonth,
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
