"use client"
import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
    Plus, Loader2, X, ClipboardList, CheckCircle2,
    Clock, Users, CheckCheck, ChevronRight, Search
} from "lucide-react"

type OnboardingTask = {
    id: string
    title: string
    category: string
    status: string
    completedAt: string | null
}

type EmployeeWithOnboarding = {
    id: string
    firstName: string
    lastName: string
    employeeId: string
    designation?: string
    photo?: string
    dateOfJoining?: string
    branch: { name: string }
    onboardingTasks: OnboardingTask[]
}

type Employee = { id: string; firstName: string; lastName: string; employeeId: string }

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
    DOCUMENT: { bg: "#eff6ff", color: "#3b82f6" },
    TRAINING: { bg: "#fef3c7", color: "#d97706" },
    IT_SETUP: { bg: "#f0fdf4", color: "#16a34a" },
    INDUCTION: { bg: "#fdf4ff", color: "#9333ea" },
    OTHER: { bg: "#f9fafb", color: "#6b7280" },
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

function ProgressBar({ value }: { value: number }) {
    const color = value === 100 ? "#1a9e6e" : value >= 50 ? "#f59e0b" : "#ef4444"
    return (
        <div className="w-full bg-[var(--surface2)] rounded-full h-1.5">
            <div style={{ width: `${value}%`, background: color }} className="h-1.5 rounded-full transition-all duration-300" />
        </div>
    )
}

function StartOnboardingModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
    const [loading, setLoading] = useState(false)
    const [employees, setEmployees] = useState<Employee[]>([])
    const [onboardedIds, setOnboardedIds] = useState<Set<string>>(new Set())
    const [selectedId, setSelectedId] = useState("")

    useEffect(() => {
        if (!open) return
        Promise.all([
            fetch("/api/employees?status=ACTIVE").then(r => r.json()),
            fetch("/api/onboarding").then(r => r.json()),
        ]).then(([emps, onboarded]) => {
            setEmployees(Array.isArray(emps) ? emps : [])
            const ids = new Set<string>((Array.isArray(onboarded) ? onboarded : []).map((e: EmployeeWithOnboarding) => e.id))
            setOnboardedIds(ids)
        }).catch(() => {})
    }, [open])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedId) return
        setLoading(true)
        try {
            const res = await fetch("/api/onboarding", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ employeeId: selectedId }),
            })
            if (!res.ok) throw new Error(await res.text())
            toast.success("Onboarding started!")
            onSaved()
            onClose()
            setSelectedId("")
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to start onboarding")
        } finally {
            setLoading(false)
        }
    }

    if (!open) return null

    const available = employees.filter(e => !onboardedIds.has(e.id))

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-[16px] border border-[var(--border)] w-full max-w-md shadow-xl">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
                    <h2 className="text-[15px] font-semibold text-[var(--text)]">Start Onboarding</h2>
                    <button onClick={onClose} className="p-1 text-[var(--text3)] hover:text-[var(--text)] rounded-md hover:bg-[var(--surface2)] transition-colors"><X size={18} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div>
                        <label className="block text-[12px] text-[var(--text2)] mb-1">Select Employee *</label>
                        <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
                            className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors" required>
                            <option value="">Choose employee...</option>
                            {available.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeId})</option>)}
                        </select>
                        {available.length === 0 && (
                            <p className="text-[11px] text-[var(--text3)] mt-1">All active employees already have onboarding initiated.</p>
                        )}
                    </div>
                    <div className="bg-[var(--surface2)] rounded-[10px] p-3 text-[12px] text-[var(--text2)]">
                        <p className="font-medium text-[var(--text)] mb-1.5">Default tasks will be created:</p>
                        <ul className="space-y-1">
                            {["Offer Letter Signed", "Aadhar Copy Submitted", "PAN Card Submitted", "Bank Details Submitted", "Uniform Issued", "ID Card Issued", "Site Induction Done", "Safety Training", "System Access Setup"].map(t => (
                                <li key={t} className="flex items-center gap-1.5">
                                    <div className="w-1 h-1 rounded-full bg-[var(--text3)]" />
                                    {t}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] font-medium text-[var(--text2)] hover:text-[var(--text)] rounded-[8px] hover:bg-[var(--surface2)] transition-colors">Cancel</button>
                        <button type="submit" disabled={loading || !selectedId}
                            className="inline-flex items-center gap-2 px-5 py-2 bg-[var(--accent)] text-white rounded-[8px] text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                            {loading && <Loader2 size={14} className="animate-spin" />}
                            Start Onboarding
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

function TaskDrawer({ employee, onClose, onUpdated }: { employee: EmployeeWithOnboarding; onClose: () => void; onUpdated: () => void }) {
    const [tasks, setTasks] = useState<OnboardingTask[]>(employee.onboardingTasks)
    const [updating, setUpdating] = useState<string | null>(null)

    const handleUpdate = async (taskId: string, status: string) => {
        setUpdating(taskId)
        try {
            const res = await fetch(`/api/onboarding/${employee.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ taskId, status }),
            })
            if (!res.ok) throw new Error(await res.text())
            const updated = await res.json()
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: updated.status, completedAt: updated.completedAt } : t))
            onUpdated()
            toast.success(status === "COMPLETED" ? "Task completed!" : "Task updated")
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Update failed")
        } finally {
            setUpdating(null)
        }
    }

    const completed = tasks.filter(t => t.status === "COMPLETED").length
    const total = tasks.length
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-end">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-10 h-full w-full max-w-[420px] bg-white border-l border-[var(--border)] overflow-y-auto flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] sticky top-0 bg-white z-10">
                    <div className="flex items-center gap-3">
                        <Avatar firstName={employee.firstName} lastName={employee.lastName} photo={employee.photo} size={36} />
                        <div>
                            <p className="text-[14px] font-semibold text-[var(--text)]">{employee.firstName} {employee.lastName}</p>
                            <p className="text-[11px] text-[var(--text3)]">{employee.employeeId} · {employee.branch.name}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-[var(--text3)] hover:text-[var(--text)] rounded-md hover:bg-[var(--surface2)] transition-colors"><X size={18} /></button>
                </div>

                {/* Progress */}
                <div className="px-5 py-4 border-b border-[var(--border)]">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[12px] font-medium text-[var(--text2)]">Onboarding Progress</span>
                        <span className="text-[13px] font-bold" style={{ color: progress === 100 ? "#1a9e6e" : progress >= 50 ? "#f59e0b" : "#ef4444" }}>{progress}%</span>
                    </div>
                    <ProgressBar value={progress} />
                    <p className="text-[11px] text-[var(--text3)] mt-1.5">{completed} of {total} tasks completed</p>
                </div>

                {/* Tasks */}
                <div className="flex-1 px-4 py-4 space-y-2">
                    {tasks.map(task => {
                        const catStyle = CATEGORY_COLORS[task.category] || CATEGORY_COLORS.OTHER
                        const isDone = task.status === "COMPLETED"
                        const isSkipped = task.status === "SKIPPED"
                        return (
                            <div key={task.id} className={`p-3.5 rounded-[10px] border transition-colors ${isDone ? "bg-[#f0fdf4] border-[#bbf7d0]" : isSkipped ? "bg-[#f9fafb] border-[var(--border)]" : "bg-white border-[var(--border)]"}`}>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors cursor-pointer ${isDone ? "bg-[#1a9e6e] border-[#1a9e6e]" : "border-[var(--border)] hover:border-[var(--accent)]"}`}
                                            onClick={() => !isDone && handleUpdate(task.id, "COMPLETED")}>
                                            {isDone && <CheckCircle2 size={12} className="text-white" />}
                                            {updating === task.id && <Loader2 size={10} className="animate-spin text-[var(--text3)]" />}
                                        </div>
                                        <div className="min-w-0">
                                            <p className={`text-[13px] font-medium ${isDone ? "line-through text-[var(--text3)]" : isSkipped ? "text-[var(--text3)]" : "text-[var(--text)]"}`}>{task.title}</p>
                                            <span style={catStyle} className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-[4px] mt-0.5">
                                                {task.category.replace("_", " ")}
                                            </span>
                                        </div>
                                    </div>
                                    {!isDone && !isSkipped && (
                                        <button onClick={() => handleUpdate(task.id, "SKIPPED")}
                                            disabled={updating === task.id}
                                            className="text-[11px] text-[var(--text3)] hover:text-[var(--text2)] shrink-0 mt-0.5 disabled:opacity-40">
                                            Skip
                                        </button>
                                    )}
                                    {isSkipped && (
                                        <span className="text-[11px] text-[var(--text3)] shrink-0">Skipped</span>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

export default function OnboardingPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [employees, setEmployees] = useState<EmployeeWithOnboarding[]>([])
    const [loading, setLoading] = useState(true)
    const [showStart, setShowStart] = useState(false)
    const [selectedEmployee, setSelectedEmployee] = useState<EmployeeWithOnboarding | null>(null)
    const [search, setSearch] = useState("")

    useEffect(() => {
        if (status === "unauthenticated") router.push("/login")
    }, [status, router])

    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/onboarding")
            const data = await res.json()
            setEmployees(Array.isArray(data) ? data : [])
        } catch {
            toast.error("Failed to load onboarding data")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        if (status === "authenticated") fetchData()
    }, [status, fetchData])

    const filtered = employees.filter(e => {
        if (!search) return true
        const name = `${e.firstName} ${e.lastName} ${e.employeeId}`.toLowerCase()
        return name.includes(search.toLowerCase())
    })

    const pending = employees.filter(e => {
        const completed = e.onboardingTasks.filter(t => t.status === "COMPLETED").length
        return completed === 0
    }).length

    const inProgress = employees.filter(e => {
        const completed = e.onboardingTasks.filter(t => t.status === "COMPLETED").length
        const total = e.onboardingTasks.length
        return completed > 0 && completed < total
    }).length

    const completedCount = employees.filter(e => {
        const completed = e.onboardingTasks.filter(t => t.status === "COMPLETED").length
        const total = e.onboardingTasks.length
        return total > 0 && completed === total
    }).length

    if (status === "loading") {
        return <div className="flex items-center justify-center min-h-screen"><Loader2 size={28} className="animate-spin text-[var(--accent)]" /></div>
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-[24px] font-semibold tracking-[-0.4px] text-[var(--text)]">Onboarding</h1>
                    <p className="text-[13px] text-[var(--text3)] mt-0.5">Track employee onboarding checklists</p>
                </div>
                <button onClick={() => setShowStart(true)}
                    className="inline-flex items-center gap-2 bg-[var(--accent)] text-white rounded-[10px] text-[13px] font-medium px-4 py-2 hover:opacity-90 transition-opacity">
                    <Plus size={16} /> Start Onboarding
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: "Pending", value: pending, color: "#ef4444", bg: "#fef2f2", icon: <Clock size={18} /> },
                    { label: "In Progress", value: inProgress, color: "#f59e0b", bg: "#fffbeb", icon: <ClipboardList size={18} /> },
                    { label: "Completed", value: completedCount, color: "#1a9e6e", bg: "#e8f7f1", icon: <CheckCheck size={18} /> },
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
            <div className="bg-white border border-[var(--border)] rounded-[12px] p-4">
                <div className="relative max-w-sm">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text3)]" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employees..."
                        className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-[var(--surface2)]/30 pl-8 pr-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors" />
                </div>
            </div>

            {/* Cards */}
            {loading ? (
                <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin text-[var(--accent)]" /></div>
            ) : filtered.length === 0 ? (
                <div className="flex min-h-[250px] flex-col items-center justify-center rounded-[14px] bg-white border border-dashed border-[var(--border)]">
                    <Users size={36} className="text-[var(--text3)] mb-2" />
                    <p className="text-[14px] font-semibold text-[var(--text)]">No onboarding records</p>
                    <p className="text-[13px] text-[var(--text3)] mt-1">Start onboarding for a new employee</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filtered.map(emp => {
                        const completed = emp.onboardingTasks.filter(t => t.status === "COMPLETED").length
                        const total = emp.onboardingTasks.length
                        const progress = total > 0 ? Math.round((completed / total) * 100) : 0
                        const statusLabel = progress === 100 ? "Completed" : progress === 0 ? "Pending" : "In Progress"
                        const statusColor = progress === 100 ? { color: "#1a9e6e", bg: "#e8f7f1" } : progress === 0 ? { color: "#ef4444", bg: "#fef2f2" } : { color: "#f59e0b", bg: "#fffbeb" }

                        return (
                            <div key={emp.id}
                                onClick={() => setSelectedEmployee(emp)}
                                className="bg-white border border-[var(--border)] rounded-[12px] p-4 cursor-pointer hover:border-[var(--accent)] hover:shadow-sm transition-all group">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-2.5">
                                        <Avatar firstName={emp.firstName} lastName={emp.lastName} photo={emp.photo} size={38} />
                                        <div>
                                            <p className="text-[14px] font-semibold text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">{emp.firstName} {emp.lastName}</p>
                                            <p className="text-[11px] text-[var(--text3)]">{emp.employeeId} · {emp.branch.name}</p>
                                        </div>
                                    </div>
                                    <ChevronRight size={16} className="text-[var(--text3)] mt-0.5 group-hover:text-[var(--accent)] transition-colors" />
                                </div>

                                {emp.designation && (
                                    <p className="text-[12px] text-[var(--text2)] mb-3">{emp.designation}</p>
                                )}

                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11.5px] text-[var(--text3)]">{completed}/{total} tasks</span>
                                        <span style={statusColor} className="text-[11px] font-semibold px-2 py-0.5 rounded-full">{statusLabel}</span>
                                    </div>
                                    <ProgressBar value={progress} />
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            <StartOnboardingModal open={showStart} onClose={() => setShowStart(false)} onSaved={fetchData} />

            {selectedEmployee && (
                <TaskDrawer
                    employee={selectedEmployee}
                    onClose={() => setSelectedEmployee(null)}
                    onUpdated={fetchData}
                />
            )}
        </div>
    )
}
