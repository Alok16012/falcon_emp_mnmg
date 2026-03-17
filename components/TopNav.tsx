"use client"

import { useState, useEffect, useRef } from "react"
import { Search, Menu, X, Building2, Folder, ClipboardCheck, Loader2, UserCircle, LogOut, Mail, Phone, ChevronDown, ShieldCheck } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useSession, signOut } from "next-auth/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface SearchResults {
    companies: any[]
    projects: any[]
    inspections: any[]
}

export function TopNav({ onMenuClick }: { onMenuClick: () => void }) {
    const { data: session, status: authStatus } = useSession()
    const [query, setQuery] = useState("")
    const [results, setResults] = useState<SearchResults | null>(null)
    const [loading, setLoading] = useState(false)
    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const profileRef = useRef<HTMLDivElement>(null)
    const [isProfileOpen, setIsProfileOpen] = useState(false)
    const pathname = usePathname()

    const isAdminOrManager = session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER"

    useEffect(() => {
        const timer = setTimeout(async () => {
            if (query.length >= 2) {
                setLoading(true)
                try {
                    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
                    const data = await res.json()
                    setResults(data)
                    setIsOpen(true)
                } catch (error) {
                    console.error("Search fetch failed", error)
                } finally {
                    setLoading(false)
                }
            } else {
                setResults(null)
                setIsOpen(false)
            }
        }, 300)

        return () => clearTimeout(timer)
    }, [query])

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
            if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
                setIsProfileOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    useEffect(() => {
        setIsOpen(false)
        setIsProfileOpen(false)
        setQuery("")
    }, [pathname])

    return (
        <div className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 shadow-sm">
            <button onClick={onMenuClick} className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground md:hidden">
                <Menu className="h-6 w-6" />
            </button>

            {isAdminOrManager ? (
                <div className="relative flex-1 max-w-md" ref={dropdownRef}>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search companies, projects, inspections..."
                            className="pl-10 h-10 border-none bg-muted/50 focus-visible:bg-background transition-colors"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onFocus={() => query.length >= 2 && setIsOpen(true)}
                        />
                        {loading && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                        )}
                    </div>

                    {isOpen && (results?.companies.length || results?.projects.length || results?.inspections.length) ? (
                        <div className="absolute top-full left-0 mt-1 w-full max-h-[400px] overflow-y-auto rounded-lg border bg-popover text-popover-foreground shadow-xl z-50 p-2 space-y-4 animate-in fade-in zoom-in-95 duration-200">
                            {results.companies.length > 0 && (
                                <section>
                                    <h3 className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Companies</h3>
                                    {results.companies.map(c => (
                                        <Link key={c.id} href={`/companies/${c.id}`} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent transition-colors">
                                            <Building2 className="h-4 w-4 text-blue-500" />
                                            <span className="text-sm font-medium">{c.name}</span>
                                        </Link>
                                    ))}
                                </section>
                            )}

                            {results.projects.length > 0 && (
                                <section>
                                    <h3 className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Projects</h3>
                                    {results.projects.map(p => (
                                        <Link key={p.id} href={`/companies/${p.companyId}`} className="flex flex-col gap-0.5 px-3 py-2 rounded-md hover:bg-accent transition-colors">
                                            <div className="flex items-center gap-3">
                                                <Folder className="h-4 w-4 text-purple-500" />
                                                <span className="text-sm font-medium">{p.name}</span>
                                            </div>
                                            <span className="text-[10px] text-muted-foreground ml-7">{p.companyName}</span>
                                        </Link>
                                    ))}
                                </section>
                            )}

                            {results.inspections.length > 0 && (
                                <section>
                                    <h3 className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Inspections</h3>
                                    {results.inspections.map(i => (
                                        <Link key={i.id} href={`/approvals/${i.id}`} className="flex flex-col gap-0.5 px-3 py-2 rounded-md hover:bg-accent transition-colors">
                                            <div className="flex items-center gap-3">
                                                <ClipboardCheck className="h-4 w-4 text-green-500" />
                                                <span className="text-sm font-medium">{i.projectName}</span>
                                                <Badge variant="outline" className="ml-auto text-[10px] py-0">{i.status}</Badge>
                                            </div>
                                            <span className="text-[10px] text-muted-foreground ml-7">Inspector: {i.inspectorName}</span>
                                        </Link>
                                    ))}
                                </section>
                            )}
                        </div>
                    ) : isOpen && query.length >= 2 && !loading ? (
                        <div className="absolute top-full left-0 mt-1 w-full rounded-lg border bg-popover p-4 text-center shadow-lg z-50">
                            <p className="text-sm text-muted-foreground">No results found for &quot;{query}&quot;</p>
                        </div>
                    ) : null}
                </div>
            ) : (
                <div className="flex-1">
                    <div className="font-bold text-xl tracking-tight text-primary md:hidden ml-2">CIMS</div>
                </div>
            )}

            <div className="text-[8px] text-muted-foreground/30 hidden lg:block">v1.0.6</div>

            <div className="ml-auto flex items-center gap-4">
                <div className="relative" ref={profileRef}>
                    <button
                        onClick={() => setIsProfileOpen(!isProfileOpen)}
                        className="flex items-center gap-3 p-1.5 pl-3 rounded-2xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100 group bg-slate-50/50"
                    >
                        <div className="flex flex-col items-end hidden sm:flex">
                            <span className="text-sm font-black text-slate-800 leading-none">{session?.user?.name || "Loading..."}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{session?.user?.role?.replace("_", " ") || "PROFILE"}</span>
                        </div>
                        <div className="h-10 w-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-lg shadow-slate-200 group-hover:scale-[1.05] transition-transform overflow-hidden font-black">
                            {session?.user?.name ? session.user.name.charAt(0).toUpperCase() : <UserCircle className="h-6 w-6" />}
                        </div>
                        <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform duration-300", isProfileOpen && "rotate-180")} />
                    </button>

                    {isProfileOpen && (
                        <div className="absolute right-0 mt-3 w-72 rounded-[24px] border border-slate-100 bg-white shadow-[0_20px_50px_rgba(0,0,0,0.1)] z-50 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
                            <div className="bg-slate-50/50 p-6 border-b border-slate-50">
                                <div className="flex items-center gap-4">
                                    <div className="h-14 w-14 rounded-[20px] bg-slate-900 text-white flex items-center justify-center text-2xl font-black shadow-xl shadow-slate-200">
                                        {session?.user?.name?.charAt(0).toUpperCase() || "U"}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-black text-slate-900 leading-tight truncate">{session?.user?.name || "User"}</h4>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest bg-white border-slate-100 text-slate-400 px-2 py-0">
                                                {session?.user?.role || "USER"}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="px-4 py-2 flex flex-col gap-1">
                                <Link
                                    href="/profile"
                                    className="p-3 flex items-center gap-3 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors group/item"
                                >
                                    <div className="h-8 w-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center group-hover/item:bg-slate-900 group-hover/item:text-white transition-colors">
                                        <UserCircle className="h-4 w-4" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs font-black">Profile Settings</span>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Update your info</span>
                                    </div>
                                </Link>
                                <div className="p-3 flex items-center gap-3 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors">
                                    <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                        <Mail className="h-4 w-4" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email</span>
                                        <span className="text-xs font-black truncate max-w-[160px]">{session?.user?.email}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 pt-0">
                                <Button
                                    variant="ghost"
                                    className="w-full justify-start gap-3 h-12 rounded-2xl text-red-500 hover:text-red-600 hover:bg-red-50 font-black transition-all"
                                    onClick={() => signOut({ redirect: true, callbackUrl: "/login" })}
                                >
                                    <div className="h-8 w-8 rounded-lg bg-red-100 flex items-center justify-center">
                                        <LogOut className="h-4 w-4" />
                                    </div>
                                    Sign Out
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
