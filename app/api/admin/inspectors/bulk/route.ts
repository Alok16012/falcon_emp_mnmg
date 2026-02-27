
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { Role } from "@prisma/client"
import bcrypt from "bcryptjs"

function generateTempPassword(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"
    let password = "Insp@"
    for (let i = 0; i < 4; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return password
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session || (session.user.role !== Role.ADMIN && session.user.role !== Role.MANAGER)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const body = await req.json()
        const { inspectors } = body

        if (!Array.isArray(inspectors) || inspectors.length === 0) {
            return NextResponse.json({ error: "No inspectors provided" }, { status: 400 })
        }

        const created: any[] = []
        const failed: any[] = []

        await prisma.$transaction(async (tx) => {
            for (const inspector of inspectors) {
                const { name, email, phone } = inspector

                if (!name || !email) {
                    failed.push({ name: name || "", email: email || "", error: "Missing name or email" })
                    continue
                }

                const existingUser = await tx.user.findUnique({
                    where: { email }
                })

                if (existingUser) {
                    failed.push({ name, email, error: "Email already exists" })
                    continue
                }

                const tempPassword = generateTempPassword()
                const hashedPassword = await bcrypt.hash(tempPassword, 10)

                try {
                    const user = await tx.user.create({
                        data: {
                            name,
                            email,
                            password: hashedPassword,
                            role: Role.INSPECTION_BOY
                        }
                    })

                    created.push({
                        name: user.name,
                        email: user.email,
                        id: user.id,
                        tempPassword,
                        phone: phone || ""
                    })
                } catch (err: any) {
                    failed.push({ name, email, error: err.message || "Failed to create user" })
                }
            }
        })

        return NextResponse.json({ created, failed })
    } catch (error) {
        console.error("BULK_CREATE_INSPECTORS_ERROR", error)
        return NextResponse.json({ error: "Internal Error" }, { status: 500 })
    }
}
