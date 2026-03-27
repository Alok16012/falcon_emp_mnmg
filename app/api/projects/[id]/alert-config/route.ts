import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { Role } from "@prisma/client"

export async function GET(
    req: Request,
    { params }: { params: { id: string } }
) {
    const session = await getServerSession(authOptions)
    if (!session || (session.user.role !== Role.ADMIN && session.user.role !== Role.MANAGER)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const config = await prisma.alertConfig.findUnique({
        where: { projectId: params.id }
    })

    return NextResponse.json(config || { projectId: params.id, defectThreshold: 5.0, notifyManager: true, notifyAdmin: true })
}

export async function PUT(
    req: Request,
    { params }: { params: { id: string } }
) {
    const session = await getServerSession(authOptions)
    if (!session || (session.user.role !== Role.ADMIN && session.user.role !== Role.MANAGER)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { defectThreshold, notifyManager, notifyAdmin } = await req.json()

    const config = await prisma.alertConfig.upsert({
        where: { projectId: params.id },
        create: {
            projectId: params.id,
            defectThreshold: parseFloat(defectThreshold) || 5.0,
            notifyManager: !!notifyManager,
            notifyAdmin: !!notifyAdmin
        },
        update: {
            defectThreshold: parseFloat(defectThreshold) || 5.0,
            notifyManager: !!notifyManager,
            notifyAdmin: !!notifyAdmin
        }
    })

    return NextResponse.json(config)
}
