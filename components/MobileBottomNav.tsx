"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import {
    Home,
    Users,
    CalendarDays,
    IndianRupee,
    LayoutGrid,
} from "lucide-react"

const TABS = [
    { key: "dashboard", label: "Dashboard", href: "/admin", icon: Home },
    { key: "employees", label: "Employees", href: "/employees", icon: Users },
    { key: "attendance", label: "Attendance", href: "/attendance", icon: CalendarDays },
    { key: "payroll", label: "Payroll", href: "/payroll", icon: IndianRupee },
]

export function MobileBottomNav({ onMoreClick }: { onMoreClick: () => void }) {
    const pathname = usePathname()
    const { data: session } = useSession()
    const [mounted, setMounted] = useState(false)
    useEffect(() => setMounted(true), [])

    const role = mounted ? session?.user?.role : undefined
    const allowed = mounted ? (session?.user?.modules || []) : []
    const canSee = (key: string) => role === "ADMIN" || allowed.includes(key)

    const tabs = TABS.filter(t => canSee(t.key))
    // "More" is highlighted when the current page is not one of the main tabs
    const onMainTab = TABS.some(t => pathname === t.href || (t.href !== "/admin" && pathname.startsWith(t.href)))

    return (
        <nav className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-[var(--surface)]/95 backdrop-blur border-t border-[var(--border)] rounded-t-[22px] shadow-[0_-6px_24px_rgba(70,70,160,0.10)] pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-stretch justify-around px-1 pt-2 pb-2">
                {tabs.map(tab => {
                    const Icon = tab.icon
                    const isActive = pathname === tab.href || (tab.href !== "/admin" && pathname.startsWith(tab.href))
                    return (
                        <Link
                            key={tab.key}
                            href={tab.href}
                            className={cn(
                                "flex flex-col items-center gap-1 flex-1 py-1 rounded-[12px] transition-colors",
                                isActive ? "text-[var(--accent)]" : "text-[var(--text3)] active:text-[var(--text2)]"
                            )}
                        >
                            <span className={cn(
                                "flex items-center justify-center w-9 h-7 rounded-[10px] transition-colors",
                                isActive && "bg-[var(--accent-light)]"
                            )}>
                                <Icon size={19} strokeWidth={isActive ? 2.4 : 2} />
                            </span>
                            <span className={cn("text-[10.5px] leading-none", isActive ? "font-semibold" : "font-medium")}>
                                {tab.label}
                            </span>
                        </Link>
                    )
                })}
                <button
                    onClick={onMoreClick}
                    className={cn(
                        "flex flex-col items-center gap-1 flex-1 py-1 rounded-[12px] transition-colors",
                        !onMainTab ? "text-[var(--accent)]" : "text-[var(--text3)] active:text-[var(--text2)]"
                    )}
                >
                    <span className={cn(
                        "flex items-center justify-center w-9 h-7 rounded-[10px] transition-colors",
                        !onMainTab && "bg-[var(--accent-light)]"
                    )}>
                        <LayoutGrid size={19} strokeWidth={!onMainTab ? 2.4 : 2} />
                    </span>
                    <span className={cn("text-[10.5px] leading-none", !onMainTab ? "font-semibold" : "font-medium")}>More</span>
                </button>
            </div>
        </nav>
    )
}
