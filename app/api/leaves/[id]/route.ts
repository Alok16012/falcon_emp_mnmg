import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

export async function PUT(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return new NextResponse("Unauthorized", { status: 401 })
        if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
            return new NextResponse("Forbidden", { status: 403 })
        }

        const body = await req.json()
        const { status } = body

        if (!status || !["APPROVED", "REJECTED", "CANCELLED"].includes(status)) {
            return new NextResponse("Valid status (APPROVED, REJECTED, CANCELLED) is required", { status: 400 })
        }

        const leave = await prisma.leave.update({
            where: { id: params.id },
            data: {
                status,
                approvedBy: session.user.id,
                approvedAt: new Date(),
            },
        })

        // Update employee status if approved
        if (status === "APPROVED") {
            await prisma.employee.update({
                where: { id: leave.employeeId },
                data: { status: "ON_LEAVE" },
            })
        } else if (status === "REJECTED" || status === "CANCELLED") {
            // Check if employee has other active approved leaves
            const activeLeaves = await prisma.leave.count({
                where: {
                    employeeId: leave.employeeId,
                    status: "APPROVED",
                    endDate: { gte: new Date() },
                    id: { not: params.id },
                },
            })
            if (activeLeaves === 0) {
                await prisma.employee.update({
                    where: { id: leave.employeeId },
                    data: { status: "ACTIVE" },
                })
            }
        }

        return NextResponse.json(leave)
    } catch (error) {
        console.error("[LEAVE_PUT]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
