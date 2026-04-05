import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

const DEFAULT_TASKS = [
    { title: "Offer Letter Signed", category: "DOCUMENT" },
    { title: "Aadhar Copy Submitted", category: "DOCUMENT" },
    { title: "PAN Card Submitted", category: "DOCUMENT" },
    { title: "Bank Details Submitted", category: "DOCUMENT" },
    { title: "Uniform Issued", category: "OTHER" },
    { title: "ID Card Issued", category: "OTHER" },
    { title: "Site Induction Done", category: "INDUCTION" },
    { title: "Safety Training", category: "TRAINING" },
    { title: "System Access Setup", category: "IT_SETUP" },
]

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return new NextResponse("Unauthorized", { status: 401 })
        if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
            return new NextResponse("Forbidden", { status: 403 })
        }

        const employees = await prisma.employee.findMany({
            where: { status: { in: ["ACTIVE", "INACTIVE"] } },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeId: true,
                designation: true,
                photo: true,
                dateOfJoining: true,
                branch: { select: { name: true } },
                onboardingTasks: {
                    select: {
                        id: true,
                        title: true,
                        category: true,
                        status: true,
                        completedAt: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        })

        // Only return employees who have onboarding tasks started
        const withOnboarding = employees.filter(e => e.onboardingTasks.length > 0)
        return NextResponse.json(withOnboarding)
    } catch (error) {
        console.error("[ONBOARDING_GET]", error)
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
        const { employeeId } = body

        if (!employeeId) {
            return new NextResponse("employeeId is required", { status: 400 })
        }

        // Check if already started
        const existing = await prisma.onboardingTask.findFirst({ where: { employeeId } })
        if (existing) {
            return new NextResponse("Onboarding already started for this employee", { status: 400 })
        }

        const tasks = await prisma.$transaction(
            DEFAULT_TASKS.map(t =>
                prisma.onboardingTask.create({
                    data: {
                        employeeId,
                        title: t.title,
                        category: t.category,
                        status: "PENDING",
                    },
                })
            )
        )

        return NextResponse.json(tasks)
    } catch (error) {
        console.error("[ONBOARDING_POST]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
