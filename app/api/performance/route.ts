import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

const DEFAULT_KPIS = [
    { title: "Attendance Rate", target: "≥95%", weightage: 20 },
    { title: "Punctuality (On-time arrival)", target: "≥95%", weightage: 15 },
    { title: "Client Complaints", target: "0 complaints", weightage: 20 },
    { title: "Safety Compliance", target: "100%", weightage: 15 },
    { title: "Task Completion Rate", target: "≥90%", weightage: 15 },
    { title: "Team Cooperation", target: "Good", weightage: 10 },
    { title: "Discipline & Conduct", target: "No violations", weightage: 5 },
]

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return new NextResponse("Unauthorized", { status: 401 })

        const { searchParams } = new URL(req.url)
        const status = searchParams.get("status")
        const cycle = searchParams.get("cycle")
        const employeeId = searchParams.get("employeeId")
        const search = searchParams.get("search")

        const isAdminOrManager = session.user.role === "ADMIN" || session.user.role === "MANAGER"

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: Record<string, any> = {}

        if (!isAdminOrManager) {
            // Non-admin/manager: find their employee record and restrict to own reviews
            const emp = await prisma.employee.findFirst({
                where: { email: session.user.email ?? undefined },
                select: { id: true },
            })
            if (emp) {
                where.employeeId = emp.id
            } else {
                return NextResponse.json([])
            }
        } else {
            if (employeeId) where.employeeId = employeeId
        }

        if (status && status !== "ALL") where.status = status
        if (cycle && cycle !== "ALL") where.cycle = cycle

        if (search) {
            where.employee = {
                OR: [
                    { firstName: { contains: search, mode: "insensitive" } },
                    { lastName: { contains: search, mode: "insensitive" } },
                    { employeeId: { contains: search, mode: "insensitive" } },
                ],
            }
        }

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
                kpis: { select: { id: true, rating: true } },
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
        const { employeeId, cycle, periodStart, periodEnd, reviewerId } = body

        if (!employeeId || !cycle || !periodStart || !periodEnd) {
            return new NextResponse("employeeId, cycle, periodStart, periodEnd are required", { status: 400 })
        }

        const employee = await prisma.employee.findUnique({ where: { id: employeeId } })
        if (!employee) return new NextResponse("Employee not found", { status: 404 })

        const review = await prisma.performanceReview.create({
            data: {
                employeeId,
                reviewerId: reviewerId || session.user.id,
                cycle,
                periodStart: new Date(periodStart),
                periodEnd: new Date(periodEnd),
                status: "DRAFT",
                kpis: {
                    create: DEFAULT_KPIS.map(k => ({
                        title: k.title,
                        target: k.target,
                        weightage: k.weightage,
                    })),
                },
            },
            include: {
                kpis: true,
                employee: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        employeeId: true,
                        designation: true,
                    },
                },
            },
        })

        return NextResponse.json(review)
    } catch (error) {
        console.error("[PERFORMANCE_POST]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
