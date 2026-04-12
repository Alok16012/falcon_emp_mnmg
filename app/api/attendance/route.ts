import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return new NextResponse("Unauthorized", { status: 401 })

        const { searchParams } = new URL(req.url)
        const date = searchParams.get("date") // YYYY-MM-DD
        const month = searchParams.get("month") // YYYY-MM
        const employeeId = searchParams.get("employeeId")

        const where: Record<string, unknown> = {}

        if (employeeId) where.employeeId = employeeId

        if (date) {
            const d = new Date(date)
            const next = new Date(d)
            next.setDate(next.getDate() + 1)
            where.date = { gte: d, lt: next }
        } else if (month) {
            const [yr, mo] = month.split("-").map(Number)
            where.date = {
                gte: new Date(yr, mo - 1, 1),
                lt: new Date(yr, mo, 1),
            }
        }

        const records = await prisma.attendance.findMany({
            where,
            include: {
                employee: {
                    select: {
                        id: true, firstName: true, lastName: true,
                        employeeId: true, designation: true,
                        employeeCategory: true, dailyRate: true, basicSalary: true,
                        department: { select: { name: true } },
                    },
                },
            },
            orderBy: { date: "desc" },
        })

        return NextResponse.json(records)
    } catch (err) {
        console.error("[ATTENDANCE_GET]", err)
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
        // Bulk upsert: [{ employeeId, date, status, remarks }]
        const records: { employeeId: string; date: string; status: string; remarks?: string }[] = body

        if (!Array.isArray(records) || records.length === 0) {
            return new NextResponse("Invalid payload", { status: 400 })
        }

        const results = await Promise.all(
            records.map(async (r) => {
                const d = new Date(r.date)
                const next = new Date(d)
                next.setDate(next.getDate() + 1)

                const existing = await prisma.attendance.findFirst({
                    where: { employeeId: r.employeeId, date: { gte: d, lt: next } },
                })

                if (existing) {
                    return prisma.attendance.update({
                        where: { id: existing.id },
                        data: { status: r.status, remarks: r.remarks || null, markedBy: session.user.id },
                    })
                } else {
                    return prisma.attendance.create({
                        data: {
                            employeeId: r.employeeId,
                            date: d,
                            status: r.status,
                            remarks: r.remarks || null,
                            markedBy: session.user.id,
                        },
                    })
                }
            })
        )

        return NextResponse.json({ saved: results.length })
    } catch (err) {
        console.error("[ATTENDANCE_POST]", err)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
