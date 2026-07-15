"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { cn } from "@/lib/utils"
import { MODULES } from "@/lib/modules"
import {
    LayoutDashboard,
    UserCheck,
    Wallet,
    X,
    Sparkles,
    ClipboardList,
    IndianRupee,
    Cpu,
    PackageSearch,
    UserPlus,
    Boxes,
    UsersRound,
    type LucideIcon,
} from "lucide-react"

// Icon per module key (module list itself lives in lib/modules.ts)
const MODULE_ICONS: Record<string, LucideIcon> = {
    dashboard: LayoutDashboard,
    employees: UserCheck,
    attendance: ClipboardList,
    joinings: UserPlus,
    advances: IndianRupee,
    payroll: Wallet,
    inquiries: PackageSearch,
    stock: Boxes,
    hardware: Cpu,
    users: UsersRound,
    profile: UserCheck,
}

export function Sidebar({ onMobileClose }: { onMobileClose?: () => void }) {
    const pathname = usePathname()
    const { data: session } = useSession()
    const [mounted, setMounted] = useState(false)
    useEffect(() => setMounted(true), [])
    // Gate role until mounted so SSR and first client render match (avoids hydration mismatch)
    const role = mounted ? session?.user?.role : undefined
    const allowed = mounted ? (session?.user?.modules || []) : []

    // Which module keys this user may see. ADMIN → everything; others → the
    // modules granted to their role (resolved in the auth session).
    const canSee = (key: string, adminOnly?: boolean) => {
        if (role === "ADMIN") return true
        if (adminOnly) return false
        return allowed.includes(key)
    }

    // Build sidebar sections from the central module list, in declared order.
    const groupOrder = ["MAIN", "HR MANAGEMENT", "SALES", "CONFIGURATION"]
    const navigation = groupOrder.map(title => ({
        title,
        links: MODULES
            .filter(m => m.group === title && canSee(m.key, m.adminOnly))
            .map(m => ({ name: m.label, href: m.href, icon: MODULE_ICONS[m.key] || UserCheck })),
    })).filter(section => section.links.length > 0)

    return (
        <div className="flex h-full w-[230px] flex-col bg-[var(--surface)] border-r border-[var(--border)] overflow-hidden">
            {/* Header / Logo */}
            <div className="flex h-[54px] items-center justify-between px-4 border-b border-[var(--border)] shrink-0">
                <Link href="/" className="flex items-center gap-2.5">
                    <div className="h-8 w-8 bg-[#1e3799] rounded-[6px] flex items-center justify-center text-white shrink-0">
                        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="currentColor">
                            <path d="M4 4h10c3.3 0 6 2.7 6 6s-2.7 6-6 6H9v4H4V4zm5 8h5c1.1 0 2-.9 2-2s-.9-2-2-2H9v4z"/>
                        </svg>
                    </div>
                    <div className="flex flex-col leading-none">
                        <span className="font-black text-[15px] tracking-tight text-[#1e3799] uppercase">Falcon</span>
                        <span className="font-semibold text-[10px] tracking-widest text-[var(--text3)] uppercase">Plus EMP</span>
                    </div>
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
                    return (
                        <div key={section.title} className="mb-6">
                            <h3 className="px-3 mb-2 text-[10.5px] font-semibold text-[var(--text3)] tracking-[0.6px] uppercase">
                                {section.title}
                            </h3>
                            <nav className="space-y-0.5">
                                {section.links.map((link) => {
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
