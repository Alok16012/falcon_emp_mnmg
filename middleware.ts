
import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"
import { homeForUser } from "@/lib/modules"

export default withAuth(
    function middleware(req) {
        const token = req.nextauth.token
        const path = req.nextUrl.pathname

        // Redirect logged-in users away from login page
        if (path === "/login") {
            if (token) {
                return NextResponse.redirect(new URL(homeForUser(token), req.url))
            }
            return NextResponse.next()
        }

        // Require authentication
        if (!token) {
            return NextResponse.redirect(new URL("/login", req.url))
        }

        // Only ADMIN can access /admin/users (user management)
        if (path.startsWith("/admin/users") && token.role !== "ADMIN") {
            return NextResponse.redirect(new URL("/admin", req.url))
        }

        return NextResponse.next()
    },
    {
        callbacks: {
            authorized: ({ token }) => !!token,
        },
        pages: {
            signIn: "/login",
        },
    }
)

export const config = {
    matcher: [
        "/admin/:path*",
        "/employees/:path*",
        "/attendance/:path*",
        "/joinings/:path*",
        "/advances/:path*",
        "/expenses/:path*",
        "/leaves/:path*",
        "/payroll/:path*",
        "/departments/:path*",
        "/profile/:path*",
        "/inquiries/:path*",
        "/stock/:path*",
    ],
}
