"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import {
    Users, UserCheck, ClipboardList, CalendarOff,
    IndianRupee, ArrowRight, TrendingUp, Plus,
    Wallet, RefreshCw,
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

    const StatCard = ({ label, value, sub, icon: Icon, color, bg, href }: {
        label: string; value: string | number; sub: string
        icon: React.ElementType; color: string; bg: string; href?: string
    }) => (
        <div className="bg-white border border-[var(--border)] rounded-[14px] p-5 flex flex-col justify-between hover:shadow-sm transition-all">
            <div className="flex items-center justify-between mb-3">
                <p className="text-[12px] font-medium text-[var(--text3)]">{label}</p>
                <div className="w-8 h-8 rounded-[8px] flex items-center justify-center" style={{ background: bg, color }}>
                    <Icon size={16} />
                </div>
            </div>
            <div>
                <p className="text-[28px] font-bold text-[var(--text)] leading-none">{loading ? "—" : value}</p>
                <p className="text-[12px] text-[var(--text3)] mt-1">{sub}</p>
            </div>
            {href && (
                <Link href={href} className="mt-3 pt-3 border-t border-[var(--border)] flex items-center justify-between text-[12px] font-medium text-[var(--text2)] hover:text-[var(--accent-text)] transition-colors group">
                    View all <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                </Link>
            )}
        </div>
    )

    return (
        <div className="p-6 space-y-6 min-h-screen bg-[var(--bg)]">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-[22px] font-bold text-[var(--text)]">
                        Welcome back, {session?.user?.name?.split(" ")[0] || "Admin"} 👋
                    </h1>
                    <p className="text-[13px] text-[var(--text3)] mt-0.5">
                        {format(now, "EEEE, dd MMMM yyyy")} · Falcon EMP Dashboard
                    </p>
                </div>
                <button onClick={fetchStats} className="p-2 rounded-[8px] border border-[var(--border)] bg-white hover:bg-[var(--surface2)] transition-colors text-[var(--text3)]">
                    <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                </button>
            </div>

            {/* Top Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total Employees" value={stats?.totalEmployees ?? 0}
                    sub={`${stats?.labourCount ?? 0} Labour · ${stats?.staffCount ?? 0} Staff`}
                    icon={Users} color="#1a9e6e" bg="#e8f7f1" href="/employees" />
                <StatCard label="Present Today"
                    value={`${stats?.attendance?.present ?? 0}/${stats?.totalEmployees ?? 0}`}
                    sub={stats?.attendance?.marked
                        ? `${stats.attendance.halfDay} half day · ${stats.attendance.absent} absent`
                        : "Attendance not marked yet"}
                    icon={UserCheck} color="#2563eb" bg="#eff6ff" href="/attendance" />
                <StatCard label="Pending Leaves" value={stats?.pendingLeaves ?? 0}
                    sub="Awaiting approval"
                    icon={CalendarOff} color="#d97706" bg="#fef3c7" href="/leaves" />
                <StatCard label="Advance This Month" value={`₹${(stats?.thisMonthAdvances?.total ?? 0).toLocaleString()}`}
                    sub={`${stats?.thisMonthAdvances?.count ?? 0} employees`}
                    icon={IndianRupee} color="#7c3aed" bg="#f5f3ff" href="/advances" />
            </div>

            {/* Attendance Summary + Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Today's Attendance Card */}
                <div className="lg:col-span-2 bg-white border border-[var(--border)] rounded-[14px] p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-[15px] font-semibold text-[var(--text)]">Today's Attendance</h2>
                        <Link href="/attendance"
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] text-white rounded-[7px] text-[12px] font-medium hover:bg-[#158a5e] transition-colors">
                            <ClipboardList size={13} /> Mark Attendance
                        </Link>
                    </div>
                    {loading ? (
                        <div className="h-24 rounded-[10px] bg-[var(--surface2)] animate-pulse" />
                    ) : (
                        <>
                            {/* Progress bar */}
                            <div className="mb-4">
                                <div className="flex items-center justify-between text-[12px] text-[var(--text3)] mb-1.5">
                                    <span>Attendance rate</span>
                                    <span className="font-semibold text-[var(--text)]">
                                        {stats?.totalEmployees
                                            ? Math.round((((stats.attendance?.present ?? 0) + (stats.attendance?.halfDay ?? 0) * 0.5) / stats.totalEmployees) * 100)
                                            : 0}%
                                    </span>
                                </div>
                                <div className="h-2.5 bg-[var(--surface2)] rounded-full overflow-hidden">
                                    <div className="h-full bg-[var(--accent)] rounded-full transition-all duration-700"
                                        style={{ width: `${stats?.totalEmployees ? Math.round((((stats.attendance?.present ?? 0) + (stats.attendance?.halfDay ?? 0) * 0.5) / stats.totalEmployees) * 100) : 0}%` }} />
                                </div>
                            </div>
                            <div className="grid grid-cols-4 gap-3">
                                {[
                                    { label: "Present", value: stats?.attendance?.present ?? 0, color: "#16a34a", bg: "#dcfce7" },
                                    { label: "Half Day", value: stats?.attendance?.halfDay ?? 0, color: "#d97706", bg: "#fef3c7" },
                                    { label: "Absent", value: stats?.attendance?.absent ?? 0, color: "#dc2626", bg: "#fee2e2" },
                                    { label: "Total", value: stats?.totalEmployees ?? 0, color: "#6b7280", bg: "#f3f4f6" },
                                ].map(s => (
                                    <div key={s.label} className="rounded-[10px] p-3 text-center" style={{ background: s.bg }}>
                                        <p className="text-[20px] font-bold" style={{ color: s.color }}>{s.value}</p>
                                        <p className="text-[11px] font-medium mt-0.5" style={{ color: s.color }}>{s.label}</p>
                                    </div>
                                ))}
                            </div>
                            {!stats?.attendance?.marked && (
                                <div className="mt-3 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-[8px] flex items-center gap-2">
                                    <span className="text-amber-500 text-lg">⚠️</span>
                                    <p className="text-[12px] text-amber-700 font-medium">Attendance not marked for today yet</p>
                                    <Link href="/attendance" className="ml-auto text-[12px] text-amber-700 font-semibold underline">Mark now</Link>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Quick Actions */}
                <div className="bg-white border border-[var(--border)] rounded-[14px] p-5">
                    <h2 className="text-[15px] font-semibold text-[var(--text)] mb-4">Quick Actions</h2>
                    <div className="flex flex-col gap-2">
                        {[
                            { href: "/employees", icon: Plus, label: "Add Employee", color: "#1a9e6e", bg: "#e8f7f1" },
                            { href: "/attendance", icon: ClipboardList, label: "Mark Attendance", color: "#2563eb", bg: "#eff6ff" },
                            { href: "/advances", icon: IndianRupee, label: "Give Advance", color: "#7c3aed", bg: "#f5f3ff" },
                            { href: "/leaves", icon: CalendarOff, label: "Approve Leaves", color: "#d97706", bg: "#fef3c7" },
                            { href: "/payroll", icon: Wallet, label: "Process Payroll", color: "#dc2626", bg: "#fee2e2" },
                        ].map(({ href, icon: Icon, label, color, bg }) => (
                            <Link key={href} href={href}
                                className="flex items-center gap-3 px-3 py-2.5 rounded-[9px] border border-[var(--border)] hover:bg-[var(--surface2)] hover:border-[var(--accent)] transition-all group">
                                <div className="w-7 h-7 rounded-[7px] flex items-center justify-center flex-shrink-0" style={{ background: bg, color }}>
                                    <Icon size={14} />
                                </div>
                                <span className="text-[13px] font-medium text-[var(--text2)] group-hover:text-[var(--text)]">{label}</span>
                                <ArrowRight size={13} className="ml-auto text-[var(--text3)] group-hover:translate-x-0.5 transition-transform" />
                            </Link>
                        ))}
                    </div>
                </div>
            </div>

            {/* Recent Employees */}
            <div className="bg-white border border-[var(--border)] rounded-[14px] overflow-hidden">
                <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
                    <h2 className="text-[15px] font-semibold text-[var(--text)]">Recent Employees</h2>
                    <Link href="/employees" className="text-[12px] font-medium text-[var(--accent-text)] hover:underline">View all</Link>
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
                    <table className="w-full">
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
                )}
            </div>
        </div>
    )
}
