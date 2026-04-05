"use client"
import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
    Calendar, CheckCircle, XCircle, Clock, Loader2,
    ChevronLeft, ChevronRight, Users, Building2, Search,
    Edit2, X, AlertCircle
} from "lucide-react"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths } from "date-fns"

type AttendanceRecord = {
    id: string
    employeeId: string
    date: string
    checkIn?: string
    checkOut?: string
    status: string
    overtimeHrs: number
    remarks?: string
    employee: {
        id: string
        firstName: string
        lastName: string
        employeeId: string
        designation?: string
        photo?: string
    }
    site?: { id: string; name: string }
}

type Employee = {
    id: string
    firstName: string
    lastName: string
    employeeId: string
    designation?: string
    status: string
    photo?: string
    branch: { id: string; name: string }
}

type Branch = { id: string; name: string }

const STATUS_COLORS: Record<string, { label: string; color: string; bg: string; border: string }> = {
    PRESENT: { label: "Present", color: "#1a9e6e", bg: "#e8f7f1", border: "#6ee7b7" },
    ABSENT: { label: "Absent", color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
    HALF_DAY: { label: "Half Day", color: "#f59e0b", bg: "#fffbeb", border: "#fde68a" },
    LATE: { label: "Late", color: "#8b5cf6", bg: "#f5f3ff", border: "#ddd6fe" },
    ON_LEAVE: { label: "On Leave", color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb" },
}

function Avatar({ firstName, lastName, photo, size = 36 }: { firstName: string; lastName: string; photo?: string; size?: number }) {
    const initials = `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase()
    const colors = ["#1a9e6e", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4"]
    const bg = colors[(firstName.charCodeAt(0) + lastName.charCodeAt(0)) % colors.length]
    if (photo) return <img src={photo} alt="" style={{ width: size, height: size }} className="rounded-full object-cover" />
    return <div style={{ width: size, height: size, background: bg }} className="rounded-full flex items-center justify-center text-white font-semibold text-[12px]">{initials}</div>
}

function MarkAttendanceModal({
    open, onClose, onSaved, employee, date, existing
}: {
    open: boolean
    onClose: () => void
    onSaved: () => void
    employee: Employee | null
    date: Date
    existing?: AttendanceRecord | null
}) {
    const [loading, setLoading] = useState(false)
    const [form, setForm] = useState({
        status: "PRESENT",
        checkIn: "",
        checkOut: "",
        overtimeHrs: "0",
        remarks: "",
    })

    useEffect(() => {
        if (existing) {
            setForm({
                status: existing.status,
                checkIn: existing.checkIn ? format(new Date(existing.checkIn), "HH:mm") : "",
                checkOut: existing.checkOut ? format(new Date(existing.checkOut), "HH:mm") : "",
                overtimeHrs: existing.overtimeHrs.toString(),
                remarks: existing.remarks || "",
            })
        } else {
            setForm({ status: "PRESENT", checkIn: "", checkOut: "", overtimeHrs: "0", remarks: "" })
        }
    }, [existing, open])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!employee) return
        setLoading(true)
        try {
            const dateStr = format(date, "yyyy-MM-dd")
            const checkInDateTime = form.checkIn ? `${dateStr}T${form.checkIn}:00` : null
            const checkOutDateTime = form.checkOut ? `${dateStr}T${form.checkOut}:00` : null

            const res = await fetch("/api/attendance", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    employeeId: employee.id,
                    date: dateStr,
                    checkIn: checkInDateTime,
                    checkOut: checkOutDateTime,
                    status: form.status,
                    overtimeHrs: parseFloat(form.overtimeHrs) || 0,
                    remarks: form.remarks,
                }),
            })
            if (!res.ok) throw new Error(await res.text())
            toast.success("Attendance saved!")
            onSaved()
            onClose()
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to save")
        } finally {
            setLoading(false)
        }
    }

    if (!open || !employee) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-[16px] border border-[var(--border)] w-full max-w-md shadow-xl">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
                    <div>
                        <h2 className="text-[15px] font-semibold text-[var(--text)]">Mark Attendance</h2>
                        <p className="text-[12px] text-[var(--text3)]">{employee.firstName} {employee.lastName} · {format(date, "dd MMM yyyy")}</p>
                    </div>
                    <button onClick={onClose} className="p-1 text-[var(--text3)] hover:text-[var(--text)] rounded-md hover:bg-[var(--surface2)] transition-colors"><X size={18} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div>
                        <label className="block text-[12px] text-[var(--text2)] mb-2">Status</label>
                        <div className="grid grid-cols-3 gap-2">
                            {Object.entries(STATUS_COLORS).map(([key, val]) => (
                                <button key={key} type="button"
                                    onClick={() => setForm(f => ({ ...f, status: key }))}
                                    style={form.status === key ? { background: val.bg, color: val.color, borderColor: val.border } : {}}
                                    className={`h-9 rounded-[8px] border text-[12px] font-medium transition-all ${form.status === key ? "border" : "border-[var(--border)] text-[var(--text3)] hover:bg-[var(--surface2)]"}`}>
                                    {val.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[12px] text-[var(--text2)] mb-1">Check In</label>
                            <input type="time" value={form.checkIn} onChange={e => setForm(f => ({ ...f, checkIn: e.target.value }))}
                                className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors" />
                        </div>
                        <div>
                            <label className="block text-[12px] text-[var(--text2)] mb-1">Check Out</label>
                            <input type="time" value={form.checkOut} onChange={e => setForm(f => ({ ...f, checkOut: e.target.value }))}
                                className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[12px] text-[var(--text2)] mb-1">Overtime Hours</label>
                        <input type="number" step="0.5" min="0" value={form.overtimeHrs} onChange={e => setForm(f => ({ ...f, overtimeHrs: e.target.value }))}
                            className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors" />
                    </div>
                    <div>
                        <label className="block text-[12px] text-[var(--text2)] mb-1">Remarks</label>
                        <input value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                            className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors"
                            placeholder="Optional remarks" />
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] font-medium text-[var(--text2)] hover:text-[var(--text)] rounded-[8px] hover:bg-[var(--surface2)] transition-colors">Cancel</button>
                        <button type="submit" disabled={loading}
                            className="inline-flex items-center gap-2 px-5 py-2 bg-[var(--accent)] text-white rounded-[8px] text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                            {loading && <Loader2 size={14} className="animate-spin" />}
                            Save
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default function AttendancePage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [viewMode, setViewMode] = useState<"daily" | "monthly">("daily")
    const [selectedDate, setSelectedDate] = useState(new Date())
    const [calendarMonth, setCalendarMonth] = useState(new Date())
    const [employees, setEmployees] = useState<Employee[]>([])
    const [attendances, setAttendances] = useState<AttendanceRecord[]>([])
    const [branches, setBranches] = useState<Branch[]>([])
    const [branchFilter, setBranchFilter] = useState("")
    const [search, setSearch] = useState("")
    const [loading, setLoading] = useState(true)
    const [markModal, setMarkModal] = useState(false)
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
    const [existingRecord, setExistingRecord] = useState<AttendanceRecord | null>(null)
    const [monthlyAttendances, setMonthlyAttendances] = useState<AttendanceRecord[]>([])
    const [selectedMonthlyEmployee, setSelectedMonthlyEmployee] = useState<Employee | null>(null)

    useEffect(() => {
        if (status === "unauthenticated") router.push("/login")
    }, [status, router])

    useEffect(() => {
        fetch("/api/branches").then(r => r.json()).then(d => setBranches(Array.isArray(d) ? d : [])).catch(() => {})
    }, [])

    const fetchEmployees = useCallback(async () => {
        const params = new URLSearchParams()
        if (branchFilter) params.set("branchId", branchFilter)
        params.set("status", "ACTIVE")
        const res = await fetch(`/api/employees?${params}`)
        const data = await res.json()
        setEmployees(Array.isArray(data) ? data : [])
    }, [branchFilter])

    const fetchAttendances = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            params.set("date", format(selectedDate, "yyyy-MM-dd"))
            if (branchFilter) params.set("branchId", branchFilter)
            const res = await fetch(`/api/attendance?${params}`)
            const data = await res.json()
            setAttendances(Array.isArray(data) ? data : [])
        } catch {
            toast.error("Failed to load attendance")
        } finally {
            setLoading(false)
        }
    }, [selectedDate, branchFilter])

    const fetchMonthlyAttendance = useCallback(async () => {
        if (!selectedMonthlyEmployee) return
        setLoading(true)
        try {
            const params = new URLSearchParams()
            params.set("employeeId", selectedMonthlyEmployee.id)
            params.set("month", String(calendarMonth.getMonth() + 1))
            params.set("year", String(calendarMonth.getFullYear()))
            const res = await fetch(`/api/attendance?${params}`)
            const data = await res.json()
            setMonthlyAttendances(Array.isArray(data) ? data : [])
        } catch {
            toast.error("Failed to load monthly attendance")
        } finally {
            setLoading(false)
        }
    }, [selectedMonthlyEmployee, calendarMonth])

    useEffect(() => {
        if (status === "authenticated") {
            fetchEmployees()
            fetchAttendances()
        }
    }, [status, fetchEmployees, fetchAttendances])

    useEffect(() => {
        if (viewMode === "monthly" && selectedMonthlyEmployee) fetchMonthlyAttendance()
    }, [viewMode, selectedMonthlyEmployee, fetchMonthlyAttendance])

    const getAttendanceForEmployee = (empId: string) => {
        return attendances.find(a => a.employeeId === empId)
    }

    const filteredEmployees = employees.filter(e =>
        !search || `${e.firstName} ${e.lastName} ${e.employeeId}`.toLowerCase().includes(search.toLowerCase())
    )

    const present = attendances.filter(a => a.status === "PRESENT").length
    const absent = filteredEmployees.filter(e => !getAttendanceForEmployee(e.id)).length
    const onLeave = attendances.filter(a => a.status === "ON_LEAVE").length
    const late = attendances.filter(a => a.status === "LATE").length

    // Calendar days for monthly view
    const calendarDays = eachDayOfInterval({ start: startOfMonth(calendarMonth), end: endOfMonth(calendarMonth) })

    const getCalendarDayStatus = (day: Date) => {
        const record = monthlyAttendances.find(a => {
            const d = new Date(a.date)
            return d.getDate() === day.getDate() && d.getMonth() === day.getMonth() && d.getFullYear() === day.getFullYear()
        })
        return record?.status || null
    }

    if (status === "loading") {
        return <div className="flex items-center justify-center min-h-screen"><Loader2 size={28} className="animate-spin text-[var(--accent)]" /></div>
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-[24px] font-semibold tracking-[-0.4px] text-[var(--text)]">Attendance</h1>
                    <p className="text-[13px] text-[var(--text3)] mt-0.5">Track employee attendance</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setViewMode("daily")}
                        className={`px-4 py-2 rounded-[8px] text-[13px] font-medium transition-colors ${viewMode === "daily" ? "bg-[var(--accent)] text-white" : "bg-white border border-[var(--border)] text-[var(--text2)] hover:bg-[var(--surface2)]"}`}>
                        Daily View
                    </button>
                    <button onClick={() => setViewMode("monthly")}
                        className={`px-4 py-2 rounded-[8px] text-[13px] font-medium transition-colors ${viewMode === "monthly" ? "bg-[var(--accent)] text-white" : "bg-white border border-[var(--border)] text-[var(--text2)] hover:bg-[var(--surface2)]"}`}>
                        Monthly View
                    </button>
                </div>
            </div>

            {viewMode === "daily" ? (
                <>
                    {/* Date Picker + Stats */}
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2 bg-white border border-[var(--border)] rounded-[10px] px-3 py-2">
                            <button onClick={() => setSelectedDate(d => { const n = new Date(d); n.setDate(n.getDate() - 1); return n })}
                                className="p-0.5 text-[var(--text3)] hover:text-[var(--text)] transition-colors"><ChevronLeft size={16} /></button>
                            <input type="date" value={format(selectedDate, "yyyy-MM-dd")}
                                onChange={e => setSelectedDate(new Date(e.target.value))}
                                className="text-[13px] font-medium text-[var(--text)] outline-none bg-transparent cursor-pointer" />
                            <button onClick={() => setSelectedDate(d => { const n = new Date(d); n.setDate(n.getDate() + 1); return n })}
                                className="p-0.5 text-[var(--text3)] hover:text-[var(--text)] transition-colors"><ChevronRight size={16} /></button>
                        </div>
                        <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)}
                            className="h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors">
                            <option value="">All Branches</option>
                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            { label: "Present", value: present, color: "#1a9e6e", bg: "#e8f7f1", icon: <CheckCircle size={18} /> },
                            { label: "Absent", value: absent, color: "#dc2626", bg: "#fef2f2", icon: <XCircle size={18} /> },
                            { label: "On Leave", value: onLeave, color: "#6b7280", bg: "#f9fafb", icon: <AlertCircle size={18} /> },
                            { label: "Late", value: late, color: "#f59e0b", bg: "#fffbeb", icon: <Clock size={18} /> },
                        ].map(s => (
                            <div key={s.label} className="bg-white border border-[var(--border)] rounded-[12px] p-4 flex items-center gap-3">
                                <div style={{ background: s.bg, color: s.color }} className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0">{s.icon}</div>
                                <div>
                                    <p className="text-[22px] font-bold text-[var(--text)] leading-tight">{s.value}</p>
                                    <p className="text-[11.5px] text-[var(--text3)]">{s.label}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text3)]" />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employees..."
                            className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white pl-8 pr-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors" />
                    </div>

                    {/* Employee attendance list */}
                    {loading ? (
                        <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin text-[var(--accent)]" /></div>
                    ) : filteredEmployees.length === 0 ? (
                        <div className="flex min-h-[200px] items-center justify-center rounded-[14px] bg-white border border-dashed border-[var(--border)]">
                            <p className="text-[13px] text-[var(--text3)]">No employees found</p>
                        </div>
                    ) : (
                        <div className="bg-white border border-[var(--border)] rounded-[12px] overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-[var(--border)] bg-[var(--surface2)]/40">
                                            <th className="text-left text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px] px-5 py-3">Employee</th>
                                            <th className="text-left text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px] px-4 py-3">Check In</th>
                                            <th className="text-left text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px] px-4 py-3">Check Out</th>
                                            <th className="text-left text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px] px-4 py-3">Status</th>
                                            <th className="text-left text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px] px-4 py-3">OT Hrs</th>
                                            <th className="text-right text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px] px-5 py-3">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredEmployees.map((emp, i) => {
                                            const att = getAttendanceForEmployee(emp.id)
                                            const s = att ? (STATUS_COLORS[att.status] || STATUS_COLORS.PRESENT) : null
                                            return (
                                                <tr key={emp.id} className={`border-b border-[var(--border)] hover:bg-[var(--surface2)]/30 transition-colors ${i === filteredEmployees.length - 1 ? "border-b-0" : ""}`}>
                                                    <td className="px-5 py-3">
                                                        <div className="flex items-center gap-3">
                                                            <Avatar firstName={emp.firstName} lastName={emp.lastName} photo={emp.photo} />
                                                            <div>
                                                                <p className="text-[13px] font-semibold text-[var(--text)]">{emp.firstName} {emp.lastName}</p>
                                                                <p className="text-[11px] text-[var(--text3)]">{emp.employeeId} · {emp.designation || "—"}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-[13px] text-[var(--text2)]">
                                                        {att?.checkIn ? format(new Date(att.checkIn), "HH:mm") : "—"}
                                                    </td>
                                                    <td className="px-4 py-3 text-[13px] text-[var(--text2)]">
                                                        {att?.checkOut ? format(new Date(att.checkOut), "HH:mm") : "—"}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {s ? (
                                                            <span style={{ color: s.color, background: s.bg, borderColor: s.border }}
                                                                className="px-2 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap">
                                                                {s.label}
                                                            </span>
                                                        ) : (
                                                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-[#f9fafb] text-[#6b7280] border-[#e5e7eb] whitespace-nowrap">
                                                                Not Marked
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-[13px] text-[var(--text2)]">{att?.overtimeHrs || 0}h</td>
                                                    <td className="px-5 py-3 text-right">
                                                        <button onClick={() => {
                                                            setSelectedEmployee(emp)
                                                            setExistingRecord(att || null)
                                                            setMarkModal(true)
                                                        }}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] border border-[var(--border)] text-[12px] font-medium text-[var(--text2)] hover:bg-[var(--surface2)] transition-colors">
                                                            {att ? <Edit2 size={12} /> : <CheckCircle size={12} />}
                                                            {att ? "Edit" : "Mark"}
                                                        </button>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                // Monthly View
                <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
                    {/* Employee selector */}
                    <div className="bg-white border border-[var(--border)] rounded-[12px] overflow-hidden">
                        <div className="px-4 py-3 border-b border-[var(--border)]">
                            <p className="text-[12px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px]">Select Employee</p>
                        </div>
                        <div className="p-2 max-h-[500px] overflow-y-auto">
                            {employees.map(emp => (
                                <button key={emp.id} onClick={() => setSelectedMonthlyEmployee(emp)}
                                    className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-[8px] text-left transition-colors ${selectedMonthlyEmployee?.id === emp.id ? "bg-[var(--accent-light)] text-[var(--accent-text)]" : "hover:bg-[var(--surface2)]"}`}>
                                    <Avatar firstName={emp.firstName} lastName={emp.lastName} photo={emp.photo} size={30} />
                                    <div className="min-w-0">
                                        <p className="text-[12.5px] font-medium text-[var(--text)] truncate">{emp.firstName} {emp.lastName}</p>
                                        <p className="text-[11px] text-[var(--text3)]">{emp.employeeId}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Calendar */}
                    <div className="bg-white border border-[var(--border)] rounded-[12px] overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
                            <button onClick={() => setCalendarMonth(m => subMonths(m, 1))}
                                className="p-1.5 rounded-[7px] border border-[var(--border)] text-[var(--text3)] hover:bg-[var(--surface2)] transition-colors"><ChevronLeft size={16} /></button>
                            <h3 className="text-[14px] font-semibold text-[var(--text)]">{format(calendarMonth, "MMMM yyyy")}</h3>
                            <button onClick={() => setCalendarMonth(m => addMonths(m, 1))}
                                className="p-1.5 rounded-[7px] border border-[var(--border)] text-[var(--text3)] hover:bg-[var(--surface2)] transition-colors"><ChevronRight size={16} /></button>
                        </div>
                        {!selectedMonthlyEmployee ? (
                            <div className="flex items-center justify-center py-16 text-[var(--text3)] text-[13px]">
                                Select an employee to view monthly attendance
                            </div>
                        ) : loading ? (
                            <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-[var(--accent)]" /></div>
                        ) : (
                            <div className="p-4">
                                <div className="grid grid-cols-7 mb-2">
                                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
                                        <div key={d} className="text-center text-[11px] font-semibold text-[var(--text3)] py-1">{d}</div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-7 gap-1">
                                    {/* Empty cells for start of month */}
                                    {Array.from({ length: calendarDays[0].getDay() }).map((_, i) => (
                                        <div key={`empty-${i}`} />
                                    ))}
                                    {calendarDays.map(day => {
                                        const attStatus = getCalendarDayStatus(day)
                                        const sc = attStatus ? STATUS_COLORS[attStatus] : null
                                        const isT = isToday(day)
                                        return (
                                            <div key={day.toISOString()}
                                                style={sc ? { background: sc.bg, color: sc.color } : {}}
                                                className={`aspect-square rounded-[8px] flex flex-col items-center justify-center text-[11px] font-medium transition-colors
                                                    ${isT ? "ring-2 ring-[var(--accent)]" : ""}
                                                    ${sc ? "" : "text-[var(--text3)] bg-[var(--surface2)]/30"}`}>
                                                <span>{day.getDate()}</span>
                                                {attStatus && <span className="text-[8px] mt-0.5 font-bold">{attStatus === "PRESENT" ? "P" : attStatus === "ABSENT" ? "A" : attStatus === "HALF_DAY" ? "H" : attStatus === "LATE" ? "L" : "OL"}</span>}
                                            </div>
                                        )
                                    })}
                                </div>
                                {/* Legend */}
                                <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-[var(--border)]">
                                    {Object.entries(STATUS_COLORS).map(([k, v]) => (
                                        <div key={k} className="flex items-center gap-1.5">
                                            <div style={{ background: v.bg, color: v.color }} className="w-4 h-4 rounded text-[8px] font-bold flex items-center justify-center">
                                                {k === "PRESENT" ? "P" : k === "ABSENT" ? "A" : k === "HALF_DAY" ? "H" : k === "LATE" ? "L" : "OL"}
                                            </div>
                                            <span className="text-[11px] text-[var(--text3)]">{v.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <MarkAttendanceModal
                open={markModal}
                onClose={() => { setMarkModal(false); setSelectedEmployee(null); setExistingRecord(null) }}
                onSaved={fetchAttendances}
                employee={selectedEmployee}
                date={selectedDate}
                existing={existingRecord}
            />
        </div>
    )
}
