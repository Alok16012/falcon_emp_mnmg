import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return new NextResponse("Unauthorized", { status: 401 })
        if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
            return new NextResponse("Forbidden", { status: 403 })
        }

        const { searchParams } = new URL(req.url)
        const month = searchParams.get("month")
        const year = searchParams.get("year")
        const status = searchParams.get("status")
        const employeeId = searchParams.get("employeeId")
        const search = searchParams.get("search")

        const where: Record<string, unknown> = {}
        if (month) where.month = parseInt(month)
        if (year) where.year = parseInt(year)
        if (status) where.status = status
        if (employeeId) where.employeeId = employeeId

        if (search) {
            where.employee = {
                OR: [
                    { firstName: { contains: search, mode: "insensitive" } },
                    { lastName: { contains: search, mode: "insensitive" } },
                    { employeeId: { contains: search, mode: "insensitive" } },
                ],
            }
        }

        const payrolls = await prisma.payroll.findMany({
            where,
            include: {
                employee: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        employeeId: true,
                        designation: true,
                        photo: true,
                        branch: { select: { name: true } },
                        department: { select: { name: true } },
                    },
                },
            },
            orderBy: [{ year: "desc" }, { month: "desc" }, { employee: { firstName: "asc" } }],
        })

        return NextResponse.json(payrolls)
    } catch (error) {
        console.error("[PAYROLL_GET]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return new NextResponse("Unauthorized", { status: 401 })
        if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
            return new NextResponse("Forbidden", { status: 403 })
        }

        const body = await req.json()
        const { employeeId, month, year, allowances, overtimePay, otherDeductions, tds, workingDays } = body

        if (!employeeId || !month || !year) {
            return new NextResponse("employeeId, month and year are required", { status: 400 })
        }

        const employee = await prisma.employee.findUnique({ where: { id: employeeId } })
        if (!employee) return new NextResponse("Employee not found", { status: 404 })

        const m = parseInt(month)
        const y = parseInt(year)
        const wDays = workingDays || 26

        // Fetch attendance for the month
        const startDate = new Date(y, m - 1, 1)
        const endDate = new Date(y, m, 1)
        const attendances = await prisma.attendance.findMany({
            where: { employeeId, date: { gte: startDate, lt: endDate } },
        })

        const presentDays = attendances.filter(a => a.status === "PRESENT").length
        const halfDays = attendances.filter(a => a.status === "HALF_DAY").length
        const leaveDays = attendances.filter(a => a.status === "LEAVE").length
        const lwpDays = attendances.filter(a => a.status === "ABSENT").length
        const overtimeHrs = attendances.reduce((s, a) => s + (a.overtimeHrs || 0), 0)
        const effectiveDays = presentDays + (halfDays * 0.5)

        // Fetch advance for this month (to deduct from net)
        const advances = await prisma.advanceAndReimbursement.findMany({
            where: { employeeId, type: "ADVANCE", monthToImpact: m, yearToImpact: y, status: "APPROVED" },
        })
        const totalAdvance = advances.reduce((s, a) => s + a.amount, 0)

        const isLabour = (employee as any).employeeCategory === "LABOUR"
        let earnedBasic: number
        let hraAmt = 0
        let pfEmployee = 0
        let pfEmployer = 0
        let esiEmployee = 0
        let esiEmployer = 0

        if (isLabour) {
            // LABOUR: daily rate × effective days
            const rate = (employee as any).dailyRate || employee.basicSalary
            earnedBasic = rate * (effectiveDays > 0 ? effectiveDays : wDays)
            // Labour usually no PF/HRA unless configured
        } else {
            // STAFF: monthly salary pro-rated
            const basicSalaryMonthly = employee.basicSalary
            const dailyRateCalc = basicSalaryMonthly / wDays
            earnedBasic = effectiveDays > 0 ? dailyRateCalc * effectiveDays : basicSalaryMonthly
            hraAmt = earnedBasic * 0.2
            pfEmployee = Math.round(earnedBasic * 0.12)
            pfEmployer = Math.round(earnedBasic * 0.12)
            esiEmployee = earnedBasic <= 21000 ? Math.round(earnedBasic * 0.0075) : 0
            esiEmployer = earnedBasic <= 21000 ? Math.round(earnedBasic * 0.0325) : 0
        }

        const allowancesAmt = allowances || 0
        const overtimePayAmt = overtimePay || 0
        const grossSalary = earnedBasic + hraAmt + allowancesAmt + overtimePayAmt
        const tdsAmt = tds || 0
        const otherDeductionsAmt = otherDeductions || 0
        // Advance is deducted from net salary
        const totalDeductions = pfEmployee + esiEmployee + tdsAmt + otherDeductionsAmt + totalAdvance
        const netSalary = grossSalary - totalDeductions

        const data = {
            basicSalary: Math.round(earnedBasic),
            hra: Math.round(hraAmt),
            allowances: allowancesAmt,
            overtimePay: overtimePayAmt,
            grossSalary: Math.round(grossSalary),
            pfEmployee,
            pfEmployer,
            esiEmployee,
            esiEmployer,
            tds: tdsAmt,
            otherDeductions: Math.round(otherDeductionsAmt + totalAdvance), // includes advance
            totalDeductions: Math.round(totalDeductions),
            netSalary: Math.round(netSalary),
            workingDays: wDays,
            presentDays: Math.round(effectiveDays),
            leaveDays,
            lwpDays,
            overtimeHrs,
            status: "DRAFT" as const,
        }

        const payroll = await prisma.payroll.upsert({
            where: { employeeId_month_year: { employeeId, month: m, year: y } },
            update: data,
            create: { employeeId, month: m, year: y, ...data },
        })

        return NextResponse.json(payroll)
    } catch (error) {
        console.error("[PAYROLL_POST]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
