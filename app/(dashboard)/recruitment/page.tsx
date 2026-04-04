"use client"
import { useState, useEffect, useMemo } from "react"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import {
    Plus, Search, Phone, Mail, MapPin, Calendar, Users,
    Target, Trophy, X, ChevronRight, Briefcase,
    MessageSquare, PhoneCall, Send, Star, Clock, Filter,
    Edit2, Trash2, CheckCircle, AlertCircle, Loader2,
    StickyNote, MoreVertical, ArrowRight, GraduationCap,
    Award, UserCheck, UserX, Banknote, Building2, Wrench,
    Video, ChevronDown
} from "lucide-react"
import { format, formatDistanceToNow, parseISO } from "date-fns"

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUSES = [
    { key: "APPLIED",              label: "Applied",             color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe" },
    { key: "SCREENING",            label: "Screening",           color: "#8b5cf6", bg: "#f5f3ff", border: "#ddd6fe" },
    { key: "INTERVIEW_SCHEDULED",  label: "Interview Scheduled", color: "#f59e0b", bg: "#fffbeb", border: "#fde68a" },
    { key: "INTERVIEW_DONE",       label: "Interview Done",      color: "#06b6d4", bg: "#ecfeff", border: "#a5f3fc" },
    { key: "SELECTED",             label: "Selected",            color: "#1a9e6e", bg: "#e8f7f1", border: "#6ee7b7" },
    { key: "ONBOARDED",            label: "Onboarded ✓",         color: "#15803d", bg: "#f0fdf4", border: "#86efac" },
    { key: "REJECTED",             label: "Rejected",            color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb" },
]

const PRIORITY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
    HIGH:   { label: "High",   color: "#dc2626", dot: "bg-[#dc2626]" },
    MEDIUM: { label: "Medium", color: "#f59e0b", dot: "bg-[#f59e0b]" },
    LOW:    { label: "Low",    color: "#1a9e6e", dot: "bg-[#1a9e6e]" },
}

const ACTIVITY_TYPES = [
    { key: "note",      label: "Note",      icon: StickyNote,   color: "#6b7280" },
    { key: "call",      label: "Call",      icon: PhoneCall,    color: "#3b82f6" },
    { key: "whatsapp",  label: "WhatsApp",  icon: MessageSquare,color: "#25d366" },
    { key: "email",     label: "Email",     icon: Send,         color: "#8b5cf6" },
    { key: "interview", label: "Interview", icon: UserCheck,    color: "#f59e0b" },
]

const POSITIONS = [
    "Inspector", "Senior Inspector", "Lead Inspector",
    "Security Guard", "Security Supervisor",
    "Driver", "Heavy Vehicle Driver",
    "Supervisor", "Team Leader",
    "Helper / Labour", "Electrician", "Plumber",
    "Housekeeping Staff", "Peon / Office Boy",
    "Data Entry Operator", "Other"
]

const SOURCES = ["Walk-in", "LinkedIn", "Naukri", "Indeed", "Referral", "WhatsApp", "Agency", "Newspaper Ad", "Other"]

const QUALIFICATIONS = ["8th Pass", "10th Pass", "12th Pass", "ITI", "Diploma", "Graduate", "Post Graduate", "Other"]

const INTERVIEW_MODES = ["In-person", "Phone", "Video Call", "WhatsApp Video"]

// ─── Types ────────────────────────────────────────────────────────────────────

interface Lead {
    id: string
    candidateName: string
    phone: string
    email?: string
    city?: string
    position: string
    experience?: number
    currentCompany?: string
    qualification?: string
    skills?: string
    expectedSalary?: number
    currentSalary?: number
    interviewDate?: string
    interviewMode?: string
    source: string
    status: string
    priority: string
    assignedTo?: string
    notes?: string
    nextFollowUp?: string
    createdAt: string
    updatedAt: string
    assignee?: { id: string; name: string; email: string }
    creator?: { id: string; name: string }
    activities?: Activity[]
    _count?: { activities: number }
}

interface Activity {
    id: string
    type: string
    content: string
    createdAt: string
    user: { id: string; name: string }
}

interface User {
    id: string
    name: string
    email: string
    role: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(date: string | null | undefined) {
    if (!date) return "—"
    try { return format(parseISO(date), "dd MMM yyyy") } catch { return "—" }
}

function fmtSalary(val?: number | null) {
    if (!val) return null
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L/yr`
    return `₹${val.toLocaleString("en-IN")}/mo`
}

function StatusBadge({ status }: { status: string }) {
    const s = STATUSES.find(x => x.key === status) ?? STATUSES[0]
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border"
            style={{ color: s.color, background: s.bg, borderColor: s.border }}>
            {s.label}
        </span>
    )
}

function PriorityDot({ priority }: { priority: string }) {
    const p = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.MEDIUM
    return <span className={`inline-block w-2 h-2 rounded-full ${p.dot}`} title={p.label} />
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LeadsPage() {
    const { data: session } = useSession()
    const [leads, setLeads] = useState<Lead[]>([])
    const [users, setUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(true)
    const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban")
    const [searchQ, setSearchQ] = useState("")
    const [filterStatus, setFilterStatus] = useState("ALL")
    const [filterPriority, setFilterPriority] = useState("ALL")
    const [showForm, setShowForm] = useState(false)
    const [editLead, setEditLead] = useState<Lead | null>(null)
    const [detailLead, setDetailLead] = useState<Lead | null>(null)
    const [saving, setSaving] = useState(false)
    const [activityContent, setActivityContent] = useState("")
    const [activityType, setActivityType] = useState("note")
    const [savingActivity, setSavingActivity] = useState(false)

    const emptyForm = {
        candidateName: "", phone: "", email: "", city: "",
        position: "", experience: "", currentCompany: "", qualification: "",
        skills: "", expectedSalary: "", currentSalary: "",
        interviewDate: "", interviewMode: "", source: "", priority: "MEDIUM",
        assignedTo: "", notes: "", nextFollowUp: ""
    }
    const [form, setForm] = useState(emptyForm)

    // ── Fetch ──────────────────────────────────────────────────────────────────
    async function fetchLeads() {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (filterStatus !== "ALL") params.set("status", filterStatus)
            if (filterPriority !== "ALL") params.set("priority", filterPriority)
            if (searchQ) params.set("search", searchQ)
            const res = await fetch(`/api/leads?${params}`)
            if (!res.ok) throw new Error()
            setLeads(await res.json())
        } catch {
            toast.error("Failed to load candidates")
        } finally { setLoading(false) }
    }

    async function fetchUsers() {
        try {
            const res = await fetch("/api/admin/users")
            if (!res.ok) return
            const data = await res.json()
            setUsers((data.users ?? data).filter((u: User) => u.role === "ADMIN" || u.role === "MANAGER"))
        } catch {}
    }

    useEffect(() => { fetchLeads() }, [filterStatus, filterPriority, searchQ])
    useEffect(() => { fetchUsers() }, [])

    // ── Stats ──────────────────────────────────────────────────────────────────
    const stats = useMemo(() => {
        const total = leads.length
        const selected = leads.filter(l => l.status === "SELECTED" || l.status === "ONBOARDED").length
        const onboarded = leads.filter(l => l.status === "ONBOARDED").length
        const interviews = leads.filter(l => l.status === "INTERVIEW_SCHEDULED").length
        return { total, selected, onboarded, interviews }
    }, [leads])

    // ── Form Handlers ──────────────────────────────────────────────────────────
    function openAddForm() {
        setEditLead(null)
        setForm(emptyForm)
        setShowForm(true)
    }

    function openEditForm(lead: Lead) {
        setEditLead(lead)
        setForm({
            candidateName: lead.candidateName ?? "",
            phone: lead.phone ?? "",
            email: lead.email ?? "",
            city: lead.city ?? "",
            position: lead.position ?? "",
            experience: lead.experience?.toString() ?? "",
            currentCompany: lead.currentCompany ?? "",
            qualification: lead.qualification ?? "",
            skills: lead.skills ?? "",
            expectedSalary: lead.expectedSalary?.toString() ?? "",
            currentSalary: lead.currentSalary?.toString() ?? "",
            interviewDate: lead.interviewDate ? lead.interviewDate.slice(0, 16) : "",
            interviewMode: lead.interviewMode ?? "",
            source: lead.source ?? "",
            priority: lead.priority ?? "MEDIUM",
            assignedTo: lead.assignedTo ?? "",
            notes: lead.notes ?? "",
            nextFollowUp: lead.nextFollowUp ? lead.nextFollowUp.slice(0, 10) : "",
        })
        setShowForm(true)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)
        try {
            const url = editLead ? `/api/leads/${editLead.id}` : "/api/leads"
            const method = editLead ? "PATCH" : "POST"
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form)
            })
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error ?? "Failed")
            }
            const saved = await res.json()
            if (editLead) {
                setLeads(prev => prev.map(l => l.id === saved.id ? saved : l))
                if (detailLead?.id === saved.id) setDetailLead(saved)
                toast.success("Candidate updated")
            } else {
                setLeads(prev => [saved, ...prev])
                toast.success("Candidate added")
            }
            setShowForm(false)
        } catch (err: any) {
            toast.error(err.message ?? "Error saving")
        } finally { setSaving(false) }
    }

    async function handleStatusChange(leadId: string, status: string) {
        try {
            const res = await fetch(`/api/leads/${leadId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status })
            })
            if (!res.ok) throw new Error()
            const updated = await res.json()
            setLeads(prev => prev.map(l => l.id === leadId ? updated : l))
            if (detailLead?.id === leadId) setDetailLead(updated)
            toast.success("Status updated")
        } catch {
            toast.error("Failed to update status")
        }
    }

    async function handleDelete(leadId: string) {
        if (!confirm("Delete this candidate?")) return
        try {
            const res = await fetch(`/api/leads/${leadId}`, { method: "DELETE" })
            if (!res.ok) throw new Error()
            setLeads(prev => prev.filter(l => l.id !== leadId))
            if (detailLead?.id === leadId) setDetailLead(null)
            toast.success("Deleted")
        } catch {
            toast.error("Failed to delete")
        }
    }

    async function handleAddActivity() {
        if (!activityContent.trim() || !detailLead) return
        setSavingActivity(true)
        try {
            const res = await fetch(`/api/leads/${detailLead.id}/activity`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: activityType, content: activityContent.trim() })
            })
            if (!res.ok) throw new Error()
            const act = await res.json()
            setDetailLead(prev => prev ? { ...prev, activities: [act, ...(prev.activities ?? [])] } : prev)
            setActivityContent("")
            toast.success("Note added")
        } catch {
            toast.error("Failed to add note")
        } finally { setSavingActivity(false) }
    }

    async function openDetail(lead: Lead) {
        try {
            const res = await fetch(`/api/leads/${lead.id}`)
            if (!res.ok) throw new Error()
            setDetailLead(await res.json())
        } catch {
            setDetailLead(lead)
        }
    }

    // ── Filtered leads per status (for kanban) ─────────────────────────────────
    const leadsByStatus = useMemo(() => {
        const map: Record<string, Lead[]> = {}
        STATUSES.forEach(s => { map[s.key] = [] })
        leads.forEach(l => { if (map[l.status]) map[l.status].push(l) })
        return map
    }, [leads])

    // ─────────────────────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col gap-0 min-h-full">

            {/* ── Header ── */}
            <div className="px-4 pt-5 pb-4 lg:px-0 lg:pt-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h1 className="text-[22px] font-bold text-[var(--text)] tracking-tight">Candidate Pipeline</h1>
                        <p className="text-[13px] text-[var(--text2)] mt-0.5">Track candidates from application to onboarding</p>
                    </div>
                    <button
                        onClick={openAddForm}
                        className="flex items-center gap-2 h-9 px-4 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-[13px] font-semibold rounded-[8px] transition-colors active:scale-95 shrink-0"
                    >
                        <Plus size={16} />
                        Add Candidate
                    </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                    {[
                        { label: "TOTAL CANDIDATES", value: stats.total, icon: Users, color: "#3b82f6" },
                        { label: "INTERVIEWS TODAY", value: stats.interviews, icon: Calendar, color: "#f59e0b" },
                        { label: "SELECTED", value: stats.selected, icon: UserCheck, color: "#1a9e6e" },
                        { label: "ONBOARDED", value: stats.onboarded, icon: Award, color: "#15803d" },
                    ].map(s => (
                        <div key={s.label} className="bg-white border border-[var(--border)] rounded-[12px] p-4">
                            <p className="text-[10px] font-semibold text-[var(--text3)] tracking-wider uppercase">{s.label}</p>
                            <p className="text-[28px] font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Toolbar ── */}
            <div className="px-4 pb-3 lg:px-0 flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                    {/* View toggle */}
                    <div className="flex bg-[var(--surface2)] rounded-[8px] p-0.5 border border-[var(--border)]">
                        {(["kanban", "list"] as const).map(v => (
                            <button key={v} onClick={() => setViewMode(v)}
                                className={`px-3 py-1.5 text-[12px] font-medium rounded-[6px] transition-all capitalize ${viewMode === v ? "bg-white text-[var(--text)] shadow-sm" : "text-[var(--text3)]"}`}>
                                {v === "kanban" ? "Board" : "List"}
                            </button>
                        ))}
                    </div>

                    {/* Status filter */}
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                        className="h-8 px-2 text-[12px] border border-[var(--border)] rounded-[7px] bg-white text-[var(--text2)] focus:outline-none">
                        <option value="ALL">All Stages</option>
                        {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>

                    {/* Priority filter */}
                    <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
                        className="h-8 px-2 text-[12px] border border-[var(--border)] rounded-[7px] bg-white text-[var(--text2)] focus:outline-none">
                        <option value="ALL">All Priority</option>
                        <option value="HIGH">High</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="LOW">Low</option>
                    </select>
                </div>

                {/* Search */}
                <div className="relative w-full sm:w-56">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text3)]" />
                    <input
                        value={searchQ}
                        onChange={e => setSearchQ(e.target.value)}
                        placeholder="Search candidates..."
                        className="w-full h-8 pl-8 pr-3 text-[12px] border border-[var(--border)] rounded-[7px] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] bg-white"
                    />
                </div>
            </div>

            {/* ── Content ── */}
            {loading ? (
                <div className="flex items-center justify-center flex-1 py-24">
                    <Loader2 size={32} className="animate-spin text-[var(--accent)]" />
                </div>
            ) : leads.length === 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 py-24 gap-3">
                    <div className="w-14 h-14 bg-[var(--surface2)] rounded-full flex items-center justify-center">
                        <Users size={24} className="text-[var(--text3)]" />
                    </div>
                    <p className="text-[14px] font-medium text-[var(--text2)]">No candidates yet</p>
                    <button onClick={openAddForm} className="text-[13px] text-[var(--accent)] hover:underline">Add first candidate</button>
                </div>
            ) : viewMode === "kanban" ? (
                <KanbanView leads={leadsByStatus} onCard={openDetail} onStatusChange={handleStatusChange} />
            ) : (
                <ListView leads={leads} onCard={openDetail} onEdit={openEditForm} onDelete={handleDelete} session={session} />
            )}

            {/* ── Add/Edit Modal ── */}
            {showForm && (
                <Modal onClose={() => setShowForm(false)} title={editLead ? "Edit Candidate" : "Add Candidate"} wide>
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        {/* Basic Info */}
                        <div>
                            <p className="text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wider mb-2">Basic Info</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Field label="Candidate Name *">
                                    <input required value={form.candidateName} onChange={e => setForm(p => ({ ...p, candidateName: e.target.value }))}
                                        placeholder="Full name" className={inputCls} />
                                </Field>
                                <Field label="Phone *">
                                    <input required value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                                        placeholder="Mobile number" className={inputCls} />
                                </Field>
                                <Field label="Email">
                                    <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                                        placeholder="Email address" className={inputCls} />
                                </Field>
                                <Field label="City">
                                    <input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))}
                                        placeholder="City / Location" className={inputCls} />
                                </Field>
                            </div>
                        </div>

                        {/* Job Info */}
                        <div>
                            <p className="text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wider mb-2">Job Details</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Field label="Position Applied For *">
                                    <select required value={form.position} onChange={e => setForm(p => ({ ...p, position: e.target.value }))} className={inputCls}>
                                        <option value="">Select position</option>
                                        {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </Field>
                                <Field label="Experience (Years)">
                                    <input type="number" step="0.5" min="0" value={form.experience} onChange={e => setForm(p => ({ ...p, experience: e.target.value }))}
                                        placeholder="e.g. 2.5" className={inputCls} />
                                </Field>
                                <Field label="Current / Previous Company">
                                    <input value={form.currentCompany} onChange={e => setForm(p => ({ ...p, currentCompany: e.target.value }))}
                                        placeholder="Company name" className={inputCls} />
                                </Field>
                                <Field label="Qualification">
                                    <select value={form.qualification} onChange={e => setForm(p => ({ ...p, qualification: e.target.value }))} className={inputCls}>
                                        <option value="">Select qualification</option>
                                        {QUALIFICATIONS.map(q => <option key={q} value={q}>{q}</option>)}
                                    </select>
                                </Field>
                                <Field label="Skills / Certifications">
                                    <input value={form.skills} onChange={e => setForm(p => ({ ...p, skills: e.target.value }))}
                                        placeholder="e.g. Driving License, Forklift, First Aid" className={inputCls} />
                                </Field>
                                <Field label="Source *">
                                    <select required value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))} className={inputCls}>
                                        <option value="">How did they apply?</option>
                                        {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </Field>
                            </div>
                        </div>

                        {/* Salary & Interview */}
                        <div>
                            <p className="text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wider mb-2">Salary & Interview</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Field label="Current Salary (₹)">
                                    <input type="number" min="0" value={form.currentSalary} onChange={e => setForm(p => ({ ...p, currentSalary: e.target.value }))}
                                        placeholder="Monthly / Annual" className={inputCls} />
                                </Field>
                                <Field label="Expected Salary (₹)">
                                    <input type="number" min="0" value={form.expectedSalary} onChange={e => setForm(p => ({ ...p, expectedSalary: e.target.value }))}
                                        placeholder="Monthly / Annual" className={inputCls} />
                                </Field>
                                <Field label="Interview Date & Time">
                                    <input type="datetime-local" value={form.interviewDate} onChange={e => setForm(p => ({ ...p, interviewDate: e.target.value }))}
                                        className={inputCls} />
                                </Field>
                                <Field label="Interview Mode">
                                    <select value={form.interviewMode} onChange={e => setForm(p => ({ ...p, interviewMode: e.target.value }))} className={inputCls}>
                                        <option value="">Select mode</option>
                                        {INTERVIEW_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </Field>
                            </div>
                        </div>

                        {/* Assignment & Follow-up */}
                        <div>
                            <p className="text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wider mb-2">Assignment & Follow-up</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Field label="Priority">
                                    <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} className={inputCls}>
                                        <option value="HIGH">High</option>
                                        <option value="MEDIUM">Medium</option>
                                        <option value="LOW">Low</option>
                                    </select>
                                </Field>
                                <Field label="Assign To">
                                    <select value={form.assignedTo} onChange={e => setForm(p => ({ ...p, assignedTo: e.target.value }))} className={inputCls}>
                                        <option value="">Unassigned</option>
                                        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                    </select>
                                </Field>
                                <Field label="Next Follow-up Date">
                                    <input type="date" value={form.nextFollowUp} onChange={e => setForm(p => ({ ...p, nextFollowUp: e.target.value }))}
                                        className={inputCls} />
                                </Field>
                            </div>
                        </div>

                        {/* Notes */}
                        <Field label="Notes">
                            <textarea rows={3} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                                placeholder="Any remarks about the candidate..."
                                className={`${inputCls} resize-none`} />
                        </Field>

                        <div className="flex gap-2 justify-end pt-1 border-t border-[var(--border)]">
                            <button type="button" onClick={() => setShowForm(false)}
                                className="h-9 px-4 text-[13px] font-medium text-[var(--text2)] border border-[var(--border)] rounded-[7px] hover:bg-[var(--surface2)] transition-colors">
                                Cancel
                            </button>
                            <button type="submit" disabled={saving}
                                className="h-9 px-5 text-[13px] font-semibold bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-[7px] transition-colors flex items-center gap-2 disabled:opacity-60">
                                {saving && <Loader2 size={14} className="animate-spin" />}
                                {editLead ? "Save Changes" : "Add Candidate"}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* ── Detail Drawer ── */}
            {detailLead && (
                <DetailDrawer
                    lead={detailLead}
                    session={session}
                    users={users}
                    activityContent={activityContent}
                    activityType={activityType}
                    savingActivity={savingActivity}
                    onClose={() => setDetailLead(null)}
                    onEdit={() => { openEditForm(detailLead); setDetailLead(null) }}
                    onDelete={() => handleDelete(detailLead.id)}
                    onStatusChange={(s) => handleStatusChange(detailLead.id, s)}
                    onActivityTypeChange={setActivityType}
                    onActivityContentChange={setActivityContent}
                    onAddActivity={handleAddActivity}
                />
            )}
        </div>
    )
}

// ─── Input CSS ────────────────────────────────────────────────────────────────
const inputCls = "w-full h-9 px-3 text-[13px] border border-[var(--border)] rounded-[7px] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] bg-white text-[var(--text)]"

// ─── Field Wrapper ────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-[var(--text2)]">{label}</label>
            {children}
        </div>
    )
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function Modal({ children, onClose, title, wide }: { children: React.ReactNode; onClose: () => void; title: string; wide?: boolean }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className={`relative bg-white rounded-[16px] shadow-xl w-full max-h-[90vh] overflow-y-auto ${wide ? "max-w-2xl" : "max-w-md"}`}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] sticky top-0 bg-white z-10">
                    <h2 className="text-[16px] font-bold text-[var(--text)]">{title}</h2>
                    <button onClick={onClose} className="p-1.5 rounded-[6px] hover:bg-[var(--surface2)] text-[var(--text3)] transition-colors">
                        <X size={18} />
                    </button>
                </div>
                <div className="px-6 py-4">{children}</div>
            </div>
        </div>
    )
}

// ─── Kanban View ──────────────────────────────────────────────────────────────
function KanbanView({
    leads, onCard, onStatusChange
}: {
    leads: Record<string, Lead[]>
    onCard: (l: Lead) => void
    onStatusChange: (id: string, s: string) => void
}) {
    return (
        <div className="flex gap-3 overflow-x-auto pb-4 px-4 lg:px-0 flex-1">
            {STATUSES.map(status => (
                <div key={status.key} className="flex flex-col shrink-0 w-[240px]">
                    {/* Column header */}
                    <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-[8px]"
                        style={{ background: status.bg, border: `1px solid ${status.border}` }}>
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: status.color }} />
                        <span className="text-[12px] font-semibold flex-1 truncate" style={{ color: status.color }}>{status.label}</span>
                        <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-white/70" style={{ color: status.color }}>
                            {leads[status.key]?.length ?? 0}
                        </span>
                    </div>
                    {/* Cards */}
                    <div className="flex flex-col gap-2">
                        {(leads[status.key] ?? []).map(lead => (
                            <KanbanCard key={lead.id} lead={lead} onCard={onCard} statusColor={status.color} />
                        ))}
                        {(leads[status.key] ?? []).length === 0 && (
                            <div className="border-2 border-dashed border-[var(--border)] rounded-[10px] py-6 flex items-center justify-center">
                                <p className="text-[11px] text-[var(--text3)]">No candidates</p>
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    )
}

function KanbanCard({ lead, onCard, statusColor }: { lead: Lead; onCard: (l: Lead) => void; statusColor: string }) {
    return (
        <div onClick={() => onCard(lead)}
            className="bg-white border border-[var(--border)] rounded-[10px] p-3 cursor-pointer hover:shadow-md hover:border-[var(--accent)] transition-all group">
            {/* Name + priority */}
            <div className="flex items-start justify-between gap-1 mb-1">
                <p className="text-[13px] font-semibold text-[var(--text)] leading-tight line-clamp-1">{lead.candidateName}</p>
                <PriorityDot priority={lead.priority} />
            </div>
            {/* Position */}
            <div className="flex items-center gap-1 text-[11px] text-[var(--text2)] mb-2">
                <Briefcase size={10} className="shrink-0" />
                <span className="truncate">{lead.position}</span>
            </div>
            {/* Details */}
            <div className="flex flex-col gap-1">
                {lead.experience != null && (
                    <span className="text-[11px] text-[var(--text3)]">{lead.experience}y exp</span>
                )}
                {lead.phone && (
                    <div className="flex items-center gap-1 text-[11px] text-[var(--text3)]">
                        <Phone size={10} />
                        <span>{lead.phone}</span>
                    </div>
                )}
                {lead.city && (
                    <div className="flex items-center gap-1 text-[11px] text-[var(--text3)]">
                        <MapPin size={10} />
                        <span>{lead.city}</span>
                    </div>
                )}
                {lead.interviewDate && (
                    <div className="flex items-center gap-1 text-[11px] text-[#f59e0b]">
                        <Calendar size={10} />
                        <span>{fmt(lead.interviewDate)}</span>
                    </div>
                )}
            </div>
            {/* Footer */}
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--border)]">
                <span className="text-[10px] text-[var(--text3)] bg-[var(--surface2)] px-1.5 py-0.5 rounded-full">{lead.source}</span>
                {lead._count?.activities ? (
                    <span className="text-[10px] text-[var(--text3)] flex items-center gap-0.5">
                        <MessageSquare size={9} />
                        {lead._count.activities}
                    </span>
                ) : null}
            </div>
        </div>
    )
}

// ─── List View ────────────────────────────────────────────────────────────────
function ListView({ leads, onCard, onEdit, onDelete, session }: {
    leads: Lead[]
    onCard: (l: Lead) => void
    onEdit: (l: Lead) => void
    onDelete: (id: string) => void
    session: any
}) {
    return (
        <div className="px-4 lg:px-0 flex flex-col gap-2">
            {leads.map(lead => (
                <div key={lead.id} onClick={() => onCard(lead)}
                    className="bg-white border border-[var(--border)] rounded-[12px] p-4 cursor-pointer hover:shadow-sm hover:border-[var(--accent)] transition-all flex items-center gap-4">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-[var(--accent-light)] flex items-center justify-center shrink-0 text-[var(--accent)] font-bold text-[14px]">
                        {lead.candidateName.charAt(0).toUpperCase()}
                    </div>
                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <p className="text-[14px] font-semibold text-[var(--text)] truncate">{lead.candidateName}</p>
                            <PriorityDot priority={lead.priority} />
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            <span className="text-[12px] text-[var(--text2)] flex items-center gap-1">
                                <Briefcase size={11} />{lead.position}
                            </span>
                            {lead.experience != null && (
                                <span className="text-[12px] text-[var(--text3)]">{lead.experience}y exp</span>
                            )}
                            {lead.city && (
                                <span className="text-[12px] text-[var(--text3)] flex items-center gap-1">
                                    <MapPin size={11} />{lead.city}
                                </span>
                            )}
                            {lead.phone && (
                                <span className="text-[12px] text-[var(--text3)] flex items-center gap-1">
                                    <Phone size={11} />{lead.phone}
                                </span>
                            )}
                        </div>
                    </div>
                    {/* Status + meta */}
                    <div className="flex items-center gap-3 shrink-0">
                        {lead.interviewDate && (
                            <span className="text-[11px] text-[#f59e0b] flex items-center gap-1 hidden sm:flex">
                                <Calendar size={11} />{fmt(lead.interviewDate)}
                            </span>
                        )}
                        <StatusBadge status={lead.status} />
                        <span className="text-[11px] text-[var(--text3)] hidden md:block">{lead.source}</span>
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <button onClick={() => onEdit(lead)} className="p-1.5 rounded-[6px] hover:bg-[var(--surface2)] text-[var(--text3)] transition-colors">
                                <Edit2 size={13} />
                            </button>
                            {session?.user?.role === "ADMIN" && (
                                <button onClick={() => onDelete(lead.id)} className="p-1.5 rounded-[6px] hover:bg-red-50 text-[var(--text3)] hover:text-red-500 transition-colors">
                                    <Trash2 size={13} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}

// ─── Detail Drawer ────────────────────────────────────────────────────────────
function DetailDrawer({ lead, session, users, activityContent, activityType, savingActivity,
    onClose, onEdit, onDelete, onStatusChange, onActivityTypeChange, onActivityContentChange, onAddActivity }: {
    lead: Lead
    session: any
    users: User[]
    activityContent: string
    activityType: string
    savingActivity: boolean
    onClose: () => void
    onEdit: () => void
    onDelete: () => void
    onStatusChange: (s: string) => void
    onActivityTypeChange: (t: string) => void
    onActivityContentChange: (c: string) => void
    onAddActivity: () => void
}) {
    return (
        <div className="fixed inset-0 z-50 flex">
            <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] sticky top-0 bg-white z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[var(--accent-light)] flex items-center justify-center text-[var(--accent)] font-bold text-[15px]">
                            {lead.candidateName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <p className="text-[15px] font-bold text-[var(--text)]">{lead.candidateName}</p>
                            <p className="text-[12px] text-[var(--text2)]">{lead.position}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button onClick={onEdit} className="p-1.5 rounded-[7px] hover:bg-[var(--surface2)] text-[var(--text3)] transition-colors">
                            <Edit2 size={15} />
                        </button>
                        {session?.user?.role === "ADMIN" && (
                            <button onClick={onDelete} className="p-1.5 rounded-[7px] hover:bg-red-50 text-[var(--text3)] hover:text-red-500 transition-colors">
                                <Trash2 size={15} />
                            </button>
                        )}
                        <button onClick={onClose} className="p-1.5 rounded-[7px] hover:bg-[var(--surface2)] text-[var(--text3)] transition-colors">
                            <X size={17} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {/* Status pipeline */}
                    <div className="px-5 py-4 border-b border-[var(--border)]">
                        <p className="text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wider mb-3">Recruitment Stage</p>
                        <div className="flex flex-wrap gap-1.5">
                            {STATUSES.map(s => (
                                <button key={s.key} onClick={() => onStatusChange(s.key)}
                                    className="px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all"
                                    style={lead.status === s.key
                                        ? { background: s.color, color: "#fff", borderColor: s.color }
                                        : { background: s.bg, color: s.color, borderColor: s.border }
                                    }>
                                    {s.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Info grid */}
                    <div className="px-5 py-4 border-b border-[var(--border)]">
                        <p className="text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wider mb-3">Candidate Details</p>
                        <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                            <InfoRow icon={Phone} label="Phone" value={lead.phone} />
                            {lead.email && <InfoRow icon={Mail} label="Email" value={lead.email} />}
                            {lead.city && <InfoRow icon={MapPin} label="City" value={lead.city} />}
                            {lead.experience != null && <InfoRow icon={Clock} label="Experience" value={`${lead.experience} years`} />}
                            {lead.currentCompany && <InfoRow icon={Building2} label="Prev Company" value={lead.currentCompany} />}
                            {lead.qualification && <InfoRow icon={GraduationCap} label="Qualification" value={lead.qualification} />}
                            {lead.skills && <InfoRow icon={Wrench} label="Skills" value={lead.skills} />}
                            <InfoRow icon={Target} label="Source" value={lead.source} />
                            {lead.currentSalary && <InfoRow icon={Banknote} label="Current CTC" value={fmtSalary(lead.currentSalary) ?? ""} />}
                            {lead.expectedSalary && <InfoRow icon={Banknote} label="Expected CTC" value={fmtSalary(lead.expectedSalary) ?? ""} />}
                            {lead.interviewDate && <InfoRow icon={Calendar} label="Interview" value={`${fmt(lead.interviewDate)}${lead.interviewMode ? ` · ${lead.interviewMode}` : ""}`} />}
                            {lead.nextFollowUp && <InfoRow icon={Clock} label="Follow-up" value={fmt(lead.nextFollowUp)} />}
                            {lead.assignee && <InfoRow icon={UserCheck} label="Assigned To" value={lead.assignee.name} />}
                        </div>
                        {lead.notes && (
                            <div className="mt-3 p-3 bg-[var(--surface2)] rounded-[8px]">
                                <p className="text-[11px] font-semibold text-[var(--text3)] mb-1">Notes</p>
                                <p className="text-[12px] text-[var(--text2)]">{lead.notes}</p>
                            </div>
                        )}
                    </div>

                    {/* Activity log */}
                    <div className="px-5 py-4">
                        <p className="text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wider mb-3">Activity Log</p>

                        {/* Add activity */}
                        <div className="border border-[var(--border)] rounded-[10px] p-3 mb-4 bg-[var(--surface2)]">
                            <div className="flex gap-1.5 mb-2 flex-wrap">
                                {ACTIVITY_TYPES.map(t => {
                                    const Icon = t.icon
                                    return (
                                        <button key={t.key} onClick={() => onActivityTypeChange(t.key)}
                                            className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium border transition-all"
                                            style={activityType === t.key
                                                ? { background: t.color, color: "#fff", borderColor: t.color }
                                                : { background: "#fff", color: t.color, borderColor: t.color + "55" }
                                            }>
                                            <Icon size={10} />
                                            {t.label}
                                        </button>
                                    )
                                })}
                            </div>
                            <textarea
                                rows={2}
                                value={activityContent}
                                onChange={e => onActivityContentChange(e.target.value)}
                                placeholder="Add a note, call summary, interview feedback..."
                                className="w-full text-[12px] border border-[var(--border)] rounded-[7px] px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-[var(--accent)] bg-white"
                            />
                            <div className="flex justify-end mt-2">
                                <button onClick={onAddActivity} disabled={savingActivity || !activityContent.trim()}
                                    className="flex items-center gap-1.5 h-8 px-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-[12px] font-semibold rounded-[6px] disabled:opacity-50 transition-colors">
                                    {savingActivity ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                                    Log
                                </button>
                            </div>
                        </div>

                        {/* Activities list */}
                        <div className="flex flex-col gap-2">
                            {(lead.activities ?? []).length === 0 && (
                                <p className="text-[12px] text-[var(--text3)] text-center py-4">No activity yet</p>
                            )}
                            {(lead.activities ?? []).map(act => {
                                const typeConf = ACTIVITY_TYPES.find(t => t.key === act.type) ?? ACTIVITY_TYPES[0]
                                const Icon = typeConf.icon
                                return (
                                    <div key={act.id} className="flex gap-3 items-start">
                                        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                                            style={{ background: typeConf.color + "20", color: typeConf.color }}>
                                            <Icon size={12} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[12px] font-semibold text-[var(--text)]">{act.user.name}</span>
                                                <span className="text-[10px] text-[var(--text3)]">
                                                    {formatDistanceToNow(parseISO(act.createdAt), { addSuffix: true })}
                                                </span>
                                            </div>
                                            <p className="text-[12px] text-[var(--text2)] mt-0.5">{act.content}</p>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
    return (
        <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-[var(--text3)] uppercase tracking-wide font-medium">{label}</span>
            <div className="flex items-center gap-1.5 text-[12px] text-[var(--text)]">
                <Icon size={11} className="text-[var(--text3)] shrink-0" />
                <span className="truncate">{value}</span>
            </div>
        </div>
    )
}
