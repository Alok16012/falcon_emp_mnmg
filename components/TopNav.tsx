"use client"

import { useState, useRef, useEffect } from "react"
import { Menu, UserCircle, LogOut, ChevronDown, Search, Loader2, Users } from "lucide-react"
import { useSession, signOut } from "next-auth/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const PAGE_LABELS: Record<string, string> = {
    "/admin": "Dashboard",
    "/employees": "Employees",
    "/attendance": "Attendance",
    "/advances": "Advance Salary",
    "/leaves": "Leaves",
    "/payroll": "Payroll",
    "/expenses": "Expenses",
    "/departments": "Departments",
    "/admin/users": "Users",
    "/profile": "My Profile",
}

export function TopNav({ onMenuClick }: { onMenuClick: () => void }) {
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

    // Derive current page label
    const pageLabel = Object.entries(PAGE_LABELS).find(([path]) =>
        pathname === path || (path !== "/admin" && pathname.startsWith(path))
    )?.[1] ?? "Dashboard"

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
        <div className="sticky top-0 z-30 flex h-[54px] items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-3 md:px-6 shrink-0 gap-3">
            {/* Left: hamburger + breadcrumb */}
            <div className="flex items-center gap-2 shrink-0">
                <button onClick={onMenuClick} className="inline-flex items-center justify-center rounded-[10px] w-9 h-9 text-[var(--text2)] hover:bg-[var(--surface2)] md:hidden transition-colors">
                    <Menu size={20} />
                </button>
                <div className="hidden md:flex items-center gap-2 text-[13px]">
                    <span className="text-[var(--text3)]">Falcon Plus</span>
                    <span className="text-[var(--text3)] text-[10px]">›</span>
                    <span className="text-[var(--text)] font-medium">{pageLabel}</span>
                </div>
            </div>

            {/* Center: Employee Search */}
            <div className="flex-1 max-w-[380px] relative" ref={searchRef}>
                <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text3)] group-focus-within:text-[var(--accent)] transition-colors" />
                    <input
                        type="text"
                        placeholder="Search employees..."
                        className="w-full h-9 pl-9 pr-4 bg-[var(--surface2)] border border-[var(--border)] rounded-[10px] text-[13px] text-[var(--text)] placeholder-[var(--text3)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] focus:bg-[var(--surface)] transition-all"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onFocus={() => results.length > 0 && setSearchOpen(true)}
                    />
                    {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-[var(--text3)]" />}
                </div>

                {searchOpen && (
                    <div className="absolute top-full left-0 mt-2 w-full rounded-[12px] border border-[var(--border)] bg-[var(--surface)] shadow-xl z-50 overflow-hidden">
                        {results.length === 0 ? (
                            <p className="px-4 py-3 text-[12px] text-[var(--text3)]">No employees found for &quot;{query}&quot;</p>
                        ) : results.map((emp: any) => (
                            <Link key={emp.id} href={`/employees`} onClick={() => { setQuery(""); setSearchOpen(false) }}
                                className="flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--surface2)] transition-colors border-b border-[var(--border)] last:border-0">
                                <div className="w-7 h-7 rounded-full bg-[var(--accent-light)] flex items-center justify-center text-[11px] font-bold text-[var(--accent-text)]">
                                    {emp.firstName?.[0]}{emp.lastName?.[0]}
                                </div>
                                <div>
                                    <p className="text-[13px] font-medium text-[var(--text)]">{emp.firstName} {emp.lastName}</p>
                                    <p className="text-[11px] text-[var(--text3)]">{emp.employeeId} · {emp.employeeCategory === "LABOUR" ? "Labour" : "Staff"}</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            {/* Right: Profile */}
            <div className="relative shrink-0" ref={profileRef}>
                <button onClick={() => setIsProfileOpen(!isProfileOpen)} className="flex items-center gap-2 p-1 rounded-full hover:bg-[var(--surface2)] transition-all">
                    <div className="h-[34px] w-[34px] rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-[13px] font-bold shadow-sm">
                        {mounted && session?.user?.name ? session.user.name.charAt(0).toUpperCase() : <UserCircle size={20} />}
                    </div>
                    <div className="hidden sm:block text-left">
                        <p className="text-[12px] font-semibold text-[var(--text)] leading-none">{session?.user?.name?.split(" ")[0] || "User"}</p>
                        <p className="text-[10px] text-[var(--text3)] mt-0.5">{session?.user?.role}</p>
                    </div>
                    <ChevronDown size={13} className={cn("text-[var(--text3)] transition-transform duration-200 hidden sm:block", isProfileOpen && "rotate-180")} />
                </button>

                {isProfileOpen && (
                    <div className="absolute right-0 mt-2 w-52 rounded-[12px] border border-[var(--border)] bg-[var(--surface)] shadow-xl z-50 overflow-hidden">
                        <div className="p-3 border-b border-[var(--border)] bg-[var(--surface2)]/50">
                            <p className="text-[13px] font-semibold text-[var(--text)] truncate">{session?.user?.name || "User"}</p>
                            <p className="text-[11px] text-[var(--text3)] truncate">{session?.user?.email}</p>
                            <span className="mt-1.5 inline-block text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--accent-light)] text-[var(--accent-text)]">
                                {session?.user?.role || "USER"}
                            </span>
                        </div>
                        <div className="p-1">
                            <Link href="/profile" onClick={() => setIsProfileOpen(false)} className="flex items-center gap-3 px-3 py-2 text-[13px] text-[var(--text2)] hover:bg-[var(--surface2)] hover:text-[var(--text)] rounded-[8px] transition-colors">
                                <UserCircle size={15} /> Profile Settings
                            </Link>
                            <button onClick={() => signOut({ redirect: true, callbackUrl: `/login` })}
                                className="w-full flex items-center gap-3 px-3 py-2 text-[13px] text-[var(--red)] hover:bg-[var(--red-light)] rounded-[8px] transition-colors mt-0.5">
                                <LogOut size={15} /> Sign Out
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
