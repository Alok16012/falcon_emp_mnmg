
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { Role } from "@prisma/client"

export async function GET(req: Request) {
    const session = await getServerSession(authOptions)

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { user } = session
    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")

    const where: any = {}

    if (user.role === Role.INSPECTION_BOY) {
        where.inspectionBoyId = user.id
    } else if (user.role !== Role.ADMIN && user.role !== Role.MANAGER) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (status && status !== "all") {
        where.status = status
    }

    try {
        const assignments = await prisma.assignment.findMany({
            where,
            include: {
                project: { include: { company: true } },
                inspectionBoy: { select: { id: true, name: true, email: true } },
                assigner: { select: { name: true } }
            },
            orderBy: { createdAt: "desc" }
        })

        // Try to get project managers (may fail if table doesn't exist)
        let projectManagers: any[] = []
        try {
            projectManagers = await prisma.projectManager.findMany({
                include: { manager: { select: { id: true, name: true, email: true } } }
            })
        } catch (e) {
            console.log("ProjectManager table not available")
        }

        // Add managers to each project
        const result = assignments.map(a => ({
            ...a,
            project: {
                ...a.project,
                managers: projectManagers
                    .filter(pm => pm.projectId === a.projectId)
                    .map(pm => pm.manager)
            }
        }))

        return NextResponse.json(result)
    } catch (error) {
        console.error("GET_ASSIGNMENTS_ERROR", error)
        return NextResponse.json({ error: "Internal Error" }, { status: 500 })
    }
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)

    if (!session || (session.user.role !== Role.ADMIN && session.user.role !== Role.MANAGER)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const body = await req.json()
        const { projectId, inspectorIds, managerId } = body

        if (!projectId || !inspectorIds || !Array.isArray(inspectorIds) || inspectorIds.length === 0) {
            return NextResponse.json({ error: "Missing fields" }, { status: 400 })
        }

        const created: any[] = []
        const failed: any[] = []

        // First create assignments
        for (const inspectionBoyId of inspectorIds) {
            const existingAssignment = await prisma.assignment.findFirst({
                where: { projectId, inspectionBoyId, status: "active" }
            })

            if (existingAssignment) {
                failed.push({ inspectionBoyId, error: "Already assigned" })
                continue
            }

            try {
                const assignment = await prisma.assignment.create({
                    data: { projectId, inspectionBoyId, assignedBy: session.user.id, status: "active" }
                })
                created.push(assignment)
            } catch (err: any) {
                failed.push({ inspectionBoyId, error: err.message })
            }
        }

        // Try to assign manager (may fail if table doesn't exist)
        if (managerId) {
            try {
                await prisma.projectManager.deleteMany({ where: { projectId } })
                await prisma.projectManager.create({
                    data: { projectId, managerId, assignedBy: session.user.id }
                })
            } catch (mgrErr) {
                console.log("Manager assignment skipped:", mgrErr)
            }
        }

        return NextResponse.json({ created, failed })
    } catch (error: any) {
        console.error("ERROR:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
