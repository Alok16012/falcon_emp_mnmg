import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { Role } from "@prisma/client"

interface ImportRow {
    candidateName?: string
    phone?: string
    email?: string
    city?: string
    position?: string
    source?: string
    priority?: string
    score?: string
    experience?: string | number
    qualification?: string
    skills?: string
    notes?: string
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session || (session.user.role !== Role.ADMIN && session.user.role !== Role.MANAGER)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const realUser = await prisma.user.findUnique({ where: { id: session.user.id } })
        ?? await prisma.user.findUnique({ where: { email: session.user.email ?? "" } })
    if (!realUser) return NextResponse.json({ error: "User not found" }, { status: 403 })

    const body = await req.json()
    const rows: ImportRow[] = body.rows ?? []

    let imported = 0
    let skipped = 0
    const errors: { row: number; reason: string }[] = []

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const rowNum = i + 2 // 1-indexed + header row

        const candidateName = String(row.candidateName ?? "").trim()
        const phone = String(row.phone ?? "").trim()
        const position = String(row.position ?? "").trim()
        const source = String(row.source ?? "").trim()

        if (!candidateName || !phone || !position || !source) {
            errors.push({ row: rowNum, reason: `Missing required fields (Candidate Name, Phone, Position, Source)` })
            skipped++
            continue
        }

        const existing = await prisma.lead.findFirst({ where: { phone } })
        if (existing) {
            skipped++
            errors.push({ row: rowNum, reason: `Duplicate phone: ${phone} (${existing.candidateName})` })
            continue
        }

        try {
            const expVal = row.experience !== undefined && row.experience !== "" ? parseFloat(String(row.experience)) : null
            await prisma.lead.create({
                data: {
                    candidateName,
                    phone,
                    position,
                    source,
                    email: row.email ? String(row.email).trim() : null,
                    city: row.city ? String(row.city).trim() : null,
                    priority: (row.priority as "HIGH" | "MEDIUM" | "LOW") || "MEDIUM",
                    score: (row.score as "HOT" | "WARM" | "COLD") || "WARM",
                    experience: expVal,
                    qualification: row.qualification ? String(row.qualification).trim() : null,
                    skills: row.skills ? String(row.skills).trim() : null,
                    notes: row.notes ? String(row.notes).trim() : null,
                    createdBy: realUser.id,
                },
            })
            imported++
        } catch (err) {
            errors.push({ row: rowNum, reason: `DB error: ${(err as Error).message}` })
            skipped++
        }
    }

    return NextResponse.json({ imported, skipped, errors })
}
