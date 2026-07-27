"use client"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import { toast } from "sonner"
import {
    Calendar, Users, CheckCircle, XCircle, Clock, ChevronLeft, ChevronRight,
    LogIn, LogOut, Search, Download, AlertTriangle, ChevronRight as ChevronRightIcon
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

type FailedScans = {
    date: string
    deviceConnected: boolean
    total: number
    matched: number
    failed: number
    failedTimes: string[]
    byHour: Record<string, number>
    noAttendance: { employeeId: string; name: string; hardwareUserId?: string | null }[]
}

const STATUS_COLOR: Record<string, { color: string; bg: string; label: string }> = {
    PRESENT:    { color: "#16a34a", bg: "#dcfce7", label: "Present" },
    ABSENT:     { color: "#dc2626", bg: "#fee2e2", label: "Absent" },
    HALF_DAY:   { color: "#d97706", bg: "#fef3c7", label: "Half Day" },
    HOLIDAY:    { color: "#7c3aed", bg: "#ede9fe", label: "Holiday" },
    WEEKLY_OFF: { color: "#6b7280", bg: "#f3f4f6", label: "Weekly Off" },
}

// Device logs every punch as an entry, so derive by TIME: first punch = IN,
// last punch = OUT (only when there are 2+ punches).
function sortedPunchTimes(rec?: AttRecord): number[] {
    return (rec?.punchLogs || []).map(p => +new Date(p.punchTime)).filter(t => !isNaN(t)).sort((a, b) => a - b)
}
function punchIn(rec?: AttRecord): string {
    if (!rec) return ""
    const t = sortedPunchTimes(rec)
    if (t.length) return new Date(t[0]).toISOString()
    return rec.checkIn || ""
}
function punchOut(rec?: AttRecord): string {
    if (!rec) return ""
    const t = sortedPunchTimes(rec)
    if (t.length >= 2) return new Date(t[t.length - 1]).toISOString()
    return rec.checkOut || ""
}
// Total hours = stored workingHrs, else span (last − first) when 2+ punches
function totalHrs(rec?: AttRecord): number {
    if (!rec) return 0
    if (rec.workingHrs) return rec.workingHrs
    const t = sortedPunchTimes(rec)
    if (t.length >= 2) return parseFloat(((t[t.length - 1] - t[0]) / 3600000).toFixed(2))
    return 0
}
// Format decimal hours (e.g. 4.5) as "4 hr 30 min"
function fmtHrsMin(dec: number): string {
    if (!dec || dec <= 0) return "—"
    const totalMin = Math.round(dec * 60)
    const h = Math.floor(totalMin / 60)
    const m = totalMin % 60
    if (h && m) return `${h} hr ${m} min`
    if (h) return `${h} hr`
    return `${m} min`
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
    const router = useRouter()
    const [employees, setEmployees] = useState<Employee[]>([])
    const [attMap, setAttMap] = useState<Record<string, AttRecord>>({})
    const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"))
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<"ALL" | "LABOUR" | "STAFF">("ALL")
    const [statusFilter, setStatusFilter] = useState<"ALL" | "PRESENT" | "ABSENT">("ALL")
    const [search, setSearch] = useState("")
    // Scans the device logged but could NOT recognise (blank UserID) — these are
    // dropped by the punch pipeline, so the person silently shows absent.
    const [failedScans, setFailedScans] = useState<FailedScans | null>(null)
    const [showFailed, setShowFailed] = useState(false)

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

    const fetchFailedScans = useCallback(async () => {
        setFailedScans(null)
        try {
            const r = await fetch(`/api/hardware/failed-scans?date=${date}`)
            setFailedScans(r.ok ? await r.json() : null)
        } catch { /* device offline / no permission — panel just stays hidden */ }
    }, [date])

    useEffect(() => { Promise.all([fetchEmployees(), fetchAttendance()]) }, [fetchEmployees, fetchAttendance])
    useEffect(() => { setShowFailed(false); fetchFailedScans() }, [fetchFailedScans])

    // Open employee's full attendance page
    const openEmployee = (emp: Employee) => router.push(`/attendance/${emp.id}`)

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

    const isPresent = (e: Employee) => attMap[e.id]?.status === "PRESENT"
    const isAbsent = (e: Employee) => !attMap[e.id] || attMap[e.id]?.status === "ABSENT"

    const counts = {
        present: filtered.filter(isPresent).length,
        absent: filtered.filter(isAbsent).length,
        totalHrs: filtered.reduce((s, e) => s + totalHrs(attMap[e.id]), 0),
    }

    // Table + export respect the clicked status card (Present / Absent)
    const visible = filtered.filter(e => {
        if (statusFilter === "PRESENT") return isPresent(e)
        if (statusFilter === "ABSENT") return isAbsent(e)
        return true
    })

    // CSV export of today's table
    const exportCSV = () => {
        const rows = [["Employee", "ID", "Type", "Punch In", "Punch Out", "Total Hours", "Status"]]
        visible.forEach(e => {
            const rec = attMap[e.id]
            rows.push([
                `${e.firstName} ${e.lastName}`,
                e.employeeId,
                e.employeeCategory,
                fmtTime(punchIn(rec)),
                fmtTime(punchOut(rec)),
                fmtHrsMin(totalHrs(rec)),
                rec ? (STATUS_COLOR[rec.status]?.label || rec.status) : "Absent",
            ])
        })
        const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n")
        const blob = new Blob([csv], { type: "text/csv" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        const tag = statusFilter === "ALL" ? "" : `-${statusFilter.toLowerCase()}`
        a.href = url; a.download = `attendance-${date}${tag}.csv`; a.click()
        URL.revokeObjectURL(url)
    }

    return (
        <div className="flex flex-col gap-4 md:gap-6 p-4 md:p-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-[24px] font-bold text-[var(--text)]">Attendance</h1>
                    <p className="text-[13px] text-[var(--text3)] mt-0.5">Track punch in / out and working hours</p>
                </div>
                <button onClick={exportCSV} disabled={visible.length === 0}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[var(--accent)] text-white rounded-[12px] text-[13px] font-semibold disabled:opacity-60 hover:bg-[#4a4ac8] transition-colors shadow-sm">
                    <Download size={15} /> Export Excel
                </button>
            </div>

            {/* Date Navigator */}
            <div className="flex items-center gap-2 md:gap-3 bg-white border border-[var(--border)] rounded-[16px] px-3 md:px-4 py-3 shadow-[0_2px_10px_rgba(80,80,170,0.05)]">
                <button onClick={() => changeDate(-1)} className="p-1.5 rounded-[8px] hover:bg-[var(--surface2)] transition-colors">
                    <ChevronLeft size={17} className="text-[var(--text2)]" />
                </button>
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-[10px] bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center shrink-0">
                        <Calendar size={16} />
                    </div>
                    <div className="min-w-0">
                        <input type="date" value={date} onChange={e => setDate(e.target.value)}
                            className="block text-[15px] font-bold text-[var(--text)] bg-transparent border-none outline-none cursor-pointer p-0 leading-tight" />
                        <span className="block text-[12px] text-[var(--text3)] leading-tight truncate">{format(parseISO(date), "EEEE, dd MMMM yyyy")}</span>
                    </div>
                </div>
                <button onClick={() => setDate(format(new Date(), "yyyy-MM-dd"))}
                    className="px-3.5 py-1.5 rounded-full bg-[var(--accent-light)] text-[var(--accent-text)] text-[12.5px] font-semibold hover:bg-[#e0e0fa] transition-colors shrink-0">
                    Today
                </button>
                <button onClick={() => changeDate(1)} className="p-1.5 rounded-[8px] hover:bg-[var(--surface2)] transition-colors">
                    <ChevronRight size={17} className="text-[var(--text2)]" />
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-2 md:gap-3">
                {([
                    { label: "Present", count: counts.present, icon: <CheckCircle size={18} />, color: "#16a34a", bg: "#dcfce7", sf: "PRESENT" as const },
                    { label: "Absent", count: counts.absent, icon: <XCircle size={18} />, color: "#dc2626", bg: "#fee2e2", sf: "ABSENT" as const },
                    { label: "Total Hours", count: fmtHrsMin(counts.totalHrs), icon: <Clock size={18} />, color: "#2563eb", bg: "#dbeafe", sf: null },
                    { label: "Employees", count: filtered.length, icon: <Users size={18} />, color: "#7c3aed", bg: "#ede9fe", sf: null },
                ]).map(s => {
                    const clickable = s.sf !== null
                    const active = clickable && statusFilter === s.sf
                    return (
                        <button key={s.label} type="button"
                            onClick={() => clickable && setStatusFilter(active ? "ALL" : s.sf!)}
                            disabled={!clickable}
                            className={`flex flex-col items-center bg-white border rounded-[16px] px-1 py-3.5 md:p-4 transition-all shadow-[0_2px_10px_rgba(80,80,170,0.05)] ${
                                clickable ? "cursor-pointer hover:shadow-md" : "cursor-default"
                            }`}
                            style={{ borderColor: active ? s.color : "var(--border)", boxShadow: active ? `0 0 0 1.5px ${s.color}` : undefined }}>
                            <div className="w-11 h-11 rounded-full flex items-center justify-center mb-2" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
                            <p className="text-[11.5px] text-[var(--text2)] font-medium truncate max-w-full">{s.label}</p>
                            <p className="text-[20px] md:text-[24px] font-bold mt-0.5 truncate max-w-full" style={{ color: s.color }}>{s.count}</p>
                        </button>
                    )
                })}
            </div>

            {/* Failed scans — the device saw someone but could not recognise them, so
                no attendance was created. Without this the absence looks unexplained. */}
            {failedScans && failedScans.failed > 0 && (
                <div className="bg-white border border-amber-300 rounded-[16px] shadow-[0_2px_10px_rgba(80,80,170,0.05)] overflow-hidden">
                    <button type="button" onClick={() => setShowFailed(v => !v)}
                        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-amber-50/60 transition-colors">
                        <div className="w-9 h-9 rounded-[10px] bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                            <AlertTriangle size={17} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[13.5px] font-semibold text-[var(--text)]">
                                {failedScans.failed} scans not recognised
                            </p>
                            <p className="text-[11.5px] text-[var(--text3)] leading-tight">
                                {failedScans.matched} of {failedScans.total} punches matched · these {failedScans.failed} had no face/card match, so no attendance was marked
                            </p>
                        </div>
                        <ChevronRightIcon size={17}
                            className={`text-[var(--text3)] shrink-0 transition-transform ${showFailed ? "rotate-90" : ""}`} />
                    </button>
                    {showFailed && (
                        <div className="px-4 pb-4 pt-1 border-t border-[var(--border)] space-y-3">
                            <div>
                                <p className="text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.4px] mb-1.5">Failed attempts by hour</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {Object.entries(failedScans.byHour).sort().map(([h, n]) => (
                                        <span key={h} className="px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-[11.5px] font-medium text-amber-800">
                                            {h}:00 — {n}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <p className="text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.4px] mb-1.5">Times</p>
                                <p className="text-[11.5px] text-[var(--text2)] leading-relaxed break-words font-mono">
                                    {failedScans.failedTimes.join("  ·  ")}
                                </p>
                            </div>
                            {failedScans.noAttendance.length > 0 && (
                                <div>
                                    <p className="text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.4px] mb-1.5">
                                        No attendance today ({failedScans.noAttendance.length}) — likely among the failed scans
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {failedScans.noAttendance.map(e => (
                                            <span key={e.employeeId} className="px-2.5 py-1 rounded-full bg-[var(--surface2)] border border-[var(--border)] text-[11.5px] text-[var(--text2)]">
                                                {e.name} <span className="text-[var(--text3)]">({e.employeeId})</span>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <p className="text-[11px] text-[var(--text3)] leading-relaxed">
                                A failed scan means the device could not match the face or card to anyone enrolled.
                                Re-enrol these people on the device, and check the camera lens and lighting if it keeps happening at the same hour.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Controls */}
            <div className="flex flex-col md:flex-row md:items-center gap-3">
                <div className="relative flex-1">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text3)]" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employee..."
                        className="w-full h-11 pl-10 pr-3 rounded-[14px] border border-[var(--border)] text-[13.5px] outline-none focus:border-[var(--accent)] bg-white shadow-[0_2px_10px_rgba(80,80,170,0.05)]" />
                </div>
                <div className="flex gap-2">
                    {(["ALL", "LABOUR", "STAFF"] as const).map(f => (
                        <button key={f} onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-full text-[12.5px] font-semibold transition-colors border ${
                                filter === f
                                    ? "bg-[var(--accent)] text-white border-[var(--accent)] shadow-sm"
                                    : "bg-white text-[var(--text2)] border-[var(--border)] hover:bg-[var(--surface2)]"
                            }`}>
                            {f === "ALL" ? "All" : f === "LABOUR" ? "🔧 Labour" : "👔 Staff"}
                        </button>
                    ))}
                </div>
            </div>

            {/* Mobile card list */}
            <div className="md:hidden space-y-2.5">
                {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-[76px] bg-white border border-[var(--border)] rounded-[16px] animate-pulse" />
                    ))
                ) : visible.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-[var(--text3)] bg-white border border-[var(--border)] rounded-[16px]">
                        <Users size={32} className="mb-2 opacity-40" />
                        <p className="text-[14px]">
                            {statusFilter === "ABSENT" ? "No absent employees" :
                             statusFilter === "PRESENT" ? "No present employees" : "No employees found"}
                        </p>
                    </div>
                ) : visible.map(emp => {
                    const rec = attMap[emp.id]
                    const status = rec?.status || "ABSENT"
                    const cfg = STATUS_COLOR[status] || STATUS_COLOR.ABSENT
                    const isLabour = emp.employeeCategory === "LABOUR"
                    const pin = punchIn(rec)
                    const pout = punchOut(rec)
                    return (
                        <button key={emp.id} onClick={() => openEmployee(emp)}
                            className="w-full text-left bg-white border border-[var(--border)] rounded-[16px] px-3.5 py-3 shadow-[0_2px_10px_rgba(80,80,170,0.05)] active:bg-[var(--surface2)] transition-colors">
                            {/* Row 1: identity + status */}
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-[var(--accent-light)] flex items-center justify-center text-[12.5px] font-bold text-[var(--accent-text)] shrink-0">
                                    {emp.firstName[0]}{emp.lastName?.[0] || ""}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[14px] font-semibold text-[var(--text)] truncate">{emp.firstName} {emp.lastName}</p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <p className="text-[11.5px] text-[var(--accent-text)] font-medium">{emp.employeeId}</p>
                                        <span className={`px-1.5 py-0.5 rounded-[5px] text-[10px] font-semibold ${
                                            isLabour ? "bg-orange-50 text-orange-700" : "bg-blue-50 text-blue-700"
                                        }`}>
                                            {isLabour ? "🔧 Labour" : "👔 Staff"}
                                        </span>
                                    </div>
                                </div>
                                <span className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold" style={{ background: cfg.bg, color: cfg.color }}>
                                    {cfg.label}
                                </span>
                            </div>
                            {/* Row 2: punch times */}
                            <div className="grid grid-cols-3 gap-2 mt-2.5 pt-2.5 border-t border-[var(--border)]">
                                <div>
                                    <p className="text-[10px] text-[var(--text3)] font-medium">Punch In</p>
                                    <p className={`text-[12.5px] font-semibold mt-0.5 ${pin ? "text-green-600" : "text-[var(--text3)]"}`}>{fmtTime(pin)}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-[var(--text3)] font-medium">Punch Out</p>
                                    <p className={`text-[12.5px] font-semibold mt-0.5 ${pout ? "text-red-500" : "text-[var(--text3)]"}`}>{fmtTime(pout)}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-[var(--text3)] font-medium">Hours</p>
                                    <p className="text-[12.5px] font-semibold mt-0.5 text-[var(--text)]">{fmtHrsMin(totalHrs(rec))}</p>
                                </div>
                            </div>
                        </button>
                    )
                })}
            </div>

            {/* Excel-style Table (desktop) */}
            <div className="hidden md:block bg-white border border-[var(--border)] rounded-[16px] overflow-hidden shadow-[0_2px_10px_rgba(80,80,170,0.05)]">
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
                ) : visible.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-[var(--text3)]">
                        <Users size={32} className="mb-2 opacity-40" />
                        <p className="text-[14px]">
                            {statusFilter === "ABSENT" ? "No absent employees" :
                             statusFilter === "PRESENT" ? "No present employees" : "No employees found"}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px]">
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
                            {visible.map(emp => {
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
                                            <span className={`text-[13px] font-bold ${totalHrs(rec) ? "text-[var(--text)]" : "text-[var(--text3)]"}`}>
                                                {fmtHrsMin(totalHrs(rec))}
                                            </span>
                                        </td>
                                        {/* Status */}
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-center gap-2">
                                                <span className="px-2.5 py-1 rounded-[6px] text-[11px] font-bold" style={{ background: cfg.bg, color: cfg.color }}>
                                                    {cfg.label}
                                                </span>
                                                <ChevronRightIcon size={15} className="text-[var(--text3)]" />
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                    </div>
                )}
            </div>

        </div>
    )
}
