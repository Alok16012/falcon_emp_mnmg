import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

// GET: all active employees with photos (for kiosk face matching)
export async function GET() {
    try {
        const employees = await prisma.employee.findMany({
            where: { status: "ACTIVE" },
            select: {
                id: true,
                employeeId: true,
                firstName: true,
                lastName: true,
                designation: true,
                photo: true,
                department: { select: { name: true } },
            },
        })
        return NextResponse.json(employees)
    } catch (err) {
        console.error("[PUNCH_GET]", err)
        return new NextResponse("Internal Error", { status: 500 })
    }
}

// POST: punch in or punch out for an employee
export async function POST(req: Request) {
    try {
        const { employeeId, action } = await req.json()
        // action: "IN" | "OUT"

        if (!employeeId || !action) {
            return new NextResponse("employeeId and action required", { status: 400 })
        }

        const now = new Date()
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const todayEnd = new Date(todayStart)
        todayEnd.setDate(todayEnd.getDate() + 1)

        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`

        const existing = await prisma.attendance.findFirst({
            where: { employeeId, date: { gte: todayStart, lt: todayEnd } },
        })

        if (action === "IN") {
            if (existing?.checkIn) {
                // Already punched in — return existing punch in time
                return NextResponse.json({
                    ok: true,
                    alreadyIn: true,
                    checkIn: existing.checkIn,
                    message: "Pehle se punch in hai",
                })
            }

            const record = existing
                ? await prisma.attendance.update({
                    where: { id: existing.id },
                    data: { checkIn: now, status: "PRESENT" },
                })
                : await prisma.attendance.create({
                    data: {
                        employeeId,
                        date: todayStart,
                        checkIn: now,
                        status: "PRESENT",
                    },
                })

            return NextResponse.json({ ok: true, action: "IN", time: now, record })
        }

        if (action === "OUT") {
            if (!existing?.checkIn) {
                return NextResponse.json({ ok: false, message: "Pehle Punch In karo" }, { status: 400 })
            }
            if (existing.checkOut) {
                return NextResponse.json({ ok: true, alreadyOut: true, checkOut: existing.checkOut, message: "Pehle se punch out hai" })
            }

            const workingHrs = parseFloat(
                ((now.getTime() - existing.checkIn.getTime()) / (1000 * 60 * 60)).toFixed(2)
            )

            const record = await prisma.attendance.update({
                where: { id: existing.id },
                data: { checkOut: now, workingHrs },
            })

            return NextResponse.json({ ok: true, action: "OUT", time: now, workingHrs, record })
        }

        return new NextResponse("Invalid action", { status: 400 })
    } catch (err) {
        console.error("[PUNCH_POST]", err)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
