"use client"
import { useState, useEffect, useCallback } from "react"
import { format, parseISO } from "date-fns"
import { toast } from "sonner"
import { Calendar, Users, CheckCircle, XCircle, Clock, Save, ChevronLeft, ChevronRight, LogIn, LogOut } from "lucide-react"

type Employee = {
    id: string
    employeeId: string
    firstName: string
    lastName: string
    designation?: string
    employeeCategory: string
    dailyRate?: number
    basicSalary: number
    shiftHours?: number
    department?: { name: string }
}

type AttendanceStatus = "PRESENT" | "ABSENT" | "HALF_DAY" | "HOLIDAY" | "WEEKLY_OFF"

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; short: string; color: string; bg: string }> = {
    PRESENT:    { label: "Present",    short: "P",  color: "#16a34a", bg: "#dcfce7" },
    ABSENT:     { label: "Absent",     short: "A",  color: "#dc2626", bg: "#fee2e2" },
    HALF_DAY:   { label: "Half Day",   short: "H",  color: "#d97706", bg: "#fef3c7" },
    HOLIDAY:    { label: "Holiday",    short: "HO", color: "#7c3aed", bg: "#ede9fe" },
    WEEKLY_OFF: { label: "Weekly Off", short: "WO", color: "#6b7280", bg: "#f3f4f6" },
}

// Helper: extract "HH:MM" from a Date/ISO string in local time
function extractTime(dt: string | null | undefined): string {
    if (!dt) return ""
    const d = new Date(dt)
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

// Helper: calculate working hours from "HH:MM" strings
function calcWorkingHrs(checkIn: string, checkOut: string): number {
    if (!checkIn || !checkOut) return 0
    const [inH, inM] = checkIn.split(":").map(Number)
    const [outH, outM] = checkOut.split(":").map(Number)
    const totalMins = (outH * 60 + outM) - (inH * 60 + inM)
    return Math.max(0, parseFloat((totalMins / 60).toFixed(2)))
}

// For labour: compute day earning and deduction
function calcLabourDay(emp: Employee, checkIn: string, checkOut: string) {
    if (!emp.dailyRate || !checkIn || !checkOut) return null
    const shiftHrs = emp.shiftHours || 8
    const worked = calcWorkingHrs(checkIn, checkOut)
    const hourlyRate = emp.dailyRate / shiftHrs
    const dayEarning = parseFloat((Math.min(worked, shiftHrs) * hourlyRate).toFixed(2))
    const deduction = parseFloat((emp.dailyRate - dayEarning).toFixed(2))
    return { worked, shiftHrs, dayEarning, deduction, hourlyRate }
}

export default function AttendancePage() {
    const [employees, setEmployees] = useState<Employee[]>([])
    const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({})
    const [remarks, setRemarks] = useState<Record<string, string>>({})
    const [checkIns, setCheckIns] = useState<Record<string, string>>({})
    const [checkOuts, setCheckOuts] = useState<Record<string, string>>({})
    const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"))
    const [saving, setSaving] = useState(false)
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<"ALL" | "LABOUR" | "STAFF">("ALL")
    const [saved, setSaved] = useState(false)

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
            const map: Record<string, AttendanceStatus> = {}
            const rem: Record<string, string> = {}
            const ci: Record<string, string> = {}
            const co: Record<string, string> = {}
            if (Array.isArray(data)) {
                data.forEach((a: {
                    employeeId: string
                    status: AttendanceStatus
                    remarks?: string
                    checkIn?: string
                    checkOut?: string
                }) => {
                    map[a.employeeId] = a.status
                    if (a.remarks) rem[a.employeeId] = a.remarks
                    if (a.checkIn) ci[a.employeeId] = extractTime(a.checkIn)
                    if (a.checkOut) co[a.employeeId] = extractTime(a.checkOut)
                })
            }
            setAttendance(map)
            setRemarks(rem)
            setCheckIns(ci)
            setCheckOuts(co)
            setSaved(Object.keys(map).length > 0)
        } catch { toast.error("Failed to load attendance") }
        finally { setLoading(false) }
    }, [date])

    useEffect(() => { fetchEmployees() }, [fetchEmployees])
    useEffect(() => { fetchAttendance() }, [fetchAttendance])

    const filtered = employees.filter(e =>
        filter === "ALL" ? true : e.employeeCategory === filter
    )

    const setStatus = (empId: string, status: AttendanceStatus) =>
        setAttendance(p => ({ ...p, [empId]: status }))

    const markAll = (status: AttendanceStatus) => {
        const map: Record<string, AttendanceStatus> = {}
        filtered.forEach(e => { map[e.id] = status })
        setAttendance(p => ({ ...p, ...map }))
    }

    const handleSave = async () => {
        const records = filtered.map(e => ({
            employeeId: e.id,
            date,
            status: attendance[e.id] || "ABSENT",
            remarks: remarks[e.id] || "",
            checkIn: checkIns[e.id] || undefined,
            checkOut: checkOuts[e.id] || undefined,
        }))
        setSaving(true)
        try {
            const r = await fetch("/api/attendance", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(records),
            })
            if (!r.ok) throw new Error()
            toast.success(`Attendance saved for ${records.length} employees`)
            setSaved(true)
        } catch { toast.error("Failed to save attendance") }
        finally { setSaving(false) }
    }

    const changeDate = (days: number) => {
        const d = new Date(date)
        d.setDate(d.getDate() + days)
        setDate(format(d, "yyyy-MM-dd"))
        setSaved(false)
    }

    const counts = {
        present: filtered.filter(e => attendance[e.id] === "PRESENT").length,
        absent: filtered.filter(e => attendance[e.id] === "ABSENT" || !attendance[e.id]).length,
        half: filtered.filter(e => attendance[e.id] === "HALF_DAY").length,
        off: filtered.filter(e => attendance[e.id] === "HOLIDAY" || attendance[e.id] === "WEEKLY_OFF").length,
    }

    return (
        <div className="flex flex-col gap-6 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-[22px] font-bold text-[var(--text)]">Attendance</h1>
                    <p className="text-[13px] text-[var(--text3)] mt-0.5">Mark daily attendance · Labour punch-in/out auto-calculates working hours</p>
                </div>
                <button onClick={handleSave} disabled={saving || filtered.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-[9px] text-[13px] font-semibold disabled:opacity-60 hover:bg-[#158a5e] transition-colors">
                    <Save size={15} />
                    {saving ? "Saving..." : saved ? "Update Attendance" : "Save Attendance"}
                </button>
            </div>

            {/* Date Navigator */}
            <div className="flex items-center gap-3 bg-white border border-[var(--border)] rounded-[12px] px-4 py-3">
                <button onClick={() => changeDate(-1)} className="p-1.5 rounded-[6px] hover:bg-[var(--surface2)] transition-colors">
                    <ChevronLeft size={16} className="text-[var(--text2)]" />
                </button>
                <div className="flex items-center gap-2 flex-1">
                    <Calendar size={16} className="text-[var(--accent)]" />
                    <input type="date" value={date} onChange={e => { setDate(e.target.value); setSaved(false) }}
                        className="text-[15px] font-semibold text-[var(--text)] bg-transparent border-none outline-none cursor-pointer" />
                    <span className="text-[13px] text-[var(--text3)]">
                        {format(parseISO(date), "EEEE, dd MMMM yyyy")}
                    </span>
                </div>
                <button onClick={() => changeDate(1)} className="p-1.5 rounded-[6px] hover:bg-[var(--surface2)] transition-colors">
                    <ChevronRight size={16} className="text-[var(--text2)]" />
                </button>
                <button onClick={() => { setDate(format(new Date(), "yyyy-MM-dd")); setSaved(false) }}
                    className="px-3 py-1 rounded-[6px] bg-[var(--accent-light)] text-[var(--accent-text)] text-[12px] font-medium hover:bg-[#d1f0e4] transition-colors">
                    Today
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
                {[
                    { label: "Present", count: counts.present, icon: <CheckCircle size={16} />, color: "#16a34a", bg: "#dcfce7" },
                    { label: "Absent", count: counts.absent, icon: <XCircle size={16} />, color: "#dc2626", bg: "#fee2e2" },
                    { label: "Half Day", count: counts.half, icon: <Clock size={16} />, color: "#d97706", bg: "#fef3c7" },
                    { label: "Total", count: filtered.length, icon: <Users size={16} />, color: "#6b7280", bg: "#f3f4f6" },
                ].map(s => (
                    <div key={s.label} className="bg-white border border-[var(--border)] rounded-[12px] p-4">
                        <div className="flex items-center justify-between">
                            <p className="text-[12px] text-[var(--text3)] font-medium">{s.label}</p>
                            <div className="p-1.5 rounded-[6px]" style={{ background: s.bg, color: s.color }}>
                                {s.icon}
                            </div>
                        </div>
                        <p className="text-[24px] font-bold mt-1" style={{ color: s.color }}>{s.count}</p>
                    </div>
                ))}
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between bg-white border border-[var(--border)] rounded-[12px] px-4 py-3">
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
                <div className="flex items-center gap-2">
                    <span className="text-[12px] text-[var(--text3)]">Mark all:</span>
                    {(Object.entries(STATUS_CONFIG) as [AttendanceStatus, typeof STATUS_CONFIG[AttendanceStatus]][]).map(([key, cfg]) => (
                        <button key={key} onClick={() => markAll(key)}
                            className="px-2.5 py-1 rounded-[6px] text-[11px] font-bold transition-colors"
                            style={{ background: cfg.bg, color: cfg.color }}>
                            {cfg.short}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="bg-white border border-[var(--border)] rounded-[12px] overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-16 text-[var(--text3)]">Loading...</div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-[var(--text3)]">
                        <Users size={32} className="mb-2 opacity-40" />
                        <p className="text-[14px]">No employees found</p>
                        <p className="text-[12px]">Add employees first to mark attendance</p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-[var(--border)] bg-[var(--surface2)]">
                                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px]">Employee</th>
                                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px]">Type / Rate</th>
                                <th className="text-center px-4 py-3 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px]">Status</th>
                                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px]">Punch In/Out · Working Hrs</th>
                                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px]">Remarks</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                            {filtered.map(emp => {
                                const status = attendance[emp.id] || "ABSENT"
                                const cfg = STATUS_CONFIG[status]
                                const isLabour = emp.employeeCategory === "LABOUR"
                                const isPresent = status === "PRESENT"
                                const ci = checkIns[emp.id] || ""
                                const co = checkOuts[emp.id] || ""
                                const dayCalc = isLabour && isPresent ? calcLabourDay(emp, ci, co) : null

                                return (
                                    <tr key={emp.id} className="hover:bg-[var(--surface2)] transition-colors">
                                        {/* Employee */}
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-8 h-8 rounded-full bg-[var(--accent-light)] flex items-center justify-center text-[12px] font-bold text-[var(--accent-text)]">
                                                    {emp.firstName[0]}{emp.lastName[0]}
                                                </div>
                                                <div>
                                                    <p className="text-[13px] font-medium text-[var(--text)]">{emp.firstName} {emp.lastName}</p>
                                                    <p className="text-[11px] text-[var(--text3)]">{emp.employeeId}{emp.department ? ` · ${emp.department.name}` : ""}</p>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Type / Rate */}
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded-[5px] text-[11px] font-semibold block w-fit mb-1 ${
                                                isLabour ? "bg-orange-50 text-orange-700" : "bg-blue-50 text-blue-700"
                                            }`}>
                                                {isLabour ? "🔧 Labour" : "👔 Staff"}
                                            </span>
                                            <p className="text-[12px] text-[var(--text2)]">
                                                {isLabour
                                                    ? `₹${emp.dailyRate || 0}/day · ${emp.shiftHours || 8}hr shift`
                                                    : `₹${(emp.basicSalary || 0).toLocaleString()}/mo`}
                                            </p>
                                        </td>

                                        {/* Status buttons */}
                                        <td className="px-4 py-3">
                                            <div className="flex gap-1.5 justify-center">
                                                {(Object.entries(STATUS_CONFIG) as [AttendanceStatus, typeof STATUS_CONFIG[AttendanceStatus]][]).map(([key, c]) => (
                                                    <button key={key} onClick={() => setStatus(emp.id, key)}
                                                        className="w-8 h-8 rounded-[6px] text-[11px] font-bold transition-all"
                                                        style={{
                                                            background: status === key ? c.color : c.bg,
                                                            color: status === key ? "#fff" : c.color,
                                                            border: `1.5px solid ${status === key ? c.color : "transparent"}`,
                                                            transform: status === key ? "scale(1.1)" : "scale(1)",
                                                        }}>
                                                        {c.short}
                                                    </button>
                                                ))}
                                            </div>
                                        </td>

                                        {/* Punch In/Out column */}
                                        <td className="px-4 py-3">
                                            {isLabour && isPresent ? (
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-[7px] px-2 py-1">
                                                            <LogIn size={12} className="text-green-600" />
                                                            <span className="text-[11px] text-green-700 font-medium">In</span>
                                                            <input
                                                                type="time"
                                                                value={ci}
                                                                onChange={e => setCheckIns(p => ({ ...p, [emp.id]: e.target.value }))}
                                                                className="text-[12px] font-semibold text-green-800 bg-transparent border-none outline-none w-[72px]"
                                                            />
                                                        </div>
                                                        <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-[7px] px-2 py-1">
                                                            <LogOut size={12} className="text-red-500" />
                                                            <span className="text-[11px] text-red-600 font-medium">Out</span>
                                                            <input
                                                                type="time"
                                                                value={co}
                                                                onChange={e => setCheckOuts(p => ({ ...p, [emp.id]: e.target.value }))}
                                                                className="text-[12px] font-semibold text-red-700 bg-transparent border-none outline-none w-[72px]"
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Working hours + deduction preview */}
                                                    {dayCalc ? (
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className={`px-2 py-0.5 rounded-[5px] text-[11px] font-bold ${
                                                                dayCalc.worked >= dayCalc.shiftHrs
                                                                    ? "bg-green-100 text-green-700"
                                                                    : "bg-amber-100 text-amber-700"
                                                            }`}>
                                                                ⏱ {dayCalc.worked.toFixed(1)} hr / {dayCalc.shiftHrs} hr
                                                            </span>
                                                            <span className="text-[11px] font-semibold text-green-700">
                                                                ₹{dayCalc.dayEarning.toFixed(0)} earned
                                                            </span>
                                                            {dayCalc.deduction > 0 && (
                                                                <span className="text-[11px] font-semibold text-red-600">
                                                                    −₹{dayCalc.deduction.toFixed(0)} cut
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : ci && co ? null : (
                                                        <p className="text-[11px] text-[var(--text3)]">Enter punch-in &amp; out time</p>
                                                    )}
                                                </div>
                                            ) : isLabour && !isPresent ? (
                                                <span className="text-[12px] text-[var(--text3)] italic">
                                                    {status === "ABSENT" ? "Absent — ₹0" : status === "HALF_DAY" ? `Half day — ₹${((emp.dailyRate || 0) / 2).toFixed(0)}` : "—"}
                                                </span>
                                            ) : (
                                                <span className="text-[12px] text-[var(--text3)]">—</span>
                                            )}
                                        </td>

                                        {/* Remarks */}
                                        <td className="px-4 py-3">
                                            <input
                                                value={remarks[emp.id] || ""}
                                                onChange={e => setRemarks(p => ({ ...p, [emp.id]: e.target.value }))}
                                                placeholder="Optional..."
                                                className="w-full h-7 rounded-[6px] border border-[var(--border)] px-2 text-[12px] text-[var(--text)] bg-[var(--surface2)] outline-none focus:border-[var(--accent)] transition-colors"
                                            />
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {filtered.length > 0 && (
                <div className="flex items-center justify-between text-[12px] text-[var(--text3)]">
                    <span>{filtered.length} employees · {counts.present} present · {counts.absent} absent</span>
                    <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-1.5 px-4 py-2 bg-[var(--accent)] text-white rounded-[8px] text-[12px] font-semibold disabled:opacity-60 hover:bg-[#158a5e] transition-colors">
                        <Save size={13} />
                        {saving ? "Saving..." : "Save Attendance"}
                    </button>
                </div>
            )}
        </div>
    )
}
