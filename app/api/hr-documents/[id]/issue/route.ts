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

        const document = await prisma.hRDocument.findUnique({
            where: { id: params.id },
            include: { template: true },
        })

        if (!document) return new NextResponse("Not Found", { status: 404 })

        const canIssue =
            document.status === "APPROVED" ||
            (document.status === "DRAFT" && !document.template?.approvalRequired)

        if (!canIssue) {
            return new NextResponse(
                "Document must be approved before issuing, or have no approval requirement",
                { status: 400 }
            )
        }

        const updated = await prisma.hRDocument.update({
            where: { id: params.id },
            data: {
                status: "ISSUED",
                issuedAt: new Date(),
                issuedBy: session.user.id,
            },
        })

        return NextResponse.json(updated)
    } catch (error) {
        console.error("[HR_DOCUMENT_ISSUE]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
