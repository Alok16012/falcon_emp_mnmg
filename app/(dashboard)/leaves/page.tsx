"use client"
import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
    Plus, Search, Filter, Loader2, CheckCircle, XCircle,
    Clock, X, Calendar, User, FileText, ChevronDown
} from "lucide-react"
import { format } from "date-fns"

type Leave = {
    id: string
    employeeId: string
    type: string
    startDate: string
    endDate: string
    days: number
    reason?: string
    status: string
    approvedBy?: string
    approvedAt?: string
    createdAt: string
    employee: {
        id: string
        firstName: string
        lastName: string
        employeeId: string
        designation?: string
        photo?: string
        branch: { name: string }
    }
}

type Employee = { id: string; firstName: string; lastName: string; employeeId: string }

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
    PENDING: { label: "Pending", color: "#f59e0b", bg: "#fffbeb", border: "#fde68a" },
    APPROVED: { label: "Approved", color: "#1a9e6e", bg: "#e8f7f1", border: "#6ee7b7" },
    REJECTED: { label: "Rejected", color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
    CANCELLED: { label: "Cancelled", color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb" },
}

const LEAVE_TYPES = ["Sick Leave", "Casual Leave", "Earned Leave", "Maternity Leave", "Paternity Leave", "Unpaid Leave", "Other"]

function Avatar({ firstName, lastName, photo, size = 36 }: { firstName: string; lastName: string; photo?: string; size?: number }) {
    const initials = `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase()
    const colors = ["#1a9e6e", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444"]
    const bg = colors[(firstName.charCodeAt(0) + lastName.charCodeAt(0)) % colors.length]
    if (photo) return <img src={photo} alt="" style={{ width: size, height: size }} className="rounded-full object-cover" />
    return <div style={{ width: size, height: size, background: bg }} className="rounded-full flex items-center justify-center text-white font-semibold text-[12px]">{initials}</div>
}

function ApplyLeaveModal({
    open, onClose, onSaved
}: {
    open: boolean
    onClose: () => void
    onSaved: () => void
}) {
    const [loading, setLoading] = useState(false)
    const [employees, setEmployees] = useState<Employee[]>([])
    const [form, setForm] = useState({
        employeeId: "",
        type: "Sick Leave",
        startDate: "",
        endDate: "",
        days: "",
        reason: "",
    })

    useEffect(() => {
        if (open) {
            fetch("/api/employees?status=ACTIVE")
                .then(r => r.json())
                .then(data => setEmployees(Array.isArray(data) ? data : []))
                .catch(() => {})
        }
    }, [open])

    // Auto-calculate days
    useEffect(() => {
        if (form.startDate && form.endDate) {
            const start = new Date(form.startDate)
            const end = new Date(form.endDate)
            const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
            if (diff > 0) setForm(f => ({ ...f, days: diff.toString() }))
        }
    }, [form.startDate, form.endDate])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            const res = await fetch("/api/leaves", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            })
            if (!res.ok) throw new Error(await res.text())
            toast.success("Leave applied successfully!")
            onSaved()
            onClose()
            setForm({ employeeId: "", type: "Sick Leave", startDate: "", endDate: "", days: "", reason: "" })
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to apply leave")
        } finally {
            setLoading(false)
        }
    }

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-[16px] border border-[var(--border)] w-full max-w-md shadow-xl">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
                    <h2 className="text-[15px] font-semibold text-[var(--text)]">Apply Leave</h2>
                    <button onClick={onClose} className="p-1 text-[var(--text3)] hover:text-[var(--text)] rounded-md hover:bg-[var(--surface2)] transition-colors"><X size={18} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div>
                        <label className="block text-[12px] text-[var(--text2)] mb-1">Employee *</label>
                        <select value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))}
                            className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors" required>
                            <option value="">Select employee</option>
                            {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeId})</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[12px] text-[var(--text2)] mb-1">Leave Type *</label>
                        <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                            className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors" required>
                            {LEAVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[12px] text-[var(--text2)] mb-1">Start Date *</label>
                            <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                                className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors" required />
                        </div>
                        <div>
                            <label className="block text-[12px] text-[var(--text2)] mb-1">End Date *</label>
                            <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} min={form.startDate}
                                className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors" required />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[12px] text-[var(--text2)] mb-1">Number of Days *</label>
                        <input type="number" min="0.5" step="0.5" value={form.days} onChange={e => setForm(f => ({ ...f, days: e.target.value }))}
                            className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors" required />
                    </div>
                    <div>
                        <label className="block text-[12px] text-[var(--text2)] mb-1">Reason</label>
                        <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                            className="w-full rounded-[8px] border border-[var(--border)] bg-white px-3 py-2 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors resize-none"
                            rows={3} placeholder="Reason for leave..." />
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] font-medium text-[var(--text2)] hover:text-[var(--text)] rounded-[8px] hover:bg-[var(--surface2)] transition-colors">Cancel</button>
                        <button type="submit" disabled={loading}
                            className="inline-flex items-center gap-2 px-5 py-2 bg-[var(--accent)] text-white rounded-[8px] text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                            {loading && <Loader2 size={14} className="animate-spin" />}
                            Apply Leave
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default function LeavesPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [leaves, setLeaves] = useState<Leave[]>([])
    const [loading, setLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState("PENDING")
    const [search, setSearch] = useState("")
    const [showApply, setShowApply] = useState(false)
    const [actionLoading, setActionLoading] = useState<string | null>(null)

    useEffect(() => {
        if (status === "unauthenticated") router.push("/login")
    }, [status, router])

    const fetchLeaves = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (statusFilter) params.set("status", statusFilter)
            const res = await fetch(`/api/leaves?${params}`)
            const data = await res.json()
            setLeaves(Array.isArray(data) ? data : [])
        } catch {
            toast.error("Failed to load leaves")
        } finally {
            setLoading(false)
        }
    }, [statusFilter])

    useEffect(() => {
        if (status === "authenticated") fetchLeaves()
    }, [status, fetchLeaves])

    const handleAction = async (leaveId: string, newStatus: "APPROVED" | "REJECTED") => {
        setActionLoading(leaveId + newStatus)
        try {
            const res = await fetch(`/api/leaves/${leaveId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            })
            if (!res.ok) throw new Error(await res.text())
            toast.success(`Leave ${newStatus.toLowerCase()}!`)
            fetchLeaves()
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Action failed")
        } finally {
            setActionLoading(null)
        }
    }

    const filtered = leaves.filter(l => {
        if (!search) return true
        const name = `${l.employee.firstName} ${l.employee.lastName} ${l.employee.employeeId}`.toLowerCase()
        return name.includes(search.toLowerCase())
    })

    // Summary
    const pending = leaves.filter(l => l.status === "PENDING").length
    const approved = leaves.filter(l => l.status === "APPROVED").length
    const rejected = leaves.filter(l => l.status === "REJECTED").length

    if (status === "loading") {
        return <div className="flex items-center justify-center min-h-screen"><Loader2 size={28} className="animate-spin text-[var(--accent)]" /></div>
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-[24px] font-semibold tracking-[-0.4px] text-[var(--text)]">Leave Management</h1>
                    <p className="text-[13px] text-[var(--text3)] mt-0.5">Manage employee leave requests</p>
                </div>
                <button onClick={() => setShowApply(true)}
                    className="inline-flex items-center gap-2 bg-[var(--accent)] text-white rounded-[10px] text-[13px] font-medium px-4 py-2 hover:opacity-90 transition-opacity">
                    <Plus size={16} /> Apply Leave
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: "Pending", value: pending, color: "#f59e0b", bg: "#fffbeb", icon: <Clock size={18} /> },
                    { label: "Approved", value: approved, color: "#1a9e6e", bg: "#e8f7f1", icon: <CheckCircle size={18} /> },
                    { label: "Rejected", value: rejected, color: "#dc2626", bg: "#fef2f2", icon: <XCircle size={18} /> },
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

            {/* Filters */}
            <div className="bg-white border border-[var(--border)] rounded-[12px] p-4 flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text3)]" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by employee name..."
                        className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-[var(--surface2)]/30 pl-8 pr-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors" />
                </div>
                <div className="flex items-center gap-2">
                    {(["", "PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const).map(s => (
                        <button key={s} onClick={() => setStatusFilter(s)}
                            className={`px-3 py-1.5 rounded-[7px] text-[12px] font-medium transition-colors ${statusFilter === s ? "bg-[var(--accent)] text-white" : "border border-[var(--border)] text-[var(--text2)] hover:bg-[var(--surface2)]"}`}>
                            {s === "" ? "All" : STATUS_CONFIG[s]?.label || s}
                        </button>
                    ))}
                </div>
            </div>

            {/* Leave Cards */}
            {loading ? (
                <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin text-[var(--accent)]" /></div>
            ) : filtered.length === 0 ? (
                <div className="flex min-h-[250px] flex-col items-center justify-center rounded-[14px] bg-white border border-dashed border-[var(--border)]">
                    <Calendar size={36} className="text-[var(--text3)] mb-2" />
                    <p className="text-[14px] font-semibold text-[var(--text)]">No leave requests</p>
                    <p className="text-[13px] text-[var(--text3)] mt-1">No {statusFilter.toLowerCase()} leaves found</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(leave => {
                        const s = STATUS_CONFIG[leave.status]
                        return (
                            <div key={leave.id} className="bg-white border border-[var(--border)] rounded-[12px] p-4">
                                <div className="flex items-start justify-between gap-4">
                                    {/* Left: Employee + Leave Info */}
                                    <div className="flex items-start gap-3 flex-1 min-w-0">
                                        <Avatar firstName={leave.employee.firstName} lastName={leave.employee.lastName} photo={leave.employee.photo} size={40} />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="text-[14px] font-semibold text-[var(--text)]">{leave.employee.firstName} {leave.employee.lastName}</h3>
                                                <span className="text-[11px] text-[var(--text3)]">· {leave.employee.employeeId}</span>
                                                {leave.employee.designation && (
                                                    <span className="text-[11px] text-[var(--text3)]">· {leave.employee.designation}</span>
                                                )}
                                            </div>
                                            <p className="text-[12px] text-[var(--text3)] mt-0.5">{leave.employee.branch.name}</p>
                                            <div className="flex flex-wrap items-center gap-3 mt-2">
                                                <span className="inline-flex items-center gap-1 text-[12px] text-[var(--text2)]">
                                                    <FileText size={12} className="text-[var(--text3)]" />
                                                    {leave.type}
                                                </span>
                                                <span className="inline-flex items-center gap-1 text-[12px] text-[var(--text2)]">
                                                    <Calendar size={12} className="text-[var(--text3)]" />
                                                    {format(new Date(leave.startDate), "dd MMM")} — {format(new Date(leave.endDate), "dd MMM yyyy")}
                                                </span>
                                                <span className="text-[12px] font-medium text-[var(--accent-text)]">
                                                    {leave.days} day{leave.days > 1 ? "s" : ""}
                                                </span>
                                            </div>
                                            {leave.reason && (
                                                <p className="text-[12px] text-[var(--text3)] mt-1.5 italic">&ldquo;{leave.reason}&rdquo;</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right: Status + Actions */}
                                    <div className="flex flex-col items-end gap-2 shrink-0">
                                        <span style={{ color: s.color, background: s.bg, borderColor: s.border }}
                                            className="px-2.5 py-1 rounded-full text-[11.5px] font-semibold border whitespace-nowrap">
                                            {s.label}
                                        </span>
                                        <p className="text-[11px] text-[var(--text3)]">{format(new Date(leave.createdAt), "dd MMM yyyy")}</p>
                                        {leave.status === "PENDING" && (
                                            <div className="flex items-center gap-2 mt-1">
                                                <button onClick={() => handleAction(leave.id, "REJECTED")}
                                                    disabled={actionLoading !== null}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] border border-[#fecaca] bg-[#fef2f2] text-[#dc2626] text-[12px] font-medium hover:bg-[#fee2e2] transition-colors disabled:opacity-50">
                                                    {actionLoading === leave.id + "REJECTED" ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
                                                    Reject
                                                </button>
                                                <button onClick={() => handleAction(leave.id, "APPROVED")}
                                                    disabled={actionLoading !== null}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] border border-[#6ee7b7] bg-[#e8f7f1] text-[#1a9e6e] text-[12px] font-medium hover:bg-[#d1f5e6] transition-colors disabled:opacity-50">
                                                    {actionLoading === leave.id + "APPROVED" ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                                                    Approve
                                                </button>
                                            </div>
                                        )}
                                        {leave.status === "APPROVED" && leave.approvedAt && (
                                            <p className="text-[10.5px] text-[#1a9e6e]">Approved {format(new Date(leave.approvedAt), "dd MMM yyyy")}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            <ApplyLeaveModal open={showApply} onClose={() => setShowApply(false)} onSaved={fetchLeaves} />
        </div>
    )
}
