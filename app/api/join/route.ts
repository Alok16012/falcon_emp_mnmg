/**
 * PUBLIC Worker Joining Form submission.
 *
 * POST /api/join  — no auth. Workers open the shareable /join link, fill the
 * form and submit. We create an Employee in INACTIVE status (pending admin
 * review) plus base64 documents (passport photo, Aadhaar, PAN). The admin then
 * verifies and activates the worker from the Employees page.
 *
 * This endpoint is intentionally unauthenticated, so it does NOT create a login
 * user and never touches active attendance — the record stays INACTIVE until an
 * admin approves it.
 */

import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

type DocInput = { fileName?: string; dataUrl?: string }

function splitName(full: string): { firstName: string; lastName: string } {
    const parts = full.trim().split(/\s+/)
    const firstName = parts[0] || ""
    const lastName = parts.slice(1).join(" ")
    return { firstName, lastName }
}

// Pull the first numeric chunk out of the wage string ("₹ 18,000 / month" → 18000)
function parseWage(s: string): number {
    if (!s) return 0
    const digits = s.replace(/[^\d.]/g, "")
    const n = parseFloat(digits)
    return isNaN(n) ? 0 : n
}

function validTime(value: unknown): string | null {
    if (typeof value !== "string") return null
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : null
}

function hoursFromShiftTimes(start?: string | null, end?: string | null): number | null {
    if (!start || !end) return null
    const toMinutes = (time: string) => {
        const [h, m] = time.split(":").map(Number)
        if (Number.isNaN(h) || Number.isNaN(m)) return null
        return h * 60 + m
    }
    const s = toMinutes(start)
    const e = toMinutes(end)
    if (s == null || e == null) return null
    let diff = e - s
    if (diff <= 0) diff += 24 * 60
    return Math.round((diff / 60) * 100) / 100
}

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => null)
        if (!body) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 })

        // Honeypot: real workers never fill this hidden field; bots do.
        if (body.website) return NextResponse.json({ ok: true })

        const {
            dateOfJoining,
            fullName,
            fathersName,
            dateOfBirth,
            gender,
            mobileNumber,
            permanentAddress,
            currentAddress,
            aadharNumber,
            panNumber,
            designation,
            departmentSite,
            providedEmployeeId,
            wageRate,
            shiftStart,
            shiftEnd,
            emergencyName,
            emergencyRelationship,
            emergencyPhone,
            declaration,
            photo,                 // data:image/...;base64,... (passport photo)
            aadharDoc,             // { fileName, dataUrl }
            panDoc,                // { fileName, dataUrl }
        } = body as Record<string, unknown>

        if (!fullName || typeof fullName !== "string" || !fullName.trim()) {
            return NextResponse.json({ ok: false, error: "Full name is required" }, { status: 400 })
        }
        if (!mobileNumber || typeof mobileNumber !== "string" || mobileNumber.trim().length < 7) {
            return NextResponse.json({ ok: false, error: "A valid mobile number is required" }, { status: 400 })
        }
        if (!declaration) {
            return NextResponse.json({ ok: false, error: "Please accept the declaration" }, { status: 400 })
        }

        const { firstName, lastName } = splitName(fullName)

        // Generate next EMP-NNNN id (same scheme as admin create)
        const lastEmployee = await prisma.employee.findFirst({
            orderBy: { createdAt: "desc" },
            select: { employeeId: true },
        })
        let nextNum = 1
        if (lastEmployee?.employeeId) {
            const match = lastEmployee.employeeId.match(/\d+$/)
            if (match) nextNum = parseInt(match[0]) + 1
        }
        let employeeId = `EMP-${String(nextNum).padStart(4, "0")}`
        if (await prisma.employee.findUnique({ where: { employeeId } })) {
            employeeId = `EMP-${String(nextNum + 1).padStart(4, "0")}`
        }

        const gen = typeof gender === "string" ? gender.toUpperCase() : null
        const validGender = gen === "MALE" || gen === "FEMALE" || gen === "OTHER" ? gen : null
        const normalizedShiftStart = validTime(shiftStart)
        const normalizedShiftEnd = validTime(shiftEnd)
        const shiftHours = hoursFromShiftTimes(normalizedShiftStart, normalizedShiftEnd)

        const noteParts: string[] = ["Self-submitted via Worker Joining Form"]
        if (departmentSite) noteParts.push(`Department/Site: ${departmentSite}`)
        if (emergencyRelationship) noteParts.push(`Emergency relationship: ${emergencyRelationship}`)
        if (providedEmployeeId) noteParts.push(`Worker-stated Employee ID: ${providedEmployeeId}`)

        const photoStr = typeof photo === "string" && photo.startsWith("data:image") ? photo : null

        const employee = await prisma.employee.create({
            data: {
                employeeId,
                firstName,
                lastName,
                phone: String(mobileNumber).trim(),
                fathersName: typeof fathersName === "string" ? fathersName : null,
                dateOfBirth: dateOfBirth ? new Date(String(dateOfBirth)) : null,
                gender: validGender,
                permanentAddress: typeof permanentAddress === "string" ? permanentAddress : null,
                address: typeof currentAddress === "string" ? currentAddress : null,
                aadharNumber: typeof aadharNumber === "string" ? aadharNumber : null,
                panNumber: typeof panNumber === "string" ? panNumber : null,
                designation: typeof designation === "string" ? designation : null,
                dateOfJoining: dateOfJoining ? new Date(String(dateOfJoining)) : null,
                basicSalary: parseWage(String(wageRate || "")),
                shiftStart: normalizedShiftStart,
                shiftEnd: normalizedShiftEnd,
                shiftHours: shiftHours ?? 8,
                emergencyContact1Name: typeof emergencyName === "string" ? emergencyName : null,
                emergencyContact1Phone: typeof emergencyPhone === "string" ? emergencyPhone : null,
                photo: photoStr,
                status: "INACTIVE",            // pending admin review
                employeeCategory: "LABOUR",
                employmentType: "Full-time",
                isKycVerified: false,
                notes: noteParts.join(" | "),
            },
            select: { id: true, employeeId: true, firstName: true, lastName: true },
        })

        // Attach uploaded documents as base64 (same storage as admin doc upload)
        const docs: { type: string; doc: DocInput | undefined; defName: string }[] = [
            { type: "PHOTO", doc: photoStr ? { fileName: "passport-photo.jpg", dataUrl: photoStr } : undefined, defName: "passport-photo.jpg" },
            { type: "AADHAAR", doc: aadharDoc as DocInput | undefined, defName: "aadhaar" },
            { type: "PAN", doc: panDoc as DocInput | undefined, defName: "pan" },
        ]
        for (const d of docs) {
            const url = d.doc?.dataUrl
            if (typeof url === "string" && url.startsWith("data:")) {
                await prisma.employeeDocument.create({
                    data: {
                        employeeId: employee.id,
                        type: d.type,
                        fileName: d.doc?.fileName || d.defName,
                        fileUrl: url,
                        status: "PENDING",
                    },
                }).catch(() => { /* don't fail the whole submission on one doc */ })
            }
        }

        return NextResponse.json({ ok: true, employeeId: employee.employeeId })
    } catch (err) {
        console.error("[JOIN_POST]", err)
        return NextResponse.json({ ok: false, error: "Something went wrong. Please try again." }, { status: 500 })
    }
}
