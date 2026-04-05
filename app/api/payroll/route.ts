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
        const branchId = searchParams.get("branchId")

        const where: Record<string, unknown> = {}
        if (month) where.month = parseInt(month)
        if (year) where.year = parseInt(year)
        if (branchId) where.employee = { branchId }

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
            orderBy: [{ year: "desc" }, { month: "desc" }],
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
        const { employeeId, month, year, hra, allowances, overtimePay, otherDeductions, tds, workingDays, presentDays } = body

        if (!employeeId || !month || !year) {
            return new NextResponse("employeeId, month and year are required", { status: 400 })
        }

        const employee = await prisma.employee.findUnique({ where: { id: employeeId } })
        if (!employee) return new NextResponse("Employee not found", { status: 404 })

        const basicSalary = employee.basicSalary
        const hraAmt = hra || basicSalary * 0.4
        const allowancesAmt = allowances || 0
        const overtimePayAmt = overtimePay || 0
        const grossSalary = basicSalary + hraAmt + allowancesAmt + overtimePayAmt

        // PF: 12% of basic
        const pfEmployee = basicSalary * 0.12
        // ESI: 0.75% of gross if gross < 21000
        const esiEmployee = grossSalary < 21000 ? grossSalary * 0.0075 : 0
        const tdsAmt = tds || 0
        const otherDeductionsAmt = otherDeductions || 0

        const totalDeductions = pfEmployee + esiEmployee + tdsAmt + otherDeductionsAmt
        const netSalary = grossSalary - totalDeductions

        const payroll = await prisma.payroll.upsert({
            where: { employeeId_month_year: { employeeId, month: parseInt(month), year: parseInt(year) } },
            update: {
                basicSalary,
                hra: hraAmt,
                allowances: allowancesAmt,
                overtimePay: overtimePayAmt,
                grossSalary,
                pfEmployee,
                esiEmployee,
                tds: tdsAmt,
                otherDeductions: otherDeductionsAmt,
                netSalary,
                workingDays: workingDays || 26,
                presentDays: presentDays || 0,
                status: "PROCESSED",
                processedAt: new Date(),
            },
            create: {
                employeeId,
                month: parseInt(month),
                year: parseInt(year),
                basicSalary,
                hra: hraAmt,
                allowances: allowancesAmt,
                overtimePay: overtimePayAmt,
                grossSalary,
                pfEmployee,
                esiEmployee,
                tds: tdsAmt,
                otherDeductions: otherDeductionsAmt,
                netSalary,
                workingDays: workingDays || 26,
                presentDays: presentDays || 0,
                status: "PROCESSED",
                processedAt: new Date(),
            },
        })

        return NextResponse.json(payroll)
    } catch (error) {
        console.error("[PAYROLL_POST]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
