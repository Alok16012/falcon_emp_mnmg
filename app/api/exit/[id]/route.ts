import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

export async function GET(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return new NextResponse("Unauthorized", { status: 401 })
        if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
            return new NextResponse("Forbidden", { status: 403 })
        }

        const exit = await prisma.exitRequest.findUnique({
            where: { id: params.id },
            include: {
                employee: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        employeeId: true,
                        designation: true,
                        photo: true,
                        basicSalary: true,
                        branch: { select: { name: true } },
                    },
                },
            },
        })

        if (!exit) return new NextResponse("Not Found", { status: 404 })

        return NextResponse.json(exit)
    } catch (error) {
        console.error("[EXIT_GET_ID]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}

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
        const { status, clearanceItems, fnfAmount, fnfStatus, interviewNotes, lastWorkingDate } = body

        const updateData: Record<string, unknown> = {}
        if (status !== undefined) updateData.status = status
        if (clearanceItems !== undefined) updateData.clearanceItems = clearanceItems
        if (fnfAmount !== undefined) updateData.fnfAmount = parseFloat(fnfAmount)
        if (fnfStatus !== undefined) updateData.fnfStatus = fnfStatus
        if (interviewNotes !== undefined) updateData.interviewNotes = interviewNotes
        if (lastWorkingDate !== undefined) updateData.lastWorkingDate = new Date(lastWorkingDate)

        const exit = await prisma.exitRequest.update({
            where: { id: params.id },
            data: updateData,
        })

        return NextResponse.json(exit)
    } catch (error) {
        console.error("[EXIT_PUT]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
