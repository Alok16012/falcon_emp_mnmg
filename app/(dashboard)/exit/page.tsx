"use client"
import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
    Plus, Loader2, X, LogOut, Clock,
    CheckCircle, AlertCircle, Search, ChevronRight, Check
} from "lucide-react"
import { format, differenceInDays } from "date-fns"

type ClearanceItem = {
    item: string
    cleared: boolean
    clearedBy: string | null
    clearedAt: string | null
}

type ExitRequest = {
    id: string
    employeeId: string
    reason: string
    lastWorkingDate?: string
    noticePeriodDays: number
    status: string
    resignationLetter?: string
    interviewNotes?: string
    clearanceItems: ClearanceItem[]
    fnfAmount?: number
    fnfStatus?: string
    createdAt: string
    updatedAt: string
    employee: {
        id: string
        firstName: string
        lastName: string
        employeeId: string
        designation?: string
        photo?: string
        basicSalary: number
        branch: { name: string }
    }
}

type Employee = { id: string; firstName: string; lastName: string; employeeId: string }

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
    RESIGNATION_SUBMITTED: { label: "Resignation Submitted", color: "#f59e0b", bg: "#fffbeb", border: "#fde68a" },
    NOTICE_PERIOD: { label: "Notice Period", color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe" },
    CLEARANCE_PENDING: { label: "Clearance Pending", color: "#f97316", bg: "#fff7ed", border: "#fed7aa" },
    FNF_PROCESSING: { label: "FnF Processing", color: "#8b5cf6", bg: "#faf5ff", border: "#ddd6fe" },
    COMPLETED: { label: "Completed", color: "#1a9e6e", bg: "#e8f7f1", border: "#6ee7b7" },
    ABSCONDING: { label: "Absconding", color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
}

const STATUS_ORDER = ["RESIGNATION_SUBMITTED", "NOTICE_PERIOD", "CLEARANCE_PENDING", "FNF_PROCESSING", "COMPLETED"]

const EXIT_REASONS = ["Resignation", "Termination", "Absconding", "Retirement", "Contract End"]

function Avatar({ firstName, lastName, photo, size = 36 }: { firstName: string; lastName: string; photo?: string; size?: number }) {
    const initials = `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase()
    const colors = ["#1a9e6e", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444"]
    const bg = colors[(firstName.charCodeAt(0) + lastName.charCodeAt(0)) % colors.length]
    if (photo) return <img src={photo} alt="" style={{ width: size, height: size }} className="rounded-full object-cover" />
    return (
        <div style={{ width: size, height: size, background: bg }} className="rounded-full flex items-center justify-center text-white font-semibold text-[12px] shrink-0">
            {initials}
        </div>
    )
}

function InitiateExitModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
    const [loading, setLoading] = useState(false)
    const [employees, setEmployees] = useState<Employee[]>([])
    const [form, setForm] = useState({
        employeeId: "",
        reason: "Resignation",
        lastWorkingDate: "",
        noticePeriodDays: "30",
        resignationLetter: "",
    })

    useEffect(() => {
        if (open) {
            fetch("/api/employees?status=ACTIVE")
                .then(r => r.json())
                .then(data => setEmployees(Array.isArray(data) ? data : []))
                .catch(() => {})
        }
    }, [open])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            const res = await fetch("/api/exit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            })
            if (!res.ok) throw new Error(await res.text())
            toast.success("Exit request initiated!")
            onSaved()
            onClose()
            setForm({ employeeId: "", reason: "Resignation", lastWorkingDate: "", noticePeriodDays: "30", resignationLetter: "" })
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to initiate exit")
        } finally {
            setLoading(false)
        }
    }

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-[16px] border border-[var(--border)] w-full max-w-md shadow-xl">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
                    <h2 className="text-[15px] font-semibold text-[var(--text)]">Initiate Exit</h2>
                    <button onClick={onClose} className="p-1 text-[var(--text3)] hover:text-[var(--text)] rounded-md hover:bg-[var(--surface2)] transition-colors"><X size={18} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div>
                        <label className="block text-[12px] text-[var(--text2)] mb-1">Employee *</label>
                        <select value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))}
                            className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors" required>
                            <option value="">Select employee...</option>
                            {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeId})</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[12px] text-[var(--text2)] mb-1">Reason *</label>
                        <select value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                            className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors">
                            {EXIT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[12px] text-[var(--text2)] mb-1">Last Working Date</label>
                            <input type="date" value={form.lastWorkingDate} onChange={e => setForm(f => ({ ...f, lastWorkingDate: e.target.value }))}
                                className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors" />
                        </div>
                        <div>
                            <label className="block text-[12px] text-[var(--text2)] mb-1">Notice Period (days)</label>
                            <input type="number" min="0" value={form.noticePeriodDays} onChange={e => setForm(f => ({ ...f, noticePeriodDays: e.target.value }))}
                                className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[12px] text-[var(--text2)] mb-1">Resignation Letter / Notes</label>
                        <textarea value={form.resignationLetter} onChange={e => setForm(f => ({ ...f, resignationLetter: e.target.value }))}
                            className="w-full rounded-[8px] border border-[var(--border)] bg-white px-3 py-2 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors resize-none"
                            rows={3} placeholder="Resignation letter content or notes..." />
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] font-medium text-[var(--text2)] hover:text-[var(--text)] rounded-[8px] hover:bg-[var(--surface2)] transition-colors">Cancel</button>
                        <button type="submit" disabled={loading}
                            className="inline-flex items-center gap-2 px-5 py-2 bg-[var(--accent)] text-white rounded-[8px] text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                            {loading && <Loader2 size={14} className="animate-spin" />}
                            Initiate Exit
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

function ExitDrawer({ exit, onClose, onUpdated }: { exit: ExitRequest; onClose: () => void; onUpdated: () => void }) {
    const [clearanceItems, setClearanceItems] = useState<ClearanceItem[]>(
        Array.isArray(exit.clearanceItems) ? exit.clearanceItems : []
    )
    const [interviewNotes, setInterviewNotes] = useState(exit.interviewNotes || "")
    const [saving, setSaving] = useState(false)
    const [statusUpdating, setStatusUpdating] = useState(false)

    const statusStyle = STATUS_CONFIG[exit.status] || STATUS_CONFIG.RESIGNATION_SUBMITTED

    const toggleClearance = (index: number) => {
        setClearanceItems(prev => {
            const updated = [...prev]
            updated[index] = {
                ...updated[index],
                cleared: !updated[index].cleared,
                clearedAt: !updated[index].cleared ? new Date().toISOString() : null,
            }
            return updated
        })
    }

    const handleSaveClearance = async () => {
        setSaving(true)
        try {
            const res = await fetch(`/api/exit/${exit.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clearanceItems, interviewNotes }),
            })
            if (!res.ok) throw new Error(await res.text())
            toast.success("Saved!")
            onUpdated()
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Save failed")
        } finally {
            setSaving(false)
        }
    }

    const handleStatusUpdate = async (newStatus: string) => {
        setStatusUpdating(true)
        try {
            const res = await fetch(`/api/exit/${exit.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            })
            if (!res.ok) throw new Error(await res.text())
            toast.success("Status updated!")
            onUpdated()
            onClose()
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Update failed")
        } finally {
            setStatusUpdating(false)
        }
    }

    // FnF Calculation
    const basicSalary = exit.employee.basicSalary || 0
    const dailyRate = basicSalary / 30
    const lastWorkingDate = exit.lastWorkingDate ? new Date(exit.lastWorkingDate) : null
    const daysWorked = lastWorkingDate ? Math.max(0, differenceInDays(lastWorkingDate, new Date(exit.createdAt))) : 0
    const proratedSalary = Math.round(dailyRate * daysWorked)
    const leaveEncashment = Math.round(dailyRate * 5) // assume 5 days encashment
    const deductions = 0
    const fnfTotal = proratedSalary + leaveEncashment - deductions

    const currentStepIndex = STATUS_ORDER.indexOf(exit.status)

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-end">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-10 h-full w-full max-w-[480px] bg-white border-l border-[var(--border)] overflow-y-auto flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] sticky top-0 bg-white z-10">
                    <div className="flex items-center gap-3">
                        <Avatar firstName={exit.employee.firstName} lastName={exit.employee.lastName} photo={exit.employee.photo} size={36} />
                        <div>
                            <p className="text-[14px] font-semibold text-[var(--text)]">{exit.employee.firstName} {exit.employee.lastName}</p>
                            <p className="text-[11px] text-[var(--text3)]">{exit.employee.employeeId} · {exit.reason}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-[var(--text3)] hover:text-[var(--text)] rounded-md hover:bg-[var(--surface2)] transition-colors"><X size={18} /></button>
                </div>

                <div className="flex-1 px-5 py-4 space-y-5">
                    {/* Status Pipeline */}
                    <div>
                        <p className="text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wide mb-3">Status Pipeline</p>
                        <div className="flex items-center gap-0.5 overflow-x-auto pb-1">
                            {STATUS_ORDER.map((s, i) => {
                                const cfg = STATUS_CONFIG[s]
                                const isActive = i === currentStepIndex
                                const isDone = i < currentStepIndex
                                return (
                                    <div key={s} className="flex items-center">
                                        <div style={isActive ? { background: cfg.bg, border: `1.5px solid ${cfg.color}`, color: cfg.color } : isDone ? { background: "#e8f7f1", borderColor: "#6ee7b7", color: "#1a9e6e" } : { background: "var(--surface2)", borderColor: "var(--border)", color: "var(--text3)" }}
                                            className="px-2.5 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap border transition-all">
                                            {isDone ? "✓ " : ""}{cfg.label.split(" ")[0]}
                                        </div>
                                        {i < STATUS_ORDER.length - 1 && <div className="w-3 h-px bg-[var(--border)] mx-0.5" />}
                                    </div>
                                )
                            })}
                        </div>
                        <div className="mt-2">
                            <span style={{ color: statusStyle.color, background: statusStyle.bg, borderColor: statusStyle.border }} className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full border inline-block">{statusStyle.label}</span>
                        </div>
                    </div>

                    {/* Exit Details */}
                    <div className="bg-[var(--surface2)] rounded-[12px] p-4 space-y-2">
                        <p className="text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wide mb-1">Exit Details</p>
                        {[
                            { label: "Employee", value: `${exit.employee.firstName} ${exit.employee.lastName} (${exit.employee.employeeId})` },
                            { label: "Designation", value: exit.employee.designation || "—" },
                            { label: "Branch", value: exit.employee.branch.name },
                            { label: "Reason", value: exit.reason },
                            { label: "Notice Period", value: `${exit.noticePeriodDays} days` },
                            { label: "Last Working Date", value: exit.lastWorkingDate ? format(new Date(exit.lastWorkingDate), "dd MMM yyyy") : "Not Set" },
                            { label: "Initiated On", value: format(new Date(exit.createdAt), "dd MMM yyyy") },
                        ].map(({ label, value }) => (
                            <div key={label} className="flex items-center justify-between">
                                <span className="text-[11.5px] text-[var(--text3)]">{label}</span>
                                <span className="text-[11.5px] font-medium text-[var(--text)]">{value}</span>
                            </div>
                        ))}
                    </div>

                    {/* Clearance Checklist */}
                    <div>
                        <p className="text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wide mb-2">Clearance Checklist</p>
                        <div className="space-y-2">
                            {clearanceItems.map((item, i) => (
                                <div key={item.item} onClick={() => toggleClearance(i)}
                                    className={`flex items-center gap-3 p-3 rounded-[10px] border cursor-pointer transition-colors ${item.cleared ? "bg-[#f0fdf4] border-[#bbf7d0]" : "bg-white border-[var(--border)] hover:border-[var(--accent)]"}`}>
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${item.cleared ? "bg-[#1a9e6e] border-[#1a9e6e]" : "border-[var(--border)]"}`}>
                                        {item.cleared && <Check size={10} className="text-white" strokeWidth={3} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-[12px] font-medium ${item.cleared ? "line-through text-[var(--text3)]" : "text-[var(--text)]"}`}>{item.item}</p>
                                        {item.clearedAt && <p className="text-[10px] text-[#1a9e6e]">Cleared {format(new Date(item.clearedAt), "dd MMM, hh:mm a")}</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* FnF Calculation */}
                    <div>
                        <p className="text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wide mb-2">Full & Final Settlement</p>
                        <div className="border border-[var(--border)] rounded-[12px] overflow-hidden">
                            <div className="divide-y divide-[var(--border)]">
                                {[
                                    { label: "Basic Salary", value: `₹${basicSalary.toLocaleString()}` },
                                    { label: `Prorated Salary (${daysWorked} days)`, value: `₹${proratedSalary.toLocaleString()}` },
                                    { label: "Leave Encashment (5 days)", value: `₹${leaveEncashment.toLocaleString()}` },
                                    { label: "Deductions", value: `- ₹${deductions.toLocaleString()}` },
                                ].map(({ label, value }) => (
                                    <div key={label} className="flex items-center justify-between px-4 py-2.5">
                                        <span className="text-[12px] text-[var(--text2)]">{label}</span>
                                        <span className="text-[12px] font-medium text-[var(--text)]">{value}</span>
                                    </div>
                                ))}
                                <div className="flex items-center justify-between px-4 py-3 bg-[var(--surface2)]">
                                    <span className="text-[13px] font-semibold text-[var(--text)]">Net FnF Amount</span>
                                    <span className="text-[14px] font-bold text-[var(--accent)]">₹{fnfTotal.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Exit Interview Notes */}
                    <div>
                        <label className="block text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wide mb-2">Exit Interview Notes</label>
                        <textarea value={interviewNotes} onChange={e => setInterviewNotes(e.target.value)}
                            className="w-full rounded-[10px] border border-[var(--border)] bg-white px-3 py-2 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors resize-none"
                            rows={4} placeholder="Notes from exit interview..." />
                    </div>

                    {/* Save + Status Actions */}
                    <div className="space-y-2">
                        <button onClick={handleSaveClearance} disabled={saving}
                            className="w-full h-9 bg-[var(--accent)] text-white rounded-[8px] text-[13px] font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
                            {saving && <Loader2 size={14} className="animate-spin" />}
                            Save Clearance & Notes
                        </button>

                        {exit.status === "RESIGNATION_SUBMITTED" && (
                            <button onClick={() => handleStatusUpdate("NOTICE_PERIOD")} disabled={statusUpdating}
                                className="w-full h-9 border border-[var(--border)] text-[var(--text)] rounded-[8px] text-[13px] font-medium hover:bg-[var(--surface2)] disabled:opacity-50 flex items-center justify-center gap-2">
                                {statusUpdating && <Loader2 size={14} className="animate-spin" />}
                                Move to Notice Period
                            </button>
                        )}
                        {exit.status === "NOTICE_PERIOD" && (
                            <button onClick={() => handleStatusUpdate("CLEARANCE_PENDING")} disabled={statusUpdating}
                                className="w-full h-9 border border-[var(--border)] text-[var(--text)] rounded-[8px] text-[13px] font-medium hover:bg-[var(--surface2)] disabled:opacity-50 flex items-center justify-center gap-2">
                                {statusUpdating && <Loader2 size={14} className="animate-spin" />}
                                Move to Clearance
                            </button>
                        )}
                        {exit.status === "CLEARANCE_PENDING" && (
                            <button onClick={() => handleStatusUpdate("FNF_PROCESSING")} disabled={statusUpdating}
                                className="w-full h-9 border border-[var(--border)] text-[var(--text)] rounded-[8px] text-[13px] font-medium hover:bg-[var(--surface2)] disabled:opacity-50 flex items-center justify-center gap-2">
                                {statusUpdating && <Loader2 size={14} className="animate-spin" />}
                                Move to FnF Processing
                            </button>
                        )}
                        {exit.status === "FNF_PROCESSING" && (
                            <button onClick={() => handleStatusUpdate("COMPLETED")} disabled={statusUpdating}
                                className="w-full h-9 bg-[#1a9e6e] text-white rounded-[8px] text-[13px] font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
                                {statusUpdating && <Loader2 size={14} className="animate-spin" />}
                                Mark as Completed
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function ExitPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [exits, setExits] = useState<ExitRequest[]>([])
    const [loading, setLoading] = useState(true)
    const [showInitiate, setShowInitiate] = useState(false)
    const [selectedExit, setSelectedExit] = useState<ExitRequest | null>(null)
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState("")

    useEffect(() => {
        if (status === "unauthenticated") router.push("/login")
    }, [status, router])

    const fetchExits = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (statusFilter) params.set("status", statusFilter)
            const res = await fetch(`/api/exit?${params}`)
            const data = await res.json()
            setExits(Array.isArray(data) ? data : [])
        } catch {
            toast.error("Failed to load exit requests")
        } finally {
            setLoading(false)
        }
    }, [statusFilter])

    useEffect(() => {
        if (status === "authenticated") fetchExits()
    }, [status, fetchExits])

    const filtered = exits.filter(e => {
        if (!search) return true
        const name = `${e.employee.firstName} ${e.employee.lastName} ${e.employee.employeeId}`.toLowerCase()
        return name.includes(search.toLowerCase())
    })

    const activeExits = exits.filter(e => !["COMPLETED"].includes(e.status)).length
    const noticePeriod = exits.filter(e => e.status === "NOTICE_PERIOD").length
    const clearancePending = exits.filter(e => e.status === "CLEARANCE_PENDING").length
    const completedThisMonth = exits.filter(e => {
        if (e.status !== "COMPLETED") return false
        const d = new Date(e.updatedAt)
        const now = new Date()
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).length

    if (status === "loading") {
        return <div className="flex items-center justify-center min-h-screen"><Loader2 size={28} className="animate-spin text-[var(--accent)]" /></div>
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-[24px] font-semibold tracking-[-0.4px] text-[var(--text)]">Exit Management</h1>
                    <p className="text-[13px] text-[var(--text3)] mt-0.5">Manage employee exits and full & final settlements</p>
                </div>
                <button onClick={() => setShowInitiate(true)}
                    className="inline-flex items-center gap-2 bg-[var(--accent)] text-white rounded-[10px] text-[13px] font-medium px-4 py-2 hover:opacity-90 transition-opacity">
                    <Plus size={16} /> Initiate Exit
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
                {[
                    { label: "Active Exits", value: activeExits, color: "#ef4444", bg: "#fef2f2", icon: <AlertCircle size={18} /> },
                    { label: "Notice Period", value: noticePeriod, color: "#3b82f6", bg: "#eff6ff", icon: <Clock size={18} /> },
                    { label: "Pending Clearance", value: clearancePending, color: "#f97316", bg: "#fff7ed", icon: <LogOut size={18} /> },
                    { label: "Completed (Month)", value: completedThisMonth, color: "#1a9e6e", bg: "#e8f7f1", icon: <CheckCircle size={18} /> },
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
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employees..."
                        className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-[var(--surface2)]/30 pl-8 pr-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors" />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => setStatusFilter("")}
                        className={`px-3 py-1.5 rounded-[7px] text-[12px] font-medium transition-colors ${statusFilter === "" ? "bg-[var(--accent)] text-white" : "border border-[var(--border)] text-[var(--text2)] hover:bg-[var(--surface2)]"}`}>
                        All
                    </button>
                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                        <button key={key} onClick={() => setStatusFilter(key)}
                            className={`px-3 py-1.5 rounded-[7px] text-[12px] font-medium transition-colors ${statusFilter === key ? "bg-[var(--accent)] text-white" : "border border-[var(--border)] text-[var(--text2)] hover:bg-[var(--surface2)]"}`}>
                            {cfg.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Exit Cards */}
            {loading ? (
                <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin text-[var(--accent)]" /></div>
            ) : filtered.length === 0 ? (
                <div className="flex min-h-[250px] flex-col items-center justify-center rounded-[14px] bg-white border border-dashed border-[var(--border)]">
                    <LogOut size={36} className="text-[var(--text3)] mb-2" />
                    <p className="text-[14px] font-semibold text-[var(--text)]">No exit requests</p>
                    <p className="text-[13px] text-[var(--text3)] mt-1">Initiate an exit request to get started</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(exit => {
                        const statusStyle = STATUS_CONFIG[exit.status] || STATUS_CONFIG.RESIGNATION_SUBMITTED
                        const cleared = Array.isArray(exit.clearanceItems) ? exit.clearanceItems.filter(i => i.cleared).length : 0
                        const total = Array.isArray(exit.clearanceItems) ? exit.clearanceItems.length : 0
                        const daysLeft = exit.lastWorkingDate
                            ? differenceInDays(new Date(exit.lastWorkingDate), new Date())
                            : null

                        return (
                            <div key={exit.id}
                                onClick={() => setSelectedExit(exit)}
                                className="bg-white border border-[var(--border)] rounded-[12px] p-4 cursor-pointer hover:border-[var(--accent)] hover:shadow-sm transition-all group">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-3 flex-1 min-w-0">
                                        <Avatar firstName={exit.employee.firstName} lastName={exit.employee.lastName} photo={exit.employee.photo} size={40} />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="text-[14px] font-semibold text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">{exit.employee.firstName} {exit.employee.lastName}</h3>
                                                <span className="text-[11px] text-[var(--text3)]">· {exit.employee.employeeId}</span>
                                            </div>
                                            <p className="text-[12px] text-[var(--text3)] mt-0.5">{exit.employee.designation || exit.employee.branch.name}</p>
                                            <div className="flex flex-wrap items-center gap-3 mt-2">
                                                <span className="text-[12px] text-[var(--text2)]">Reason: <span className="font-medium">{exit.reason}</span></span>
                                                {exit.lastWorkingDate && (
                                                    <span className="text-[12px] text-[var(--text2)]">
                                                        LWD: <span className="font-medium">{format(new Date(exit.lastWorkingDate), "dd MMM yyyy")}</span>
                                                    </span>
                                                )}
                                                {daysLeft !== null && daysLeft >= 0 && (
                                                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ color: daysLeft <= 5 ? "#ef4444" : "#f59e0b", background: daysLeft <= 5 ? "#fef2f2" : "#fffbeb" }}>
                                                        {daysLeft === 0 ? "Last Day" : `${daysLeft}d remaining`}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 mt-2">
                                                <div className="flex-1 max-w-[120px] bg-[var(--surface2)] rounded-full h-1.5">
                                                    <div style={{ width: total > 0 ? `${(cleared / total) * 100}%` : "0%", background: "#1a9e6e" }} className="h-1.5 rounded-full" />
                                                </div>
                                                <span className="text-[11px] text-[var(--text3)]">{cleared}/{total} cleared</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2 shrink-0">
                                        <span style={{ color: statusStyle.color, background: statusStyle.bg, borderColor: statusStyle.border }}
                                            className="px-2.5 py-1 rounded-full text-[11px] font-semibold border whitespace-nowrap">
                                            {statusStyle.label}
                                        </span>
                                        <p className="text-[11px] text-[var(--text3)]">{format(new Date(exit.createdAt), "dd MMM yyyy")}</p>
                                        <ChevronRight size={14} className="text-[var(--text3)] group-hover:text-[var(--accent)] transition-colors" />
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            <InitiateExitModal open={showInitiate} onClose={() => setShowInitiate(false)} onSaved={fetchExits} />
            {selectedExit && (
                <ExitDrawer
                    exit={selectedExit}
                    onClose={() => setSelectedExit(null)}
                    onUpdated={fetchExits}
                />
            )}
        </div>
    )
}
