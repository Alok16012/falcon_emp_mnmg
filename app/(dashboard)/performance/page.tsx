"use client"
import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
    Plus, Loader2, X, Star, Search,
    ChevronDown, MoreVertical, Trash2, Eye,
    TrendingUp, CheckCircle2, Clock, AlertCircle,
    Send, ChevronRight
} from "lucide-react"
import { format } from "date-fns"

// ─── Types ────────────────────────────────────────────────────────────────────

type ReviewStatus = "DRAFT" | "SUBMITTED" | "ACKNOWLEDGED" | "COMPLETED"
type ReviewCycle = "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "ANNUAL"

type KPI = {
    id: string
    reviewId: string
    title: string
    description?: string | null
    target: string
    actual?: string | null
    weightage: number
    rating?: number | null
    remarks?: string | null
}

type PerformanceReview = {
    id: string
    employeeId: string
    reviewerId: string
    cycle: ReviewCycle
    periodStart: string
    periodEnd: string
    status: ReviewStatus
    overallRating?: number | null
    strengths?: string | null
    improvements?: string | null
    managerComments?: string | null
    employeeComments?: string | null
    promotionRecommended: boolean
    incrementPercent?: number | null
    submittedAt?: string | null
    acknowledgedAt?: string | null
    completedAt?: string | null
    createdAt: string
    updatedAt: string
    employee: {
        id: string
        firstName: string
        lastName: string
        employeeId: string
        designation?: string | null
        photo?: string | null
        branch: { name: string }
    }
    kpis: { id: string; rating?: number | null }[]
}

type EmployeeOption = { id: string; firstName: string; lastName: string; employeeId: string }

// ─── Constants ────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ["#1a9e6e", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#f97316"]

const STATUS_CONFIG: Record<ReviewStatus, { label: string; color: string; bg: string }> = {
    DRAFT:        { label: "Draft",        color: "#6b7280", bg: "#f3f4f6" },
    SUBMITTED:    { label: "Submitted",    color: "#d97706", bg: "#fef3c7" },
    ACKNOWLEDGED: { label: "Acknowledged", color: "#2563eb", bg: "#eff6ff" },
    COMPLETED:    { label: "Completed",    color: "#1a9e6e", bg: "#e8f7f1" },
}

const CYCLE_CONFIG: Record<ReviewCycle, { label: string; color: string; bg: string }> = {
    MONTHLY:     { label: "Monthly",    color: "#7c3aed", bg: "#f5f3ff" },
    QUARTERLY:   { label: "Quarterly",  color: "#2563eb", bg: "#eff6ff" },
    HALF_YEARLY: { label: "Half-Yearly", color: "#0891b2", bg: "#ecfeff" },
    ANNUAL:      { label: "Annual",     color: "#1a9e6e", bg: "#e8f7f1" },
}

const RATING_CONFIG: Record<number, { label: string; color: string }> = {
    5: { label: "Excellent",     color: "#1a9e6e" },
    4: { label: "Good",          color: "#0891b2" },
    3: { label: "Average",       color: "#d97706" },
    2: { label: "Below Average", color: "#ea580c" },
    1: { label: "Poor",          color: "#ef4444" },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAvatarColor(first: string, last: string) {
    return AVATAR_COLORS[(first.charCodeAt(0) + (last.charCodeAt(0) || 0)) % AVATAR_COLORS.length]
}

function fmtDate(d?: string | null) {
    if (!d) return "—"
    try { return format(new Date(d), "MMM yyyy") } catch { return "—" }
}

function fmtFull(d?: string | null) {
    if (!d) return "—"
    try { return format(new Date(d), "dd MMM yyyy") } catch { return "—" }
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ firstName, lastName, photo, size = 36 }: {
    firstName: string; lastName: string; photo?: string | null; size?: number
}) {
    const initials = `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase()
    const bg = getAvatarColor(firstName, lastName)
    if (photo) {
        return <img src={photo} alt="" style={{ width: size, height: size }} className="rounded-full object-cover shrink-0" />
    }
    return (
        <div style={{ width: size, height: size, background: bg, fontSize: size * 0.33 }}
            className="rounded-full flex items-center justify-center text-white font-semibold shrink-0 select-none">
            {initials}
        </div>
    )
}

// ─── Star Rating Display ───────────────────────────────────────────────────────

function StarDisplay({ rating, size = 14 }: { rating?: number | null; size?: number }) {
    if (!rating) return <span className="text-[12px] text-[var(--text3)] italic">Not rated</span>
    const cfg = RATING_CONFIG[Math.round(rating)] || RATING_CONFIG[3]
    return (
        <div className="flex items-center gap-1">
            <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map(i => (
                    <Star
                        key={i}
                        size={size}
                        style={{ color: i <= rating ? cfg.color : "#d1d5db" }}
                        fill={i <= rating ? cfg.color : "none"}
                    />
                ))}
            </div>
            <span className="text-[11px] font-medium" style={{ color: cfg.color }}>{rating.toFixed(1)}</span>
        </div>
    )
}

// ─── Clickable Star Rating ─────────────────────────────────────────────────────

function StarRating({ value, onChange, size = 24, disabled = false }: {
    value?: number | null; onChange: (v: number) => void; size?: number; disabled?: boolean
}) {
    const [hovered, setHovered] = useState<number | null>(null)
    const display = hovered ?? value ?? 0
    return (
        <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(i => {
                const cfg = RATING_CONFIG[i] || RATING_CONFIG[3]
                const filled = i <= display
                return (
                    <button
                        key={i}
                        type="button"
                        disabled={disabled}
                        onMouseEnter={() => !disabled && setHovered(i)}
                        onMouseLeave={() => setHovered(null)}
                        onClick={() => !disabled && onChange(i)}
                        className="transition-transform hover:scale-110 disabled:cursor-not-allowed"
                    >
                        <Star
                            size={size}
                            style={{ color: filled ? cfg.color : "#d1d5db" }}
                            fill={filled ? cfg.color : "none"}
                        />
                    </button>
                )
            })}
        </div>
    )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, color, bg, icon }: {
    label: string; value: string | number; color: string; bg: string; icon: React.ReactNode
}) {
    return (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[12px] p-4 flex items-center gap-3">
            <div style={{ background: bg, color }} className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0">{icon}</div>
            <div>
                <p className="text-[22px] font-bold text-[var(--text)] leading-tight">{value}</p>
                <p className="text-[11.5px] text-[var(--text3)]">{label}</p>
            </div>
        </div>
    )
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ReviewStatus }) {
    const cfg = STATUS_CONFIG[status]
    return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
            style={{ background: cfg.bg, color: cfg.color }}>
            {cfg.label}
        </span>
    )
}

// ─── Cycle Badge ──────────────────────────────────────────────────────────────

function CycleBadge({ cycle }: { cycle: ReviewCycle }) {
    const cfg = CYCLE_CONFIG[cycle]
    return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
            style={{ background: cfg.bg, color: cfg.color }}>
            {cfg.label}
        </span>
    )
}

// ─── New Review Modal ─────────────────────────────────────────────────────────

function NewReviewModal({
    onClose, onCreated, currentUserId
}: { onClose: () => void; onCreated: () => void; currentUserId: string }) {
    const [employees, setEmployees] = useState<EmployeeOption[]>([])
    const [loading, setLoading] = useState(false)
    const [form, setForm] = useState({
        employeeId: "",
        cycle: "QUARTERLY" as ReviewCycle,
        periodStart: "",
        periodEnd: "",
        reviewerId: currentUserId,
    })

    useEffect(() => {
        fetch("/api/employees?status=ACTIVE&limit=500")
            .then(r => r.json())
            .then(d => setEmployees(Array.isArray(d.employees) ? d.employees : Array.isArray(d) ? d : []))
            .catch(() => setEmployees([]))
    }, [])

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!form.employeeId || !form.periodStart || !form.periodEnd) {
            toast.error("Please fill all required fields")
            return
        }
        setLoading(true)
        try {
            const res = await fetch("/api/performance", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            })
            if (!res.ok) throw new Error(await res.text())
            toast.success("Review created with default KPIs")
            onCreated()
            onClose()
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to create review")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-[var(--surface)] rounded-[16px] border border-[var(--border)] shadow-2xl w-full max-w-md mx-4">
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
                    <h2 className="text-[15px] font-semibold text-[var(--text)]">New Performance Review</h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-[var(--surface2)] rounded-md text-[var(--text3)]"><X size={16} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-[12px] font-medium text-[var(--text2)] mb-1.5">Employee <span className="text-[var(--red)]">*</span></label>
                        <select
                            value={form.employeeId}
                            onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))}
                            className="w-full h-9 px-3 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[13px] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                            required
                        >
                            <option value="">Select employee...</option>
                            {employees.map(e => (
                                <option key={e.id} value={e.id}>
                                    {e.firstName} {e.lastName} ({e.employeeId})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-[12px] font-medium text-[var(--text2)] mb-1.5">Review Cycle <span className="text-[var(--red)]">*</span></label>
                        <select
                            value={form.cycle}
                            onChange={e => setForm(f => ({ ...f, cycle: e.target.value as ReviewCycle }))}
                            className="w-full h-9 px-3 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[13px] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                        >
                            <option value="MONTHLY">Monthly</option>
                            <option value="QUARTERLY">Quarterly</option>
                            <option value="HALF_YEARLY">Half-Yearly</option>
                            <option value="ANNUAL">Annual</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[12px] font-medium text-[var(--text2)] mb-1.5">Period Start <span className="text-[var(--red)]">*</span></label>
                            <input
                                type="date"
                                value={form.periodStart}
                                onChange={e => setForm(f => ({ ...f, periodStart: e.target.value }))}
                                className="w-full h-9 px-3 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[13px] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-[12px] font-medium text-[var(--text2)] mb-1.5">Period End <span className="text-[var(--red)]">*</span></label>
                            <input
                                type="date"
                                value={form.periodEnd}
                                onChange={e => setForm(f => ({ ...f, periodEnd: e.target.value }))}
                                className="w-full h-9 px-3 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[13px] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                                required
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={onClose} className="h-9 px-4 rounded-[8px] text-[13px] font-medium text-[var(--text2)] border border-[var(--border)] hover:bg-[var(--surface2)]">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="h-9 px-5 rounded-[8px] text-[13px] font-medium bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-60 flex items-center gap-2"
                        >
                            {loading && <Loader2 size={14} className="animate-spin" />}
                            Create Review
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// ─── Review Detail Drawer ──────────────────────────────────────────────────────

function ReviewDrawer({
    reviewId, onClose, onUpdated, currentUserRole
}: { reviewId: string; onClose: () => void; onUpdated: () => void; currentUserRole: string }) {
    const [review, setReview] = useState<PerformanceReview & { kpis: KPI[] } | null>(null)
    const [loading, setLoading] = useState(true)
    const [tab, setTab] = useState<"overview" | "kpis" | "feedback">("overview")
    const [saving, setSaving] = useState(false)
    const [overallRating, setOverallRating] = useState<number | null>(null)
    const [promotion, setPromotion] = useState(false)
    const [increment, setIncrement] = useState("")
    const [strengths, setStrengths] = useState("")
    const [improvements, setImprovements] = useState("")
    const [managerComments, setManagerComments] = useState("")
    const [employeeComments, setEmployeeComments] = useState("")
    const [kpis, setKpis] = useState<KPI[]>([])
    const [addKpiForm, setAddKpiForm] = useState({ title: "", target: "", weightage: "10" })
    const [addingKpi, setAddingKpi] = useState(false)
    const [showAddKpi, setShowAddKpi] = useState(false)

    const fetchReview = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/performance/${reviewId}`)
            if (!res.ok) throw new Error("Failed to load")
            const data = await res.json()
            setReview(data)
            setKpis(data.kpis || [])
            setOverallRating(data.overallRating ?? null)
            setPromotion(data.promotionRecommended ?? false)
            setIncrement(data.incrementPercent?.toString() ?? "")
            setStrengths(data.strengths ?? "")
            setImprovements(data.improvements ?? "")
            setManagerComments(data.managerComments ?? "")
            setEmployeeComments(data.employeeComments ?? "")
        } catch {
            toast.error("Failed to load review")
        } finally {
            setLoading(false)
        }
    }, [reviewId])

    useEffect(() => { fetchReview() }, [fetchReview])

    async function saveField(field: Record<string, unknown>) {
        setSaving(true)
        try {
            const res = await fetch(`/api/performance/${reviewId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(field),
            })
            if (!res.ok) throw new Error("Failed to save")
            onUpdated()
        } catch {
            toast.error("Failed to save")
        } finally {
            setSaving(false)
        }
    }

    async function handleStatusChange(newStatus: ReviewStatus) {
        setSaving(true)
        try {
            const res = await fetch(`/api/performance/${reviewId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            })
            if (!res.ok) throw new Error("Failed to update status")
            toast.success(`Review ${newStatus === "SUBMITTED" ? "submitted" : newStatus === "COMPLETED" ? "completed" : "updated"}`)
            await fetchReview()
            onUpdated()
        } catch {
            toast.error("Failed to update status")
        } finally {
            setSaving(false)
        }
    }

    async function handleKpiUpdate(kpiId: string, field: Record<string, unknown>) {
        try {
            const res = await fetch(`/api/performance/${reviewId}/kpis/${kpiId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(field),
            })
            if (!res.ok) throw new Error("Failed to save KPI")
            setKpis(prev => prev.map(k => k.id === kpiId ? { ...k, ...field } : k))
        } catch {
            toast.error("Failed to save KPI")
        }
    }

    async function handleKpiDelete(kpiId: string) {
        if (!confirm("Delete this KPI?")) return
        try {
            const res = await fetch(`/api/performance/${reviewId}/kpis/${kpiId}`, { method: "DELETE" })
            if (!res.ok) throw new Error("Failed to delete")
            setKpis(prev => prev.filter(k => k.id !== kpiId))
            toast.success("KPI removed")
        } catch {
            toast.error("Failed to delete KPI")
        }
    }

    async function handleAddKpi() {
        if (!addKpiForm.title || !addKpiForm.target) {
            toast.error("Title and target required")
            return
        }
        setAddingKpi(true)
        try {
            const res = await fetch(`/api/performance/${reviewId}/kpis`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: addKpiForm.title,
                    target: addKpiForm.target,
                    weightage: parseFloat(addKpiForm.weightage) || 10,
                }),
            })
            if (!res.ok) throw new Error("Failed to add KPI")
            const newKpi = await res.json()
            setKpis(prev => [...prev, newKpi])
            setAddKpiForm({ title: "", target: "", weightage: "10" })
            setShowAddKpi(false)
            toast.success("KPI added")
        } catch {
            toast.error("Failed to add KPI")
        } finally {
            setAddingKpi(false)
        }
    }

    const totalWeightage = kpis.reduce((s, k) => s + k.weightage, 0)
    const weightedScore = kpis.reduce((s, k) => {
        if (k.rating && k.weightage) return s + (k.rating * k.weightage) / 100
        return s
    }, 0)
    const ratedCount = kpis.filter(k => k.rating).length

    if (loading) {
        return (
            <div className="fixed inset-0 z-40 flex justify-end">
                <div className="absolute inset-0 bg-black/30" onClick={onClose} />
                <div className="relative bg-[var(--surface)] w-full max-w-[520px] h-full flex items-center justify-center shadow-2xl">
                    <Loader2 size={28} className="animate-spin text-[var(--accent)]" />
                </div>
            </div>
        )
    }

    if (!review) return null

    const emp = review.employee
    const isAdminOrManager = currentUserRole === "ADMIN" || currentUserRole === "MANAGER"
    const statusOrder: ReviewStatus[] = ["DRAFT", "SUBMITTED", "ACKNOWLEDGED", "COMPLETED"]
    const currentStatusIdx = statusOrder.indexOf(review.status)

    return (
        <div className="fixed inset-0 z-40 flex justify-end">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-[var(--surface)] w-full max-w-[520px] h-full flex flex-col shadow-2xl overflow-hidden">
                {/* Drawer Header */}
                <div className="flex items-start justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
                    <div className="flex items-start gap-3">
                        <Avatar firstName={emp.firstName} lastName={emp.lastName} photo={emp.photo} size={44} />
                        <div>
                            <p className="text-[15px] font-semibold text-[var(--text)]">{emp.firstName} {emp.lastName}</p>
                            <p className="text-[12px] text-[var(--text3)]">{emp.employeeId} · {emp.designation || "—"}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                                <CycleBadge cycle={review.cycle} />
                                <span className="text-[11px] text-[var(--text3)]">{fmtDate(review.periodStart)} – {fmtDate(review.periodEnd)}</span>
                                <StatusBadge status={review.status} />
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-[var(--surface2)] rounded-md text-[var(--text3)] shrink-0">
                        <X size={16} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-[var(--border)] px-6 shrink-0">
                    {(["overview", "kpis", "feedback"] as const).map(t => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`py-3 px-1 mr-5 text-[13px] font-medium border-b-2 transition-colors capitalize ${
                                tab === t
                                    ? "border-[var(--accent)] text-[var(--accent)]"
                                    : "border-transparent text-[var(--text3)] hover:text-[var(--text2)]"
                            }`}
                        >
                            {t === "kpis" ? "KPIs" : t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                    ))}
                    {saving && <div className="ml-auto flex items-center gap-1 py-3 text-[11px] text-[var(--text3)]"><Loader2 size={12} className="animate-spin" /> Saving…</div>}
                </div>

                {/* Drawer Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">

                    {/* ── OVERVIEW TAB ── */}
                    {tab === "overview" && (
                        <>
                            {/* Overall Rating */}
                            <div className="bg-[var(--surface2)] rounded-[12px] p-4">
                                <p className="text-[12px] font-medium text-[var(--text2)] mb-3">Overall Rating</p>
                                <StarRating
                                    value={overallRating}
                                    size={32}
                                    onChange={v => {
                                        setOverallRating(v)
                                        saveField({ overallRating: v })
                                    }}
                                    disabled={!isAdminOrManager}
                                />
                                {overallRating && (
                                    <p className="mt-2 text-[13px] font-medium" style={{ color: (RATING_CONFIG[Math.round(overallRating)] || RATING_CONFIG[3]).color }}>
                                        {(RATING_CONFIG[Math.round(overallRating)] || RATING_CONFIG[3]).label}
                                    </p>
                                )}
                            </div>

                            {/* Weighted Score */}
                            <div className="bg-[var(--surface2)] rounded-[12px] p-4 flex items-center justify-between">
                                <div>
                                    <p className="text-[11px] text-[var(--text3)]">Weighted Score</p>
                                    <p className="text-[20px] font-bold text-[var(--text)]">{weightedScore.toFixed(2)}<span className="text-[13px] text-[var(--text3)] font-normal"> / 5.00</span></p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[11px] text-[var(--text3)]">KPIs Rated</p>
                                    <p className="text-[15px] font-semibold text-[var(--text)]">{ratedCount}/{kpis.length}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[11px] text-[var(--text3)]">Total Weightage</p>
                                    <p className="text-[15px] font-semibold" style={{ color: totalWeightage === 100 ? "#1a9e6e" : "#ef4444" }}>{totalWeightage}%</p>
                                </div>
                            </div>

                            {/* Promotion + Increment */}
                            {isAdminOrManager && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-[var(--surface2)] rounded-[12px] p-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={promotion}
                                                onChange={e => {
                                                    setPromotion(e.target.checked)
                                                    saveField({ promotionRecommended: e.target.checked })
                                                }}
                                                className="w-4 h-4 accent-[var(--accent)]"
                                            />
                                            <span className="text-[12px] font-medium text-[var(--text2)]">Promotion Recommended</span>
                                        </label>
                                    </div>
                                    <div className="bg-[var(--surface2)] rounded-[12px] p-4">
                                        <p className="text-[11px] text-[var(--text3)] mb-1.5">Increment %</p>
                                        <input
                                            type="number"
                                            value={increment}
                                            onChange={e => setIncrement(e.target.value)}
                                            onBlur={() => saveField({ incrementPercent: increment ? parseFloat(increment) : null })}
                                            placeholder="e.g. 10"
                                            min="0"
                                            max="100"
                                            className="w-full h-8 px-2 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-[13px] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Status Timeline */}
                            <div className="bg-[var(--surface2)] rounded-[12px] p-4">
                                <p className="text-[12px] font-medium text-[var(--text2)] mb-3">Progress</p>
                                <div className="flex items-center gap-1">
                                    {statusOrder.map((s, i) => {
                                        const done = i <= currentStatusIdx
                                        const cfg = STATUS_CONFIG[s]
                                        return (
                                            <div key={s} className="flex items-center flex-1 last:flex-none">
                                                <div className="flex flex-col items-center gap-1 flex-1">
                                                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                                                        style={{ background: done ? cfg.bg : "#f3f4f6", color: done ? cfg.color : "#9ca3af", border: `1.5px solid ${done ? cfg.color : "#e5e7eb"}` }}>
                                                        {done && i < currentStatusIdx ? "✓" : i + 1}
                                                    </div>
                                                    <span className="text-[9px] text-[var(--text3)] text-center whitespace-nowrap">{cfg.label}</span>
                                                </div>
                                                {i < statusOrder.length - 1 && (
                                                    <div className="h-[2px] flex-1 mx-1 mb-4 rounded-full" style={{ background: i < currentStatusIdx ? "#1a9e6e" : "#e5e7eb" }} />
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Action Buttons */}
                            {isAdminOrManager && review.status === "DRAFT" && (
                                <button
                                    onClick={() => handleStatusChange("SUBMITTED")}
                                    disabled={saving}
                                    className="w-full h-10 rounded-[8px] bg-[var(--accent)] text-white text-[13px] font-medium flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60"
                                >
                                    <Send size={14} />
                                    Submit Review
                                </button>
                            )}
                            {review.status === "SUBMITTED" && (
                                <div className="bg-[#eff6ff] border border-[#bfdbfe] rounded-[10px] p-3 flex items-center gap-2">
                                    <AlertCircle size={14} className="text-[#2563eb] shrink-0" />
                                    <p className="text-[12px] text-[#1d4ed8]">Review submitted — waiting for employee acknowledgement.</p>
                                </div>
                            )}
                            {review.status === "ACKNOWLEDGED" && isAdminOrManager && (
                                <button
                                    onClick={() => handleStatusChange("COMPLETED")}
                                    disabled={saving}
                                    className="w-full h-10 rounded-[8px] bg-[#1a9e6e] text-white text-[13px] font-medium flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60"
                                >
                                    <CheckCircle2 size={14} />
                                    Mark as Completed
                                </button>
                            )}
                            {review.status === "SUBMITTED" && !isAdminOrManager && (
                                <button
                                    onClick={() => handleStatusChange("ACKNOWLEDGED")}
                                    disabled={saving}
                                    className="w-full h-10 rounded-[8px] bg-[#2563eb] text-white text-[13px] font-medium flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60"
                                >
                                    <CheckCircle2 size={14} />
                                    Acknowledge Review
                                </button>
                            )}
                        </>
                    )}

                    {/* ── KPIs TAB ── */}
                    {tab === "kpis" && (
                        <>
                            {totalWeightage !== 100 && (
                                <div className="bg-[#fef3c7] border border-[#fde68a] rounded-[8px] px-3 py-2 flex items-center gap-2">
                                    <AlertCircle size={13} className="text-[#d97706] shrink-0" />
                                    <p className="text-[11.5px] text-[#92400e]">Total weightage is {totalWeightage}% — should be 100%</p>
                                </div>
                            )}

                            <div className="space-y-2">
                                {kpis.map(kpi => (
                                    <div key={kpi.id} className="bg-[var(--surface2)] border border-[var(--border)] rounded-[10px] p-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[13px] font-medium text-[var(--text)] truncate">{kpi.title}</p>
                                                <p className="text-[11px] text-[var(--text3)]">Target: <span className="font-medium text-[var(--text2)]">{kpi.target}</span> · Weightage: <span className="font-medium text-[var(--text2)]">{kpi.weightage}%</span></p>
                                            </div>
                                            <button
                                                onClick={() => handleKpiDelete(kpi.id)}
                                                className="p-1 text-[var(--text3)] hover:text-[var(--red)] rounded shrink-0"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                        <div className="mt-2 grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-[10.5px] text-[var(--text3)] mb-1">Actual Achieved</label>
                                                <input
                                                    defaultValue={kpi.actual ?? ""}
                                                    onBlur={e => handleKpiUpdate(kpi.id, { actual: e.target.value })}
                                                    placeholder="Enter actual..."
                                                    className="w-full h-7 px-2 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-[12px] text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/40"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10.5px] text-[var(--text3)] mb-1">Remarks</label>
                                                <input
                                                    defaultValue={kpi.remarks ?? ""}
                                                    onBlur={e => handleKpiUpdate(kpi.id, { remarks: e.target.value })}
                                                    placeholder="Optional..."
                                                    className="w-full h-7 px-2 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-[12px] text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/40"
                                                />
                                            </div>
                                        </div>
                                        <div className="mt-2">
                                            <label className="block text-[10.5px] text-[var(--text3)] mb-1">Rating</label>
                                            <StarRating
                                                value={kpi.rating}
                                                size={20}
                                                onChange={v => handleKpiUpdate(kpi.id, { rating: v })}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Weighted Score Summary */}
                            <div className="bg-[var(--surface2)] border border-[var(--border)] rounded-[10px] p-3 flex justify-between items-center">
                                <p className="text-[12px] text-[var(--text2)]">Weighted Score: <strong>Σ(rating × weightage) / 100</strong></p>
                                <p className="text-[16px] font-bold text-[var(--accent)]">{weightedScore.toFixed(2)}</p>
                            </div>

                            {/* Add KPI */}
                            {!showAddKpi ? (
                                <button
                                    onClick={() => setShowAddKpi(true)}
                                    className="w-full h-9 rounded-[8px] border border-dashed border-[var(--border)] text-[12px] text-[var(--text3)] hover:border-[var(--accent)] hover:text-[var(--accent)] flex items-center justify-center gap-1.5 transition-colors"
                                >
                                    <Plus size={13} /> Add KPI
                                </button>
                            ) : (
                                <div className="bg-[var(--surface2)] border border-[var(--border)] rounded-[10px] p-3 space-y-2">
                                    <p className="text-[12px] font-medium text-[var(--text2)]">Add Custom KPI</p>
                                    <input
                                        value={addKpiForm.title}
                                        onChange={e => setAddKpiForm(f => ({ ...f, title: e.target.value }))}
                                        placeholder="KPI Title"
                                        className="w-full h-8 px-2.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-[12px] text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/40"
                                    />
                                    <div className="grid grid-cols-2 gap-2">
                                        <input
                                            value={addKpiForm.target}
                                            onChange={e => setAddKpiForm(f => ({ ...f, target: e.target.value }))}
                                            placeholder="Target (e.g. ≥95%)"
                                            className="w-full h-8 px-2.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-[12px] text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/40"
                                        />
                                        <input
                                            type="number"
                                            value={addKpiForm.weightage}
                                            onChange={e => setAddKpiForm(f => ({ ...f, weightage: e.target.value }))}
                                            placeholder="Weightage %"
                                            className="w-full h-8 px-2.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-[12px] text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/40"
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => setShowAddKpi(false)} className="h-8 px-3 rounded-[6px] text-[12px] text-[var(--text2)] border border-[var(--border)] hover:bg-[var(--surface)]">Cancel</button>
                                        <button onClick={handleAddKpi} disabled={addingKpi} className="h-8 px-4 rounded-[6px] text-[12px] bg-[var(--accent)] text-white flex items-center gap-1.5 disabled:opacity-60">
                                            {addingKpi && <Loader2 size={11} className="animate-spin" />}
                                            Add
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* ── FEEDBACK TAB ── */}
                    {tab === "feedback" && (
                        <div className="space-y-4">
                            {(
                                [
                                    { key: "strengths", label: "Strengths", value: strengths, setter: setStrengths, editable: isAdminOrManager },
                                    { key: "improvements", label: "Areas for Improvement", value: improvements, setter: setImprovements, editable: isAdminOrManager },
                                    { key: "managerComments", label: "Manager Comments", value: managerComments, setter: setManagerComments, editable: isAdminOrManager },
                                    { key: "employeeComments", label: "Employee Comments", value: employeeComments, setter: setEmployeeComments, editable: true },
                                ] as Array<{ key: string; label: string; value: string; setter: (v: string) => void; editable: boolean }>
                            ).map(({ key, label, value, setter, editable }) => (
                                <div key={key}>
                                    <label className="block text-[12px] font-medium text-[var(--text2)] mb-1.5">{label}</label>
                                    <textarea
                                        value={value}
                                        onChange={e => setter(e.target.value)}
                                        onBlur={() => saveField({ [key]: value })}
                                        disabled={!editable}
                                        rows={4}
                                        placeholder={editable ? `Enter ${label.toLowerCase()}...` : "Not provided"}
                                        className="w-full px-3 py-2 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[13px] text-[var(--text)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 disabled:bg-[var(--surface2)] disabled:text-[var(--text3)]"
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PerformancePage() {
    const { data: session, status } = useSession()
    const router = useRouter()

    const [reviews, setReviews] = useState<PerformanceReview[]>([])
    const [loading, setLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState("ALL")
    const [cycleFilter, setCycleFilter] = useState("ALL")
    const [search, setSearch] = useState("")
    const [showNewModal, setShowNewModal] = useState(false)
    const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null)
    const [openMenuId, setOpenMenuId] = useState<string | null>(null)

    useEffect(() => {
        if (status !== "unauthenticated") return
        router.push("/login")
    }, [status, router])

    const fetchReviews = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (statusFilter !== "ALL") params.set("status", statusFilter)
            if (cycleFilter !== "ALL") params.set("cycle", cycleFilter)
            if (search) params.set("search", search)
            const res = await fetch(`/api/performance?${params}`)
            if (!res.ok) throw new Error("Failed to fetch")
            const data = await res.json()
            setReviews(Array.isArray(data) ? data : [])
        } catch {
            toast.error("Failed to load reviews")
        } finally {
            setLoading(false)
        }
    }, [statusFilter, cycleFilter, search])

    useEffect(() => {
        if (status === "authenticated") fetchReviews()
    }, [status, fetchReviews])

    async function handleDelete(id: string) {
        if (!confirm("Delete this review? This cannot be undone.")) return
        try {
            const res = await fetch(`/api/performance/${id}`, { method: "DELETE" })
            if (!res.ok) throw new Error(await res.text())
            toast.success("Review deleted")
            setReviews(prev => prev.filter(r => r.id !== id))
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to delete")
        }
    }

    // Stats
    const totalReviews = reviews.length
    const completed = reviews.filter(r => r.status === "COMPLETED")
    const avgRating = completed.filter(r => r.overallRating).length > 0
        ? (completed.filter(r => r.overallRating).reduce((s, r) => s + (r.overallRating || 0), 0) / completed.filter(r => r.overallRating).length).toFixed(1)
        : "—"
    const pendingAck = reviews.filter(r => r.status === "SUBMITTED").length

    const now = new Date()
    const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
    const completedThisQ = reviews.filter(r => {
        if (r.status !== "COMPLETED" || !r.completedAt) return false
        return new Date(r.completedAt) >= qStart
    }).length

    const currentUserRole = session?.user?.role || ""
    const currentUserId = session?.user?.id || ""

    const STATUS_PILLS = ["ALL", "DRAFT", "SUBMITTED", "ACKNOWLEDGED", "COMPLETED"]

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-[var(--surface2)]">
            {/* Header */}
            <div className="bg-[var(--surface)] border-b border-[var(--border)] px-6 py-4 flex items-center justify-between shrink-0">
                <div>
                    <h1 className="text-[18px] font-bold text-[var(--text)]">Performance Management</h1>
                    <p className="text-[12.5px] text-[var(--text3)] mt-0.5">KPIs, reviews & appraisals</p>
                </div>
                {(currentUserRole === "ADMIN" || currentUserRole === "MANAGER") && (
                    <button
                        onClick={() => setShowNewModal(true)}
                        className="h-9 px-4 bg-[var(--accent)] text-white rounded-[8px] text-[13px] font-medium flex items-center gap-2 hover:opacity-90"
                    >
                        <Plus size={15} />
                        New Review
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatCard label="Total Reviews" value={totalReviews} color="#2563eb" bg="#eff6ff" icon={<TrendingUp size={18} />} />
                    <StatCard label="Avg Rating" value={`${avgRating}/5`} color="#1a9e6e" bg="#e8f7f1" icon={<Star size={18} />} />
                    <StatCard label="Pending Acknowledgement" value={pendingAck} color="#d97706" bg="#fef3c7" icon={<Clock size={18} />} />
                    <StatCard label="Completed This Quarter" value={completedThisQ} color="#1a9e6e" bg="#e8f7f1" icon={<CheckCircle2 size={18} />} />
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-2 items-center">
                    {/* Status Pills */}
                    <div className="flex gap-1 flex-wrap">
                        {STATUS_PILLS.map(s => (
                            <button
                                key={s}
                                onClick={() => setStatusFilter(s)}
                                className={`h-8 px-3 rounded-full text-[12px] font-medium transition-all ${
                                    statusFilter === s
                                        ? "bg-[var(--accent)] text-white"
                                        : "bg-[var(--surface)] border border-[var(--border)] text-[var(--text2)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                                }`}
                            >
                                {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
                            </button>
                        ))}
                    </div>

                    {/* Cycle Filter */}
                    <div className="relative ml-1">
                        <select
                            value={cycleFilter}
                            onChange={e => setCycleFilter(e.target.value)}
                            className="h-8 pl-3 pr-7 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[12px] text-[var(--text2)] appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                        >
                            <option value="ALL">All Cycles</option>
                            <option value="MONTHLY">Monthly</option>
                            <option value="QUARTERLY">Quarterly</option>
                            <option value="HALF_YEARLY">Half-Yearly</option>
                            <option value="ANNUAL">Annual</option>
                        </select>
                        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text3)] pointer-events-none" />
                    </div>

                    {/* Search */}
                    <div className="relative ml-auto">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text3)]" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search employee..."
                            className="h-8 pl-8 pr-3 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[12.5px] text-[var(--text)] w-52 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                        />
                    </div>
                </div>

                {/* Review List */}
                <div className="bg-[var(--surface)] rounded-[12px] border border-[var(--border)] overflow-hidden">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 size={24} className="animate-spin text-[var(--accent)]" />
                        </div>
                    ) : reviews.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-2">
                            <Star size={32} className="text-[var(--text3)]" />
                            <p className="text-[13px] text-[var(--text3)]">No reviews found</p>
                            {(currentUserRole === "ADMIN" || currentUserRole === "MANAGER") && (
                                <button
                                    onClick={() => setShowNewModal(true)}
                                    className="mt-2 h-8 px-4 rounded-[8px] bg-[var(--accent)] text-white text-[12px] font-medium"
                                >
                                    Create First Review
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-[var(--border)] bg-[var(--surface2)]">
                                        {["Employee", "Designation", "Cycle", "Period", "KPIs", "Overall Rating", "Status", ""].map(h => (
                                            <th key={h} className="text-left text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.4px] px-4 py-3 whitespace-nowrap">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border)]">
                                    {reviews.map(review => {
                                        const emp = review.employee
                                        const ratedKpis = review.kpis.filter(k => k.rating).length
                                        return (
                                            <tr key={review.id} className="hover:bg-[var(--surface2)] transition-colors group">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2.5">
                                                        <Avatar firstName={emp.firstName} lastName={emp.lastName} photo={emp.photo} size={32} />
                                                        <div>
                                                            <p className="text-[13px] font-medium text-[var(--text)]">{emp.firstName} {emp.lastName}</p>
                                                            <p className="text-[11px] text-[var(--text3)]">{emp.employeeId}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-[12.5px] text-[var(--text2)]">{emp.designation || "—"}</td>
                                                <td className="px-4 py-3"><CycleBadge cycle={review.cycle} /></td>
                                                <td className="px-4 py-3 text-[12px] text-[var(--text2)] whitespace-nowrap">{fmtDate(review.periodStart)} – {fmtDate(review.periodEnd)}</td>
                                                <td className="px-4 py-3">
                                                    <span className="text-[12px] font-medium text-[var(--text2)]">{ratedKpis}/{review.kpis.length} <span className="text-[var(--text3)] font-normal">rated</span></span>
                                                </td>
                                                <td className="px-4 py-3"><StarDisplay rating={review.overallRating} /></td>
                                                <td className="px-4 py-3"><StatusBadge status={review.status} /></td>
                                                <td className="px-4 py-3">
                                                    <div className="relative">
                                                        <button
                                                            onClick={() => setOpenMenuId(openMenuId === review.id ? null : review.id)}
                                                            className="p-1.5 rounded-[6px] text-[var(--text3)] hover:bg-[var(--surface2)] opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            <MoreVertical size={14} />
                                                        </button>
                                                        {openMenuId === review.id && (
                                                            <div className="absolute right-0 top-7 z-20 bg-[var(--surface)] border border-[var(--border)] rounded-[8px] shadow-lg w-36 py-1" onClick={() => setOpenMenuId(null)}>
                                                                <button
                                                                    onClick={() => setSelectedReviewId(review.id)}
                                                                    className="w-full flex items-center gap-2 px-3 py-2 text-[12.5px] text-[var(--text2)] hover:bg-[var(--surface2)]"
                                                                >
                                                                    <Eye size={13} /> View / Edit
                                                                </button>
                                                                {review.status === "DRAFT" && (currentUserRole === "ADMIN" || currentUserRole === "MANAGER") && (
                                                                    <button
                                                                        onClick={() => handleDelete(review.id)}
                                                                        className="w-full flex items-center gap-2 px-3 py-2 text-[12.5px] text-[var(--red)] hover:bg-[#fef2f2]"
                                                                    >
                                                                        <Trash2 size={13} /> Delete
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
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

            {/* Modals */}
            {showNewModal && (
                <NewReviewModal
                    onClose={() => setShowNewModal(false)}
                    onCreated={fetchReviews}
                    currentUserId={currentUserId}
                />
            )}

            {selectedReviewId && (
                <ReviewDrawer
                    reviewId={selectedReviewId}
                    onClose={() => setSelectedReviewId(null)}
                    onUpdated={fetchReviews}
                    currentUserRole={currentUserRole}
                />
            )}

            {/* Close menu on outside click */}
            {openMenuId && (
                <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
            )}
        </div>
    )
}
