import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import bcrypt from "bcryptjs"

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
        const employmentType = searchParams.get("employmentType")
        const shiftHoursFilter = searchParams.get("shiftHours")
        const companyId = searchParams.get("companyId")

        const where: Record<string, unknown> = {}
        if (branchId) where.branchId = branchId
        if (departmentId) where.departmentId = departmentId
        if (status) where.status = status
        if (employmentType) where.employmentType = employmentType
        if (shiftHoursFilter) where.shiftHours = parseFloat(shiftHoursFilter)
        if (companyId) {
            // filter via branch -> company
            where.branch = { companyId }
        }
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
            select: {
                id: true,
                employeeId: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                photo: true,
                designation: true,
                status: true,
                gender: true,
                dateOfBirth: true,
                dateOfJoining: true,
                employmentType: true,
                employeeCategory: true,
                basicSalary: true,
                dailyRate: true,
                shiftHours: true,
                hardwareUserId: true,
                createdAt: true,
                branch: { select: { id: true, name: true } },
                department: { select: { id: true, name: true } },
                employeeSalary: { select: { basic: true, otRatePerHour: true } },
            },
            orderBy: { createdAt: "desc" },
        })

        return NextResponse.json(employees, {
            headers: {
                // Browser/CDN caches for 30s, serves stale while revalidating for 60s
                // This means 2nd page load within 30s = instant (from cache)
                "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
            },
        })
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
            firstName, lastName, email, phone, alternatePhone,
            dateOfBirth, gender, address, city, state, pincode,
            aadharNumber, panNumber, bankAccountNumber, bankIFSC, bankName,
            photo, designation, departmentId, branchId,
            dateOfJoining, status, employmentType, basicSalary, dailyRate, employeeCategory, notes,
            // New fields
            middleName, nameAsPerAadhar, fathersName, bloodGroup, maritalStatus, marriageDate, nationality, religion, caste,
            uan, pfNumber, esiNumber, labourCardNo, labourCardExpDate,
            contractFrom, contractPeriodDays, contractorCode, workOrderNumber, workOrderFrom, workOrderTo, workSkill, natureOfWork, categoryCode, employmentTypeCode,
            emergencyContact1Name, emergencyContact1Phone, emergencyContact2Name, emergencyContact2Phone,
            permanentAddress, permanentCity, permanentState, permanentPincode,
            isBackgroundChecked, backgroundCheckRemark, isMedicalDone, medicalRemark,
            safetyGoggles, safetyGogglesDate, safetyGloves, safetyGlovesDate,
            safetyHelmet, safetyHelmetDate, safetyMask, safetyMaskDate,
            safetyJacket, safetyJacketDate, safetyEarMuffs, safetyEarMuffsDate,
            safetyShoes, safetyShoesDate, bankBranch, shiftHours,
        } = body

        if (!firstName || !lastName || !phone) {
            return new NextResponse("firstName, lastName and phone are required", { status: 400 })
        }

        // Auto-generate employeeId as EMP-NNNN
        const lastEmployee = await prisma.employee.findFirst({
            orderBy: { createdAt: "desc" },
            select: { employeeId: true },
        })
        let nextNum = 1
        if (lastEmployee?.employeeId) {
            const match = lastEmployee.employeeId.match(/\d+$/)
            if (match) nextNum = parseInt(match[0]) + 1
        }
        const employeeId = `EMP-${String(nextNum).padStart(4, "0")}`

        // Check uniqueness (race condition safety)
        const existing = await prisma.employee.findUnique({ where: { employeeId } })
        const finalId = existing
            ? `EMP-${String(nextNum + 1).padStart(4, "0")}`
            : employeeId

        // Auto-assign a numeric Hardware (biometric device) User ID derived from
        // the employee number — e.g. EMP-0007 → "7". Keeps it unique & ready for
        // the attendance device without manual mapping. Falls back to next free
        // number if that ID is already taken.
        const hwBase = String(parseInt(finalId.match(/\d+$/)?.[0] || String(nextNum)))
        const hwTaken = await prisma.employee.findFirst({
            where: { hardwareUserId: hwBase },
            select: { id: true },
        })
        let hardwareUserId = hwBase
        if (hwTaken) {
            const maxHw = await prisma.employee.findMany({
                where: { hardwareUserId: { not: null } },
                select: { hardwareUserId: true },
            })
            const maxNum = maxHw.reduce((m, e) => {
                const n = parseInt(e.hardwareUserId || "0")
                return isNaN(n) ? m : Math.max(m, n)
            }, 0)
            hardwareUserId = String(maxNum + 1)
        }

        // ── Auto-create User account ──────────────────────────────────────────
        // Email: use provided email, else phone@cims.local
        // Password: phone number (employee can change later)
        // Role: INSPECTION_BOY by default
        const userEmail = email || `${phone}@cims.local`
        const passwordHash = await bcrypt.hash(phone, 10)

        // Check if user already exists with this email
        const existingUser = await prisma.user.findUnique({ where: { email: userEmail } })

        let userId: string
        if (existingUser) {
            userId = existingUser.id
        } else {
            const newUser = await prisma.user.create({
                data: {
                    name: `${firstName} ${lastName}`,
                    email: userEmail,
                    password: passwordHash,
                    role: "INSPECTION_BOY",
                },
            })
            userId = newUser.id
        }

        const employee = await prisma.employee.create({
            data: {
                employeeId: finalId,
                hardwareUserId,
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
                branchId: branchId || null,
                dateOfJoining: dateOfJoining ? new Date(dateOfJoining) : null,
                status: status || "ACTIVE",
                employmentType: employmentType || "Full-time",
                employeeCategory: employeeCategory || "LABOUR",
                basicSalary: basicSalary ? parseFloat(basicSalary) : 0,
                dailyRate: dailyRate ? parseFloat(dailyRate) : null,
                shiftHours: shiftHours ? parseFloat(String(shiftHours)) : 8,
                userId,
                // New fields
                middleName: middleName || null,
                nameAsPerAadhar: nameAsPerAadhar || null,
                fathersName: fathersName || null,
                bloodGroup: bloodGroup || null,
                maritalStatus: maritalStatus || null,
                marriageDate: marriageDate ? new Date(marriageDate) : null,
                nationality: nationality || "Indian",
                religion: religion || null,
                caste: caste || null,
                uan: uan || null,
                pfNumber: pfNumber || null,
                esiNumber: esiNumber || null,
                labourCardNo: labourCardNo || null,
                labourCardExpDate: labourCardExpDate ? new Date(labourCardExpDate) : null,
                contractFrom: contractFrom ? new Date(contractFrom) : null,
                contractPeriodDays: contractPeriodDays ? parseInt(String(contractPeriodDays)) : null,
                contractorCode: contractorCode || null,
                workOrderNumber: workOrderNumber || null,
                workOrderFrom: workOrderFrom ? new Date(workOrderFrom) : null,
                workOrderTo: workOrderTo ? new Date(workOrderTo) : null,
                workSkill: workSkill || null,
                natureOfWork: natureOfWork || null,
                categoryCode: categoryCode || null,
                employmentTypeCode: employmentTypeCode || null,
                emergencyContact1Name: emergencyContact1Name || null,
                emergencyContact1Phone: emergencyContact1Phone || null,
                emergencyContact2Name: emergencyContact2Name || null,
                emergencyContact2Phone: emergencyContact2Phone || null,
                permanentAddress: permanentAddress || null,
                permanentCity: permanentCity || null,
                permanentState: permanentState || null,
                permanentPincode: permanentPincode || null,
                isBackgroundChecked: isBackgroundChecked ?? false,
                backgroundCheckRemark: backgroundCheckRemark || null,
                isMedicalDone: isMedicalDone ?? false,
                medicalRemark: medicalRemark || null,
                safetyGoggles: safetyGoggles ?? false,
                safetyGogglesDate: safetyGogglesDate ? new Date(safetyGogglesDate) : null,
                safetyGloves: safetyGloves ?? false,
                safetyGlovesDate: safetyGlovesDate ? new Date(safetyGlovesDate) : null,
                safetyHelmet: safetyHelmet ?? false,
                safetyHelmetDate: safetyHelmetDate ? new Date(safetyHelmetDate) : null,
                safetyMask: safetyMask ?? false,
                safetyMaskDate: safetyMaskDate ? new Date(safetyMaskDate) : null,
                safetyJacket: safetyJacket ?? false,
                safetyJacketDate: safetyJacketDate ? new Date(safetyJacketDate) : null,
                safetyEarMuffs: safetyEarMuffs ?? false,
                safetyEarMuffsDate: safetyEarMuffsDate ? new Date(safetyEarMuffsDate) : null,
                safetyShoes: safetyShoes ?? false,
                safetyShoesDate: safetyShoesDate ? new Date(safetyShoesDate) : null,
                bankBranch: bankBranch || null,
            },
        })

        return NextResponse.json({
            ...employee,
            _userCreated: !existingUser,
            _loginEmail: userEmail,
            _loginPassword: phone,
        })
    } catch (error) {
        console.error("[EMPLOYEES_POST]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
