import prisma from "@/lib/prisma"
import { Session } from "next-auth"

/**
 * Resolves the real DB user ID from session.
 * session.user.id may be a "demo-xxx" string if DB was down at login time.
 * Falls back to lookup by email.
 */
export async function resolveUserId(session: Session): Promise<string | null> {
    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
        ?? await prisma.user.findUnique({ where: { email: session.user.email ?? "" } })
    return user?.id ?? null
}
