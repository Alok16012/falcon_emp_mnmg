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
