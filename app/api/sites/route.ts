import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return new NextResponse("Unauthorized", { status: 401 })
        if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
            return new NextResponse("Forbidden", { status: 403 })
        }

        const { searchParams } = new URL(req.url)
        const branchId = searchParams.get("branchId")

        const sites = await prisma.site.findMany({
            where: branchId ? { branchId } : undefined,
            include: {
                branch: { select: { id: true, name: true } },
                _count: { select: { deployments: true, attendances: true } },
            },
            orderBy: { createdAt: "desc" },
        })

        return NextResponse.json(sites)
    } catch (error) {
        console.error("[SITES_GET]", error)
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
        const { name, address, city, branchId, latitude, longitude, radius } = body

        if (!name || !branchId) {
            return new NextResponse("Name and branchId are required", { status: 400 })
        }

        const site = await prisma.site.create({
            data: {
                name,
                address,
                city,
                branchId,
                latitude: latitude ? parseFloat(latitude) : null,
                longitude: longitude ? parseFloat(longitude) : null,
                radius: radius ? parseFloat(radius) : 100,
            },
        })

        return NextResponse.json(site)
    } catch (error) {
        console.error("[SITES_POST]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
