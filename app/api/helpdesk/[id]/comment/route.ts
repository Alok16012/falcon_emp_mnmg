import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

export async function POST(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return new NextResponse("Unauthorized", { status: 401 })

        const ticket = await prisma.ticket.findUnique({ where: { id: params.id } })
        if (!ticket) return new NextResponse("Not Found", { status: 404 })

        const isPrivileged = session.user.role === "ADMIN" || session.user.role === "MANAGER"
        if (!isPrivileged && ticket.raisedBy !== session.user.id) {
            return new NextResponse("Forbidden", { status: 403 })
        }

        const body = await req.json()
        const { content, isInternal } = body

        if (!content || !content.trim()) {
            return new NextResponse("content is required", { status: 400 })
        }

        // Only privileged users can post internal notes
        const internal = isPrivileged ? (isInternal === true) : false

        const comment = await prisma.ticketComment.create({
            data: {
                ticketId: params.id,
                userId: session.user.id,
                content: content.trim(),
                isInternal: internal,
            },
        })

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { id: true, name: true, email: true },
        })

        return NextResponse.json({ ...comment, user })
    } catch (error) {
        console.error("[HELPDESK_COMMENT_POST]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
