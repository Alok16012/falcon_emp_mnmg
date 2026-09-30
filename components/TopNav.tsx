"use client"

import { useState, useRef, useEffect } from "react"
import { UserCircle, LogOut, Search, Loader2, Bell } from "lucide-react"
import { useSession, signOut } from "next-auth/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { MODULES } from "@/lib/modules"

// App-style header (Pushpak design): greeting on the dashboard, page title elsewhere.
const PAGE_LABELS: Record<string, string> = {
    ...Object.fromEntries(MODULES.map(m => [m.href, m.label])),
    "/leaves": "Leaves",
    "/expenses": "Expenses",
    "/departments": "Departments",
    "/documents": "Documents",
}

function greeting() {
    const h = new Date().getHours()
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"
}

function BrandMark({ size = 40 }: { size?: number }) {
    return (
        <div
            className="rounded-full bg-gradient-to-br from-[#0847c7] to-[#0b5cff] flex items-center justify-center text-white shrink-0 shadow-[0_2px_10px_rgba(11,92,255,0.25)]"
            style={{ width: size, height: size }}
        >
            <svg viewBox="0 0 24 24" className="w-[45%] h-[45%]" fill="currentColor">
                <path d="M4 4h10c3.3 0 6 2.7 6 6s-2.7 6-6 6H9v4H4V4zm5 8h5c1.1 0 2-.9 2-2s-.9-2-2-2H9v4z" />
            </svg>
        </div>
    )
}

export function TopNav() {
    const { data: session } = useSession()
    const pathname = usePathname()
    const profileRef = useRef<HTMLDivElement>(null)
    const searchRef = useRef<HTMLDivElement>(null)
    const [isProfileOpen, setIsProfileOpen] = useState(false)
    const [mounted, setMounted] = useState(false)
    const [query, setQuery] = useState("")
    const [results, setResults] = useState<any[]>([])
    const [searching, setSearching] = useState(false)
    const [searchOpen, setSearchOpen] = useState(false)

    useEffect(() => { setMounted(true) }, [])

    const isHome = pathname === "/admin"
    const pageLabel = Object.entries(PAGE_LABELS)
        .sort((a, b) => b[0].length - a[0].length)
        .find(([path]) => pathname === path || pathname.startsWith(path + "/"))?.[1] ?? "Falcon Plus"
    const firstName = mounted ? session?.user?.name?.split(" ")[0] || "User" : ""

    useEffect(() => {
        setIsProfileOpen(false)
        setQuery("")
        setSearchOpen(false)
    }, [pathname])

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (profileRef.current && !profileRef.current.contains(e.target as Node)) setIsProfileOpen(false)
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false)
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    useEffect(() => {
        const timer = setTimeout(async () => {
            if (query.length >= 2) {
                setSearching(true)
                try {
                    const res = await fetch(`/api/employees?search=${encodeURIComponent(query)}&limit=5`)
                    if (res.ok) {
                        const data = await res.json()
                        setResults(Array.isArray(data) ? data.slice(0, 5) : (data.employees || []))
                        setSearchOpen(true)
                    }
                } catch { } finally { setSearching(false) }
            } else {
                setResults([])
                setSearchOpen(false)
            }
        }, 300)
        return () => clearTimeout(timer)
    }, [query])

    return (
        <header className="sticky top-0 z-30 bg-[var(--bg)]/90 backdrop-blur-md">
            <div className="mx-auto w-full max-w-[1180px] flex items-center justify-between gap-3 px-4 md:px-6 pt-[18px] pb-3">
                {/* Left: logo + greeting / page title */}
                <Link href="/admin" className="flex items-center gap-3 min-w-0">
                    <BrandMark />
                    {isHome ? (
                        <div className="min-w-0">
                            <p className="text-[12px] text-[var(--text2)] leading-tight">{greeting()},</p>
                            <p className="text-[18px] font-bold text-[var(--text)] leading-tight truncate">{firstName} 👋</p>
                        </div>
                    ) : (
                        <div className="min-w-0">
                            <p className="text-[10px] font-bold tracking-[0.12em] text-[var(--accent)] uppercase leading-tight">Falcon <span className="text-[var(--gold)]">Plus</span></p>
                            <p className="text-[18px] font-bold text-[var(--text)] leading-tight truncate">{pageLabel}</p>
                        </div>
                    )}
                </Link>

                {/* Center: employee search (desktop) */}
                <div className="hidden md:block flex-1 max-w-[360px] relative" ref={searchRef}>
                    <div className="relative group">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text3)] group-focus-within:text-[var(--accent)] transition-colors" />
                        <input
                            type="text"
                            placeholder="Search employees..."
                            className="w-full h-10 pl-10 pr-4 bg-[var(--surface)] border border-[var(--border)] rounded-full text-[13px] text-[var(--text)] placeholder-[var(--text3)] shadow-[var(--shadow-card)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 transition-all"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            onFocus={() => results.length > 0 && setSearchOpen(true)}
                        />
                        {searching && <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-[var(--text3)]" />}
                    </div>

                    {searchOpen && (
                        <div className="absolute top-full left-0 mt-2 w-full rounded-[16px] bg-[var(--surface)] shadow-[0_8px_24px_rgba(15,23,41,0.12)] z-50 overflow-hidden">
                            {results.length === 0 ? (
                                <p className="px-4 py-3 text-[12px] text-[var(--text3)]">No employees found for &quot;{query}&quot;</p>
                            ) : results.map((emp: any) => (
                                <Link key={emp.id} href={`/employees`} onClick={() => { setQuery(""); setSearchOpen(false) }}
                                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--surface2)] transition-colors border-b border-[var(--border)] last:border-0">
                                    <div className="w-8 h-8 rounded-full bg-[var(--accent-light)] flex items-center justify-center text-[11px] font-bold text-[var(--accent)]">
                                        {emp.firstName?.[0]}{emp.lastName?.[0]}
                                    </div>
                                    <div>
                                        <p className="text-[13px] font-semibold text-[var(--text)]">{emp.firstName} {emp.lastName}</p>
                                        <p className="text-[11px] text-[var(--text3)]">{emp.employeeId} · {emp.employeeCategory === "LABOUR" ? "Labour" : "Staff"}</p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

                {/* Right: bell + profile */}
                <div className="flex items-center gap-2.5 shrink-0">
                    <button aria-label="Notifications" className="relative inline-flex items-center justify-center w-10 h-10 rounded-full bg-[var(--surface)] shadow-[var(--shadow-card)] text-[var(--text)] press">
                        <Bell size={18} />
                        <span className="absolute top-[8px] right-[9px] w-2 h-2 rounded-full bg-[var(--red)] border-2 border-[var(--surface)]" />
                    </button>
                    <div className="relative shrink-0" ref={profileRef}>
                        <button onClick={() => setIsProfileOpen(!isProfileOpen)} aria-label="Account"
                            className="h-10 w-10 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-[14px] font-bold shadow-[0_2px_10px_rgba(11,92,255,0.25)] press">
                            {mounted && session?.user?.name ? session.user.name.charAt(0).toUpperCase() : <UserCircle size={20} />}
                        </button>

                        {isProfileOpen && (
                            <div className="absolute right-0 mt-2 w-56 rounded-[18px] bg-[var(--surface)] shadow-[0_8px_24px_rgba(15,23,41,0.14)] z-50 overflow-hidden fade-up">
                                <div className="p-4 border-b border-[var(--border)]">
                                    <p className="text-[14px] font-bold text-[var(--text)] truncate">{session?.user?.name || "User"}</p>
                                    <p className="text-[11.5px] text-[var(--text3)] truncate">{session?.user?.email}</p>
                                    <span className="mt-2 inline-block text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[var(--gold-light)] text-[var(--gold-dark)]">
                                        {session?.user?.role || "USER"}
                                    </span>
                                </div>
                                <div className="p-1.5">
                                    <Link href="/profile" onClick={() => setIsProfileOpen(false)} className="flex items-center gap-3 px-3 py-2.5 text-[13px] font-medium text-[var(--text2)] hover:bg-[var(--surface2)] hover:text-[var(--text)] rounded-[12px] transition-colors">
                                        <UserCircle size={16} /> My Profile
                                    </Link>
                                    <button onClick={() => signOut({ redirect: true, callbackUrl: `/login` })}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 text-[13px] font-medium text-[var(--red)] hover:bg-[var(--red-light)] rounded-[12px] transition-colors">
                                        <LogOut size={16} /> Sign Out
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    )
}
