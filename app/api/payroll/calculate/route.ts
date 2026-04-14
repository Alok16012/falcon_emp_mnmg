import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { Role } from "@prisma/client"
import { calcGrowusPayroll } from "@/lib/payroll-calc"

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || (session.user.role !== Role.ADMIN && session.user.role !== Role.MANAGER)) {
            return new NextResponse("Unauthorized", { status: 401 })
        }

        const body = await req.json()
        const { month, year, branchId, attendance } = body
        // attendance: Array<{ employeeId, monthDays, workedDays, otDays, canteenDays,
        //                      penalty, advance, otherDeductions, productionIncentive, lwf }>

        if (!month || !year) return new NextResponse("Month and Year required", { status: 400 })

        // Get or create payroll run
        let run = await prisma.payrollRun.findUnique({ where: { month_year: { month, year } } })
        if (run && run.status !== "DRAFT") {
            return new NextResponse(`Payroll ${month}/${year} is ${run.status} — cannot recalculate.`, { status: 400 })
        }
        if (!run) {
            run = await prisma.payrollRun.create({
                data: { month, year, processedBy: session.user.id, status: "DRAFT" }
            })
        }

        const whereClause: Record<string, unknown> = { status: "ACTIVE" }
        if (branchId) whereClause.branchId = branchId

        const employees = await prisma.employee.findMany({
            where: whereClause,
            include: { employeeSalary: true }
        })

        if (!employees.length) return new NextResponse("No active employees found", { status: 404 })

        const defaultMonthDays = new Date(year, month, 0).getDate()
        let totalGross = 0, totalNet = 0, totalPfE = 0, totalEsiE = 0

        // Fetch all advances for this month/year in one query
        const monthAdvances = await prisma.advanceAndReimbursement.findMany({
            where: { type: "ADVANCE", monthToImpact: month, yearToImpact: year, status: "APPROVED" }
        })

        // Fetch all approved leaves for this month in one query
        const monthStart = new Date(year, month - 1, 1)
        const monthEnd   = new Date(year, month, 0)
        const monthLeaves = await prisma.leave.findMany({
            where: {
                status: "APPROVED",
                startDate: { lte: monthEnd },
                endDate:   { gte: monthStart },
            }
        })

        const upserts = employees.map(async emp => {
            const sal = emp.employeeSalary
            if (!sal || sal.status !== "APPROVED") return null

            const attInput = (attendance as any[])?.find((a: any) => a.employeeId === emp.id) ?? {}

            // Auto-sum approved advances for this employee this month
            const autoAdvance = monthAdvances
                .filter(a => a.employeeId === emp.id)
                .reduce((sum, a) => sum + a.amount, 0)

            // Auto-calculate leave days (unpaid) → subtract from workedDays
            const empLeaves = monthLeaves.filter(l => l.employeeId === emp.id)
            let leaveDays = 0
            for (const lv of empLeaves) {
                const start = new Date(Math.max(lv.startDate.getTime(), monthStart.getTime()))
                const end   = new Date(Math.min(lv.endDate.getTime(),   monthEnd.getTime()))
                const days  = Math.round((end.getTime() - start.getTime()) / 86400000) + 1
                leaveDays  += Math.max(0, days)
            }

            const monthDays   = attInput.monthDays ?? defaultMonthDays
            const workedDays  = attInput.workedDays !== undefined
                ? Number(attInput.workedDays)
                : Math.max(0, monthDays - leaveDays)

            const att = {
                monthDays,
                workedDays,
                otDays:              Number(attInput.otDays)     || 0,
                canteenDays:         Number(attInput.canteenDays)|| 0,
                penalty:             Number(attInput.penalty)    || 0,
                advance:             Number(attInput.advance)    || autoAdvance,
                otherDeductions:     Number(attInput.otherDeductions) || 0,
                productionIncentive: Number(attInput.productionIncentive) || 0,
                lwf:                 Number(attInput.lwf)        || 0,
            }

            const calc = calcGrowusPayroll({
                basic: sal.basic, da: sal.da, washing: sal.washing,
                conveyance: sal.conveyance, leaveWithWages: sal.leaveWithWages,
                otherAllowance: sal.otherAllowance, otRatePerHour: sal.otRatePerHour,
                canteenRatePerDay: sal.canteenRatePerDay,
            }, att)

            totalGross += calc.grossSalary
            totalNet   += calc.netSalary
            totalPfE   += calc.pfEmployer
            totalEsiE  += calc.esiEmployer

            return prisma.payroll.upsert({
                where: { employeeId_month_year: { employeeId: emp.id, month, year } },
                create: {
                    employeeId: emp.id, payrollRunId: run.id, month, year,
                    ...calc,
                    workingDays: att.monthDays, presentDays: att.workedDays,
                    lwpDays: att.monthDays - att.workedDays,
                    overtimeHrs: att.otDays * 4,
                    status: "DRAFT", processedBy: session.user.id,
                },
                update: {
                    payrollRunId: run.id,
                    ...calc,
                    workingDays: att.monthDays, presentDays: att.workedDays,
                    lwpDays: att.monthDays - att.workedDays,
                    overtimeHrs: att.otDays * 4,
                    processedBy: session.user.id,
                }
            })
        })

        const results = await Promise.all(upserts)
        const processedCount = results.filter(Boolean).length

        await prisma.payrollRun.update({
            where: { id: run.id },
            data: { totalGross, totalNet, totalPfEmployer: totalPfE, totalEsiEmployer: totalEsiE }
        })

        return NextResponse.json({ success: true, processedCount, runId: run.id })
    } catch (error) {
        console.error("[PAYROLL_CALCULATE]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
