import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { Role } from "@prisma/client"

export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session || (session.user.role !== Role.ADMIN && session.user.role !== Role.MANAGER)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get all inspectors with their inspection stats
    const inspectors = await prisma.user.findMany({
        where: { role: Role.INSPECTION_BOY, isActive: true },
        select: {
            id: true,
            name: true,
            email: true,
            inspections: {
                select: {
                    id: true,
                    status: true,
                    submittedAt: true,
                    approvedAt: true,
                    createdAt: true,
                    sentBackCount: true,
                    startedAt: true,
                    assignment: {
                        select: {
                            project: {
                                select: { name: true, company: { select: { name: true } } }
                            }
                        }
                    }
                }
            }
        }
    })

    const analytics = inspectors.map(inspector => {
        const inspections = inspector.inspections
        const total = inspections.length
        const approved = inspections.filter(i => i.status === "approved").length
        const rejected = inspections.filter(i => i.status === "rejected").length
        const pending = inspections.filter(i => i.status === "pending").length
        const draft = inspections.filter(i => i.status === "draft").length

        const avgSentBack = total > 0
            ? inspections.reduce((sum, i) => sum + (i.sentBackCount || 0), 0) / total
            : 0

        // Average turnaround time (submitted → approved)
        const completedWithTimes = inspections.filter(i => i.submittedAt && i.approvedAt)
        const avgTurnaround = completedWithTimes.length > 0
            ? completedWithTimes.reduce((sum, i) => {
                const diff = new Date(i.approvedAt!).getTime() - new Date(i.submittedAt!).getTime()
                return sum + diff / (1000 * 60 * 60) // hours
              }, 0) / completedWithTimes.length
            : 0

        const acceptanceRate = total > 0 ? (approved / total) * 100 : 0

        return {
            id: inspector.id,
            name: inspector.name,
            email: inspector.email,
            total,
            approved,
            rejected,
            pending,
            draft,
            acceptanceRate: parseFloat(acceptanceRate.toFixed(1)),
            avgSentBack: parseFloat(avgSentBack.toFixed(2)),
            avgTurnaroundHours: parseFloat(avgTurnaround.toFixed(1)),
            recentInspections: inspections
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 3)
                .map(i => ({
                    status: i.status,
                    project: i.assignment?.project?.name || "—",
                    company: i.assignment?.project?.company?.name || "—",
                    date: i.submittedAt || i.createdAt
                }))
        }
    })

    // Sort by acceptance rate descending
    analytics.sort((a, b) => b.acceptanceRate - a.acceptanceRate)

    // Monthly trend (last 6 months)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const recentInspections = await prisma.inspection.findMany({
        where: { submittedAt: { gte: sixMonthsAgo } },
        select: { submittedAt: true, status: true }
    })

    const monthlyMap: Record<string, { submitted: number; approved: number }> = {}
    recentInspections.forEach(i => {
        if (!i.submittedAt) return
        const key = `${new Date(i.submittedAt).getFullYear()}-${String(new Date(i.submittedAt).getMonth() + 1).padStart(2, "0")}`
        if (!monthlyMap[key]) monthlyMap[key] = { submitted: 0, approved: 0 }
        monthlyMap[key].submitted++
        if (i.status === "approved") monthlyMap[key].approved++
    })

    const monthlyTrend = Object.entries(monthlyMap)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, counts]) => ({
            month,
            submitted: counts.submitted,
            approved: counts.approved,
            rate: counts.submitted > 0 ? parseFloat(((counts.approved / counts.submitted) * 100).toFixed(1)) : 0
        }))

    return NextResponse.json({ inspectors: analytics, monthlyTrend })
}
