import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    try {
        const now = new Date()
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const todayEnd = new Date(todayStart)
        todayEnd.setDate(todayEnd.getDate() + 1)
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)

        const [
            totalEmployees,
            labourCount,
            staffCount,
            todayAttendance,
            pendingLeaves,
            thisMonthAdvances,
            recentEmployees,
        ] = await Promise.all([
            prisma.employee.count({ where: { status: "ACTIVE" } }),
            prisma.employee.count({ where: { status: "ACTIVE", employeeCategory: "LABOUR" } }),
            prisma.employee.count({ where: { status: "ACTIVE", employeeCategory: "STAFF" } }),
            prisma.attendance.findMany({
                where: { date: { gte: todayStart, lt: todayEnd } },
                select: { status: true },
            }),
            prisma.leave.count({ where: { status: "PENDING" } }),
            prisma.advanceAndReimbursement.aggregate({
                where: {
                    type: "ADVANCE",
                    monthToImpact: now.getMonth() + 1,
                    yearToImpact: now.getFullYear(),
                },
                _sum: { amount: true },
                _count: true,
            }),
            prisma.employee.findMany({
                where: { status: "ACTIVE" },
                orderBy: { createdAt: "desc" },
                take: 6,
                select: {
                    id: true, firstName: true, lastName: true,
                    employeeId: true, designation: true,
                    employeeCategory: true, dailyRate: true, basicSalary: true,
                    dateOfJoining: true,
                    department: { select: { name: true } },
                },
            }),
        ])

        const presentToday = todayAttendance.filter(a => a.status === "PRESENT").length
        const halfDayToday = todayAttendance.filter(a => a.status === "HALF_DAY").length
        const absentToday = totalEmployees - presentToday - halfDayToday
        const attendanceMarked = todayAttendance.length

        return NextResponse.json({
            totalEmployees,
            labourCount,
            staffCount,
            attendance: {
                marked: attendanceMarked,
                present: presentToday,
                halfDay: halfDayToday,
                absent: absentToday > 0 ? absentToday : 0,
            },
            pendingLeaves,
            thisMonthAdvances: {
                total: thisMonthAdvances._sum.amount || 0,
                count: thisMonthAdvances._count,
            },
            recentEmployees,
        })
    } catch (error) {
        console.error("ADMIN_STATS_ERROR", error)
        return NextResponse.json({ error: "Failed to load stats" }, { status: 500 })
    }
}
