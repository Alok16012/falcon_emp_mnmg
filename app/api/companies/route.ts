import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return new NextResponse("Unauthorized", { status: 401 })

        const companies = await prisma.company.findMany({
            select: { id: true, name: true, address: true, contactPerson: true, contactPhone: true, logoUrl: true },
            orderBy: { name: "asc" },
        })

        return NextResponse.json(companies)
    } catch (error) {
        console.error("[COMPANIES_GET]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
