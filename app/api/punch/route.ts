import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

// GET: all active employees with photos (for kiosk)
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
        const message = err instanceof Error ? err.message : "Internal Error"
        return NextResponse.json({ error: message }, { status: 500 })
    }
}

// POST: single tap punch — punchCount odd=IN, even=OUT
export async function POST(req: Request) {
    try {
        const { employeeId } = await req.json()
        if (!employeeId) return new NextResponse("employeeId required", { status: 400 })

        const now = new Date()
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const todayEnd   = new Date(todayStart); todayEnd.setDate(todayEnd.getDate() + 1)

        // Get or create today's attendance record
        let attendance = await prisma.attendance.findFirst({
            where: { employeeId, date: { gte: todayStart, lt: todayEnd } },
        })
        if (!attendance) {
            attendance = await prisma.attendance.create({
                data: { employeeId, date: todayStart, status: "PRESENT", punchCount: 0 },
            })
        }

        const newPunchCount = (attendance.punchCount ?? 0) + 1
        // Odd = IN, Even = OUT
        const punchType: "IN" | "OUT" = newPunchCount % 2 === 1 ? "IN" : "OUT"

        // Late check: first punch IN after 09:15
        const SHIFT_H = 9, SHIFT_M = 15
        const isLate = punchType === "IN" && newPunchCount === 1 &&
            (now.getHours() > SHIFT_H || (now.getHours() === SHIFT_H && now.getMinutes() > SHIFT_M))

        // Working hours = full span (last OUT − first IN). 35-min lunch is paid, not deducted.
        const newCheckIn  = newPunchCount === 1 ? now : attendance.checkIn  // first IN only
        const newCheckOut = punchType === "OUT" ? now : attendance.checkOut // update on every OUT
        let newWorkingHrs = attendance.workingHrs ?? 0
        if (newCheckIn && newCheckOut && newCheckOut > newCheckIn) {
            const spanHrs = (newCheckOut.getTime() - newCheckIn.getTime()) / (1000 * 60 * 60)
            newWorkingHrs = parseFloat(spanHrs.toFixed(2))
        }

        // Update attendance
        const updated = await prisma.attendance.update({
            where: { id: attendance.id },
            data: {
                punchCount: newPunchCount,
                lastPunchTime: now,
                workingHrs: newWorkingHrs,
                checkIn:  newCheckIn,
                checkOut: newCheckOut,
                status: "PRESENT",
                ...(isLate ? { remarks: `Late arrival: ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}` } : {}),
            },
        })

        // Save to PunchLog (non-blocking — if table missing, punch still works)
        prisma.punchLog.create({
            data: {
                employeeId,
                attendanceId: attendance.id,
                punchNumber: newPunchCount,
                punchType,
                punchTime: now,
            },
        }).catch(() => {})

        return NextResponse.json({
            ok: true,
            punchType,
            punchNumber: newPunchCount,
            time: now,
            totalWorkingHrs: updated.workingHrs,
            isLate,
        })
    } catch (err) {
        console.error("[PUNCH_POST]", err)
        const message = err instanceof Error ? err.message : "Internal Error"
        return NextResponse.json({ error: message }, { status: 500 })
    }
}

// PUT: get today's punch info for an employee
export async function PUT(req: Request) {
    try {
        const { employeeId } = await req.json()
        if (!employeeId) return new NextResponse("employeeId required", { status: 400 })

        const now = new Date()
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const todayEnd   = new Date(todayStart); todayEnd.setDate(todayEnd.getDate() + 1)

        const attendance = await prisma.attendance.findFirst({
            where: { employeeId, date: { gte: todayStart, lt: todayEnd } },
        })

        // Fetch punch logs for display
        let punches: unknown[] = []
        try {
            if (attendance) {
                punches = await prisma.punchLog.findMany({
                    where: { attendanceId: attendance.id },
                    orderBy: { punchNumber: "asc" },
                    select: { punchNumber: true, punchType: true, punchTime: true },
                })
            }
        } catch { /* safe fallback */ }

        return NextResponse.json({
            punches,
            punchCount: attendance?.punchCount ?? 0,
            workingHrs: attendance?.workingHrs ?? 0,
            checkIn:  attendance?.checkIn  ?? null,
            checkOut: attendance?.checkOut ?? null,
        })
    } catch (err) {
        console.error("[PUNCH_PUT]", err)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
