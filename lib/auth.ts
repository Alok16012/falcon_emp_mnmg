
import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import prisma from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { Role } from "@prisma/client"

export const authOptions: NextAuthOptions = {
    session: {
        strategy: "jwt",
    },
    pages: {
        signIn: "/login",
    },
    providers: [
        CredentialsProvider({
            name: "credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                console.log("Authorize attempt for:", credentials?.email)

                if (!credentials?.email || !credentials?.password) {
                    console.log("Missing email or password")
                    throw new Error("Invalid credentials")
                }

                try {
                    const user = await prisma.user.findUnique({
                        where: {
                            email: credentials.email,
                        },
                    })

                    if (!user) {
                        console.log("User not found in database:", credentials.email)
                        throw new Error("Invalid credentials")
                    }

                    if (!user.password) {
                        console.log("User has no password set:", credentials.email)
                        throw new Error("Invalid credentials")
                    }

                    const isCorrectPassword = await bcrypt.compare(
                        credentials.password,
                        user.password
                    )

                    if (!isCorrectPassword) {
                        console.log("Password comparison failed for:", credentials.email)
                        throw new Error("Invalid credentials")
                    }

                    if (!user.isActive) {
                        console.log("User account is inactive:", credentials.email)
                        throw new Error("Account is inactive")
                    }

                    console.log("Login successful for:", credentials.email)
                    return {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        role: user.role,
                    }
                } catch (error) {
                    console.error("Auth error details:", error)
                    throw error
                }
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id
                token.role = user.role
            }
            // Always re-fetch role from DB so role changes take effect immediately
            // (without needing re-login)
            if (token.id) {
                try {
                    const dbUser = await prisma.user.findUnique({
                        where: { id: token.id as string },
                        select: { role: true, isActive: true },
                    })
                    if (dbUser) {
                        token.role = dbUser.role
                        token.isActive = dbUser.isActive
                    }
                } catch { /* ignore DB errors */ }
            }
            return token
        },
        async session({ session, token }) {
            if (token) {
                session.user.id = token.id
                session.user.role = token.role as Role
            }
            return session
        },
    },
}
