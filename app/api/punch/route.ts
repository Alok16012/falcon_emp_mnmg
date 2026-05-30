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
        const message = err instanceof Error ? err.message : "Internal Error"
        return NextResponse.json({ error: message }, { status: 500 })
    }
}

// POST: single tap punch — odd = IN, even = OUT
export async function POST(req: Request) {
    try {
        const { employeeId } = await req.json()

        if (!employeeId) {
            return new NextResponse("employeeId required", { status: 400 })
        }

        const now = new Date()
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const todayEnd = new Date(todayStart)
        todayEnd.setDate(todayEnd.getDate() + 1)

        // Get or create today's attendance record
        let attendance = await prisma.attendance.findFirst({
            where: { employeeId, date: { gte: todayStart, lt: todayEnd } },
            include: { punchLogs: { orderBy: { punchNumber: "asc" } } },
        })

        if (!attendance) {
            attendance = await prisma.attendance.create({
                data: {
                    employeeId,
                    date: todayStart,
                    status: "PRESENT",
                },
                include: { punchLogs: true },
            })
        }

        const punchCount = attendance.punchLogs.length
        const nextPunchNumber = punchCount + 1
        // Odd punch = IN, Even punch = OUT
        const punchType = nextPunchNumber % 2 === 1 ? "IN" : "OUT"

        // Create punch log
        await prisma.punchLog.create({
            data: {
                employeeId,
                attendanceId: attendance.id,
                punchNumber: nextPunchNumber,
                punchType,
                punchTime: now,
            },
        })

        // Recalculate total working hours from all IN/OUT pairs
        const allPunches = [...attendance.punchLogs, {
            punchNumber: nextPunchNumber,
            punchType,
            punchTime: now,
        }].sort((a, b) => a.punchNumber - b.punchNumber)

        let totalWorkingMs = 0
        for (let i = 0; i < allPunches.length - 1; i += 2) {
            const inPunch = allPunches[i]
            const outPunch = allPunches[i + 1]
            if (inPunch && outPunch && inPunch.punchType === "IN" && outPunch.punchType === "OUT") {
                totalWorkingMs += new Date(outPunch.punchTime).getTime() - new Date(inPunch.punchTime).getTime()
            }
        }
        const totalWorkingHrs = parseFloat((totalWorkingMs / (1000 * 60 * 60)).toFixed(2))

        // Update attendance: first IN as checkIn, last OUT as checkOut, working hrs
        const firstIn = allPunches.find(p => p.punchType === "IN")
        const lastOut = [...allPunches].reverse().find(p => p.punchType === "OUT")

        await prisma.attendance.update({
            where: { id: attendance.id },
            data: {
                checkIn: firstIn ? new Date(firstIn.punchTime) : undefined,
                checkOut: lastOut ? new Date(lastOut.punchTime) : undefined,
                workingHrs: totalWorkingHrs,
                status: "PRESENT",
            },
        })

        return NextResponse.json({
            ok: true,
            punchNumber: nextPunchNumber,
            punchType,
            time: now,
            totalWorkingHrs,
            totalPunches: nextPunchNumber,
        })
    } catch (err) {
        console.error("[PUNCH_POST]", err)
        const message = err instanceof Error ? err.message : "Internal Error"
        return NextResponse.json({ error: message }, { status: 500 })
    }
}

// GET today's punches for an employee
export async function PUT(req: Request) {
    try {
        const { employeeId } = await req.json()
        if (!employeeId) return new NextResponse("employeeId required", { status: 400 })

        const now = new Date()
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const todayEnd = new Date(todayStart)
        todayEnd.setDate(todayEnd.getDate() + 1)

        const attendance = await prisma.attendance.findFirst({
            where: { employeeId, date: { gte: todayStart, lt: todayEnd } },
            include: { punchLogs: { orderBy: { punchNumber: "asc" } } },
        })

        return NextResponse.json({
            punches: attendance?.punchLogs ?? [],
            workingHrs: attendance?.workingHrs ?? 0,
        })
    } catch (err) {
        console.error("[PUNCH_PUT]", err)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
