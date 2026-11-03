import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { canAccessModule } from "@/lib/modules"
import { calcHourlyPayroll, monthPeriod, SALARY_BASE_DAYS } from "@/lib/hourly-payroll"

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

// Save hourly (30-day base · shift-wise · Sunday rules) payroll for employees and
// set its status. The numbers are recomputed here from attendance with the same
// lib the Payroll page uses, so what is saved always matches what was shown.
//
// POST { month, year, from?, to?, employeeIds: string[], status: "PAID" | "DRAFT",
//        overrides?: { [employeeId]: { advance?: number, otHrs?: number, paidAmount?: number } } }
//
// Carry forward: last month's (netSalary − paidAmount) is added to this month's
// net, so a short payment is made good (and an over-payment taken back).
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return new NextResponse("Unauthorized", { status: 401 })
        if (!canAccessModule(session.user, "payroll")) {
            return new NextResponse("Forbidden", { status: 403 })
        }

        const body = await req.json()
        const month = parseInt(body.month), year = parseInt(body.year)
        const employeeIds: string[] = Array.isArray(body.employeeIds) ? body.employeeIds : []
        const status: "PAID" | "DRAFT" = body.status === "PAID" ? "PAID" : "DRAFT"
        const overrides: Record<string, { advance?: number; otHrs?: number; paidAmount?: number }> = body.overrides ?? {}
        if (!month || !year || employeeIds.length === 0) {
            return new NextResponse("month, year and employeeIds are required", { status: 400 })
        }

        const period = body.from && body.to ? { from: String(body.from), to: String(body.to) } : monthPeriod(year, month)
        const [fy, fm, fd] = period.from.split("-").map(Number)
        const [ty, tm, td] = period.to.split("-").map(Number)
        // Pad a day each side; the lib keeps only records whose IST date is in the period
        const dateRange = { gte: new Date(Date.UTC(fy, fm - 1, fd - 1)), lt: new Date(Date.UTC(ty, tm - 1, td + 2)) }

        const prevMonth = month === 1 ? 12 : month - 1, prevYear = month === 1 ? year - 1 : year
        const [employees, attendances, advances, prevPayrolls] = await Promise.all([
            prisma.employee.findMany({
                where: { id: { in: employeeIds } },
                select: {
                    id: true, employeeId: true, firstName: true, lastName: true, basicSalary: true,
                    shiftHours: true, shiftStart: true, shiftEnd: true, dateOfJoining: true, dateOfLeaving: true,
                },
            }),
            prisma.attendance.findMany({
                where: { employeeId: { in: employeeIds }, date: dateRange },
                include: { punchLogs: { select: { punchTime: true } } },
            }),
            prisma.advanceAndReimbursement.findMany({
                where: { employeeId: { in: employeeIds }, type: "ADVANCE", monthToImpact: month, yearToImpact: year, status: "APPROVED" },
                orderBy: { advanceDate: "asc" },
            }),
            prisma.payroll.findMany({
                where: { employeeId: { in: employeeIds }, month: prevMonth, year: prevYear },
                select: { employeeId: true, status: true, netSalary: true, paidAmount: true },
            }),
        ])

        const saved: string[] = []
        for (const emp of employees) {
            const ov = overrides[emp.id] ?? {}
            const empAdvances = advances.filter(a => a.employeeId === emp.id).map(a => ({
                date: (a.advanceDate ?? a.createdAt).toISOString().slice(0, 10), amount: a.amount, reason: a.reason,
            }))
            const calc = calcHourlyPayroll(
                emp,
                attendances.filter(a => a.employeeId === emp.id),
                period,
                {
                    advances: empAdvances,
                    advance: ov.advance,
                    otHrs: ov.otHrs ?? 0,
                    carryForward: carryForwardOf(prevPayrolls.find(p => p.employeeId === emp.id)),
                },
            )
            const paidAmount = status === "PAID"
                ? Math.max(0, Math.round(Number.isFinite(Number(ov.paidAmount)) && ov.paidAmount != null ? Number(ov.paidAmount) : calc.net))
                : null

            const data = {
                basicFull: calc.monthlySalary,                    // full 30-day salary before cuts
                basicSalary: calc.workPay,                        // Mon–Sat hours × hourly rate
                allowances: calc.freeSundayPay,                   // free (paid) Sundays
                overtimePay: r(calc.sundayPay + calc.otPay),      // Sunday double pay + manual OT
                lwpDays: calc.absentDays + calc.unpaidSundays,    // days cut
                hra: 0, pfEmployee: 0, pfEmployer: 0, esiEmployee: 0, esiEmployer: 0, tds: 0,
                grossSalary: calc.gross,
                advance: calc.advance,
                otherDeductions: 0,
                totalDeductions: calc.advance,
                netSalary: calc.net,
                paidAmount,
                workingDays: SALARY_BASE_DAYS,
                presentDays: calc.daysWorked,
                overtimeHrs: r(calc.sundayHours + calc.otHrs),
                overtimeRate: calc.hourlyRate,
                remarks:
                    `Hourly ₹${calc.hourlyRate} (₹${calc.monthlySalary} ÷ 30 ÷ ${calc.shiftHours}h) · ` +
                    `${calc.daysWorked} days / ${calc.workHours}h (−${calc.lateEarlyHrs}h late/early) · ` +
                    `Absent ${calc.absentDays} · Unpaid Sundays ${calc.unpaidSundays} · ` +
                    `Sunday worked ${calc.sundaysWorked} (${calc.sundayHours}h ×2) · Free Sundays ${calc.freeSundays}` +
                    (calc.carryForward ? ` · Carry fwd ₹${calc.carryForward}` : "") +
                    (paidAmount != null && paidAmount !== calc.net ? ` · Paid ₹${paidAmount} (balance ₹${calc.net - paidAmount} to next month)` : ""),
                status,
                ...(status === "PAID"
                    ? { paidAt: new Date(), paidBy: session.user.id }
                    : { paidAt: null, paidBy: null }),
            }

            await prisma.payroll.upsert({
                where: { employeeId_month_year: { employeeId: emp.id, month, year } },
                create: { employeeId: emp.id, month, year, processedBy: session.user.id, ...data },
                update: data,
            })

            // Keep one SALARY expense per employee per month in step with the payroll
            const title = `Salary - ${emp.firstName} ${emp.lastName} (${MONTHS[month - 1]} ${year})`
            const existingExp = await prisma.expense.findFirst({ where: { employeeId: emp.id, category: "SALARY", title } })
            if (status === "PAID") {
                if (existingExp) {
                    await prisma.expense.update({
                        where: { id: existingExp.id },
                        data: { amount: paidAmount ?? calc.net, status: "APPROVED" },
                    }).catch(() => {})
                } else {
                    const expCount = await prisma.expense.count()
                    await prisma.expense.create({
                        data: {
                            expenseNo: `EXP-${String(expCount + 1).padStart(4, "0")}`,
                            title, category: "SALARY", amount: paidAmount ?? calc.net,
                            date: new Date(year, month - 1, 1),
                            description: `Net salary paid to ${emp.employeeId} for ${MONTHS[month - 1]} ${year}`,
                            employeeId: emp.id, submittedBy: session.user.id, status: "APPROVED",
                        },
                    }).catch(() => {})
                }
            } else if (existingExp) {
                // Marked unpaid again → the salary expense goes back to draft
                await prisma.expense.update({
                    where: { id: existingExp.id },
                    data: { amount: calc.net, status: "DRAFT" },
                }).catch(() => {})
            }
            saved.push(emp.id)
        }

        return NextResponse.json({ saved: saved.length })
    } catch (error) {
        console.error("[PAYROLL_HOURLY_POST]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}

function r(n: number) { return Math.round(n * 100) / 100 }

/** Balance left over from last month: only when it was marked PAID for a different amount. */
function carryForwardOf(prev?: { status: string; netSalary: number; paidAmount: number | null } | null) {
    if (!prev || prev.status !== "PAID" || prev.paidAmount == null) return 0
    return r(prev.netSalary - prev.paidAmount)
}
