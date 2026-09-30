"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { MODULES } from "@/lib/modules"
import {
    Home,
    Users,
    CalendarDays,
    IndianRupee,
    LayoutGrid,
    UserPlus,
    Wallet,
    PackageSearch,
    Boxes,
    Cpu,
    UsersRound,
    UserCircle,
    LogOut,
    X,
    type LucideIcon,
} from "lucide-react"

// Floating pill bottom nav (Pushpak design) — the app's only navigation.
// The bar shows the first 4 modules the user may access; everything else,
// plus sign-out, lives in the "More" sheet.
const TAB_META: Record<string, { label: string; icon: LucideIcon; tint: [string, string] }> = {
    dashboard: { label: "Home", icon: Home, tint: ["#e8effe", "#0b5cff"] },
    employees: { label: "Employees", icon: Users, tint: ["#dcfce7", "#15803d"] },
    attendance: { label: "Attendance", icon: CalendarDays, tint: ["#dbeafe", "#1e40af"] },
    payroll: { label: "Payroll", icon: IndianRupee, tint: ["#fff4ea", "#e8650c"] },
    stock: { label: "Stock", icon: Boxes, tint: ["#e6fffa", "#0d9488"] },
    inquiries: { label: "Inquiries", icon: PackageSearch, tint: ["#f5f3ff", "#7c3aed"] },
    joinings: { label: "Joinings", icon: UserPlus, tint: ["#fef3c7", "#d97706"] },
    advances: { label: "Advances", icon: Wallet, tint: ["#fee2e2", "#dc2626"] },
    hardware: { label: "Hardware", icon: Cpu, tint: ["#e0f2fe", "#0e7490"] },
    users: { label: "Users", icon: UsersRound, tint: ["#eef2ff", "#0847c7"] },
    profile: { label: "Profile", icon: UserCircle, tint: ["#f3f4f6", "#374151"] },
}
const TAB_PRIORITY = ["dashboard", "employees", "attendance", "payroll", "stock", "inquiries", "joinings", "advances", "hardware"]

const isActiveHref = (pathname: string, href: string) =>
    pathname === href || (href !== "/admin" && pathname.startsWith(href))

export function MobileBottomNav() {
    const pathname = usePathname()
    const { data: session } = useSession()
    const [mounted, setMounted] = useState(false)
    const [moreOpen, setMoreOpen] = useState(false)
    useEffect(() => setMounted(true), [])
    useEffect(() => setMoreOpen(false), [pathname])

    const role = mounted ? session?.user?.role : undefined
    const allowed = mounted ? (session?.user?.modules || []) : []
    const canSee = (key: string, adminOnly?: boolean) => role === "ADMIN" || (!adminOnly && allowed.includes(key))

    const visible = MODULES.filter(m => canSee(m.key, m.adminOnly))
    const tabs = TAB_PRIORITY
        .map(key => visible.find(m => m.key === key))
        .filter((m): m is (typeof MODULES)[number] => !!m)
        .slice(0, 4)
    // "More" is highlighted when the current page is not one of the main tabs
    const onMainTab = tabs.some(t => isActiveHref(pathname, t.href))

    return (
        <>
            <div className="fixed inset-x-0 bottom-0 z-40 px-3.5 pb-[calc(10px+env(safe-area-inset-bottom))] pointer-events-none">
                <nav className="mx-auto max-w-[520px] flex rounded-full p-1 bg-white/95 backdrop-blur-md shadow-[0_8px_24px_rgba(15,23,41,0.14)] pointer-events-auto">
                    {tabs.map(tab => {
                        const meta = TAB_META[tab.key]
                        const Icon = meta.icon
                        const on = isActiveHref(pathname, tab.href)
                        return (
                            <Link
                                key={tab.key}
                                href={tab.href}
                                aria-current={on ? "page" : undefined}
                                className={cn(
                                    "flex-1 flex flex-col items-center gap-0.5 rounded-full pt-1.5 pb-[5px] transition-colors",
                                    on ? "bg-[var(--accent-light)] text-[var(--accent)]" : "text-[var(--text)]"
                                )}
                            >
                                <Icon size={20} strokeWidth={on ? 2.4 : 2} />
                                <span className={cn("text-[10.5px]", on ? "font-semibold" : "font-medium")}>{meta.label}</span>
                            </Link>
                        )
                    })}
                    <button
                        onClick={() => setMoreOpen(true)}
                        className={cn(
                            "flex-1 flex flex-col items-center gap-0.5 rounded-full pt-1.5 pb-[5px] transition-colors",
                            !onMainTab ? "bg-[var(--accent-light)] text-[var(--accent)]" : "text-[var(--text)]"
                        )}
                    >
                        <LayoutGrid size={20} strokeWidth={!onMainTab ? 2.4 : 2} />
                        <span className={cn("text-[10.5px]", !onMainTab ? "font-semibold" : "font-medium")}>More</span>
                    </button>
                </nav>
            </div>

            {moreOpen && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(15,23,41,0.45)]" onClick={() => setMoreOpen(false)}>
                    <div
                        role="dialog"
                        aria-label="All modules"
                        onClick={e => e.stopPropagation()}
                        className="sheet-up w-full max-w-[520px] bg-[var(--bg)] rounded-t-[24px] px-4 pt-3 pb-[calc(20px+env(safe-area-inset-bottom))] max-h-[85vh] overflow-y-auto"
                    >
                        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--border2)]" />
                        <div className="flex items-center justify-between mb-3 px-1">
                            <h2 className="text-[17px] font-bold text-[var(--text)]">All modules</h2>
                            <button onClick={() => setMoreOpen(false)} aria-label="Close" className="w-8 h-8 rounded-full bg-[var(--surface)] flex items-center justify-center text-[var(--text2)] shadow-[var(--shadow-card)]">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2.5">
                            {visible.map(m => {
                                const meta = TAB_META[m.key] ?? TAB_META.profile
                                const Icon = meta.icon
                                const on = isActiveHref(pathname, m.href)
                                return (
                                    <Link
                                        key={m.key}
                                        href={m.href}
                                        className={cn(
                                            "press flex flex-col items-center gap-2 rounded-[18px] bg-[var(--surface)] px-2 py-3.5 shadow-[var(--shadow-card)] text-center",
                                            on && "ring-2 ring-[var(--accent)]"
                                        )}
                                    >
                                        <span className="w-11 h-11 rounded-[14px] flex items-center justify-center" style={{ background: meta.tint[0], color: meta.tint[1] }}>
                                            <Icon size={20} />
                                        </span>
                                        <span className="text-[12px] font-semibold text-[var(--text)] leading-tight">{m.label}</span>
                                    </Link>
                                )
                            })}
                        </div>
                        <button
                            onClick={() => signOut({ redirect: true, callbackUrl: "/login" })}
                            className="press mt-4 w-full flex items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-[#fecaca] bg-[var(--surface)] py-3 text-[14px] font-bold text-[var(--red)]"
                        >
                            <LogOut size={16} /> Sign Out
                        </button>
                    </div>
                </div>
            )}
        </>
    )
}
