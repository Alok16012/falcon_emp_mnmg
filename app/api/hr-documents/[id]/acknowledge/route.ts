import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

export async function POST(req: Request, { params }: { params: { id: string } }) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return new NextResponse("Unauthorized", { status: 401 })

        const document = await prisma.hRDocument.findUnique({ where: { id: params.id } })
        if (!document) return new NextResponse("Not Found", { status: 404 })

        const updated = await prisma.hRDocument.update({
            where: { id: params.id },
            data: { acknowledgedAt: new Date() },
        })

        return NextResponse.json(updated)
    } catch (error) {
        console.error("[HR_DOCUMENT_ACKNOWLEDGE]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
