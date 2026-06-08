"use client"
import { useState, useEffect, useCallback } from "react"
import { format, parseISO } from "date-fns"
import { toast } from "sonner"
import {
    Calendar, Users, CheckCircle, XCircle, Clock, ChevronLeft, ChevronRight,
    LogIn, LogOut, Search, Download, X, AlertTriangle
} from "lucide-react"

type Employee = {
    id: string
    employeeId: string
    firstName: string
    lastName: string
    designation?: string
    employeeCategory: string
    department?: { name: string }
}

type PunchLog = {
    punchNumber: number
    punchType: "IN" | "OUT"
    punchTime: string
}

type AttRecord = {
    employeeId: string
    date?: string
    status: string
    checkIn?: string | null
    checkOut?: string | null
    workingHrs?: number
    remarks?: string | null
    punchLogs?: PunchLog[]
}

const STATUS_COLOR: Record<string, { color: string; bg: string; label: string }> = {
    PRESENT:    { color: "#16a34a", bg: "#dcfce7", label: "Present" },
    ABSENT:     { color: "#dc2626", bg: "#fee2e2", label: "Absent" },
    HALF_DAY:   { color: "#d97706", bg: "#fef3c7", label: "Half Day" },
    HOLIDAY:    { color: "#7c3aed", bg: "#ede9fe", label: "Holiday" },
    WEEKLY_OFF: { color: "#6b7280", bg: "#f3f4f6", label: "Weekly Off" },
}

// First IN punch time → fallback to checkIn
function punchIn(rec?: AttRecord): string {
    if (!rec) return ""
    const ins = (rec.punchLogs || []).filter(p => p.punchType === "IN")
    if (ins.length) return ins.sort((a, b) => +new Date(a.punchTime) - +new Date(b.punchTime))[0].punchTime
    return rec.checkIn || ""
}

// Last OUT punch time → fallback to checkOut
function punchOut(rec?: AttRecord): string {
    if (!rec) return ""
    const outs = (rec.punchLogs || []).filter(p => p.punchType === "OUT")
    if (outs.length) return outs.sort((a, b) => +new Date(b.punchTime) - +new Date(a.punchTime))[0].punchTime
    return rec.checkOut || ""
}

function fmtTime(dt: string): string {
    if (!dt) return "—"
    const d = new Date(dt)
    if (isNaN(d.getTime())) return "—"
    return format(d, "hh:mm a")
}

function isLateIn(rec?: AttRecord): boolean {
    const pin = punchIn(rec)
    if (!pin) return false
    const t = new Date(pin)
    return t.getHours() > 9 || (t.getHours() === 9 && t.getMinutes() > 15)
}

export default function AttendancePage() {
    const [employees, setEmployees] = useState<Employee[]>([])
    const [attMap, setAttMap] = useState<Record<string, AttRecord>>({})
    const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"))
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<"ALL" | "LABOUR" | "STAFF">("ALL")
    const [search, setSearch] = useState("")

    // Detail modal
    const [selected, setSelected] = useState<Employee | null>(null)
    const [history, setHistory] = useState<AttRecord[]>([])
    const [historyLoading, setHistoryLoading] = useState(false)

    const fetchEmployees = useCallback(async () => {
        try {
            const r = await fetch("/api/employees?status=ACTIVE")
            const data = await r.json()
            setEmployees(Array.isArray(data) ? data : [])
        } catch { toast.error("Failed to load employees") }
    }, [])

    const fetchAttendance = useCallback(async () => {
        setLoading(true)
        try {
            const r = await fetch(`/api/attendance?date=${date}`)
            const data = await r.json()
            const map: Record<string, AttRecord> = {}
            if (Array.isArray(data)) data.forEach((a: AttRecord) => { map[a.employeeId] = a })
            setAttMap(map)
        } catch { toast.error("Failed to load attendance") }
        finally { setLoading(false) }
    }, [date])

    useEffect(() => { Promise.all([fetchEmployees(), fetchAttendance()]) }, [fetchEmployees, fetchAttendance])

    // Open employee detail → fetch full history
    const openEmployee = async (emp: Employee) => {
        setSelected(emp)
        setHistory([])
        setHistoryLoading(true)
        try {
            const r = await fetch(`/api/attendance?employeeId=${emp.id}`)
            const data = await r.json()
            setHistory(Array.isArray(data) ? data : [])
        } catch { toast.error("Failed to load history") }
        finally { setHistoryLoading(false) }
    }

    const changeDate = (days: number) => {
        const d = new Date(date); d.setDate(d.getDate() + days)
        setDate(format(d, "yyyy-MM-dd"))
    }

    const filtered = employees.filter(e => {
        if (filter !== "ALL" && e.employeeCategory !== filter) return false
        if (search) {
            const q = search.toLowerCase()
            return `${e.firstName} ${e.lastName} ${e.employeeId}`.toLowerCase().includes(q)
        }
        return true
    })

    const counts = {
        present: filtered.filter(e => attMap[e.id]?.status === "PRESENT").length,
        absent: filtered.filter(e => !attMap[e.id] || attMap[e.id]?.status === "ABSENT").length,
        totalHrs: filtered.reduce((s, e) => s + (attMap[e.id]?.workingHrs || 0), 0),
    }

    // CSV export of today's table
    const exportCSV = () => {
        const rows = [["Employee", "ID", "Type", "Punch In", "Punch Out", "Total Hours", "Status"]]
        filtered.forEach(e => {
            const rec = attMap[e.id]
            rows.push([
                `${e.firstName} ${e.lastName}`,
                e.employeeId,
                e.employeeCategory,
                fmtTime(punchIn(rec)),
                fmtTime(punchOut(rec)),
                (rec?.workingHrs || 0).toFixed(2),
                rec ? (STATUS_COLOR[rec.status]?.label || rec.status) : "Absent",
            ])
        })
        const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n")
        const blob = new Blob([csv], { type: "text/csv" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url; a.download = `attendance-${date}.csv`; a.click()
        URL.revokeObjectURL(url)
    }

    return (
        <div className="flex flex-col gap-6 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-[22px] font-bold text-[var(--text)]">Attendance</h1>
                    <p className="text-[13px] text-[var(--text3)] mt-0.5">Punch in / out &amp; working hours · click an employee for full log</p>
                </div>
                <button onClick={exportCSV} disabled={filtered.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-[9px] text-[13px] font-semibold disabled:opacity-60 hover:bg-[#158a5e] transition-colors">
                    <Download size={15} /> Export Excel
                </button>
            </div>

            {/* Date Navigator */}
            <div className="flex items-center gap-3 bg-white border border-[var(--border)] rounded-[12px] px-4 py-3">
                <button onClick={() => changeDate(-1)} className="p-1.5 rounded-[6px] hover:bg-[var(--surface2)] transition-colors">
                    <ChevronLeft size={16} className="text-[var(--text2)]" />
                </button>
                <div className="flex items-center gap-2 flex-1">
                    <Calendar size={16} className="text-[var(--accent)]" />
                    <input type="date" value={date} onChange={e => setDate(e.target.value)}
                        className="text-[15px] font-semibold text-[var(--text)] bg-transparent border-none outline-none cursor-pointer" />
                    <span className="text-[13px] text-[var(--text3)]">{format(parseISO(date), "EEEE, dd MMMM yyyy")}</span>
                </div>
                <button onClick={() => changeDate(1)} className="p-1.5 rounded-[6px] hover:bg-[var(--surface2)] transition-colors">
                    <ChevronRight size={16} className="text-[var(--text2)]" />
                </button>
                <button onClick={() => setDate(format(new Date(), "yyyy-MM-dd"))}
                    className="px-3 py-1 rounded-[6px] bg-[var(--accent-light)] text-[var(--accent-text)] text-[12px] font-medium hover:bg-[#d1f0e4] transition-colors">
                    Today
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
                {[
                    { label: "Present", count: counts.present, icon: <CheckCircle size={16} />, color: "#16a34a", bg: "#dcfce7" },
                    { label: "Absent", count: counts.absent, icon: <XCircle size={16} />, color: "#dc2626", bg: "#fee2e2" },
                    { label: "Total Hours", count: counts.totalHrs.toFixed(1), icon: <Clock size={16} />, color: "#2563eb", bg: "#dbeafe" },
                    { label: "Employees", count: filtered.length, icon: <Users size={16} />, color: "#6b7280", bg: "#f3f4f6" },
                ].map(s => (
                    <div key={s.label} className="bg-white border border-[var(--border)] rounded-[12px] p-4">
                        <div className="flex items-center justify-between">
                            <p className="text-[12px] text-[var(--text3)] font-medium">{s.label}</p>
                            <div className="p-1.5 rounded-[6px]" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
                        </div>
                        <p className="text-[24px] font-bold mt-1" style={{ color: s.color }}>{s.count}</p>
                    </div>
                ))}
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between bg-white border border-[var(--border)] rounded-[12px] px-4 py-3 gap-3">
                <div className="flex gap-2">
                    {(["ALL", "LABOUR", "STAFF"] as const).map(f => (
                        <button key={f} onClick={() => setFilter(f)}
                            className={`px-3 py-1.5 rounded-[7px] text-[12px] font-medium transition-colors ${
                                filter === f ? "bg-[var(--accent)] text-white" : "bg-[var(--surface2)] text-[var(--text2)] hover:bg-[var(--border)]"
                            }`}>
                            {f === "ALL" ? "All" : f === "LABOUR" ? "🔧 Labour" : "👔 Staff"}
                        </button>
                    ))}
                </div>
                <div className="relative w-full max-w-xs">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text3)]" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employee..."
                        className="w-full h-8 pl-8 pr-3 rounded-[7px] border border-[var(--border)] text-[13px] outline-none focus:border-[var(--accent)] bg-[var(--surface2)]" />
                </div>
            </div>

            {/* Excel-style Table */}
            <div className="bg-white border border-[var(--border)] rounded-[12px] overflow-hidden">
                {loading ? (
                    <table className="w-full">
                        <tbody>
                            {Array.from({ length: 8 }).map((_, i) => (
                                <tr key={i} className="border-b border-[var(--border)]">
                                    <td className="px-4 py-3"><div className="h-3 w-40 bg-[var(--surface2)] rounded animate-pulse" /></td>
                                    {Array.from({ length: 4 }).map((_, j) => (
                                        <td key={j} className="px-4 py-3"><div className="h-3 w-20 bg-[var(--surface2)] rounded animate-pulse" /></td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-[var(--text3)]">
                        <Users size={32} className="mb-2 opacity-40" />
                        <p className="text-[14px]">No employees found</p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-[var(--border)] bg-[var(--surface2)]">
                                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px]">Employee</th>
                                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px]">Type</th>
                                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px]">Punch In</th>
                                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px]">Punch Out</th>
                                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px]">Total Hours</th>
                                <th className="text-center px-4 py-3 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px]">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                            {filtered.map(emp => {
                                const rec = attMap[emp.id]
                                const status = rec?.status || "ABSENT"
                                const cfg = STATUS_COLOR[status] || STATUS_COLOR.ABSENT
                                const isLabour = emp.employeeCategory === "LABOUR"
                                const pin = punchIn(rec)
                                const pout = punchOut(rec)
                                const late = isLateIn(rec)
                                return (
                                    <tr key={emp.id} onClick={() => openEmployee(emp)}
                                        className="hover:bg-[var(--surface2)] transition-colors cursor-pointer">
                                        {/* Employee */}
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-8 h-8 rounded-full bg-[var(--accent-light)] flex items-center justify-center text-[12px] font-bold text-[var(--accent-text)]">
                                                    {emp.firstName[0]}{emp.lastName[0]}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-1.5">
                                                        <p className="text-[13px] font-medium text-[var(--text)]">{emp.firstName} {emp.lastName}</p>
                                                        {late && (
                                                            <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-[4px] text-[10px] font-bold">
                                                                <AlertTriangle size={9} /> LATE
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[11px] text-[var(--text3)]">{emp.employeeId}{emp.department ? ` · ${emp.department.name}` : ""}</p>
                                                </div>
                                            </div>
                                        </td>
                                        {/* Type */}
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded-[5px] text-[11px] font-semibold ${
                                                isLabour ? "bg-orange-50 text-orange-700" : "bg-blue-50 text-blue-700"
                                            }`}>
                                                {isLabour ? "🔧 Labour" : "👔 Staff"}
                                            </span>
                                        </td>
                                        {/* Punch In */}
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center gap-1.5 text-[13px] ${pin ? "text-green-700 font-medium" : "text-[var(--text3)]"}`}>
                                                {pin && <LogIn size={12} className="text-green-600" />}
                                                {fmtTime(pin)}
                                            </span>
                                        </td>
                                        {/* Punch Out */}
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center gap-1.5 text-[13px] ${pout ? "text-red-600 font-medium" : "text-[var(--text3)]"}`}>
                                                {pout && <LogOut size={12} className="text-red-500" />}
                                                {fmtTime(pout)}
                                            </span>
                                        </td>
                                        {/* Total Hours */}
                                        <td className="px-4 py-3">
                                            <span className={`text-[13px] font-bold ${rec?.workingHrs ? "text-[var(--text)]" : "text-[var(--text3)]"}`}>
                                                {rec?.workingHrs ? `${rec.workingHrs.toFixed(2)} hrs` : "—"}
                                            </span>
                                        </td>
                                        {/* Status */}
                                        <td className="px-4 py-3 text-center">
                                            <span className="px-2.5 py-1 rounded-[6px] text-[11px] font-bold" style={{ background: cfg.bg, color: cfg.color }}>
                                                {cfg.label}
                                            </span>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Employee Detail Modal — full attendance log */}
            {selected && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setSelected(null)}>
                    <div className="bg-white rounded-[16px] border border-[var(--border)] w-full max-w-2xl max-h-[85vh] flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
                        {/* Modal header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-[var(--accent-light)] flex items-center justify-center text-[14px] font-bold text-[var(--accent-text)]">
                                    {selected.firstName[0]}{selected.lastName[0]}
                                </div>
                                <div>
                                    <h2 className="text-[16px] font-semibold text-[var(--text)]">{selected.firstName} {selected.lastName}</h2>
                                    <p className="text-[12px] text-[var(--text3)]">{selected.employeeId} · Full attendance log</p>
                                </div>
                            </div>
                            <button onClick={() => setSelected(null)} className="text-[var(--text3)] hover:text-[var(--text)] p-1 rounded-md hover:bg-[var(--surface2)]">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Modal body */}
                        <div className="overflow-y-auto p-6">
                            {historyLoading ? (
                                <div className="space-y-2">
                                    {Array.from({ length: 6 }).map((_, i) => (
                                        <div key={i} className="h-10 bg-[var(--surface2)] rounded-[8px] animate-pulse" />
                                    ))}
                                </div>
                            ) : history.length === 0 ? (
                                <div className="py-12 text-center text-[var(--text3)]">
                                    <Calendar size={28} className="mx-auto mb-2 opacity-30" />
                                    <p className="text-[13px]">No attendance records yet</p>
                                </div>
                            ) : (
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-[var(--border)]">
                                            <th className="text-left py-2 text-[11px] font-semibold text-[var(--text3)] uppercase">Date</th>
                                            <th className="text-left py-2 text-[11px] font-semibold text-[var(--text3)] uppercase">Punch In</th>
                                            <th className="text-left py-2 text-[11px] font-semibold text-[var(--text3)] uppercase">Punch Out</th>
                                            <th className="text-left py-2 text-[11px] font-semibold text-[var(--text3)] uppercase">Total Hrs</th>
                                            <th className="text-center py-2 text-[11px] font-semibold text-[var(--text3)] uppercase">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--border)]">
                                        {history.map((rec, i) => {
                                            const cfg = STATUS_COLOR[rec.status] || STATUS_COLOR.ABSENT
                                            const pin = punchIn(rec)
                                            const pout = punchOut(rec)
                                            return (
                                                <tr key={i} className="hover:bg-[var(--surface2)]">
                                                    <td className="py-2.5 text-[13px] font-medium text-[var(--text)]">
                                                        {rec.date ? format(new Date(rec.date), "dd MMM yyyy, EEE") : "—"}
                                                    </td>
                                                    <td className="py-2.5 text-[13px] text-green-700">{fmtTime(pin)}</td>
                                                    <td className="py-2.5 text-[13px] text-red-600">{fmtTime(pout)}</td>
                                                    <td className="py-2.5 text-[13px] font-bold text-[var(--text)]">
                                                        {rec.workingHrs ? `${rec.workingHrs.toFixed(2)}` : "—"}
                                                    </td>
                                                    <td className="py-2.5 text-center">
                                                        <span className="px-2 py-0.5 rounded-[5px] text-[10px] font-bold" style={{ background: cfg.bg, color: cfg.color }}>
                                                            {cfg.label}
                                                        </span>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Modal footer summary */}
                        {!historyLoading && history.length > 0 && (
                            <div className="px-6 py-3 border-t border-[var(--border)] bg-[var(--surface2)] flex items-center justify-between text-[12px]">
                                <span className="text-[var(--text3)]">{history.length} days recorded</span>
                                <span className="font-semibold text-[var(--text)]">
                                    Total: {history.reduce((s, r) => s + (r.workingHrs || 0), 0).toFixed(2)} hrs
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
