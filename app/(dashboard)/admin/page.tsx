"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import {
    Users, UserCheck, CalendarOff,
    IndianRupee, ArrowRight, UserPlus,
    RefreshCw, AlertTriangle, CalendarCheck2,
    CalendarDays, FileText, Package,
} from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"

type Stats = {
    totalEmployees: number
    labourCount: number
    staffCount: number
    attendance: { marked: number; present: number; halfDay: number; absent: number }
    pendingLeaves: number
    thisMonthAdvances: { total: number; count: number }
    recentEmployees: {
        id: string; firstName: string; lastName: string; employeeId: string
        designation?: string; employeeCategory: string; dailyRate?: number
        basicSalary: number; dateOfJoining?: string
        department?: { name: string }
    }[]
}

function greeting() {
    const h = new Date().getHours()
    if (h < 12) return "Good Morning"
    if (h < 17) return "Good Afternoon"
    return "Good Evening"
}

export default function AdminDashboard() {
    const { data: session } = useSession()
    const [stats, setStats] = useState<Stats | null>(null)
    const [loading, setLoading] = useState(true)
    const now = new Date()

    const fetchStats = async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/admin/stats")
            const data = await res.json()
            setStats(data)
        } catch { } finally { setLoading(false) }
    }

    useEffect(() => { fetchStats() }, [])

    const attendanceRate = stats?.totalEmployees
        ? Math.round((((stats.attendance?.present ?? 0) + (stats.attendance?.halfDay ?? 0) * 0.5) / stats.totalEmployees) * 100)
        : 0

    const StatCard = ({ label, value, sub, icon: Icon, color, bg, href }: {
        label: string; value: string | number; sub: string
        icon: React.ElementType; color: string; bg: string; href: string
    }) => (
        <Link href={href} className="bg-white border border-[var(--border)] rounded-[18px] p-4 md:p-5 shadow-[0_2px_10px_rgba(80,80,170,0.05)] hover:shadow-[0_4px_16px_rgba(80,80,170,0.10)] transition-all block">
            <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-[13px] flex items-center justify-center shrink-0" style={{ background: bg, color }}>
                    <Icon size={20} />
                </div>
                <div className="min-w-0">
                    <p className="text-[12.5px] font-medium text-[var(--text2)] leading-tight">{label}</p>
                    <p className="text-[26px] font-bold text-[var(--text)] leading-tight mt-0.5">{loading ? "—" : value}</p>
                </div>
            </div>
            <p className="text-[12px] text-[var(--text3)] mt-2.5">{sub}</p>
        </Link>
    )

    return (
        <div className="p-4 md:p-6 space-y-4 md:space-y-6 min-h-screen">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-[24px] md:text-[26px] font-bold text-[var(--text)] leading-tight">
                        {greeting()}, {session?.user?.name?.split(" ")[0] || "Admin"} 👋
                    </h1>
                    <p className="text-[13.5px] text-[var(--text3)] mt-1">
                        {format(now, "EEEE, dd MMMM yyyy")}
                    </p>
                </div>
                <button onClick={fetchStats} className="p-2.5 rounded-full border border-[var(--border)] bg-white hover:bg-[var(--surface2)] transition-colors text-[var(--text3)] shadow-sm">
                    <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                </button>
            </div>

            {/* Top Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                <StatCard label="Total Employees" value={stats?.totalEmployees ?? 0}
                    sub={`${stats?.labourCount ?? 0} Labour · ${stats?.staffCount ?? 0} Staff`}
                    icon={Users} color="#16a34a" bg="#dcfce7" href="/employees" />
                <StatCard label="Present Today"
                    value={`${stats?.attendance?.present ?? 0}/${stats?.totalEmployees ?? 0}`}
                    sub={`${stats?.attendance?.halfDay ?? 0} Half Day · ${stats?.attendance?.absent ?? 0} Absent`}
                    icon={UserCheck} color="#2563eb" bg="#dbeafe" href="/attendance" />
                <StatCard label="Pending Leaves" value={stats?.pendingLeaves ?? 0}
                    sub="Awaiting approval"
                    icon={CalendarOff} color="#ea580c" bg="#ffedd5" href="/leaves" />
                <StatCard label="Advance This Month" value={`₹${(stats?.thisMonthAdvances?.total ?? 0).toLocaleString()}`}
                    sub={`${stats?.thisMonthAdvances?.count ?? 0} employees`}
                    icon={IndianRupee} color="#7c3aed" bg="#ede9fe" href="/advances" />
            </div>

            {/* Today's Attendance */}
            <div className="bg-white border border-[var(--border)] rounded-[18px] p-4 md:p-5 shadow-[0_2px_10px_rgba(80,80,170,0.05)]">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-[11px] bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center">
                            <CalendarCheck2 size={17} />
                        </div>
                        <h2 className="text-[16px] font-bold text-[var(--text)]">Today&apos;s Attendance</h2>
                    </div>
                    <Link href="/attendance"
                        className="px-3.5 py-2 bg-[var(--accent-light)] text-[var(--accent-text)] rounded-full text-[12.5px] font-semibold hover:bg-[#e0e0fa] transition-colors">
                        View Details
                    </Link>
                </div>
                {loading ? (
                    <div className="h-24 rounded-[12px] bg-[var(--surface2)] animate-pulse" />
                ) : (
                    <>
                        {/* Progress bar */}
                        <div className="mb-4">
                            <div className="flex items-center justify-between text-[12.5px] mb-2">
                                <span className="text-[var(--text2)]">Attendance rate</span>
                                <span className="font-bold text-[var(--text)]">{attendanceRate}%</span>
                            </div>
                            <div className="h-2.5 bg-[var(--surface2)] rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-700"
                                    style={{ width: `${attendanceRate}%`, background: "var(--accent-grad)" }} />
                            </div>
                        </div>
                        <div className="grid grid-cols-4 divide-x divide-[var(--border)]">
                            {[
                                { label: "Present", value: stats?.attendance?.present ?? 0, dot: "#22c55e" },
                                { label: "Half Day", value: stats?.attendance?.halfDay ?? 0, dot: "#f59e0b" },
                                { label: "Absent", value: stats?.attendance?.absent ?? 0, dot: "#ef4444" },
                                { label: "Total", value: stats?.totalEmployees ?? 0, dot: null },
                            ].map(s => (
                                <div key={s.label} className="px-2 first:pl-0 last:pr-0 text-left">
                                    <div className="flex items-center gap-1.5">
                                        {s.dot && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.dot }} />}
                                        <p className="text-[11.5px] font-medium text-[var(--text2)] truncate">{s.label}</p>
                                    </div>
                                    <p className="text-[22px] font-bold text-[var(--text)] mt-1">{s.value}</p>
                                </div>
                            ))}
                        </div>
                        {!stats?.attendance?.marked && (
                            <div className="mt-4 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-[10px] flex items-center gap-2">
                                <span className="text-amber-500 text-lg">⚠️</span>
                                <p className="text-[12px] text-amber-700 font-medium">Attendance not marked for today yet</p>
                                <Link href="/attendance" className="ml-auto text-[12px] text-amber-700 font-semibold underline">Mark now</Link>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Quick Actions */}
            <div className="bg-white border border-[var(--border)] rounded-[18px] p-4 md:p-5 shadow-[0_2px_10px_rgba(80,80,170,0.05)]">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-[16px] font-bold text-[var(--text)]">Quick Actions</h2>
                    <Link href="/employees" className="text-[13px] font-semibold text-[var(--accent-text)] hover:underline">View All</Link>
                </div>
                <div className="grid grid-cols-5 gap-1.5 md:max-w-xl">
                    {[
                        { href: "/employees", icon: UserPlus, label: "Add Employee", color: "#16a34a", bg: "#dcfce7" },
                        { href: "/attendance", icon: CalendarDays, label: "Mark Attendance", color: "#5b5bd6", bg: "#ececfc" },
                        { href: "/leaves", icon: CalendarCheck2, label: "Approve Leaves", color: "#ea580c", bg: "#ffedd5" },
                        { href: "/payroll", icon: FileText, label: "Payroll", color: "#a855f7", bg: "#f3e8ff" },
                        { href: "/advances", icon: IndianRupee, label: "Give Advance", color: "#6366f1", bg: "#e0e7ff" },
                    ].map(({ href, icon: Icon, label, color, bg }) => (
                        <Link key={href} href={href} className="flex flex-col items-center gap-2 group">
                            <div className="w-[52px] h-[52px] rounded-[16px] flex items-center justify-center transition-transform group-hover:scale-105 group-active:scale-95"
                                style={{ background: bg, color }}>
                                <Icon size={22} />
                            </div>
                            <span className="text-[11px] font-medium text-[var(--text2)] text-center leading-tight">{label}</span>
                        </Link>
                    ))}
                </div>
            </div>

            {/* Low Stock Alert */}
            <LowStockWidget />

            {/* Recent Employees (desktop) */}
            <div className="hidden md:block bg-white border border-[var(--border)] rounded-[18px] overflow-hidden shadow-[0_2px_10px_rgba(80,80,170,0.05)]">
                <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
                    <h2 className="text-[15px] font-bold text-[var(--text)]">Recent Employees</h2>
                    <Link href="/employees" className="text-[12px] font-semibold text-[var(--accent-text)] hover:underline">View all</Link>
                </div>
                {loading ? (
                    <div className="p-5 space-y-3">
                        {[1,2,3].map(i => <div key={i} className="h-12 bg-[var(--surface2)] rounded-[8px] animate-pulse" />)}
                    </div>
                ) : !stats?.recentEmployees?.length ? (
                    <div className="py-12 text-center text-[var(--text3)]">
                        <Users size={32} className="mx-auto mb-2 opacity-30" />
                        <p className="text-[14px]">No employees yet</p>
                        <Link href="/employees" className="text-[13px] text-[var(--accent-text)] hover:underline mt-1 inline-block">Add first employee →</Link>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px]">
                        <thead>
                            <tr className="border-b border-[var(--border)] bg-[var(--surface2)]">
                                <th className="text-left px-5 py-3 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px]">Employee</th>
                                <th className="text-left px-5 py-3 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px]">Type</th>
                                <th className="text-left px-5 py-3 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px]">Salary</th>
                                <th className="text-left px-5 py-3 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px]">Joined</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                            {stats.recentEmployees.map(emp => (
                                <tr key={emp.id} className="hover:bg-[var(--surface2)] transition-colors">
                                    <td className="px-5 py-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-full bg-[var(--accent-light)] flex items-center justify-center text-[11px] font-bold text-[var(--accent-text)]">
                                                {emp.firstName[0]}{emp.lastName[0]}
                                            </div>
                                            <div>
                                                <p className="text-[13px] font-medium text-[var(--text)]">{emp.firstName} {emp.lastName}</p>
                                                <p className="text-[11px] text-[var(--text3)]">{emp.employeeId}{emp.department ? ` · ${emp.department.name}` : ""}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3">
                                        <span className={`px-2 py-0.5 rounded-[5px] text-[11px] font-semibold ${
                                            emp.employeeCategory === "LABOUR"
                                                ? "bg-orange-50 text-orange-700 border border-orange-200"
                                                : "bg-blue-50 text-blue-700 border border-blue-200"
                                        }`}>
                                            {emp.employeeCategory === "LABOUR" ? "🔧 Labour" : "👔 Staff"}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3 text-[13px] text-[var(--text2)]">
                                        {emp.employeeCategory === "LABOUR"
                                            ? `₹${emp.dailyRate || 0}/day`
                                            : `₹${(emp.basicSalary || 0).toLocaleString()}/mo`}
                                    </td>
                                    <td className="px-5 py-3 text-[13px] text-[var(--text3)]">
                                        {emp.dateOfJoining ? format(new Date(emp.dateOfJoining), "dd MMM yyyy") : "—"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>
                )}
            </div>
        </div>
    )
}

type LowItem = { id: string; itemCode: string; itemName: string; quantity: number; quantityUnit: string; minStock: number }

function LowStockWidget() {
    const [items, setItems] = useState<LowItem[]>([])
    const [loaded, setLoaded] = useState(false)

    useEffect(() => {
        fetch("/api/stock")
            .then(r => r.ok ? r.json() : [])
            .then((data: LowItem[]) => {
                setItems((data || []).filter(i => i.minStock > 0 && i.quantity <= i.minStock))
            })
            .catch(() => {})
            .finally(() => setLoaded(true))
    }, [])

    if (!loaded || items.length === 0) return null

    return (
        <div className="bg-red-50 border border-red-200 rounded-[18px] p-4 md:p-5">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <AlertTriangle size={17} className="text-red-600" />
                    <h2 className="text-[15px] font-bold text-red-600">Low Stock Alert</h2>
                </div>
                <Link href="/stock" className="text-[13px] font-semibold text-red-600 hover:underline">
                    View All
                </Link>
            </div>
            <div className="space-y-2">
                {items.slice(0, 5).map(i => (
                    <div key={i.id} className="bg-white rounded-[13px] px-3.5 py-3 flex items-center gap-3 border border-red-100">
                        <div className="w-9 h-9 rounded-[10px] bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center shrink-0">
                            <Package size={17} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[13.5px] font-semibold text-[var(--text)] truncate">{i.itemName}</p>
                            <p className="text-[11.5px] text-[var(--text3)]">{i.itemCode}</p>
                        </div>
                        <span className="px-2.5 py-1 rounded-[8px] bg-red-100 text-red-600 text-[13px] font-bold shrink-0">{i.quantity}</span>
                        <span className="text-[12px] text-[var(--text3)] shrink-0">{i.quantityUnit}</span>
                    </div>
                ))}
                {items.length > 5 && (
                    <Link href="/stock" className="block text-center text-[12.5px] font-medium text-red-600 pt-1 hover:underline">
                        +{items.length - 5} more items <ArrowRight size={12} className="inline" />
                    </Link>
                )}
            </div>
        </div>
    )
}
