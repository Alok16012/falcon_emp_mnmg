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
        const branchId = searchParams.get("branchId")
        const departmentId = searchParams.get("departmentId")
        const status = searchParams.get("status")
        const search = searchParams.get("search")

        const where: Record<string, unknown> = {}
        if (branchId) where.branchId = branchId
        if (departmentId) where.departmentId = departmentId
        if (status) where.status = status
        if (search) {
            where.OR = [
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
                { employeeId: { contains: search, mode: "insensitive" } },
                { phone: { contains: search, mode: "insensitive" } },
                { designation: { contains: search, mode: "insensitive" } },
            ]
        }

        const employees = await prisma.employee.findMany({
            where,
            include: {
                branch: { select: { id: true, name: true } },
                department: { select: { id: true, name: true } },
                _count: { select: { attendances: true, leaves: true } },
            },
            orderBy: { createdAt: "desc" },
        })

        return NextResponse.json(employees)
    } catch (error) {
        console.error("[EMPLOYEES_GET]", error)
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
        const {
            employeeId, firstName, lastName, email, phone, alternatePhone,
            dateOfBirth, gender, address, city, state, pincode,
            aadharNumber, panNumber, bankAccountNumber, bankIFSC, bankName,
            photo, designation, departmentId, branchId,
            dateOfJoining, status, employmentType, basicSalary,
        } = body

        if (!employeeId || !firstName || !lastName || !phone || !branchId) {
            return new NextResponse("employeeId, firstName, lastName, phone and branchId are required", { status: 400 })
        }

        const employee = await prisma.employee.create({
            data: {
                employeeId,
                firstName,
                lastName,
                email,
                phone,
                alternatePhone,
                dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
                gender,
                address,
                city,
                state,
                pincode,
                aadharNumber,
                panNumber,
                bankAccountNumber,
                bankIFSC,
                bankName,
                photo,
                designation,
                departmentId: departmentId || null,
                branchId,
                dateOfJoining: dateOfJoining ? new Date(dateOfJoining) : null,
                status: status || "ACTIVE",
                employmentType: employmentType || "Full-time",
                basicSalary: basicSalary ? parseFloat(basicSalary) : 0,
            },
        })

        return NextResponse.json(employee)
    } catch (error) {
        console.error("[EMPLOYEES_POST]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
