"use client"
import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
    GraduationCap, Plus, Search, BookOpen, Users, CheckCircle,
    AlertTriangle, MoreVertical, X, Loader2,
    ExternalLink, Trash2, Edit2, Eye,
    TrendingUp
} from "lucide-react"
import { format } from "date-fns"

// ─── Types ────────────────────────────────────────────────────────────────────

type Course = {
    id: string
    courseCode: string
    title: string
    description?: string
    category: string
    duration: number
    passingScore: number
    isMandatory: boolean
    status: string
    thumbnail?: string
    createdAt: string
    _count: { enrollments: number; modules: number }
    enrolledCount: number
    passRate: number
}

type CourseModule = {
    id: string
    courseId: string
    title: string
    content?: string
    videoUrl?: string
    duration: number
    order: number
    isRequired: boolean
}

type CourseDetail = Course & {
    modules: CourseModule[]
    stats: { totalEnrolled: number; completed: number; inProgress: number; passRate: number }
}

type Enrollment = {
    id: string
    courseId: string
    employeeId: string
    enrolledAt: string
    startedAt?: string
    completedAt?: string
    dueDate?: string
    score?: number
    status: string
    progress: number
    certificate?: string
    employee: {
        id: string
        employeeId: string
        firstName: string
        lastName: string
        photo?: string
        designation?: string
    }
    course: {
        id: string
        courseCode: string
        title: string
        passingScore: number
        category: string
    }
}

type Employee = {
    id: string
    employeeId: string
    firstName: string
    lastName: string
    designation?: string
    photo?: string
    status: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = ["All", "Safety", "Security", "Compliance", "Soft Skills", "Technical", "Induction", "Other"]
const COURSE_STATUSES = ["All", "DRAFT", "PUBLISHED", "ARCHIVED"]
const ENROLLMENT_STATUSES = ["All", "ENROLLED", "IN_PROGRESS", "COMPLETED", "FAILED", "DROPPED"]

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    Safety:       { bg: "#fef3c7", text: "#b45309", border: "#fde68a" },
    Security:     { bg: "#ede9fe", text: "#6d28d9", border: "#ddd6fe" },
    Compliance:   { bg: "#dbeafe", text: "#1d4ed8", border: "#bfdbfe" },
    "Soft Skills":{ bg: "#fce7f3", text: "#be185d", border: "#fbcfe8" },
    Technical:    { bg: "#d1fae5", text: "#065f46", border: "#a7f3d0" },
    Induction:    { bg: "#e0f2fe", text: "#0369a1", border: "#bae6fd" },
    Other:        { bg: "#f3f4f6", text: "#374151", border: "#e5e7eb" },
}

const CATEGORY_STRIP: Record<string, string> = {
    Safety:       "#f59e0b",
    Security:     "#8b5cf6",
    Compliance:   "#3b82f6",
    "Soft Skills":"#ec4899",
    Technical:    "#10b981",
    Induction:    "#0ea5e9",
    Other:        "#6b7280",
}

const ENROLLMENT_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
    ENROLLED:    { label: "Enrolled",     color: "#1d4ed8", bg: "#dbeafe", border: "#bfdbfe" },
    IN_PROGRESS: { label: "In Progress",  color: "#b45309", bg: "#fef3c7", border: "#fde68a" },
    COMPLETED:   { label: "Completed",    color: "#065f46", bg: "#d1fae5", border: "#a7f3d0" },
    FAILED:      { label: "Failed",       color: "#dc2626", bg: "#fee2e2", border: "#fecaca" },
    DROPPED:     { label: "Dropped",      color: "#6b7280", bg: "#f3f4f6", border: "#e5e7eb" },
}

const COURSE_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    DRAFT:     { label: "Draft",     color: "#6b7280", bg: "#f3f4f6" },
    PUBLISHED: { label: "Published", color: "#065f46", bg: "#d1fae5" },
    ARCHIVED:  { label: "Archived",  color: "#b45309", bg: "#fef3c7" },
}

const AVATAR_COLORS = ["#1a9e6e", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#f97316"]

function getAvatarColor(name: string) {
    return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ firstName, lastName, photo, size = 36 }: {
    firstName: string; lastName: string; photo?: string; size?: number
}) {
    const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase()
    const bg = getAvatarColor(firstName)
    if (photo) {
        return (
            <img
                src={photo}
                alt={`${firstName} ${lastName}`}
                style={{ width: size, height: size }}
                className="rounded-full object-cover shrink-0"
            />
        )
    }
    return (
        <div
            style={{ width: size, height: size, background: bg, fontSize: size * 0.33 }}
            className="rounded-full flex items-center justify-center text-white font-semibold shrink-0 select-none"
        >
            {initials}
        </div>
    )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color }: {
    label: string; value: number | string; icon: React.ReactNode; color: string
}) {
    return (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[14px] p-5 flex items-center gap-4">
            <div className="h-12 w-12 rounded-[12px] flex items-center justify-center shrink-0" style={{ background: color + "22" }}>
                <div style={{ color }}>{icon}</div>
            </div>
            <div>
                <p className="text-[12px] text-[var(--text3)] font-medium">{label}</p>
                <p className="text-[24px] font-bold text-[var(--text)] leading-tight">{value}</p>
            </div>
        </div>
    )
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ value, color = "var(--accent)" }: { value: number; color?: string }) {
    return (
        <div className="w-full h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
            <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }}
            />
        </div>
    )
}

// ─── Course Modal ─────────────────────────────────────────────────────────────

type CourseForm = {
    title: string; category: string; description: string; duration: string
    passingScore: string; isMandatory: boolean; status: string
}

type ModuleForm = {
    title: string; content: string; videoUrl: string; duration: string; order: string
}

const EMPTY_COURSE_FORM: CourseForm = {
    title: "", category: "Safety", description: "", duration: "60",
    passingScore: "70", isMandatory: false, status: "DRAFT"
}

const EMPTY_MODULE_FORM: ModuleForm = {
    title: "", content: "", videoUrl: "", duration: "15", order: ""
}

function CourseModal({ open, onClose, onSaved, course }: {
    open: boolean
    onClose: () => void
    onSaved: () => void
    course?: Course | null
}) {
    const [activeTab, setActiveTab] = useState<"basic" | "modules">("basic")
    const [form, setForm] = useState<CourseForm>(EMPTY_COURSE_FORM)
    const [modules, setModules] = useState<CourseModule[]>([])
    const [moduleForm, setModuleForm] = useState<ModuleForm>(EMPTY_MODULE_FORM)
    const [loading, setLoading] = useState(false)
    const [addingModule, setAddingModule] = useState(false)
    const [showModuleForm, setShowModuleForm] = useState(false)

    useEffect(() => {
        if (!open) return
        setActiveTab("basic")
        if (course) {
            setForm({
                title: course.title,
                category: course.category,
                description: course.description || "",
                duration: course.duration.toString(),
                passingScore: course.passingScore.toString(),
                isMandatory: course.isMandatory,
                status: course.status,
            })
            // Load modules
            fetch(`/api/lms/courses/${course.id}/modules`)
                .then(r => r.json())
                .then(d => setModules(Array.isArray(d) ? d : []))
                .catch(() => setModules([]))
        } else {
            setForm(EMPTY_COURSE_FORM)
            setModules([])
        }
        setShowModuleForm(false)
        setModuleForm(EMPTY_MODULE_FORM)
    }, [course, open])

    const handleSave = async () => {
        if (!form.title.trim()) { toast.error("Title is required"); return }
        if (!form.category) { toast.error("Category is required"); return }
        setLoading(true)
        try {
            const url = course ? `/api/lms/courses/${course.id}` : "/api/lms/courses"
            const method = course ? "PUT" : "POST"
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            })
            if (!res.ok) { toast.error(await res.text()); return }
            toast.success(course ? "Course updated" : "Course created")
            onSaved()
            onClose()
        } catch {
            toast.error("Something went wrong")
        } finally {
            setLoading(false)
        }
    }

    const handleAddModule = async () => {
        if (!moduleForm.title.trim()) { toast.error("Module title is required"); return }
        if (!course) { toast.error("Save the course first"); return }
        setAddingModule(true)
        try {
            const res = await fetch(`/api/lms/courses/${course.id}/modules`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(moduleForm),
            })
            if (!res.ok) { toast.error(await res.text()); return }
            const mod = await res.json()
            setModules(prev => [...prev, mod])
            setModuleForm(EMPTY_MODULE_FORM)
            setShowModuleForm(false)
            toast.success("Module added")
        } catch {
            toast.error("Failed to add module")
        } finally {
            setAddingModule(false)
        }
    }

    const handleDeleteModule = async (moduleId: string) => {
        if (!course) return
        try {
            const res = await fetch(`/api/lms/courses/${course.id}/modules/${moduleId}`, { method: "DELETE" })
            if (!res.ok) { toast.error("Failed to delete module"); return }
            setModules(prev => prev.filter(m => m.id !== moduleId))
            toast.success("Module removed")
        } catch {
            toast.error("Failed to delete module")
        }
    }

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative bg-[var(--surface)] rounded-[16px] border border-[var(--border)] shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
                    <h2 className="text-[16px] font-semibold text-[var(--text)]">
                        {course ? "Edit Course" : "Create Course"}
                    </h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--surface2)] text-[var(--text3)]">
                        <X size={18} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-[var(--border)] px-6 shrink-0">
                    {(["basic", "modules"] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-3 text-[13px] font-medium border-b-2 transition-colors capitalize ${
                                activeTab === tab
                                    ? "border-[var(--accent)] text-[var(--accent)]"
                                    : "border-transparent text-[var(--text3)] hover:text-[var(--text2)]"
                            }`}
                        >
                            {tab === "basic" ? "Basic Info" : `Modules ${modules.length > 0 ? `(${modules.length})` : ""}`}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === "basic" && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[12px] font-medium text-[var(--text2)] mb-1.5">Title *</label>
                                <input
                                    value={form.title}
                                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                                    placeholder="e.g. Fire Safety Training"
                                    className="w-full h-10 px-3 rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] text-[13px] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[12px] font-medium text-[var(--text2)] mb-1.5">Category *</label>
                                    <select
                                        value={form.category}
                                        onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                                        className="w-full h-10 px-3 rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] text-[13px] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                                    >
                                        {CATEGORIES.filter(c => c !== "All").map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[12px] font-medium text-[var(--text2)] mb-1.5">Status</label>
                                    <select
                                        value={form.status}
                                        onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                                        className="w-full h-10 px-3 rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] text-[13px] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                                    >
                                        <option value="DRAFT">Draft</option>
                                        <option value="PUBLISHED">Published</option>
                                        <option value="ARCHIVED">Archived</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[12px] font-medium text-[var(--text2)] mb-1.5">Description</label>
                                <textarea
                                    value={form.description}
                                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                    placeholder="Course description..."
                                    rows={3}
                                    className="w-full px-3 py-2 rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] text-[13px] text-[var(--text)] focus:outline-none focus:border-[var(--accent)] resize-none"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[12px] font-medium text-[var(--text2)] mb-1.5">Duration (minutes)</label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={form.duration}
                                        onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}
                                        className="w-full h-10 px-3 rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] text-[13px] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[12px] font-medium text-[var(--text2)] mb-1.5">Passing Score (%)</label>
                                    <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={form.passingScore}
                                        onChange={e => setForm(f => ({ ...f, passingScore: e.target.value }))}
                                        className="w-full h-10 px-3 rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] text-[13px] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                                    />
                                </div>
                            </div>
                            <label className="flex items-center gap-3 p-3 rounded-[10px] border border-[var(--border)] bg-[var(--surface2)] cursor-pointer hover:border-[var(--accent)] transition-colors">
                                <input
                                    type="checkbox"
                                    checked={form.isMandatory}
                                    onChange={e => setForm(f => ({ ...f, isMandatory: e.target.checked }))}
                                    className="w-4 h-4 accent-[var(--accent)]"
                                />
                                <div>
                                    <p className="text-[13px] font-medium text-[var(--text)]">Mandatory Course</p>
                                    <p className="text-[11.5px] text-[var(--text3)]">All employees must complete this course</p>
                                </div>
                            </label>
                        </div>
                    )}

                    {activeTab === "modules" && (
                        <div className="space-y-3">
                            {!course && (
                                <div className="p-4 rounded-[10px] bg-[var(--surface2)] border border-[var(--border)] text-center">
                                    <p className="text-[13px] text-[var(--text3)]">Save the course first, then add modules.</p>
                                </div>
                            )}
                            {modules.map((mod, idx) => (
                                <div key={mod.id} className="flex items-start gap-3 p-3 rounded-[10px] border border-[var(--border)] bg-[var(--surface2)]">
                                    <div className="h-7 w-7 rounded-full bg-[var(--accent)] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                                        {idx + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[13px] font-medium text-[var(--text)]">{mod.title}</p>
                                        {mod.content && <p className="text-[11.5px] text-[var(--text3)] mt-0.5 line-clamp-1">{mod.content}</p>}
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-[11px] text-[var(--text3)]">⏱ {mod.duration} min</span>
                                            {mod.videoUrl && <span className="text-[11px] text-[var(--accent)]">▶ Video</span>}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDeleteModule(mod.id)}
                                        className="p-1 text-[var(--text3)] hover:text-[var(--red)] transition-colors"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}

                            {course && !showModuleForm && (
                                <button
                                    onClick={() => setShowModuleForm(true)}
                                    className="w-full h-10 border border-dashed border-[var(--border)] rounded-[10px] text-[13px] text-[var(--text3)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors flex items-center justify-center gap-2"
                                >
                                    <Plus size={15} /> Add Module
                                </button>
                            )}

                            {course && showModuleForm && (
                                <div className="p-4 rounded-[12px] border border-[var(--border)] bg-[var(--surface2)] space-y-3">
                                    <p className="text-[13px] font-semibold text-[var(--text)]">New Module</p>
                                    <input
                                        value={moduleForm.title}
                                        onChange={e => setModuleForm(f => ({ ...f, title: e.target.value }))}
                                        placeholder="Module title *"
                                        className="w-full h-9 px-3 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[13px] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                                    />
                                    <textarea
                                        value={moduleForm.content}
                                        onChange={e => setModuleForm(f => ({ ...f, content: e.target.value }))}
                                        placeholder="Content / notes"
                                        rows={2}
                                        className="w-full px-3 py-2 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[13px] text-[var(--text)] focus:outline-none focus:border-[var(--accent)] resize-none"
                                    />
                                    <input
                                        value={moduleForm.videoUrl}
                                        onChange={e => setModuleForm(f => ({ ...f, videoUrl: e.target.value }))}
                                        placeholder="Video URL (optional)"
                                        className="w-full h-9 px-3 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[13px] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                                    />
                                    <div className="grid grid-cols-2 gap-3">
                                        <input
                                            type="number"
                                            value={moduleForm.duration}
                                            onChange={e => setModuleForm(f => ({ ...f, duration: e.target.value }))}
                                            placeholder="Duration (min)"
                                            className="h-9 px-3 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[13px] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                                        />
                                        <input
                                            type="number"
                                            value={moduleForm.order}
                                            onChange={e => setModuleForm(f => ({ ...f, order: e.target.value }))}
                                            placeholder="Order (optional)"
                                            className="h-9 px-3 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[13px] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                                        />
                                    </div>
                                    <div className="flex gap-2 justify-end">
                                        <button
                                            onClick={() => { setShowModuleForm(false); setModuleForm(EMPTY_MODULE_FORM) }}
                                            className="h-8 px-4 text-[12px] text-[var(--text2)] hover:text-[var(--text)] border border-[var(--border)] rounded-[6px]"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleAddModule}
                                            disabled={addingModule}
                                            className="h-8 px-4 text-[12px] bg-[var(--accent)] text-white rounded-[6px] font-medium flex items-center gap-2 disabled:opacity-60"
                                        >
                                            {addingModule && <Loader2 size={12} className="animate-spin" />}
                                            Add Module
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border)] shrink-0">
                    <button onClick={onClose} className="h-9 px-4 text-[13px] border border-[var(--border)] rounded-[8px] text-[var(--text2)] hover:bg-[var(--surface2)]">
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="h-9 px-5 text-[13px] bg-[var(--accent)] text-white rounded-[8px] font-medium flex items-center gap-2 disabled:opacity-60"
                    >
                        {loading && <Loader2 size={14} className="animate-spin" />}
                        {course ? "Save Changes" : "Create Course"}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Enroll Modal ─────────────────────────────────────────────────────────────

function EnrollModal({ open, onClose, onSaved, courses, preselectedCourseId }: {
    open: boolean
    onClose: () => void
    onSaved: () => void
    courses: Course[]
    preselectedCourseId?: string
}) {
    const [courseId, setCourseId] = useState("")
    const [enrollAll, setEnrollAll] = useState(false)
    const [dueDate, setDueDate] = useState("")
    const [employees, setEmployees] = useState<Employee[]>([])
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [searchEmp, setSearchEmp] = useState("")
    const [loading, setLoading] = useState(false)
    const [loadingEmps, setLoadingEmps] = useState(false)

    useEffect(() => {
        if (!open) return
        setCourseId(preselectedCourseId || "")
        setEnrollAll(false)
        setDueDate("")
        setSelectedIds([])
        setSearchEmp("")

        setLoadingEmps(true)
        fetch("/api/employees?status=ACTIVE")
            .then(r => r.json())
            .then(d => setEmployees(Array.isArray(d) ? d : []))
            .catch(() => setEmployees([]))
            .finally(() => setLoadingEmps(false))
    }, [open, preselectedCourseId])

    const filteredEmps = employees.filter(e => {
        if (!searchEmp) return true
        const q = searchEmp.toLowerCase()
        return (
            e.firstName.toLowerCase().includes(q) ||
            e.lastName.toLowerCase().includes(q) ||
            e.employeeId.toLowerCase().includes(q)
        )
    })

    const toggleEmp = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
    }

    const handleEnroll = async () => {
        if (!courseId) { toast.error("Select a course"); return }
        if (!enrollAll && selectedIds.length === 0) { toast.error("Select at least one employee"); return }
        setLoading(true)
        try {
            const res = await fetch("/api/lms/enrollments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    courseId,
                    enrollAll,
                    employeeIds: enrollAll ? [] : selectedIds,
                    dueDate: dueDate || null,
                }),
            })
            if (!res.ok) { toast.error(await res.text()); return }
            const data = await res.json()
            toast.success(`Enrolled ${data.enrolled} employee(s)${data.skipped > 0 ? ` (${data.skipped} already enrolled)` : ""}`)
            onSaved()
            onClose()
        } catch {
            toast.error("Failed to enroll")
        } finally {
            setLoading(false)
        }
    }

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative bg-[var(--surface)] rounded-[16px] border border-[var(--border)] shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh]">
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
                    <h2 className="text-[16px] font-semibold text-[var(--text)]">Enroll Employees</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--surface2)] text-[var(--text3)]">
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    <div>
                        <label className="block text-[12px] font-medium text-[var(--text2)] mb-1.5">Course *</label>
                        <select
                            value={courseId}
                            onChange={e => setCourseId(e.target.value)}
                            className="w-full h-10 px-3 rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] text-[13px] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                        >
                            <option value="">Select course...</option>
                            {courses.filter(c => c.status === "PUBLISHED").map(c => (
                                <option key={c.id} value={c.id}>{c.courseCode} — {c.title}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[12px] font-medium text-[var(--text2)] mb-1.5">Due Date (optional)</label>
                        <input
                            type="date"
                            value={dueDate}
                            onChange={e => setDueDate(e.target.value)}
                            className="w-full h-10 px-3 rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] text-[13px] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                        />
                    </div>
                    <label className="flex items-center gap-3 p-3 rounded-[10px] border border-[var(--border)] bg-[var(--surface2)] cursor-pointer">
                        <input
                            type="checkbox"
                            checked={enrollAll}
                            onChange={e => { setEnrollAll(e.target.checked); if (e.target.checked) setSelectedIds([]) }}
                            className="w-4 h-4 accent-[var(--accent)]"
                        />
                        <div>
                            <p className="text-[13px] font-medium text-[var(--text)]">Enroll All Active Employees</p>
                            <p className="text-[11.5px] text-[var(--text3)]">Enroll all {employees.length} active employees</p>
                        </div>
                    </label>
                    {!enrollAll && (
                        <div>
                            <div className="relative mb-2">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text3)]" />
                                <input
                                    value={searchEmp}
                                    onChange={e => setSearchEmp(e.target.value)}
                                    placeholder="Search employees..."
                                    className="w-full h-9 pl-8 pr-3 rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] text-[12px] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                                />
                            </div>
                            <div className="max-h-[200px] overflow-y-auto space-y-1 border border-[var(--border)] rounded-[10px] p-2">
                                {loadingEmps ? (
                                    <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-[var(--accent)]" /></div>
                                ) : filteredEmps.length === 0 ? (
                                    <p className="text-center py-4 text-[12px] text-[var(--text3)]">No employees found</p>
                                ) : filteredEmps.map(emp => (
                                    <label key={emp.id} className="flex items-center gap-3 px-2 py-1.5 rounded-[7px] hover:bg-[var(--surface2)] cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.includes(emp.id)}
                                            onChange={() => toggleEmp(emp.id)}
                                            className="w-3.5 h-3.5 accent-[var(--accent)]"
                                        />
                                        <Avatar firstName={emp.firstName} lastName={emp.lastName} photo={emp.photo} size={28} />
                                        <div className="min-w-0">
                                            <p className="text-[12px] font-medium text-[var(--text)]">{emp.firstName} {emp.lastName}</p>
                                            <p className="text-[10.5px] text-[var(--text3)]">{emp.employeeId}{emp.designation ? ` · ${emp.designation}` : ""}</p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                            {selectedIds.length > 0 && (
                                <p className="text-[11.5px] text-[var(--accent)] mt-1">{selectedIds.length} employee(s) selected</p>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border)] shrink-0">
                    <button onClick={onClose} className="h-9 px-4 text-[13px] border border-[var(--border)] rounded-[8px] text-[var(--text2)] hover:bg-[var(--surface2)]">
                        Cancel
                    </button>
                    <button
                        onClick={handleEnroll}
                        disabled={loading}
                        className="h-9 px-5 text-[13px] bg-[var(--accent)] text-white rounded-[8px] font-medium flex items-center gap-2 disabled:opacity-60"
                    >
                        {loading && <Loader2 size={14} className="animate-spin" />}
                        Enroll
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Course Detail Drawer ─────────────────────────────────────────────────────

function CourseDrawer({ courseId, onClose, onEdit, onEnroll, onRefresh }: {
    courseId: string | null
    onClose: () => void
    onEdit: (course: Course) => void
    onEnroll: (courseId: string) => void
    onRefresh: () => void
}) {
    const [course, setCourse] = useState<CourseDetail | null>(null)
    const [enrollments, setEnrollments] = useState<Enrollment[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!courseId) { setCourse(null); return }
        setLoading(true)
        Promise.all([
            fetch(`/api/lms/courses/${courseId}`).then(r => r.json()),
            fetch(`/api/lms/enrollments?courseId=${courseId}`).then(r => r.json()),
        ])
            .then(([courseData, enrollData]) => {
                setCourse(courseData)
                setEnrollments(Array.isArray(enrollData) ? enrollData.slice(0, 8) : [])
            })
            .catch(() => setCourse(null))
            .finally(() => setLoading(false))
    }, [courseId])

    const handlePublishToggle = async () => {
        if (!course) return
        const newStatus = course.status === "PUBLISHED" ? "ARCHIVED" : "PUBLISHED"
        try {
            const res = await fetch(`/api/lms/courses/${course.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            })
            if (!res.ok) { toast.error("Failed to update status"); return }
            setCourse(prev => prev ? { ...prev, status: newStatus } : prev)
            onRefresh()
            toast.success(`Course ${newStatus.toLowerCase()}`)
        } catch {
            toast.error("Failed to update status")
        }
    }

    const catColors = course ? (CATEGORY_COLORS[course.category] ?? CATEGORY_COLORS["Other"]) : null

    if (!courseId) return null

    return (
        <div className="fixed inset-0 z-40 flex justify-end">
            <div className="absolute inset-0 bg-black/30" onClick={onClose} />
            <div className="relative bg-[var(--surface)] border-l border-[var(--border)] w-full max-w-[520px] flex flex-col h-full shadow-2xl">
                {loading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <Loader2 size={28} className="animate-spin text-[var(--accent)]" />
                    </div>
                ) : course ? (
                    <>
                        {/* Header */}
                        <div className="px-6 pt-6 pb-4 border-b border-[var(--border)] shrink-0">
                            <div className="flex items-start justify-between gap-4 mb-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-mono text-[11.5px] text-[var(--text3)]">{course.courseCode}</span>
                                        {catColors && (
                                            <span
                                                className="px-2 py-0.5 rounded-full text-[10.5px] font-medium"
                                                style={{ background: catColors.bg, color: catColors.text, border: `1px solid ${catColors.border}` }}
                                            >
                                                {course.category}
                                            </span>
                                        )}
                                        <span
                                            className="px-2 py-0.5 rounded-full text-[10.5px] font-medium"
                                            style={{
                                                background: COURSE_STATUS_CONFIG[course.status]?.bg ?? "#f3f4f6",
                                                color: COURSE_STATUS_CONFIG[course.status]?.color ?? "#6b7280"
                                            }}
                                        >
                                            {COURSE_STATUS_CONFIG[course.status]?.label ?? course.status}
                                        </span>
                                    </div>
                                    <h2 className="text-[17px] font-semibold text-[var(--text)] leading-snug">{course.title}</h2>
                                    {course.isMandatory && (
                                        <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-[#fef3c7] text-[#b45309] border border-[#fde68a]">
                                            <AlertTriangle size={10} />
                                            Mandatory
                                        </span>
                                    )}
                                </div>
                                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--surface2)] text-[var(--text3)] shrink-0">
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Stats row */}
                            <div className="grid grid-cols-4 gap-3 mt-4">
                                {[
                                    { label: "Duration", value: `${course.duration}m` },
                                    { label: "Modules", value: course.modules.length },
                                    { label: "Enrolled", value: course.stats.totalEnrolled },
                                    { label: "Pass Rate", value: `${course.stats.passRate}%` },
                                ].map(s => (
                                    <div key={s.label} className="text-center p-2.5 bg-[var(--surface2)] rounded-[10px] border border-[var(--border)]">
                                        <p className="text-[16px] font-bold text-[var(--text)]">{s.value}</p>
                                        <p className="text-[10.5px] text-[var(--text3)]">{s.label}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {course.description && (
                                <div>
                                    <p className="text-[11.5px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px] mb-2">Description</p>
                                    <p className="text-[13px] text-[var(--text2)] leading-relaxed">{course.description}</p>
                                </div>
                            )}

                            {/* Modules */}
                            <div>
                                <p className="text-[11.5px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px] mb-2">
                                    Modules ({course.modules.length})
                                </p>
                                {course.modules.length === 0 ? (
                                    <p className="text-[13px] text-[var(--text3)] italic">No modules added yet</p>
                                ) : (
                                    <div className="space-y-2">
                                        {course.modules.map((mod, idx) => (
                                            <div key={mod.id} className="flex items-start gap-3 p-3 rounded-[10px] bg-[var(--surface2)] border border-[var(--border)]">
                                                <div className="h-6 w-6 rounded-full bg-[var(--accent)] text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                                                    {idx + 1}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[13px] font-medium text-[var(--text)]">{mod.title}</p>
                                                    {mod.content && (
                                                        <p className="text-[11.5px] text-[var(--text3)] mt-0.5 line-clamp-2">{mod.content}</p>
                                                    )}
                                                    <div className="flex items-center gap-3 mt-1">
                                                        <span className="text-[11px] text-[var(--text3)]">⏱ {mod.duration} min</span>
                                                        {mod.videoUrl && (
                                                            <a href={mod.videoUrl} target="_blank" rel="noopener noreferrer"
                                                                className="text-[11px] text-[var(--accent)] flex items-center gap-1 hover:underline">
                                                                <ExternalLink size={10} /> Video
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Enrollments */}
                            <div>
                                <p className="text-[11.5px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px] mb-2">
                                    Recent Enrollments
                                </p>
                                {enrollments.length === 0 ? (
                                    <p className="text-[13px] text-[var(--text3)] italic">No enrollments yet</p>
                                ) : (
                                    <div className="space-y-2">
                                        {enrollments.map(e => {
                                            const cfg = ENROLLMENT_STATUS_CONFIG[e.status]
                                            return (
                                                <div key={e.id} className="flex items-center gap-3 p-3 rounded-[10px] bg-[var(--surface2)] border border-[var(--border)]">
                                                    <Avatar firstName={e.employee.firstName} lastName={e.employee.lastName} photo={e.employee.photo} size={32} />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[13px] font-medium text-[var(--text)]">
                                                            {e.employee.firstName} {e.employee.lastName}
                                                        </p>
                                                        <div className="mt-1">
                                                            <ProgressBar value={e.progress} />
                                                        </div>
                                                    </div>
                                                    {cfg && (
                                                        <span
                                                            className="px-2 py-0.5 rounded-full text-[10.5px] font-medium shrink-0"
                                                            style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
                                                        >
                                                            {cfg.label}
                                                        </span>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="px-6 py-4 border-t border-[var(--border)] flex gap-2 shrink-0">
                            <button
                                onClick={() => onEdit(course)}
                                className="flex-1 h-9 text-[13px] border border-[var(--border)] rounded-[8px] text-[var(--text2)] hover:bg-[var(--surface2)] flex items-center justify-center gap-2"
                            >
                                <Edit2 size={14} /> Edit
                            </button>
                            <button
                                onClick={handlePublishToggle}
                                className="flex-1 h-9 text-[13px] border border-[var(--border)] rounded-[8px] text-[var(--text2)] hover:bg-[var(--surface2)] flex items-center justify-center gap-2"
                            >
                                {course.status === "PUBLISHED" ? "Archive" : "Publish"}
                            </button>
                            <button
                                onClick={() => onEnroll(course.id)}
                                className="flex-1 h-9 text-[13px] bg-[var(--accent)] text-white rounded-[8px] font-medium flex items-center justify-center gap-2"
                            >
                                <Users size={14} /> Enroll More
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center">
                        <p className="text-[var(--text3)]">Failed to load course</p>
                    </div>
                )}
            </div>
        </div>
    )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LMSPage() {
    const { data: session, status } = useSession()
    const router = useRouter()

    const [activeTab, setActiveTab] = useState<"courses" | "enrollments">("courses")
    const [courses, setCourses] = useState<Course[]>([])
    const [enrollments, setEnrollments] = useState<Enrollment[]>([])
    const [loadingCourses, setLoadingCourses] = useState(true)
    const [loadingEnrollments, setLoadingEnrollments] = useState(false)

    // Filters — Courses
    const [catFilter, setCatFilter] = useState("All")
    const [statusFilter, setStatusFilter] = useState("All")
    const [search, setSearch] = useState("")
    const [mandatoryOnly, setMandatoryOnly] = useState(false)

    // Filters — Enrollments
    const [enrollStatusFilter, setEnrollStatusFilter] = useState("All")
    const [enrollCourseFilter, setEnrollCourseFilter] = useState("")
    const [enrollSearch, setEnrollSearch] = useState("")

    // Modals
    const [showCourseModal, setShowCourseModal] = useState(false)
    const [editCourse, setEditCourse] = useState<Course | null>(null)
    const [showEnrollModal, setShowEnrollModal] = useState(false)
    const [enrollCourseId, setEnrollCourseId] = useState<string | undefined>()
    const [drawerCourseId, setDrawerCourseId] = useState<string | null>(null)
    const [openMenuId, setOpenMenuId] = useState<string | null>(null)

    useEffect(() => {
        if (status !== "unauthenticated") return
        router.replace("/login")
    }, [status, router])

    const fetchCourses = useCallback(async () => {
        setLoadingCourses(true)
        try {
            const params = new URLSearchParams()
            if (statusFilter !== "All") params.set("status", statusFilter)
            if (catFilter !== "All") params.set("category", catFilter)
            if (mandatoryOnly) params.set("isMandatory", "true")
            if (search) params.set("search", search)
            const res = await fetch(`/api/lms/courses?${params}`)
            const data = await res.json()
            setCourses(Array.isArray(data) ? data : [])
        } catch {
            toast.error("Failed to load courses")
        } finally {
            setLoadingCourses(false)
        }
    }, [statusFilter, catFilter, mandatoryOnly, search])

    const fetchEnrollments = useCallback(async () => {
        setLoadingEnrollments(true)
        try {
            const params = new URLSearchParams()
            if (enrollStatusFilter !== "All") params.set("status", enrollStatusFilter)
            if (enrollCourseFilter) params.set("courseId", enrollCourseFilter)
            if (enrollSearch) params.set("search", enrollSearch)
            const res = await fetch(`/api/lms/enrollments?${params}`)
            const data = await res.json()
            setEnrollments(Array.isArray(data) ? data : [])
        } catch {
            toast.error("Failed to load enrollments")
        } finally {
            setLoadingEnrollments(false)
        }
    }, [enrollStatusFilter, enrollCourseFilter, enrollSearch])

    useEffect(() => { fetchCourses() }, [fetchCourses])
    useEffect(() => { if (activeTab === "enrollments") fetchEnrollments() }, [activeTab, fetchEnrollments])

    const handleDeleteCourse = async (courseId: string) => {
        if (!confirm("Delete this course? This action cannot be undone.")) return
        try {
            const res = await fetch(`/api/lms/courses/${courseId}`, { method: "DELETE" })
            if (!res.ok) { toast.error(await res.text()); return }
            toast.success("Course deleted")
            fetchCourses()
        } catch {
            toast.error("Failed to delete course")
        }
    }

    const handlePublishToggle = async (course: Course) => {
        const newStatus = course.status === "PUBLISHED" ? "ARCHIVED" : "PUBLISHED"
        try {
            const res = await fetch(`/api/lms/courses/${course.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            })
            if (!res.ok) { toast.error("Failed to update"); return }
            toast.success(`Course ${newStatus.toLowerCase()}`)
            fetchCourses()
        } catch {
            toast.error("Failed to update course")
        }
    }

    const handleDeleteEnrollment = async (id: string) => {
        if (!confirm("Remove this enrollment?")) return
        try {
            const res = await fetch(`/api/lms/enrollments/${id}`, { method: "DELETE" })
            if (!res.ok) { toast.error(await res.text()); return }
            toast.success("Enrollment removed")
            fetchEnrollments()
        } catch {
            toast.error("Failed to remove enrollment")
        }
    }

    // Stats
    const totalCourses = courses.length
    const publishedCourses = courses.filter(c => c.status === "PUBLISHED").length
    const mandatoryCourses = courses.filter(c => c.isMandatory).length
    const totalEnrollments = courses.reduce((sum, c) => sum + c.enrolledCount, 0)

    return (
        <div className="flex flex-col h-full bg-[var(--surface2)] min-h-0">
            {/* Page Header */}
            <div className="bg-[var(--surface)] border-b border-[var(--border)] px-6 py-5 shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 bg-[var(--accent)] rounded-[10px] flex items-center justify-center">
                            <GraduationCap size={18} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-[18px] font-bold text-[var(--text)]">Learning Management</h1>
                            <p className="text-[12px] text-[var(--text3)]">Training courses &amp; employee development</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => { setEnrollCourseId(undefined); setShowEnrollModal(true) }}
                            className="h-9 px-4 text-[13px] border border-[var(--border)] rounded-[8px] text-[var(--text2)] hover:bg-[var(--surface2)] flex items-center gap-2"
                        >
                            <Users size={15} /> Enroll Employees
                        </button>
                        <button
                            onClick={() => { setEditCourse(null); setShowCourseModal(true) }}
                            className="h-9 px-4 text-[13px] bg-[var(--accent)] text-white rounded-[8px] font-medium flex items-center gap-2"
                        >
                            <Plus size={15} /> Create Course
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard label="Total Courses" value={totalCourses} icon={<BookOpen size={22} />} color="#3b82f6" />
                    <StatCard label="Published" value={publishedCourses} icon={<CheckCircle size={22} />} color="#1a9e6e" />
                    <StatCard label="Mandatory" value={mandatoryCourses} icon={<AlertTriangle size={22} />} color="#f59e0b" />
                    <StatCard label="Total Enrollments" value={totalEnrollments} icon={<Users size={22} />} color="#8b5cf6" />
                </div>

                {/* Tabs */}
                <div className="flex border-b border-[var(--border)] bg-[var(--surface)] rounded-t-[12px] px-4">
                    {(["courses", "enrollments"] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-3 text-[13px] font-medium border-b-2 transition-colors capitalize ${
                                activeTab === tab
                                    ? "border-[var(--accent)] text-[var(--accent)]"
                                    : "border-transparent text-[var(--text3)] hover:text-[var(--text2)]"
                            }`}
                        >
                            {tab === "courses" ? "Courses" : "Enrollments"}
                        </button>
                    ))}
                </div>

                {/* ── Courses Tab ── */}
                {activeTab === "courses" && (
                    <div className="space-y-4">
                        {/* Filters */}
                        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[12px] p-4 space-y-3">
                            <div className="flex flex-wrap gap-2">
                                <div className="flex flex-wrap gap-1.5">
                                    {CATEGORIES.map(cat => (
                                        <button
                                            key={cat}
                                            onClick={() => setCatFilter(cat)}
                                            className={`px-3 py-1 rounded-full text-[12px] font-medium transition-colors ${
                                                catFilter === cat
                                                    ? "bg-[var(--accent)] text-white"
                                                    : "bg-[var(--surface2)] text-[var(--text2)] border border-[var(--border)] hover:border-[var(--accent)]"
                                            }`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2 items-center">
                                <div className="flex gap-1.5">
                                    {COURSE_STATUSES.map(s => (
                                        <button
                                            key={s}
                                            onClick={() => setStatusFilter(s)}
                                            className={`px-3 py-1 rounded-full text-[12px] font-medium transition-colors ${
                                                statusFilter === s
                                                    ? "bg-[var(--accent)] text-white"
                                                    : "bg-[var(--surface2)] text-[var(--text2)] border border-[var(--border)] hover:border-[var(--accent)]"
                                            }`}
                                        >
                                            {s === "All" ? "All Status" : s.charAt(0) + s.slice(1).toLowerCase()}
                                        </button>
                                    ))}
                                </div>
                                <div className="relative flex-1 min-w-[180px]">
                                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text3)]" />
                                    <input
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        placeholder="Search courses..."
                                        className="w-full h-8 pl-8 pr-3 rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] text-[12px] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                                    />
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={mandatoryOnly}
                                        onChange={e => setMandatoryOnly(e.target.checked)}
                                        className="w-3.5 h-3.5 accent-[var(--accent)]"
                                    />
                                    <span className="text-[12px] text-[var(--text2)]">Mandatory only</span>
                                </label>
                            </div>
                        </div>

                        {/* Course Grid */}
                        {loadingCourses ? (
                            <div className="flex justify-center py-16">
                                <Loader2 size={28} className="animate-spin text-[var(--accent)]" />
                            </div>
                        ) : courses.length === 0 ? (
                            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[12px] py-16 text-center">
                                <GraduationCap size={36} className="mx-auto text-[var(--text3)] mb-3" />
                                <p className="text-[14px] font-medium text-[var(--text2)]">No courses found</p>
                                <p className="text-[12px] text-[var(--text3)] mt-1">Create a course to get started</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {courses.map(course => {
                                    const catCfg = CATEGORY_COLORS[course.category] ?? CATEGORY_COLORS["Other"]
                                    const strip = CATEGORY_STRIP[course.category] ?? "#6b7280"
                                    const statusCfg = COURSE_STATUS_CONFIG[course.status]
                                    const isMenuOpen = openMenuId === course.id

                                    return (
                                        <div
                                            key={course.id}
                                            className="bg-[var(--surface)] border border-[var(--border)] rounded-[14px] overflow-hidden hover:shadow-md transition-shadow cursor-pointer relative"
                                        >
                                            {/* Category color strip */}
                                            <div className="h-1.5 w-full" style={{ background: strip }} />

                                            <div className="p-4">
                                                {/* Top row */}
                                                <div className="flex items-start justify-between gap-2 mb-2">
                                                    <div>
                                                        <span className="font-mono text-[10.5px] text-[var(--text3)]">{course.courseCode}</span>
                                                        <h3 className="text-[14px] font-semibold text-[var(--text)] leading-snug mt-0.5">{course.title}</h3>
                                                    </div>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <button
                                                            onClick={() => setDrawerCourseId(course.id)}
                                                            className="p-1.5 rounded-lg hover:bg-[var(--surface2)] text-[var(--text3)]"
                                                        >
                                                            <Eye size={14} />
                                                        </button>
                                                        <div className="relative">
                                                            <button
                                                                onClick={e => { e.stopPropagation(); setOpenMenuId(isMenuOpen ? null : course.id) }}
                                                                className="p-1.5 rounded-lg hover:bg-[var(--surface2)] text-[var(--text3)]"
                                                            >
                                                                <MoreVertical size={14} />
                                                            </button>
                                                            {isMenuOpen && (
                                                                <div
                                                                    className="absolute right-0 top-8 z-20 bg-[var(--surface)] border border-[var(--border)] rounded-[10px] shadow-lg py-1 min-w-[160px]"
                                                                    onClick={e => e.stopPropagation()}
                                                                >
                                                                    <button
                                                                        onClick={() => { setEditCourse(course); setShowCourseModal(true); setOpenMenuId(null) }}
                                                                        className="flex items-center gap-2 w-full px-3 py-2 text-[12.5px] text-[var(--text2)] hover:bg-[var(--surface2)]"
                                                                    >
                                                                        <Edit2 size={13} /> Edit
                                                                    </button>
                                                                    <button
                                                                        onClick={() => { handlePublishToggle(course); setOpenMenuId(null) }}
                                                                        className="flex items-center gap-2 w-full px-3 py-2 text-[12.5px] text-[var(--text2)] hover:bg-[var(--surface2)]"
                                                                    >
                                                                        <TrendingUp size={13} />
                                                                        {course.status === "PUBLISHED" ? "Archive" : "Publish"}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => { setEnrollCourseId(course.id); setShowEnrollModal(true); setOpenMenuId(null) }}
                                                                        className="flex items-center gap-2 w-full px-3 py-2 text-[12.5px] text-[var(--text2)] hover:bg-[var(--surface2)]"
                                                                    >
                                                                        <Users size={13} /> Enroll Employees
                                                                    </button>
                                                                    {session?.user?.role === "ADMIN" && (
                                                                        <button
                                                                            onClick={() => { handleDeleteCourse(course.id); setOpenMenuId(null) }}
                                                                            className="flex items-center gap-2 w-full px-3 py-2 text-[12.5px] text-[var(--red)] hover:bg-[var(--surface2)]"
                                                                        >
                                                                            <Trash2 size={13} /> Delete
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Description */}
                                                {course.description && (
                                                    <p className="text-[12px] text-[var(--text3)] line-clamp-2 mb-3">{course.description}</p>
                                                )}

                                                {/* Meta */}
                                                <div className="flex items-center gap-3 text-[11.5px] text-[var(--text3)] mb-3">
                                                    <span>⏱ {course.duration} min</span>
                                                    <span>· {course._count.modules} modules</span>
                                                </div>

                                                {/* Badges */}
                                                <div className="flex flex-wrap gap-1.5 mb-3">
                                                    <span
                                                        className="px-2 py-0.5 rounded-full text-[10.5px] font-medium"
                                                        style={{ background: catCfg.bg, color: catCfg.text, border: `1px solid ${catCfg.border}` }}
                                                    >
                                                        {course.category}
                                                    </span>
                                                    {course.isMandatory && (
                                                        <span className="px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-[#fef3c7] text-[#b45309] border border-[#fde68a]">
                                                            Mandatory
                                                        </span>
                                                    )}
                                                    {statusCfg && (
                                                        <span className="px-2 py-0.5 rounded-full text-[10.5px] font-medium"
                                                            style={{ background: statusCfg.bg, color: statusCfg.color }}>
                                                            {statusCfg.label}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Enrollment stats */}
                                                <div className="border-t border-[var(--border)] pt-3 flex items-center justify-between text-[11.5px] text-[var(--text3)]">
                                                    <span>{course.enrolledCount} enrolled</span>
                                                    <span>Pass rate: <strong className="text-[var(--text2)]">{course.passRate}%</strong></span>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ── Enrollments Tab ── */}
                {activeTab === "enrollments" && (
                    <div className="space-y-4">
                        {/* Filters */}
                        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[12px] p-4 space-y-3">
                            <div className="flex flex-wrap gap-2 items-center">
                                <div className="flex flex-wrap gap-1.5">
                                    {ENROLLMENT_STATUSES.map(s => (
                                        <button
                                            key={s}
                                            onClick={() => setEnrollStatusFilter(s)}
                                            className={`px-3 py-1 rounded-full text-[12px] font-medium transition-colors ${
                                                enrollStatusFilter === s
                                                    ? "bg-[var(--accent)] text-white"
                                                    : "bg-[var(--surface2)] text-[var(--text2)] border border-[var(--border)] hover:border-[var(--accent)]"
                                            }`}
                                        >
                                            {s === "All" ? "All Status" : ENROLLMENT_STATUS_CONFIG[s]?.label ?? s}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <select
                                    value={enrollCourseFilter}
                                    onChange={e => setEnrollCourseFilter(e.target.value)}
                                    className="h-9 px-3 rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] text-[12px] text-[var(--text)] focus:outline-none focus:border-[var(--accent)] min-w-[200px]"
                                >
                                    <option value="">All Courses</option>
                                    {courses.map(c => (
                                        <option key={c.id} value={c.id}>{c.courseCode} — {c.title}</option>
                                    ))}
                                </select>
                                <div className="relative flex-1">
                                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text3)]" />
                                    <input
                                        value={enrollSearch}
                                        onChange={e => setEnrollSearch(e.target.value)}
                                        placeholder="Search employee..."
                                        className="w-full h-9 pl-8 pr-3 rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] text-[12px] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[12px] overflow-hidden">
                            {loadingEnrollments ? (
                                <div className="flex justify-center py-16">
                                    <Loader2 size={28} className="animate-spin text-[var(--accent)]" />
                                </div>
                            ) : enrollments.length === 0 ? (
                                <div className="py-16 text-center">
                                    <Users size={36} className="mx-auto text-[var(--text3)] mb-3" />
                                    <p className="text-[14px] font-medium text-[var(--text2)]">No enrollments found</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-[var(--border)] bg-[var(--surface2)]">
                                                <th className="px-4 py-3 text-left text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px]">Employee</th>
                                                <th className="px-4 py-3 text-left text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px]">Course</th>
                                                <th className="px-4 py-3 text-left text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px]">Enrolled</th>
                                                <th className="px-4 py-3 text-left text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px]">Due Date</th>
                                                <th className="px-4 py-3 text-left text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px] min-w-[120px]">Progress</th>
                                                <th className="px-4 py-3 text-left text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px]">Score</th>
                                                <th className="px-4 py-3 text-left text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px]">Status</th>
                                                <th className="px-4 py-3 text-left text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px]"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[var(--border)]">
                                            {enrollments.map(e => {
                                                const cfg = ENROLLMENT_STATUS_CONFIG[e.status]
                                                return (
                                                    <tr key={e.id} className="hover:bg-[var(--surface2)] transition-colors">
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-2.5">
                                                                <Avatar firstName={e.employee.firstName} lastName={e.employee.lastName} photo={e.employee.photo} size={32} />
                                                                <div>
                                                                    <p className="text-[13px] font-medium text-[var(--text)]">{e.employee.firstName} {e.employee.lastName}</p>
                                                                    <p className="text-[11px] text-[var(--text3)]">{e.employee.employeeId}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <p className="text-[13px] text-[var(--text)] font-medium line-clamp-1">{e.course.title}</p>
                                                            <p className="text-[10.5px] font-mono text-[var(--text3)]">{e.course.courseCode}</p>
                                                        </td>
                                                        <td className="px-4 py-3 text-[12px] text-[var(--text2)]">
                                                            {format(new Date(e.enrolledAt), "dd MMM yy")}
                                                        </td>
                                                        <td className="px-4 py-3 text-[12px] text-[var(--text2)]">
                                                            {e.dueDate ? format(new Date(e.dueDate), "dd MMM yy") : "—"}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-2">
                                                                <div className="flex-1">
                                                                    <ProgressBar value={e.progress} />
                                                                </div>
                                                                <span className="text-[11px] text-[var(--text3)] shrink-0">{e.progress}%</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-[12px] text-[var(--text2)]">
                                                            {e.score !== null && e.score !== undefined ? `${e.score}%` : "—"}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            {cfg && (
                                                                <span
                                                                    className="px-2 py-0.5 rounded-full text-[10.5px] font-medium"
                                                                    style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
                                                                >
                                                                    {cfg.label}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            {session?.user?.role === "ADMIN" && (
                                                                <button
                                                                    onClick={() => handleDeleteEnrollment(e.id)}
                                                                    className="p-1.5 text-[var(--text3)] hover:text-[var(--red)] transition-colors"
                                                                >
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            )}
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
                )}
            </div>

            {/* Modals */}
            <CourseModal
                open={showCourseModal}
                onClose={() => { setShowCourseModal(false); setEditCourse(null) }}
                onSaved={() => { fetchCourses() }}
                course={editCourse}
            />
            <EnrollModal
                open={showEnrollModal}
                onClose={() => { setShowEnrollModal(false); setEnrollCourseId(undefined) }}
                onSaved={() => { fetchCourses(); if (activeTab === "enrollments") fetchEnrollments() }}
                courses={courses}
                preselectedCourseId={enrollCourseId}
            />
            <CourseDrawer
                courseId={drawerCourseId}
                onClose={() => setDrawerCourseId(null)}
                onEdit={course => { setEditCourse(course); setShowCourseModal(true); setDrawerCourseId(null) }}
                onEnroll={id => { setEnrollCourseId(id); setShowEnrollModal(true); setDrawerCourseId(null) }}
                onRefresh={fetchCourses}
            />

            {/* Click outside to close dropdown */}
            {openMenuId && (
                <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
            )}
        </div>
    )
}
