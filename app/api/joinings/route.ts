/**
 * Worker Joining submissions — dashboard list (authenticated).
 *
 * GET /api/joinings — returns workers who self-submitted via the public
 * /join form. These are stored as Employee rows (status INACTIVE, pending
 * admin review) carrying the marker note set by /api/join. We surface them
 * here so the admin can review the form data + uploaded documents and
 * approve (activate) each worker.
 */

import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { canAccessModule } from "@/lib/modules"

// Same marker that /api/join writes into Employee.notes
const JOIN_MARKER = "Self-submitted via Worker Joining Form"

export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return new NextResponse("Unauthorized", { status: 401 })
        if (!canAccessModule(session.user, "joinings")) {
            return new NextResponse("Forbidden", { status: 403 })
        }

        const employees = await prisma.employee.findMany({
            where: { notes: { contains: JOIN_MARKER } },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                employeeId: true,
                firstName: true,
                lastName: true,
                phone: true,
                fathersName: true,
                aadharNumber: true,
                designation: true,
                dateOfJoining: true,
                basicSalary: true,
                shiftHours: true,
                shiftStart: true,
                shiftEnd: true,
                photo: true,
                status: true,
                notes: true,
                createdAt: true,
                documents: {
                    select: { id: true, type: true, fileName: true, fileUrl: true, status: true },
                },
            },
        })

        return NextResponse.json(employees)
    } catch (error) {
        console.error("[JOININGS_GET]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
