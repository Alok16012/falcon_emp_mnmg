import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return new NextResponse("Unauthorized", { status: 401 })

        const { searchParams } = new URL(req.url)
        const isActive = searchParams.get("isActive")

        const where: Record<string, unknown> = {}
        if (isActive !== null) where.isActive = isActive === "true"

        const templates = await prisma.hRDocTemplate.findMany({
            where,
            orderBy: { createdAt: "desc" },
        })

        return NextResponse.json(templates)
    } catch (error) {
        console.error("[HR_DOC_TEMPLATES_GET]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return new NextResponse("Unauthorized", { status: 401 })
        if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
            return new NextResponse("Forbidden", { status: 403 })
        }

        const body = await req.json()
        const { name, type, description, templateContent, approvalRequired } = body

        if (!name || !type || !templateContent) {
            return new NextResponse("Missing required fields", { status: 400 })
        }

        const template = await prisma.hRDocTemplate.create({
            data: {
                name,
                type,
                description: description || null,
                templateContent,
                approvalRequired: approvalRequired !== false,
                createdBy: session.user.id,
            },
        })

        return NextResponse.json(template, { status: 201 })
    } catch (error) {
        console.error("[HR_DOC_TEMPLATES_POST]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
