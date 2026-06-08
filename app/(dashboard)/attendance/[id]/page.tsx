"use client"
import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { format } from "date-fns"
import { toast } from "sonner"
import {
    ArrowLeft, Download, Calendar, Clock, CheckCircle, XCircle, LogIn, LogOut
} from "lucide-react"

type PunchLog = { punchNumber: number; punchType: "IN" | "OUT"; punchTime: string }
type AttRecord = {
    date?: string
    status: string
    checkIn?: string | null
    checkOut?: string | null
    workingHrs?: number
    remarks?: string | null
    punchLogs?: PunchLog[]
}
type Employee = {
    id: string; employeeId: string; firstName: string; lastName: string
    designation?: string; employeeCategory: string
    department?: { name: string }
}

const STATUS_COLOR: Record<string, { color: string; bg: string; label: string }> = {
    PRESENT:    { color: "#16a34a", bg: "#dcfce7", label: "Present" },
    ABSENT:     { color: "#dc2626", bg: "#fee2e2", label: "Absent" },
    HALF_DAY:   { color: "#d97706", bg: "#fef3c7", label: "Half Day" },
    HOLIDAY:    { color: "#7c3aed", bg: "#ede9fe", label: "Holiday" },
    WEEKLY_OFF: { color: "#6b7280", bg: "#f3f4f6", label: "Weekly Off" },
}

function punchIn(rec?: AttRecord): string {
    if (!rec) return ""
    const ins = (rec.punchLogs || []).filter(p => p.punchType === "IN")
    if (ins.length) return ins.sort((a, b) => +new Date(a.punchTime) - +new Date(b.punchTime))[0].punchTime
    return rec.checkIn || ""
}
function punchOut(rec?: AttRecord): string {
    if (!rec) return ""
    const outs = (rec.punchLogs || []).filter(p => p.punchType === "OUT")
    if (outs.length) return outs.sort((a, b) => +new Date(b.punchTime) - +new Date(a.punchTime))[0].punchTime
    return rec.checkOut || ""
}
function fmtTime(dt: string): string {
    if (!dt) return "—"
    const d = new Date(dt)
    return isNaN(d.getTime()) ? "—" : format(d, "hh:mm a")
}

export default function EmployeeAttendancePage() {
    const { id } = useParams<{ id: string }>()
    const router = useRouter()
    const [emp, setEmp] = useState<Employee | null>(null)
    const [history, setHistory] = useState<AttRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [month, setMonth] = useState("ALL") // "ALL" or "YYYY-MM"

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const [e, a] = await Promise.all([
                fetch(`/api/employees/${id}`).then(r => r.ok ? r.json() : null),
                fetch(`/api/attendance?employeeId=${id}`).then(r => r.ok ? r.json() : []),
            ])
            setEmp(e)
            setHistory(Array.isArray(a) ? a : [])
        } catch { toast.error("Failed to load attendance") }
        finally { setLoading(false) }
    }, [id])

    useEffect(() => { if (id) load() }, [id, load])

    // Months present in data for the filter dropdown
    const months = Array.from(new Set(
        history.filter(r => r.date).map(r => format(new Date(r.date as string), "yyyy-MM"))
    )).sort().reverse()

    const filtered = month === "ALL"
        ? history
        : history.filter(r => r.date && format(new Date(r.date), "yyyy-MM") === month)

    const totals = {
        days: filtered.length,
        present: filtered.filter(r => r.status === "PRESENT").length,
        absent: filtered.filter(r => r.status === "ABSENT").length,
        hours: filtered.reduce((s, r) => s + (r.workingHrs || 0), 0),
    }

    const exportCSV = () => {
        if (!emp) return
        const rows = [["Date", "Day", "Punch In", "Punch Out", "Total Hours", "Status", "Remarks"]]
        filtered.forEach(r => {
            rows.push([
                r.date ? format(new Date(r.date), "dd-MM-yyyy") : "",
                r.date ? format(new Date(r.date), "EEEE") : "",
                fmtTime(punchIn(r)),
                fmtTime(punchOut(r)),
                (r.workingHrs || 0).toFixed(2),
                STATUS_COLOR[r.status]?.label || r.status,
                r.remarks || "",
            ])
        })
        const csv = rows.map(row => row.map(c => `"${c}"`).join(",")).join("\n")
        const blob = new Blob([csv], { type: "text/csv" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${emp.firstName}-${emp.lastName}-attendance${month !== "ALL" ? `-${month}` : ""}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    return (
        <div className="flex flex-col gap-6 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <button onClick={() => router.push("/attendance")}
                    className="flex items-center gap-2 text-[13px] text-[var(--text2)] hover:text-[var(--text)] transition-colors">
                    <ArrowLeft size={16} /> Back to Attendance
                </button>
                <button onClick={exportCSV} disabled={filtered.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-[9px] text-[13px] font-semibold disabled:opacity-60 hover:bg-[#158a5e] transition-colors">
                    <Download size={15} /> Download Excel
                </button>
            </div>

            {/* Employee card */}
            <div className="bg-white border border-[var(--border)] rounded-[12px] p-5 flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-[var(--accent-light)] flex items-center justify-center text-[20px] font-bold text-[var(--accent-text)]">
                    {emp ? `${emp.firstName[0]}${emp.lastName[0]}` : "…"}
                </div>
                <div>
                    <h1 className="text-[20px] font-bold text-[var(--text)]">
                        {emp ? `${emp.firstName} ${emp.lastName}` : "Loading…"}
                    </h1>
                    <p className="text-[13px] text-[var(--text3)]">
                        {emp?.employeeId}
                        {emp?.department ? ` · ${emp.department.name}` : ""}
                        {emp ? ` · ${emp.employeeCategory === "LABOUR" ? "🔧 Labour" : "👔 Staff"}` : ""}
                    </p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
                {[
                    { label: "Total Days", count: totals.days, icon: <Calendar size={16} />, color: "#6b7280", bg: "#f3f4f6" },
                    { label: "Present", count: totals.present, icon: <CheckCircle size={16} />, color: "#16a34a", bg: "#dcfce7" },
                    { label: "Absent", count: totals.absent, icon: <XCircle size={16} />, color: "#dc2626", bg: "#fee2e2" },
                    { label: "Total Hours", count: totals.hours.toFixed(1), icon: <Clock size={16} />, color: "#2563eb", bg: "#dbeafe" },
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

            {/* Month filter */}
            <div className="flex items-center gap-2 bg-white border border-[var(--border)] rounded-[12px] px-4 py-3">
                <Calendar size={15} className="text-[var(--accent)]" />
                <span className="text-[13px] text-[var(--text3)]">Filter:</span>
                <select value={month} onChange={e => setMonth(e.target.value)}
                    className="h-8 px-2 rounded-[7px] border border-[var(--border)] text-[13px] outline-none bg-white">
                    <option value="ALL">All months</option>
                    {months.map(m => <option key={m} value={m}>{format(new Date(`${m}-01`), "MMMM yyyy")}</option>)}
                </select>
            </div>

            {/* Full log table */}
            <div className="bg-white border border-[var(--border)] rounded-[12px] overflow-hidden">
                {loading ? (
                    <div className="p-6 space-y-2">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="h-10 bg-[var(--surface2)] rounded-[8px] animate-pulse" />
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="py-16 text-center text-[var(--text3)]">
                        <Calendar size={28} className="mx-auto mb-2 opacity-30" />
                        <p className="text-[13px]">No attendance records</p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-[var(--border)] bg-[var(--surface2)]">
                                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px]">Date</th>
                                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px]">Punch In</th>
                                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px]">Punch Out</th>
                                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px]">Total Hours</th>
                                <th className="text-center px-4 py-3 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px]">Status</th>
                                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px]">Remarks</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                            {filtered.map((r, i) => {
                                const cfg = STATUS_COLOR[r.status] || STATUS_COLOR.ABSENT
                                const pin = punchIn(r)
                                const pout = punchOut(r)
                                return (
                                    <tr key={i} className="hover:bg-[var(--surface2)] transition-colors">
                                        <td className="px-4 py-3 text-[13px] font-medium text-[var(--text)]">
                                            {r.date ? format(new Date(r.date), "dd MMM yyyy, EEE") : "—"}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center gap-1.5 text-[13px] ${pin ? "text-green-700 font-medium" : "text-[var(--text3)]"}`}>
                                                {pin && <LogIn size={12} className="text-green-600" />}{fmtTime(pin)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center gap-1.5 text-[13px] ${pout ? "text-red-600 font-medium" : "text-[var(--text3)]"}`}>
                                                {pout && <LogOut size={12} className="text-red-500" />}{fmtTime(pout)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-[13px] font-bold text-[var(--text)]">
                                            {r.workingHrs ? `${r.workingHrs.toFixed(2)} hrs` : "—"}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="px-2.5 py-1 rounded-[6px] text-[11px] font-bold" style={{ background: cfg.bg, color: cfg.color }}>
                                                {cfg.label}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-[12px] text-[var(--text2)]">{r.remarks || "—"}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                        <tfoot>
                            <tr className="border-t-2 border-[var(--border)] bg-[var(--surface2)]">
                                <td className="px-4 py-3 text-[12px] font-semibold text-[var(--text3)]">TOTAL</td>
                                <td colSpan={2}></td>
                                <td className="px-4 py-3 text-[13px] font-bold text-[var(--accent-text)]">{totals.hours.toFixed(2)} hrs</td>
                                <td colSpan={2}></td>
                            </tr>
                        </tfoot>
                    </table>
                )}
            </div>
        </div>
    )
}
