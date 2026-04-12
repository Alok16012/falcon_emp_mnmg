"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { cn } from "@/lib/utils"
import {
    LayoutDashboard,
    Users,
    Building2,
    UserCheck,
    CalendarOff,
    Wallet,
    CreditCard,
    X,
    Sparkles,
    ClipboardList,
    IndianRupee,
} from "lucide-react"

export function Sidebar({ onMobileClose }: { onMobileClose?: () => void }) {
    const pathname = usePathname()
    const { data: session } = useSession()
    const role = session?.user?.role

    const navigation = [
        {
            title: "MAIN",
            links: [
                { name: "Dashboard", href: "/admin", icon: LayoutDashboard, roles: ["ADMIN", "MANAGER"] },
            ]
        },
        {
            title: "HR MANAGEMENT",
            links: [
                { name: "Employees", href: "/employees", icon: UserCheck, roles: ["ADMIN", "MANAGER"] },
                { name: "Attendance", href: "/attendance", icon: ClipboardList, roles: ["ADMIN", "MANAGER"] },
                { name: "Advance Salary", href: "/advances", icon: IndianRupee, roles: ["ADMIN", "MANAGER"] },
                { name: "Leaves", href: "/leaves", icon: CalendarOff, roles: ["ADMIN", "MANAGER"] },
                { name: "Payroll", href: "/payroll", icon: Wallet, roles: ["ADMIN", "MANAGER"] },
                { name: "Expenses", href: "/expenses", icon: CreditCard, roles: ["ADMIN", "MANAGER"] },
                { name: "Departments", href: "/departments", icon: Building2, roles: ["ADMIN", "MANAGER"] },
            ]
        },
        {
            title: "CONFIGURATION",
            links: [
                { name: "Users", href: "/admin/users", icon: Users, roles: ["ADMIN"] },
                { name: "My Profile", href: "/profile", icon: UserCheck, roles: ["ADMIN", "MANAGER"] },
            ]
        }
    ]

    return (
        <div className="flex h-full w-[230px] flex-col bg-[var(--surface)] border-r border-[var(--border)] overflow-hidden">
            {/* Header / Logo */}
            <div className="flex h-[54px] items-center justify-between px-4 border-b border-[var(--border)] shrink-0">
                <Link href="/" className="flex items-center gap-2.5">
                    <div className="h-8 w-8 bg-[var(--accent)] rounded-[6px] flex items-center justify-center text-white">
                        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 3h18v18H3z" />
                            <path d="M18 9h-6v6h6v-3h-3" />
                        </svg>
                    </div>
                    <span className="font-bold text-[16px] tracking-tight text-[var(--text)]">Growus Auto</span>
                </Link>
                {onMobileClose && (
                    <button onClick={onMobileClose} className="p-1 md:hidden hover:bg-[var(--surface2)] rounded-md transition-colors text-[var(--text3)]">
                        <X size={20} />
                    </button>
                )}
            </div>

            {/* Navigation */}
            <div className="flex-1 overflow-y-auto pt-4 px-2 scrollbar-thin">
                {navigation.map((section) => {
                    const filteredLinks = section.links.filter(link =>
                        role ? link.roles.includes(role) : link.roles.includes("ADMIN")
                    )
                    if (filteredLinks.length === 0) return null

                    return (
                        <div key={section.title} className="mb-6">
                            <h3 className="px-3 mb-2 text-[10.5px] font-semibold text-[var(--text3)] tracking-[0.6px] uppercase">
                                {section.title}
                            </h3>
                            <nav className="space-y-0.5">
                                {filteredLinks.map((link) => {
                                    const Icon = link.icon
                                    const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href))

                                    return (
                                        <Link
                                            key={link.href}
                                            href={link.href}
                                            onClick={onMobileClose}
                                            className={cn(
                                                "flex items-center gap-3 rounded-[8px] px-[10px] py-[8px] text-[13px] transition-all group",
                                                isActive
                                                    ? "bg-[var(--accent-light)] text-[var(--accent-text)] font-medium"
                                                    : "text-[var(--text2)] hover:bg-[var(--surface2)] hover:text-[var(--text)]"
                                            )}
                                        >
                                            <Icon size={18} className={cn(isActive ? "text-[var(--accent-text)]" : "text-[var(--text3)] group-hover:text-[var(--text2)]")} />
                                            {link.name}
                                        </Link>
                                    )
                                })}
                            </nav>
                        </div>
                    )
                })}
            </div>

            {/* Upgrade Box */}
            <div className="px-3 mb-4">
                <div className="bg-[var(--surface2)] border border-[var(--border)] rounded-[12px] p-4 text-center">
                    <div className="flex justify-center mb-2">
                        <div className="h-8 w-8 bg-white border border-[var(--border)] rounded-full flex items-center justify-center text-[var(--amber)] shadow-sm">
                            <Sparkles size={16} fill="currentColor" />
                        </div>
                    </div>
                    <p className="text-[12px] font-medium text-[var(--text)] mb-1">Manage your workforce</p>
                    <p className="text-[11px] text-[var(--text2)] mb-3">Employee management made simple</p>
                </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-[var(--border)] mt-auto">
                <div className="flex flex-col gap-1">
                    <p className="text-[10.5px] text-[var(--text3)]">v1.1.2 · Dashboard</p>
                    <Link href="/terms" className="text-[10.5px] text-[var(--text3)] hover:text-[var(--text2)]">Terms & Conditions</Link>
                </div>
            </div>
        </div>
    )
}
