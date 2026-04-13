import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

export async function POST(req: Request, { params }: { params: { id: string } }) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return new NextResponse("Unauthorized", { status: 401 })
        if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
            return new NextResponse("Forbidden", { status: 403 })
        }

        const body = await req.json()
        const { action, comments } = body

        if (!action || !["APPROVE", "REJECT"].includes(action)) {
            return new NextResponse("Invalid action", { status: 400 })
        }

        const document = await prisma.hRDocument.findUnique({ where: { id: params.id } })
        if (!document) return new NextResponse("Not Found", { status: 404 })

        if (document.status !== "PENDING_APPROVAL") {
            return new NextResponse("Document is not pending approval", { status: 400 })
        }

        const now = new Date()

        if (action === "APPROVE") {
            const updated = await prisma.hRDocument.update({
                where: { id: params.id },
                data: {
                    status: "APPROVED",
                    approvedBy: session.user.id,
                    approvedAt: now,
                },
            })

            await prisma.hRDocApproval.create({
                data: {
                    documentId: params.id,
                    approverId: session.user.id,
                    status: "APPROVED",
                    comments: comments || null,
                    actionAt: now,
                },
            })

            return NextResponse.json(updated)
        } else {
            if (!comments) {
                return new NextResponse("Rejection reason is required", { status: 400 })
            }

            const updated = await prisma.hRDocument.update({
                where: { id: params.id },
                data: {
                    status: "REJECTED",
                    rejectionReason: comments,
                    rejectedAt: now,
                },
            })

            await prisma.hRDocApproval.create({
                data: {
                    documentId: params.id,
                    approverId: session.user.id,
                    status: "REJECTED",
                    comments,
                    actionAt: now,
                },
            })

            return NextResponse.json(updated)
        }
    } catch (error) {
        console.error("[HR_DOCUMENT_APPROVE]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
