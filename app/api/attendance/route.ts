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
        const employeeId = searchParams.get("employeeId")
        const dateStr = searchParams.get("date")
        const month = searchParams.get("month")
        const year = searchParams.get("year")
        const branchId = searchParams.get("branchId")

        const where: Record<string, unknown> = {}
        if (employeeId) where.employeeId = employeeId

        if (dateStr) {
            const date = new Date(dateStr)
            const nextDay = new Date(date)
            nextDay.setDate(nextDay.getDate() + 1)
            where.date = { gte: date, lt: nextDay }
        } else if (month && year) {
            const startDate = new Date(parseInt(year), parseInt(month) - 1, 1)
            const endDate = new Date(parseInt(year), parseInt(month), 1)
            where.date = { gte: startDate, lt: endDate }
        }

        if (branchId) {
            where.employee = { branchId }
        }

        const attendances = await prisma.attendance.findMany({
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
                    },
                },
                site: { select: { id: true, name: true } },
            },
            orderBy: { date: "desc" },
        })

        return NextResponse.json(attendances)
    } catch (error) {
        console.error("[ATTENDANCE_GET]", error)
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
        const {
            employeeId, siteId, date, checkIn, checkOut,
            checkInLat, checkInLng, checkOutLat, checkOutLng,
            status, overtimeHrs, remarks,
        } = body

        if (!employeeId || !date) {
            return new NextResponse("employeeId and date are required", { status: 400 })
        }

        const attendanceDate = new Date(date)
        const nextDay = new Date(attendanceDate)
        nextDay.setDate(nextDay.getDate() + 1)

        // Upsert: update existing or create new
        const existing = await prisma.attendance.findFirst({
            where: {
                employeeId,
                date: { gte: attendanceDate, lt: nextDay },
            },
        })

        let attendance
        if (existing) {
            attendance = await prisma.attendance.update({
                where: { id: existing.id },
                data: {
                    siteId: siteId || null,
                    checkIn: checkIn ? new Date(checkIn) : null,
                    checkOut: checkOut ? new Date(checkOut) : null,
                    checkInLat, checkInLng, checkOutLat, checkOutLng,
                    status: status || "PRESENT",
                    overtimeHrs: overtimeHrs || 0,
                    remarks,
                },
            })
        } else {
            attendance = await prisma.attendance.create({
                data: {
                    employeeId,
                    siteId: siteId || null,
                    date: attendanceDate,
                    checkIn: checkIn ? new Date(checkIn) : null,
                    checkOut: checkOut ? new Date(checkOut) : null,
                    checkInLat, checkInLng, checkOutLat, checkOutLng,
                    status: status || "PRESENT",
                    overtimeHrs: overtimeHrs || 0,
                    remarks,
                },
            })
        }

        return NextResponse.json(attendance)
    } catch (error) {
        console.error("[ATTENDANCE_POST]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
