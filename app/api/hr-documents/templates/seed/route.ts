import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"

const DEFAULT_TEMPLATES = [
    {
        name: "Appointment Letter",
        type: "APPOINTMENT",
        description: "Standard appointment letter for new employees",
        approvalRequired: true,
        templateContent: `<div style="font-family: Arial, sans-serif; padding: 40px; max-width: 700px; margin: 0 auto;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h2 style="color: #1e3799; font-size: 22px; font-weight: bold;">FALCON PLUS</h2>
    <p style="color: #666; font-size: 12px;">HR Department</p>
  </div>
  <h3 style="text-align: center; text-decoration: underline; color: #333;">APPOINTMENT LETTER</h3>
  <p style="margin-top: 20px;"><strong>Date:</strong> {{date}}</p>
  <p><strong>Ref No:</strong> {{doc_number}}</p>
  <br/>
  <p>Dear <strong>{{employee_name}}</strong>,</p>
  <p>We are pleased to appoint you as <strong>{{designation}}</strong> in our organization with effect from <strong>{{joining_date}}</strong>.</p>
  <p>Your appointment is subject to the following terms and conditions:</p>
  <ul>
    <li>Department: {{department}}</li>
    <li>Designation: {{designation}}</li>
    <li>Date of Joining: {{joining_date}}</li>
    <li>Basic Salary: ₹{{salary}} per month</li>
  </ul>
  <p>We look forward to your contribution and wish you a successful career with us.</p>
  <br/>
  <p>Yours sincerely,</p>
  <br/><br/>
  <p>_________________________</p>
  <p><strong>Authorized Signatory</strong><br/>{{company_name}}</p>
</div>`,
    },
    {
        name: "Experience Letter",
        type: "EXPERIENCE",
        description: "Experience letter issued upon separation",
        approvalRequired: true,
        templateContent: `<div style="font-family: Arial, sans-serif; padding: 40px; max-width: 700px; margin: 0 auto;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h2 style="color: #1e3799;">FALCON PLUS</h2>
  </div>
  <h3 style="text-align: center; text-decoration: underline;">EXPERIENCE LETTER</h3>
  <p><strong>Date:</strong> {{date}}</p>
  <p>To Whomsoever It May Concern,</p>
  <p>This is to certify that <strong>{{employee_name}}</strong> (Employee ID: {{employee_id}}) has worked with us as <strong>{{designation}}</strong> in the <strong>{{department}}</strong> department from <strong>{{joining_date}}</strong> to <strong>{{effective_date}}</strong>.</p>
  <p>During their tenure, they have shown dedication and professionalism. We wish them all the best for their future endeavors.</p>
  <br/>
  <p>Yours sincerely,</p>
  <br/><br/>
  <p>_________________________</p>
  <p><strong>HR Manager</strong><br/>{{company_name}}</p>
</div>`,
    },
    {
        name: "Salary Certificate",
        type: "SALARY_CERT",
        description: "Certificate confirming employee salary details",
        approvalRequired: false,
        templateContent: `<div style="font-family: Arial, sans-serif; padding: 40px; max-width: 700px; margin: 0 auto;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h2 style="color: #1e3799;">FALCON PLUS</h2>
  </div>
  <h3 style="text-align: center; text-decoration: underline;">SALARY CERTIFICATE</h3>
  <p><strong>Date:</strong> {{date}}</p>
  <p>To Whomsoever It May Concern,</p>
  <p>This is to certify that <strong>{{employee_name}}</strong>, employed as <strong>{{designation}}</strong> in our organization, is drawing a Basic Salary of <strong>₹{{salary}}</strong> per month.</p>
  <p>This certificate is issued on request for the purpose of personal use.</p>
  <br/>
  <p>Yours faithfully,</p>
  <br/><br/>
  <p>_________________________</p>
  <p><strong>Authorized Signatory</strong><br/>{{company_name}}</p>
</div>`,
    },
]

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) return new NextResponse("Unauthorized", { status: 401 })
        if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
            return new NextResponse("Forbidden", { status: 403 })
        }

        const existingCount = await prisma.hRDocTemplate.count()
        if (existingCount > 0) {
            return NextResponse.json({ message: "Templates already seeded", count: existingCount })
        }

        const created = await prisma.hRDocTemplate.createMany({
            data: DEFAULT_TEMPLATES.map((t) => ({
                ...t,
                createdBy: session.user.id,
            })),
        })

        return NextResponse.json({ message: "Templates seeded successfully", count: created.count }, { status: 201 })
    } catch (error) {
        console.error("[HR_DOC_TEMPLATES_SEED]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
