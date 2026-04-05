import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

export async function GET(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return new NextResponse("Unauthorized", { status: 401 })
        if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
            return new NextResponse("Forbidden", { status: 403 })
        }

        const employee = await prisma.employee.findUnique({
            where: { id: params.id },
            include: {
                branch: true,
                department: true,
                documents: true,
                deployments: { include: { site: true }, orderBy: { createdAt: "desc" } },
                attendances: { orderBy: { date: "desc" }, take: 30 },
                leaves: { orderBy: { createdAt: "desc" } },
                payrolls: { orderBy: [{ year: "desc" }, { month: "desc" }] },
                assets: { include: { asset: true } },
            },
        })

        if (!employee) return new NextResponse("Not Found", { status: 404 })
        return NextResponse.json(employee)
    } catch (error) {
        console.error("[EMPLOYEE_GET]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}

export async function PUT(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return new NextResponse("Unauthorized", { status: 401 })
        if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
            return new NextResponse("Forbidden", { status: 403 })
        }

        const body = await req.json()
        const {
            firstName, lastName, email, phone, alternatePhone,
            dateOfBirth, gender, address, city, state, pincode,
            aadharNumber, panNumber, bankAccountNumber, bankIFSC, bankName,
            photo, designation, departmentId, branchId,
            dateOfJoining, status, employmentType, basicSalary,
        } = body

        const employee = await prisma.employee.update({
            where: { id: params.id },
            data: {
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
                status,
                employmentType,
                basicSalary: basicSalary ? parseFloat(basicSalary) : 0,
            },
        })

        return NextResponse.json(employee)
    } catch (error) {
        console.error("[EMPLOYEE_PUT]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return new NextResponse("Unauthorized", { status: 401 })
        if (session.user.role !== "ADMIN") {
            return new NextResponse("Forbidden", { status: 403 })
        }

        await prisma.employee.delete({ where: { id: params.id } })
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("[EMPLOYEE_DELETE]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
