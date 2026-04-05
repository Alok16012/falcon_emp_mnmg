import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

const DEFAULT_CLEARANCE_ITEMS = [
    { item: "ID Card Returned", cleared: false, clearedBy: null, clearedAt: null },
    { item: "Uniform Returned", cleared: false, clearedBy: null, clearedAt: null },
    { item: "Assets Returned", cleared: false, clearedBy: null, clearedAt: null },
    { item: "System Access Revoked", cleared: false, clearedBy: null, clearedAt: null },
    { item: "NOC Issued", cleared: false, clearedBy: null, clearedAt: null },
    { item: "Experience Letter Issued", cleared: false, clearedBy: null, clearedAt: null },
]

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return new NextResponse("Unauthorized", { status: 401 })
        if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
            return new NextResponse("Forbidden", { status: 403 })
        }

        const { searchParams } = new URL(req.url)
        const status = searchParams.get("status")
        const employeeId = searchParams.get("employeeId")

        const where: Record<string, unknown> = {}
        if (status) where.status = status
        if (employeeId) where.employeeId = employeeId

        const exits = await prisma.exitRequest.findMany({
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
                        basicSalary: true,
                        branch: { select: { name: true } },
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        })

        return NextResponse.json(exits)
    } catch (error) {
        console.error("[EXIT_GET]", error)
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
        const { employeeId, reason, lastWorkingDate, noticePeriodDays, resignationLetter } = body

        if (!employeeId || !reason) {
            return new NextResponse("employeeId and reason are required", { status: 400 })
        }

        // Check if already exists
        const existing = await prisma.exitRequest.findUnique({ where: { employeeId } })
        if (existing) {
            return new NextResponse("Exit request already exists for this employee", { status: 400 })
        }

        const exit = await prisma.exitRequest.create({
            data: {
                employeeId,
                reason,
                lastWorkingDate: lastWorkingDate ? new Date(lastWorkingDate) : null,
                noticePeriodDays: noticePeriodDays ? parseInt(noticePeriodDays) : 30,
                resignationLetter,
                status: "RESIGNATION_SUBMITTED",
                clearanceItems: DEFAULT_CLEARANCE_ITEMS,
                fnfStatus: "PENDING",
            },
        })

        return NextResponse.json(exit)
    } catch (error) {
        console.error("[EXIT_POST]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
