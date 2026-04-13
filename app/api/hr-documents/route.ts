import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

function replaceVariables(content: string, vars: Record<string, string>): string {
    let result = content
    for (const [key, value] of Object.entries(vars)) {
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value || "")
    }
    return result
}

function formatDate(date: Date | string | null | undefined): string {
    if (!date) return ""
    const d = new Date(date)
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })
}

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return new NextResponse("Unauthorized", { status: 401 })

        const { searchParams } = new URL(req.url)
        const status = searchParams.get("status")
        const employeeId = searchParams.get("employeeId")
        const type = searchParams.get("type")

        const where: Record<string, unknown> = {}
        if (status) where.status = status
        if (employeeId) where.employeeId = employeeId
        if (type) where.type = type

        const documents = await prisma.hRDocument.findMany({
            where,
            include: {
                employee: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        employeeId: true,
                        designation: true,
                    },
                },
                template: {
                    select: {
                        id: true,
                        name: true,
                        type: true,
                        approvalRequired: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        })

        return NextResponse.json(documents)
    } catch (error) {
        console.error("[HR_DOCUMENTS_GET]", error)
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
        const { templateId, employeeId, effectiveDate, customTitle, statusOverride } = body

        if (!templateId || !employeeId) {
            return new NextResponse("Missing required fields", { status: 400 })
        }

        const [template, employee] = await Promise.all([
            prisma.hRDocTemplate.findUnique({ where: { id: templateId } }),
            prisma.employee.findUnique({
                where: { id: employeeId },
                include: {
                    department: { select: { name: true } },
                    branch: { select: { name: true } },
                    employeeSalary: true,
                },
            }),
        ])

        if (!template) return new NextResponse("Template not found", { status: 404 })
        if (!employee) return new NextResponse("Employee not found", { status: 404 })

        // Generate doc number
        const count = await prisma.hRDocument.count()
        const year = new Date().getFullYear()
        const docNumber = `DOC-${year}-${String(count + 1).padStart(4, "0")}`

        const salary = employee.employeeSalary?.basic ?? employee.basicSalary ?? 0
        const today = new Date()
        const effectiveDateObj = effectiveDate ? new Date(effectiveDate) : today

        const variables: Record<string, string> = {
            employee_name: `${employee.firstName} ${employee.lastName}`,
            designation: employee.designation || "",
            department: employee.department?.name || "",
            joining_date: formatDate(employee.dateOfJoining),
            salary: salary.toLocaleString("en-IN"),
            company_name: "Falcon Plus",
            employee_id: employee.employeeId || "",
            date: formatDate(today),
            effective_date: formatDate(effectiveDateObj),
            doc_number: docNumber,
        }

        const renderedContent = replaceVariables(template.templateContent, variables)

        let status: "DRAFT" | "PENDING_APPROVAL" = "DRAFT"
        if (statusOverride === "PENDING_APPROVAL") {
            status = "PENDING_APPROVAL"
        } else if (template.approvalRequired) {
            status = "PENDING_APPROVAL"
        }

        const document = await prisma.hRDocument.create({
            data: {
                docNumber,
                templateId,
                employeeId,
                type: template.type,
                title: customTitle || template.name,
                content: renderedContent,
                status,
                effectiveDate: effectiveDateObj,
                createdBy: session.user.id,
            },
            include: {
                employee: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        employeeId: true,
                        designation: true,
                    },
                },
                template: {
                    select: { id: true, name: true, type: true },
                },
            },
        })

        return NextResponse.json(document, { status: 201 })
    } catch (error) {
        console.error("[HR_DOCUMENTS_POST]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
