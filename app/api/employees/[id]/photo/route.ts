import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

export async function POST(req: Request, { params }: { params: { id: string } }) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return new NextResponse("Unauthorized", { status: 401 })

        const { photo } = await req.json()
        if (!photo || !photo.startsWith("data:image")) {
            return new NextResponse("Invalid photo data", { status: 400 })
        }

        const employee = await prisma.employee.update({
            where: { id: params.id },
            data: { photo },
            select: { id: true, firstName: true, lastName: true, photo: true },
        })

        return NextResponse.json(employee)
    } catch (err) {
        console.error("[EMPLOYEE_PHOTO]", err)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
