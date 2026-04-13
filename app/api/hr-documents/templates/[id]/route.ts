import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

export async function GET(req: Request, { params }: { params: { id: string } }) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return new NextResponse("Unauthorized", { status: 401 })

        const template = await prisma.hRDocTemplate.findUnique({
            where: { id: params.id },
        })

        if (!template) return new NextResponse("Not Found", { status: 404 })

        return NextResponse.json(template)
    } catch (error) {
        console.error("[HR_DOC_TEMPLATE_GET]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return new NextResponse("Unauthorized", { status: 401 })
        if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
            return new NextResponse("Forbidden", { status: 403 })
        }

        const body = await req.json()
        const { name, type, description, templateContent, approvalRequired, isActive } = body

        const template = await prisma.hRDocTemplate.update({
            where: { id: params.id },
            data: {
                ...(name !== undefined && { name }),
                ...(type !== undefined && { type }),
                ...(description !== undefined && { description }),
                ...(templateContent !== undefined && { templateContent }),
                ...(approvalRequired !== undefined && { approvalRequired }),
                ...(isActive !== undefined && { isActive }),
            },
        })

        return NextResponse.json(template)
    } catch (error) {
        console.error("[HR_DOC_TEMPLATE_PUT]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return new NextResponse("Unauthorized", { status: 401 })
        if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
            return new NextResponse("Forbidden", { status: 403 })
        }

        await prisma.hRDocTemplate.delete({ where: { id: params.id } })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("[HR_DOC_TEMPLATE_DELETE]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
