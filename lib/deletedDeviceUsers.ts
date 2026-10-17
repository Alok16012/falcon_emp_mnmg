/**
 * Tombstones for biometric-enrolled employees that were permanently deleted.
 * Device-user import (channel sync + manual import) consults this so a deleted
 * worker whose enrolment still exists on the device isn't re-created.
 */

import prisma from "@/lib/prisma"

const norm = (s?: string | null) => (s || "").trim().toLowerCase()

/** hardwareUserId → name at delete time. Empty map if the table isn't there yet. */
export async function getDeletedDeviceUsers(): Promise<Map<string, string>> {
    try {
        const rows = await prisma.deletedDeviceUser.findMany({ select: { hardwareUserId: true, name: true } })
        return new Map(rows.map((r) => [r.hardwareUserId, norm(r.name)]))
    } catch (e) {
        console.error("[DELETED_DEVICE_USERS]", e)
        return new Map()
    }
}

/** True if this device user was deleted (and the device still has the same person on that ID). */
export function isDeletedDeviceUser(deleted: Map<string, string>, userId: string, name: string): boolean {
    if (!deleted.has(userId)) return false
    const n = deleted.get(userId)!
    // ID reused on the device for a different person → treat as new
    return !n || !norm(name) || n === norm(name)
}

/** Permanently delete an employee and every non-cascading related record. */
export async function hardDeleteEmployee(id: string): Promise<void> {
    const emp = await prisma.employee.findUnique({
        where: { id },
        select: { hardwareUserId: true, firstName: true, lastName: true },
    })
    if (!emp) return
    const name = [emp.firstName, emp.lastName].filter((p) => p && p !== ".").join(" ")
    await prisma.$transaction([
        // Tombstone in the same transaction: if it can't be written, nothing is
        // deleted (otherwise the device sync would bring the worker back).
        ...(emp.hardwareUserId
            ? [prisma.deletedDeviceUser.upsert({
                  where: { hardwareUserId: emp.hardwareUserId },
                  create: { hardwareUserId: emp.hardwareUserId, name },
                  update: { name, deletedAt: new Date() },
              })]
            : []),
        prisma.punchLog.deleteMany({ where: { employeeId: id } }),
        prisma.attendance.deleteMany({ where: { employeeId: id } }),
        prisma.leave.deleteMany({ where: { employeeId: id } }),
        prisma.payroll.deleteMany({ where: { employeeId: id } }),
        prisma.advanceAndReimbursement.deleteMany({ where: { employeeId: id } }),
        prisma.employee.delete({ where: { id } }),
    ])
}
