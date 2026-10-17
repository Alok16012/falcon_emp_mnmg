/**
 * Bulk delete (hide) employees.
 * POST /api/employees/bulk-delete  { ids: string[] }
 *
 * Sets deletedAt so they disappear from the portal; no data is removed.
 */

import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return new NextResponse("Unauthorized", { status: 401 })
    if (session.user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 })

    const { ids } = await req.json().catch(() => ({}))
    if (!Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json({ error: "ids array required" }, { status: 400 })
    }

    // Hide only — all related records are kept (see DELETE /api/employees/[id])
    const { count } = await prisma.employee.updateMany({
        where: { id: { in: ids }, deletedAt: null },
        data: { deletedAt: new Date() },
    })

    return NextResponse.json({ ok: true, deleted: count, message: `${count} deleted` })
}
