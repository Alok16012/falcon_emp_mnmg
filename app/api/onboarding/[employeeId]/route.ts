import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

export async function GET(
    req: Request,
    { params }: { params: { employeeId: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return new NextResponse("Unauthorized", { status: 401 })
        if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
            return new NextResponse("Forbidden", { status: 403 })
        }

        const tasks = await prisma.onboardingTask.findMany({
            where: { employeeId: params.employeeId },
            orderBy: { createdAt: "asc" },
        })

        return NextResponse.json(tasks)
    } catch (error) {
        console.error("[ONBOARDING_TASKS_GET]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}

export async function PUT(
    req: Request,
    { params }: { params: { employeeId: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return new NextResponse("Unauthorized", { status: 401 })
        if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
            return new NextResponse("Forbidden", { status: 403 })
        }

        const body = await req.json()
        const { taskId, status } = body

        if (!taskId || !status) {
            return new NextResponse("taskId and status are required", { status: 400 })
        }

        const task = await prisma.onboardingTask.update({
            where: { id: taskId },
            data: {
                status,
                completedAt: status === "COMPLETED" ? new Date() : null,
            },
        })

        return NextResponse.json(task)
    } catch (error) {
        console.error("[ONBOARDING_TASKS_PUT]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
