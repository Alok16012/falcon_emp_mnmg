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
        <div className="flex h-full w-full flex-col overflow-hidden bg-[var(--accent-dark)] text-white">
            {/* Header / Logo */}
            <div className="flex items-center justify-between px-4 pt-[18px] pb-4 shrink-0">
                <Link href="/" className="flex items-center gap-2.5">
                    <div className="h-[38px] w-[38px] bg-white rounded-full flex items-center justify-center text-[var(--accent)] shrink-0 shadow-sm">
                        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="currentColor">
                            <path d="M4 4h10c3.3 0 6 2.7 6 6s-2.7 6-6 6H9v4H4V4zm5 8h5c1.1 0 2-.9 2-2s-.9-2-2-2H9v4z"/>
                        </svg>
                    </div>
                    <div className="flex flex-col leading-tight">
                        <span className="font-extrabold text-[16px] tracking-tight text-white">Falcon Plus</span>
                        <span className="font-semibold text-[10px] tracking-[0.08em] text-white/65 uppercase">Admin Panel</span>
                    </div>
                </Link>
                {onMobileClose && (
                    <button onClick={onMobileClose} className="p-1 md:hidden hover:bg-white/10 rounded-md transition-colors text-white/80">
                        <X size={20} />
                    </button>
                )}
            </div>

            {/* Navigation */}
            <div className="flex-1 overflow-y-auto px-3 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {navigation.map((section) => {
                    return (
                        <div key={section.title} className="mb-3.5">
                            <h3 className="px-2.5 mb-1.5 text-[10.5px] font-bold text-white/50 tracking-[0.08em] uppercase">
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
                                            aria-current={isActive ? "page" : undefined}
                                            className={cn(
                                                "flex items-center gap-2.5 rounded-[10px] px-2.5 py-[9px] text-[13.5px] transition-colors",
                                                isActive
                                                    ? "bg-white/[0.14] text-white font-bold"
                                                    : "text-white/[0.78] font-medium hover:bg-white/[0.08] hover:text-white"
                                            )}
                                        >
                                            <Icon size={18} className={isActive ? "text-white" : "text-white/70"} />
                                            {link.name}
                                        </Link>
                                    )
                                })}
                            </nav>
                        </div>
                    )
                })}
            </div>

            {/* Footer */}
            <div className="mx-3 py-3 border-t border-white/15 mt-auto">
                <div className="flex flex-col gap-1 px-2.5">
                    <p className="text-[10.5px] text-white/55">v1.1.2 · Dashboard</p>
                    <Link href="/terms" className="text-[10.5px] text-white/55 hover:text-white/80">Terms & Conditions</Link>
                </div>
            </div>
        </div>
    )
}
