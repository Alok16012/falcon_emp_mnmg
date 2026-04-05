"use client"
import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
    Plus, Loader2, X, Star, BarChart2,
    CheckCircle, Clock, Search, ChevronDown
} from "lucide-react"
import { format } from "date-fns"

type KPI = {
    name: string
    target: number
    achieved: number
    score: number
    weight: number
}

type PerformanceReview = {
    id: string
    employeeId: string
    reviewerId: string
    period: string
    reviewType: string
    kpis: KPI[]
    totalScore: number
    rating?: string
    strengths?: string
    improvements?: string
    goals?: string
    status: string
    submittedAt?: string
    acknowledgedAt?: string
    createdAt: string
    updatedAt: string
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

const DEFAULT_KPIS: KPI[] = [
    { name: "Attendance %", target: 100, achieved: 0, score: 0, weight: 20 },
    { name: "Quality of Work", target: 10, achieved: 0, score: 0, weight: 25 },
    { name: "Productivity", target: 10, achieved: 0, score: 0, weight: 25 },
    { name: "Discipline", target: 10, achieved: 0, score: 0, weight: 15 },
    { name: "Client Feedback", target: 10, achieved: 0, score: 0, weight: 15 },
]

const PERIODS = ["Q1 2026", "Q2 2026", "Q3 2026", "Q4 2026", "Q1 2025", "Q2 2025", "Q3 2025", "Q4 2025", "Annual 2026", "Annual 2025"]

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    DRAFT: { label: "Draft", color: "#6b7280", bg: "#f9fafb" },
    SUBMITTED: { label: "Submitted", color: "#f59e0b", bg: "#fffbeb" },
    ACKNOWLEDGED: { label: "Acknowledged", color: "#3b82f6", bg: "#eff6ff" },
    CLOSED: { label: "Closed", color: "#1a9e6e", bg: "#e8f7f1" },
}

const RATING_CONFIG: Record<string, { color: string; bg: string }> = {
    Excellent: { color: "#1a9e6e", bg: "#e8f7f1" },
    Good: { color: "#3b82f6", bg: "#eff6ff" },
    Average: { color: "#f59e0b", bg: "#fffbeb" },
    "Below Average": { color: "#f97316", bg: "#fff7ed" },
    Poor: { color: "#ef4444", bg: "#fef2f2" },
}

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

function ScoreCircle({ score }: { score: number }) {
    const color = score >= 80 ? "#1a9e6e" : score >= 60 ? "#f59e0b" : "#ef4444"
    const bg = score >= 80 ? "#e8f7f1" : score >= 60 ? "#fffbeb" : "#fef2f2"
    return (
        <div style={{ background: bg, color, border: `2px solid ${color}` }} className="w-12 h-12 rounded-full flex flex-col items-center justify-center shrink-0">
            <span className="text-[14px] font-bold leading-none">{Math.round(score)}</span>
            <span className="text-[8px] font-medium leading-none mt-0.5">/ 100</span>
        </div>
    )
}

function NewReviewModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
    const [loading, setLoading] = useState(false)
    const [employees, setEmployees] = useState<Employee[]>([])
    const [form, setForm] = useState({
        employeeId: "",
        period: "Q1 2026",
        reviewType: "QUARTERLY",
        strengths: "",
        improvements: "",
        goals: "",
    })
    const [kpis, setKpis] = useState<KPI[]>(DEFAULT_KPIS.map(k => ({ ...k })))

    useEffect(() => {
        if (open) {
            fetch("/api/employees?status=ACTIVE")
                .then(r => r.json())
                .then(data => setEmployees(Array.isArray(data) ? data : []))
                .catch(() => {})
        }
    }, [open])

    const updateKpi = (index: number, field: keyof KPI, value: number) => {
        setKpis(prev => {
            const updated = [...prev]
            updated[index] = { ...updated[index], [field]: value }
            // Auto-calculate score
            if (field === "achieved" || field === "target") {
                const t = field === "target" ? value : updated[index].target
                const a = field === "achieved" ? value : updated[index].achieved
                updated[index].score = t > 0 ? Math.min(100, Math.round((a / t) * 100)) : 0
            }
            return updated
        })
    }

    const totalScore = kpis.reduce((sum, kpi) => sum + (kpi.score * kpi.weight) / 100, 0)
    const rating = totalScore >= 80 ? "Excellent" : totalScore >= 60 ? "Good" : totalScore >= 40 ? "Average" : totalScore >= 20 ? "Below Average" : "Poor"

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.employeeId) { toast.error("Select an employee"); return }
        setLoading(true)
        try {
            const res = await fetch("/api/performance", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...form, kpis, totalScore, rating }),
            })
            if (!res.ok) throw new Error(await res.text())
            toast.success("Review created!")
            onSaved()
            onClose()
            setForm({ employeeId: "", period: "Q1 2026", reviewType: "QUARTERLY", strengths: "", improvements: "", goals: "" })
            setKpis(DEFAULT_KPIS.map(k => ({ ...k })))
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to create review")
        } finally {
            setLoading(false)
        }
    }

    if (!open) return null

    const ratingStyle = RATING_CONFIG[rating] || { color: "#6b7280", bg: "#f9fafb" }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white rounded-[16px] border border-[var(--border)] w-full max-w-2xl shadow-xl my-4">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
                    <h2 className="text-[15px] font-semibold text-[var(--text)]">New Performance Review</h2>
                    <button onClick={onClose} className="p-1 text-[var(--text3)] hover:text-[var(--text)] rounded-md hover:bg-[var(--surface2)] transition-colors"><X size={18} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-5">
                    {/* Basic Info */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-3 md:col-span-1">
                            <label className="block text-[12px] text-[var(--text2)] mb-1">Employee *</label>
                            <select value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))}
                                className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors" required>
                                <option value="">Select...</option>
                                {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[12px] text-[var(--text2)] mb-1">Period *</label>
                            <select value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))}
                                className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors">
                                {PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[12px] text-[var(--text2)] mb-1">Review Type</label>
                            <select value={form.reviewType} onChange={e => setForm(f => ({ ...f, reviewType: e.target.value }))}
                                className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors">
                                <option value="MONTHLY">Monthly</option>
                                <option value="QUARTERLY">Quarterly</option>
                                <option value="ANNUAL">Annual</option>
                            </select>
                        </div>
                    </div>

                    {/* KPIs */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-[12px] font-medium text-[var(--text2)]">KPI Scores</label>
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] text-[var(--text3)]">Overall:</span>
                                <span style={ratingStyle} className="text-[11px] font-bold px-2 py-0.5 rounded-full">{rating} ({Math.round(totalScore)})</span>
                            </div>
                        </div>
                        <div className="border border-[var(--border)] rounded-[10px] overflow-hidden">
                            <table className="w-full text-[12px]">
                                <thead className="bg-[var(--surface2)]">
                                    <tr>
                                        <th className="text-left px-3 py-2 text-[var(--text2)] font-medium">KPI</th>
                                        <th className="text-center px-3 py-2 text-[var(--text2)] font-medium w-20">Target</th>
                                        <th className="text-center px-3 py-2 text-[var(--text2)] font-medium w-20">Achieved</th>
                                        <th className="text-center px-3 py-2 text-[var(--text2)] font-medium w-20">Score</th>
                                        <th className="text-center px-3 py-2 text-[var(--text2)] font-medium w-16">Weight</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border)]">
                                    {kpis.map((kpi, i) => (
                                        <tr key={kpi.name} className="bg-white">
                                            <td className="px-3 py-2 text-[var(--text)] font-medium">{kpi.name}</td>
                                            <td className="px-2 py-1.5">
                                                <input type="number" min="0" value={kpi.target}
                                                    onChange={e => updateKpi(i, "target", parseFloat(e.target.value) || 0)}
                                                    className="w-full h-7 text-center rounded-[6px] border border-[var(--border)] bg-white text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent)]" />
                                            </td>
                                            <td className="px-2 py-1.5">
                                                <input type="number" min="0" value={kpi.achieved}
                                                    onChange={e => updateKpi(i, "achieved", parseFloat(e.target.value) || 0)}
                                                    className="w-full h-7 text-center rounded-[6px] border border-[var(--border)] bg-white text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent)]" />
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <span style={{ color: kpi.score >= 80 ? "#1a9e6e" : kpi.score >= 60 ? "#f59e0b" : "#ef4444" }} className="font-bold">{kpi.score}%</span>
                                            </td>
                                            <td className="px-3 py-2 text-center text-[var(--text3)]">{kpi.weight}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Text areas */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                            <label className="block text-[12px] text-[var(--text2)] mb-1">Strengths</label>
                            <textarea value={form.strengths} onChange={e => setForm(f => ({ ...f, strengths: e.target.value }))}
                                className="w-full rounded-[8px] border border-[var(--border)] bg-white px-3 py-2 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors resize-none"
                                rows={3} placeholder="Key strengths..." />
                        </div>
                        <div>
                            <label className="block text-[12px] text-[var(--text2)] mb-1">Areas of Improvement</label>
                            <textarea value={form.improvements} onChange={e => setForm(f => ({ ...f, improvements: e.target.value }))}
                                className="w-full rounded-[8px] border border-[var(--border)] bg-white px-3 py-2 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors resize-none"
                                rows={3} placeholder="Areas to improve..." />
                        </div>
                        <div>
                            <label className="block text-[12px] text-[var(--text2)] mb-1">Next Period Goals</label>
                            <textarea value={form.goals} onChange={e => setForm(f => ({ ...f, goals: e.target.value }))}
                                className="w-full rounded-[8px] border border-[var(--border)] bg-white px-3 py-2 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors resize-none"
                                rows={3} placeholder="Goals for next period..." />
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] font-medium text-[var(--text2)] hover:text-[var(--text)] rounded-[8px] hover:bg-[var(--surface2)] transition-colors">Cancel</button>
                        <button type="submit" disabled={loading}
                            className="inline-flex items-center gap-2 px-5 py-2 bg-[var(--accent)] text-white rounded-[8px] text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                            {loading && <Loader2 size={14} className="animate-spin" />}
                            Create Review
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

function ReviewDetailDrawer({ review, onClose, onUpdated }: { review: PerformanceReview; onClose: () => void; onUpdated: () => void }) {
    const [updating, setUpdating] = useState(false)

    const handleStatusUpdate = async (newStatus: string) => {
        setUpdating(true)
        try {
            const res = await fetch(`/api/performance/${review.id}`, {
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
            setUpdating(false)
        }
    }

    const kpis = Array.isArray(review.kpis) ? review.kpis : []
    const ratingStyle = review.rating ? (RATING_CONFIG[review.rating] || { color: "#6b7280", bg: "#f9fafb" }) : { color: "#6b7280", bg: "#f9fafb" }
    const statusStyle = STATUS_CONFIG[review.status] || STATUS_CONFIG.DRAFT

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-end">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-10 h-full w-full max-w-[480px] bg-white border-l border-[var(--border)] overflow-y-auto flex flex-col">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] sticky top-0 bg-white z-10">
                    <div>
                        <p className="text-[14px] font-semibold text-[var(--text)]">{review.employee.firstName} {review.employee.lastName}</p>
                        <p className="text-[11px] text-[var(--text3)]">{review.period} · {review.reviewType}</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-[var(--text3)] hover:text-[var(--text)] rounded-md hover:bg-[var(--surface2)] transition-colors"><X size={18} /></button>
                </div>

                <div className="flex-1 px-5 py-4 space-y-5">
                    {/* Score Summary */}
                    <div className="flex items-center gap-4 p-4 bg-[var(--surface2)] rounded-[12px]">
                        <ScoreCircle score={review.totalScore} />
                        <div>
                            <p className="text-[13px] font-medium text-[var(--text)]">Overall Score</p>
                            <span style={ratingStyle} className="text-[12px] font-bold px-2.5 py-0.5 rounded-full inline-block mt-1">{review.rating || "N/A"}</span>
                        </div>
                        <div className="ml-auto">
                            <span style={{ color: statusStyle.color, background: statusStyle.bg }} className="text-[11px] font-semibold px-2.5 py-1 rounded-full">{statusStyle.label}</span>
                        </div>
                    </div>

                    {/* KPI Breakdown */}
                    <div>
                        <p className="text-[12px] font-semibold text-[var(--text2)] uppercase tracking-wide mb-2">KPI Breakdown</p>
                        <div className="space-y-2">
                            {kpis.map((kpi: KPI) => (
                                <div key={kpi.name} className="p-3 bg-white border border-[var(--border)] rounded-[10px]">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[12px] font-medium text-[var(--text)]">{kpi.name}</span>
                                        <span style={{ color: kpi.score >= 80 ? "#1a9e6e" : kpi.score >= 60 ? "#f59e0b" : "#ef4444" }} className="text-[12px] font-bold">{kpi.score}%</span>
                                    </div>
                                    <div className="w-full bg-[var(--surface2)] rounded-full h-1.5">
                                        <div style={{ width: `${kpi.score}%`, background: kpi.score >= 80 ? "#1a9e6e" : kpi.score >= 60 ? "#f59e0b" : "#ef4444" }} className="h-1.5 rounded-full" />
                                    </div>
                                    <div className="flex justify-between mt-1">
                                        <span className="text-[10.5px] text-[var(--text3)]">Achieved: {kpi.achieved} / {kpi.target}</span>
                                        <span className="text-[10.5px] text-[var(--text3)]">Weight: {kpi.weight}%</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Notes */}
                    {(review.strengths || review.improvements || review.goals) && (
                        <div className="space-y-3">
                            {review.strengths && (
                                <div className="p-3 bg-[#f0fdf4] border border-[#bbf7d0] rounded-[10px]">
                                    <p className="text-[11px] font-semibold text-[#1a9e6e] uppercase mb-1">Strengths</p>
                                    <p className="text-[12px] text-[var(--text)]">{review.strengths}</p>
                                </div>
                            )}
                            {review.improvements && (
                                <div className="p-3 bg-[#fffbeb] border border-[#fde68a] rounded-[10px]">
                                    <p className="text-[11px] font-semibold text-[#d97706] uppercase mb-1">Areas of Improvement</p>
                                    <p className="text-[12px] text-[var(--text)]">{review.improvements}</p>
                                </div>
                            )}
                            {review.goals && (
                                <div className="p-3 bg-[#eff6ff] border border-[#bfdbfe] rounded-[10px]">
                                    <p className="text-[11px] font-semibold text-[#3b82f6] uppercase mb-1">Next Period Goals</p>
                                    <p className="text-[12px] text-[var(--text)]">{review.goals}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Actions */}
                    {review.status === "DRAFT" && (
                        <button onClick={() => handleStatusUpdate("SUBMITTED")} disabled={updating}
                            className="w-full h-9 bg-[var(--accent)] text-white rounded-[8px] text-[13px] font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
                            {updating && <Loader2 size={14} className="animate-spin" />}
                            Submit for Review
                        </button>
                    )}
                    {review.status === "SUBMITTED" && (
                        <button onClick={() => handleStatusUpdate("ACKNOWLEDGED")} disabled={updating}
                            className="w-full h-9 bg-[#3b82f6] text-white rounded-[8px] text-[13px] font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
                            {updating && <Loader2 size={14} className="animate-spin" />}
                            Mark Acknowledged
                        </button>
                    )}
                    {review.status === "ACKNOWLEDGED" && (
                        <button onClick={() => handleStatusUpdate("CLOSED")} disabled={updating}
                            className="w-full h-9 bg-[var(--surface2)] text-[var(--text)] border border-[var(--border)] rounded-[8px] text-[13px] font-medium hover:bg-white disabled:opacity-50 flex items-center justify-center gap-2">
                            {updating && <Loader2 size={14} className="animate-spin" />}
                            Close Review
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

export default function PerformancePage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [reviews, setReviews] = useState<PerformanceReview[]>([])
    const [loading, setLoading] = useState(true)
    const [showNew, setShowNew] = useState(false)
    const [selectedReview, setSelectedReview] = useState<PerformanceReview | null>(null)
    const [search, setSearch] = useState("")
    const [periodFilter, setPeriodFilter] = useState("")

    useEffect(() => {
        if (status === "unauthenticated") router.push("/login")
    }, [status, router])

    const fetchReviews = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (periodFilter) params.set("period", periodFilter)
            const res = await fetch(`/api/performance?${params}`)
            const data = await res.json()
            setReviews(Array.isArray(data) ? data : [])
        } catch {
            toast.error("Failed to load reviews")
        } finally {
            setLoading(false)
        }
    }, [periodFilter])

    useEffect(() => {
        if (status === "authenticated") fetchReviews()
    }, [status, fetchReviews])

    const filtered = reviews.filter(r => {
        if (!search) return true
        const name = `${r.employee.firstName} ${r.employee.lastName} ${r.employee.employeeId}`.toLowerCase()
        return name.includes(search.toLowerCase())
    })

    const initiated = reviews.length
    const submitted = reviews.filter(r => r.status === "SUBMITTED").length
    const completed = reviews.filter(r => r.status === "CLOSED").length
    const avgScore = reviews.length > 0 ? Math.round(reviews.reduce((sum, r) => sum + r.totalScore, 0) / reviews.length) : 0

    if (status === "loading") {
        return <div className="flex items-center justify-center min-h-screen"><Loader2 size={28} className="animate-spin text-[var(--accent)]" /></div>
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-[24px] font-semibold tracking-[-0.4px] text-[var(--text)]">Performance Management</h1>
                    <p className="text-[13px] text-[var(--text3)] mt-0.5">Track and evaluate employee performance</p>
                </div>
                <button onClick={() => setShowNew(true)}
                    className="inline-flex items-center gap-2 bg-[var(--accent)] text-white rounded-[10px] text-[13px] font-medium px-4 py-2 hover:opacity-90 transition-opacity">
                    <Plus size={16} /> New Review
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
                {[
                    { label: "Initiated", value: initiated, color: "#3b82f6", bg: "#eff6ff", icon: <BarChart2 size={18} /> },
                    { label: "Submitted", value: submitted, color: "#f59e0b", bg: "#fffbeb", icon: <Clock size={18} /> },
                    { label: "Completed", value: completed, color: "#1a9e6e", bg: "#e8f7f1", icon: <CheckCircle size={18} /> },
                    { label: "Avg Score", value: avgScore, color: "#8b5cf6", bg: "#faf5ff", icon: <Star size={18} /> },
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
                <div className="relative">
                    <select value={periodFilter} onChange={e => setPeriodFilter(e.target.value)}
                        className="h-9 rounded-[8px] border border-[var(--border)] bg-white pl-3 pr-8 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors appearance-none">
                        <option value="">All Periods</option>
                        {PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text3)] pointer-events-none" />
                </div>
            </div>

            {/* Review Cards */}
            {loading ? (
                <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin text-[var(--accent)]" /></div>
            ) : filtered.length === 0 ? (
                <div className="flex min-h-[250px] flex-col items-center justify-center rounded-[14px] bg-white border border-dashed border-[var(--border)]">
                    <Star size={36} className="text-[var(--text3)] mb-2" />
                    <p className="text-[14px] font-semibold text-[var(--text)]">No reviews found</p>
                    <p className="text-[13px] text-[var(--text3)] mt-1">Create a new performance review to get started</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filtered.map(review => {
                        const statusStyle = STATUS_CONFIG[review.status] || STATUS_CONFIG.DRAFT
                        const ratingStyle = review.rating ? (RATING_CONFIG[review.rating] || { color: "#6b7280", bg: "#f9fafb" }) : { color: "#6b7280", bg: "#f9fafb" }

                        return (
                            <div key={review.id}
                                onClick={() => setSelectedReview(review)}
                                className="bg-white border border-[var(--border)] rounded-[12px] p-4 cursor-pointer hover:border-[var(--accent)] hover:shadow-sm transition-all">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-2.5">
                                        <Avatar firstName={review.employee.firstName} lastName={review.employee.lastName} photo={review.employee.photo} size={38} />
                                        <div>
                                            <p className="text-[13px] font-semibold text-[var(--text)]">{review.employee.firstName} {review.employee.lastName}</p>
                                            <p className="text-[11px] text-[var(--text3)]">{review.employee.designation || review.employee.branch.name}</p>
                                        </div>
                                    </div>
                                    <ScoreCircle score={review.totalScore} />
                                </div>

                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[11px] text-[var(--text3)]">{review.period} · {review.reviewType}</p>
                                        <p className="text-[11px] text-[var(--text3)] mt-0.5">{format(new Date(review.createdAt), "dd MMM yyyy")}</p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        {review.rating && (
                                            <span style={ratingStyle} className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full">{review.rating}</span>
                                        )}
                                        <span style={{ color: statusStyle.color, background: statusStyle.bg }} className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full">{statusStyle.label}</span>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            <NewReviewModal open={showNew} onClose={() => setShowNew(false)} onSaved={fetchReviews} />
            {selectedReview && (
                <ReviewDetailDrawer
                    review={selectedReview}
                    onClose={() => setSelectedReview(null)}
                    onUpdated={fetchReviews}
                />
            )}
        </div>
    )
}
