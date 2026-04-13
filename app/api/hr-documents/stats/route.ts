import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return new NextResponse("Unauthorized", { status: 401 })

        const [total, pending, draft, issued, approved, rejected] = await Promise.all([
            prisma.hRDocument.count(),
            prisma.hRDocument.count({ where: { status: "PENDING_APPROVAL" } }),
            prisma.hRDocument.count({ where: { status: "DRAFT" } }),
            prisma.hRDocument.count({ where: { status: "ISSUED" } }),
            prisma.hRDocument.count({ where: { status: "APPROVED" } }),
            prisma.hRDocument.count({ where: { status: "REJECTED" } }),
        ])

        return NextResponse.json({ total, pending, draft, issued, approved, rejected })
    } catch (error) {
        console.error("[HR_DOCUMENT_STATS]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
