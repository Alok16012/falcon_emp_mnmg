
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { Role } from "@prisma/client"

export async function PATCH(
    req: Request,
    { params }: { params: { id: string } }
) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    try {
        const { responses, status } = await req.json()
        const inspectionId = params.id

        const inspection = await prisma.inspection.findUnique({
            where: { id: inspectionId },
            include: { assignment: true }
        })

        if (!inspection) {
            return NextResponse.json({ error: "Inspection not found" }, { status: 404 })
        }

        // Only the assigned inspector can update
        if (inspection.submittedBy !== session.user.id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        // Cannot edit if not in draft, unless inspector is reverting pending back to draft
        const isRevertToDraft = status === "draft" && inspection.status === "pending"
        if (inspection.status !== "draft" && !isRevertToDraft) {
            return NextResponse.json({ error: "Inspection is already submitted and cannot be edited" }, { status: 400 })
        }

        // Update status and submittedAt if pending
        const updateData: any = { status }
        if (status === "pending") {
            updateData.submittedAt = new Date()
        }
        // If reverting to draft, clear submittedAt
        if (isRevertToDraft) {
            updateData.submittedAt = null
        }

        // Use transaction for status update and response upserts
        await prisma.$transaction(async (tx) => {
            // Update main inspection
            await tx.inspection.update({
                where: { id: inspectionId },
                data: updateData
            })

            // Upsert responses
            if (responses && Array.isArray(responses)) {
                for (const response of responses) {
                    const { fieldId, value } = response

                    // Direct upsert is tricky with UUIDs if we don't have the response ID
                    // Better to find if it exists by inspectionId and fieldId
                    const existingResponse = await tx.inspectionData.findFirst({
                        where: {
                            inspectionId,
                            fieldId
                        }
                    })

                    if (existingResponse) {
                        await tx.inspectionData.update({
                            where: { id: existingResponse.id },
                            data: { value }
                        })
                    } else {
                        await tx.inspectionData.create({
                            data: {
                                inspectionId,
                                fieldId,
                                value
                            }
                        })
                    }
                }
            }
        })

        const updatedInspection = await prisma.inspection.findUnique({
            where: { id: inspectionId },
            include: { responses: true }
        })

        return NextResponse.json(updatedInspection)
    } catch (error) {
        console.error("PATCH_INSPECTION_ERROR", error)
        return NextResponse.json({ error: "Internal Error" }, { status: 500 })
    }
}
