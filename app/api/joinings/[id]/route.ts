/**
 * Worker Joining submission — approve / update status / delete (authenticated).
 *
 * PATCH  /api/joinings/:id  — { status }  approve (ACTIVE) or change status
 * DELETE /api/joinings/:id  — remove the submission (and its documents via cascade)
 */

import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { canAccessModule } from "@/lib/modules"

const VALID_STATUS = ["ACTIVE", "INACTIVE", "ON_LEAVE", "TERMINATED", "RESIGNED"] as const

export async function PATCH(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return new NextResponse("Unauthorized", { status: 401 })
        if (!canAccessModule(session.user, "joinings")) {
            return new NextResponse("Forbidden", { status: 403 })
        }

        const body = await req.json().catch(() => ({}))
        const { status } = body

        if (!status || !VALID_STATUS.includes(status)) {
            return new NextResponse("Invalid status", { status: 400 })
        }

        const employee = await prisma.employee.update({
            where: { id: params.id },
            data: {
                status,
                // Approving a worker confirms their KYC review is done
                ...(status === "ACTIVE" ? { isKycVerified: true } : {}),
            },
            select: { id: true, employeeId: true, status: true },
        })

        return NextResponse.json(employee)
    } catch (error) {
        console.error("[JOININGS_PATCH]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return new NextResponse("Unauthorized", { status: 401 })
        if (session.user.role !== "ADMIN") {
            return new NextResponse("Forbidden", { status: 403 })
        }

        await prisma.employee.delete({ where: { id: params.id } })
        return new NextResponse(null, { status: 204 })
    } catch (error) {
        console.error("[JOININGS_DELETE]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
