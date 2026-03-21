
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { Role } from "@prisma/client"

export async function GET(
    req: Request,
    { params }: { params: { id: string } }
) {
    const session = await getServerSession(authOptions)
    if (!session || (session.user.role !== Role.ADMIN && session.user.role !== Role.MANAGER)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const inspection = await prisma.inspection.findUnique({
            where: { id: params.id },
            include: {
                submitter: {
                    select: { name: true, email: true }
                },
                assignment: {
                    include: {
                        project: {
                            include: {
                                company: true
                            }
                        }
                    }
                },
                responses: {
                    include: {
                        field: true
                    }
                }
            }
        })

        if (!inspection) {
            return NextResponse.json({ error: "Inspection not found" }, { status: 404 })
        }

        return NextResponse.json(inspection)
    } catch (error) {
        console.error("GET_APPROVAL_DETAIL_ERROR", error)
        return NextResponse.json({ error: "Internal Error" }, { status: 500 })
    }
}

export async function PATCH(
    req: Request,
    { params }: { params: { id: string } }
) {
    const session = await getServerSession(authOptions)
    if (!session || (session.user.role !== Role.ADMIN && session.user.role !== Role.MANAGER)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const { action, reviewerNotes } = await req.json()
        const inspectionId = params.id

        const inspection = await prisma.inspection.findUnique({
            where: { id: inspectionId }
        })

        if (!inspection) {
            return NextResponse.json({ error: "Inspection not found" }, { status: 404 })
        }

        if (inspection.status !== "pending") {
            return NextResponse.json({ error: "This inspection is not awaiting review" }, { status: 400 })
        }

        if (action === "reject" && !reviewerNotes) {
            return NextResponse.json({ error: "Please provide a reason for rejection" }, { status: 400 })
        }

        let updatedStatus = action === "approve" ? "approved" : "rejected"
        let updateData: any = {
            status: updatedStatus,
            reviewerNotes: reviewerNotes || null
        }

        if (action === "approve") {
            updateData.approvedAt = new Date()
        }

        const assignment = await prisma.assignment.findUnique({
            where: { id: inspection.assignmentId }
        })

        await prisma.$transaction(async (tx) => {
            await tx.inspection.update({
                where: { id: inspectionId },
                data: updateData
            })

            if (action === "approve") {
                await tx.assignment.update({
                    where: { id: inspection.assignmentId },
                    data: { status: "completed" }
                })

                // Auto-create next recurring assignment
                if (assignment && assignment.recurrenceType !== "none" && assignment.recurrenceActive) {
                    await tx.assignment.create({
                        data: {
                            projectId: assignment.projectId,
                            inspectionBoyId: assignment.inspectionBoyId,
                            assignedBy: assignment.assignedBy,
                            status: "active",
                            recurrenceType: assignment.recurrenceType,
                            recurrenceActive: true
                        }
                    })
                }
            }
        })

        return NextResponse.json({ message: `Inspection ${updatedStatus} successfully` })
    } catch (error) {
        console.error("PATCH_APPROVAL_ERROR", error)
        return NextResponse.json({ error: "Internal Error" }, { status: 500 })
    }
}
