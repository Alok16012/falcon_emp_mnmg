/**
 * Bulk delete employees.
 * POST /api/employees/bulk-delete  { ids: string[], force?: boolean }
 *
 * force=true permanently removes each employee and their related records.
 * Without force, employees with records are soft-deleted (TERMINATED).
 */

import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return new NextResponse("Unauthorized", { status: 401 })
    if (session.user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 })

    const { ids, force = true } = await req.json().catch(() => ({}))
    if (!Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json({ error: "ids array required" }, { status: 400 })
    }

    let deleted = 0, terminated = 0, failed = 0

    for (const id of ids) {
        try {
            if (force) {
                await prisma.punchLog.deleteMany({ where: { employeeId: id } })
                await prisma.attendance.deleteMany({ where: { employeeId: id } })
                await prisma.leave.deleteMany({ where: { employeeId: id } })
                await prisma.payroll.deleteMany({ where: { employeeId: id } })
                await prisma.advanceAndReimbursement.deleteMany({ where: { employeeId: id } })
                await prisma.employee.delete({ where: { id } })
                deleted++
            } else {
                const emp = await prisma.employee.findUnique({
                    where: { id },
                    include: { _count: { select: { attendances: true, leaves: true, payrolls: true, deployments: true } } },
                })
                if (!emp) { failed++; continue }
                const hasRecords =
                    emp._count.attendances > 0 || emp._count.leaves > 0 ||
                    emp._count.payrolls > 0 || emp._count.deployments > 0
                if (hasRecords) {
                    await prisma.employee.update({ where: { id }, data: { status: "TERMINATED" } })
                    terminated++
                } else {
                    await prisma.employee.delete({ where: { id } })
                    deleted++
                }
            }
        } catch (e) {
            console.error("[BULK_DELETE]", id, e)
            failed++
        }
    }

    return NextResponse.json({
        ok: true,
        deleted, terminated, failed,
        message: `${deleted} deleted${terminated ? `, ${terminated} terminated` : ""}${failed ? `, ${failed} failed` : ""}`,
    })
}
