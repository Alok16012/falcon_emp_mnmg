import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

export async function GET(req: Request, { params }: { params: { id: string } }) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return new NextResponse("Unauthorized", { status: 401 })

        const document = await prisma.hRDocument.findUnique({
            where: { id: params.id },
            include: {
                employee: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        employeeId: true,
                        designation: true,
                        department: { select: { name: true } },
                    },
                },
                template: {
                    select: { id: true, name: true, type: true, approvalRequired: true },
                },
                approvals: true,
            },
        })

        if (!document) return new NextResponse("Not Found", { status: 404 })

        return NextResponse.json(document)
    } catch (error) {
        console.error("[HR_DOCUMENT_GET]", error)
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
        const { title, content, effectiveDate, status } = body

        const document = await prisma.hRDocument.update({
            where: { id: params.id },
            data: {
                ...(title !== undefined && { title }),
                ...(content !== undefined && { content }),
                ...(effectiveDate !== undefined && { effectiveDate: new Date(effectiveDate) }),
                ...(status !== undefined && { status }),
            },
        })

        return NextResponse.json(document)
    } catch (error) {
        console.error("[HR_DOCUMENT_PUT]", error)
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

        await prisma.hRDocument.delete({ where: { id: params.id } })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("[HR_DOCUMENT_DELETE]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
