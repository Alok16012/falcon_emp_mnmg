/**
 * Role → module permissions. ADMIN-only.
 *
 *   GET  /api/admin/role-permissions
 *        → { roles: [{ role, modules }], modules: [{ key, label, group }] }
 *   PUT  /api/admin/role-permissions   body: { role, modules: string[] }
 *        → upserts the module list for one configurable role
 */

import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { Role } from "@prisma/client"
import { ASSIGNABLE_MODULES, CONFIGURABLE_ROLES, modulesForRole } from "@/lib/modules"

export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== Role.ADMIN) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const saved = await prisma.rolePermission.findMany({ select: { role: true, modules: true } })
    const savedMap = new Map(saved.map(s => [s.role, s.modules]))

    const roles = CONFIGURABLE_ROLES.map(role => ({
        role,
        modules: modulesForRole(role, savedMap.get(role)),
    }))

    return NextResponse.json({
        roles,
        modules: ASSIGNABLE_MODULES.map(m => ({ key: m.key, label: m.label, group: m.group })),
    })
}

export async function PUT(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== Role.ADMIN) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const role = String(body.role || "")
    const modules: string[] = Array.isArray(body.modules) ? body.modules : []

    if (!CONFIGURABLE_ROLES.includes(role as (typeof CONFIGURABLE_ROLES)[number])) {
        return NextResponse.json({ error: "Invalid or non-configurable role" }, { status: 400 })
    }

    // Keep only valid, assignable module keys.
    const valid = new Set(ASSIGNABLE_MODULES.map(m => m.key))
    const cleaned = Array.from(new Set(modules.filter(k => valid.has(k))))

    const saved = await prisma.rolePermission.upsert({
        where: { role },
        update: { modules: cleaned },
        create: { role, modules: cleaned },
        select: { role: true, modules: true },
    })

    return NextResponse.json({ success: true, ...saved })
}
