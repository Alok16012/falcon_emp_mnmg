"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import {
    UserPlus, Search, X, Loader2, Link2, Copy, ExternalLink,
    Trash2, RefreshCw, CheckCircle, FileText, Phone, User,
} from "lucide-react"
import { format } from "date-fns"

type JoinDoc = { id: string; type: string; fileName: string; fileUrl: string; status: string }
type Joining = {
    id: string
    employeeId: string
    firstName: string
    lastName: string
    phone: string
    fathersName: string | null
    aadharNumber: string | null
    designation: string | null
    dateOfJoining: string | null
    basicSalary: number
    shiftHours: number
    shiftStart: string | null
    shiftEnd: string | null
    photo: string | null
    status: string
    notes: string | null
    createdAt: string
    documents: JoinDoc[]
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
    ACTIVE: { label: "Approved", color: "#1a9e6e", bg: "#e8f7f1", border: "#6ee7b7" },
    INACTIVE: { label: "Pending", color: "#f59e0b", bg: "#fffbeb", border: "#fde68a" },
    ON_LEAVE: { label: "On Leave", color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb" },
    TERMINATED: { label: "Rejected", color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
    RESIGNED: { label: "Resigned", color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb" },
}

function fmtRupee(n: number) {
    return `₹${(n || 0).toLocaleString("en-IN")}`
}

function shiftTimeLabel(start?: string | null, end?: string | null): string {
    if (!start || !end) return "—"
    const fmt = (time: string) => {
        const [h, m] = time.split(":").map(Number)
        if (Number.isNaN(h) || Number.isNaN(m)) return time
        const suffix = h >= 12 ? "PM" : "AM"
        const hour = h % 12 || 12
        return `${hour}:${String(m).padStart(2, "0")} ${suffix}`
    }
    return `${fmt(start)} - ${fmt(end)}`
}

// Pull "Department/Site: X" out of the notes string the join API composed
function extractNote(notes: string | null, key: string): string | null {
    if (!notes) return null
    const m = notes.split("|").map(s => s.trim()).find(s => s.startsWith(key))
    return m ? m.slice(key.length).replace(/^[:\s]+/, "") : null
}

export default function JoiningsPage() {
    const [rows, setRows] = useState<Joining[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState("")
    const [publicUrl, setPublicUrl] = useState("")
    const [view, setView] = useState<Joining | null>(null)

    useEffect(() => {
        if (typeof window !== "undefined") setPublicUrl(`${window.location.origin}/join`)
    }, [])

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/joinings")
            if (!res.ok) throw new Error()
            setRows(await res.json())
        } catch {
            toast.error("Failed to load joining submissions")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { load() }, [load])

    async function updateStatus(id: string, status: string) {
        const prev = rows
        setRows(list => list.map(r => r.id === id ? { ...r, status } : r))
        try {
            const res = await fetch(`/api/joinings/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
            })
            if (!res.ok) throw new Error()
            toast.success(status === "ACTIVE" ? "Worker approved & activated" : "Status updated")
        } catch {
            setRows(prev)
            toast.error("Failed to update status")
        }
    }

    async function remove(id: string) {
        if (!confirm("Delete this submission? This removes the worker record and uploaded documents.")) return
        const prev = rows
        setRows(list => list.filter(r => r.id !== id))
        try {
            const res = await fetch(`/api/joinings/${id}`, { method: "DELETE" })
            if (!res.ok) throw new Error()
            toast.success("Submission deleted")
        } catch {
            setRows(prev)
            toast.error("Failed to delete")
        }
    }

    function copyLink() {
        navigator.clipboard.writeText(publicUrl)
        toast.success("Joining form link copied")
    }

    const filtered = rows.filter(r => {
        const q = search.toLowerCase()
        const name = `${r.firstName} ${r.lastName}`.toLowerCase()
        const matchesSearch = !q ||
            name.includes(q) ||
            r.phone?.toLowerCase().includes(q) ||
            (r.aadharNumber || "").toLowerCase().includes(q) ||
            (r.designation || "").toLowerCase().includes(q)
        const matchesStatus = !statusFilter || r.status === statusFilter
        return matchesSearch && matchesStatus
    })

    const counts = {
        total: rows.length,
        pending: rows.filter(r => r.status === "INACTIVE").length,
        approved: rows.filter(r => r.status === "ACTIVE").length,
        rejected: rows.filter(r => r.status === "TERMINATED").length,
    }

    return (
        <div className="p-6 max-w-[1200px] mx-auto">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-[10px] bg-[#1e3799] flex items-center justify-center text-white">
                        <UserPlus size={20} />
                    </div>
                    <div>
                        <h1 className="text-[20px] font-bold text-[var(--text)] leading-tight">Worker Joining</h1>
                        <p className="text-[13px] text-[var(--text2)]">Review workers who self-submitted via the joining form</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={load} className="inline-flex items-center gap-2 rounded-[8px] border border-[var(--border)] bg-white px-3 py-2 text-[13px] font-medium text-[var(--text2)] hover:bg-[var(--surface2)]">
                        <RefreshCw size={15} /> Refresh
                    </button>
                </div>
            </div>

            {/* External link box */}
            <div className="mb-5 rounded-[12px] border border-[var(--border)] bg-[var(--surface2)]/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                        <Link2 size={16} className="text-[#1e3799] shrink-0" />
                        <div className="min-w-0">
                            <p className="text-[12.5px] font-semibold text-[var(--text)]">Worker joining form link</p>
                            <p className="text-[12px] text-[var(--text2)] truncate">{publicUrl || "…"}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={copyLink} className="inline-flex items-center gap-1.5 rounded-[8px] border border-[var(--border)] bg-white px-3 py-1.5 text-[12.5px] font-medium text-[var(--text2)] hover:bg-[var(--surface2)]">
                            <Copy size={14} /> Copy
                        </button>
                        <a href={publicUrl || "/join"} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-[8px] border border-[var(--border)] bg-white px-3 py-1.5 text-[12.5px] font-medium text-[var(--text2)] hover:bg-[var(--surface2)]">
                            <ExternalLink size={14} /> Open
                        </a>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                <StatCard label="Total" value={counts.total} />
                <StatCard label="Pending" value={counts.pending} color="#f59e0b" />
                <StatCard label="Approved" value={counts.approved} color="#1a9e6e" />
                <StatCard label="Rejected" value={counts.rejected} color="#dc2626" />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text3)]" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search name, phone, Aadhaar, designation…"
                        className="w-full rounded-[8px] border border-[var(--border)] bg-white pl-9 pr-3 py-2 text-[13px] outline-none focus:border-[#1e3799]"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="rounded-[8px] border border-[var(--border)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#1e3799]"
                >
                    <option value="">All status</option>
                    <option value="INACTIVE">Pending</option>
                    <option value="ACTIVE">Approved</option>
                    <option value="TERMINATED">Rejected</option>
                </select>
            </div>

            {/* Table */}
            <div className="rounded-[12px] border border-[var(--border)] bg-white overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                        <thead>
                            <tr className="border-b border-[var(--border)] bg-[var(--surface2)]/40 text-left text-[var(--text2)]">
                                <th className="px-4 py-3 font-semibold">Worker</th>
                                <th className="px-4 py-3 font-semibold">Phone</th>
                                <th className="px-4 py-3 font-semibold">Designation</th>
                                <th className="px-4 py-3 font-semibold">Shift Time</th>
                                <th className="px-4 py-3 font-semibold text-right">Wage</th>
                                <th className="px-4 py-3 font-semibold">Docs</th>
                                <th className="px-4 py-3 font-semibold">Submitted</th>
                                <th className="px-4 py-3 font-semibold">Status</th>
                                <th className="px-4 py-3 font-semibold text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={9} className="px-4 py-10 text-center text-[var(--text3)]">
                                    <Loader2 size={20} className="animate-spin inline" />
                                </td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={9} className="px-4 py-10 text-center text-[var(--text3)]">No joining submissions yet</td></tr>
                            ) : filtered.map(r => {
                                const sc = STATUS_CONFIG[r.status] || STATUS_CONFIG.INACTIVE
                                return (
                                    <tr key={r.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface2)]/30">
                                        <td className="px-4 py-3">
                                            <button onClick={() => setView(r)} className="flex items-center gap-2.5 text-left group">
                                                {r.photo ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img src={r.photo} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
                                                ) : (
                                                    <span className="h-8 w-8 rounded-full bg-[var(--surface2)] flex items-center justify-center text-[var(--text3)] shrink-0"><User size={15} /></span>
                                                )}
                                                <span>
                                                    <span className="block font-medium text-[var(--text)] group-hover:text-[#1e3799]">{r.firstName} {r.lastName}</span>
                                                    <span className="block text-[12px] text-[var(--text3)]">{r.employeeId}</span>
                                                </span>
                                            </button>
                                        </td>
                                        <td className="px-4 py-3 text-[var(--text)] whitespace-nowrap">{r.phone}</td>
                                        <td className="px-4 py-3 text-[var(--text2)]">{r.designation || "—"}</td>
                                        <td className="px-4 py-3 text-[var(--text2)] whitespace-nowrap">
                                            {r.shiftStart && r.shiftEnd ? `${shiftTimeLabel(r.shiftStart, r.shiftEnd)} (${r.shiftHours} hr)` : "—"}
                                        </td>
                                        <td className="px-4 py-3 text-right text-[var(--text)] whitespace-nowrap">{r.basicSalary ? fmtRupee(r.basicSalary) : "—"}</td>
                                        <td className="px-4 py-3">
                                            <span className="inline-flex items-center gap-1 text-[12px] text-[var(--text2)]">
                                                <FileText size={13} /> {r.documents.length}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-[var(--text2)] whitespace-nowrap">{format(new Date(r.createdAt), "dd MMM yyyy")}</td>
                                        <td className="px-4 py-3">
                                            <span style={{ color: sc.color, background: sc.bg, borderColor: sc.border }} className="inline-block rounded-full border px-2.5 py-1 text-[12px] font-semibold">{sc.label}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-1">
                                                {r.status !== "ACTIVE" && (
                                                    <button onClick={() => updateStatus(r.id, "ACTIVE")} title="Approve & activate" className="inline-flex items-center gap-1 rounded-[7px] bg-[#1a9e6e] px-2.5 py-1.5 text-[12px] font-medium text-white hover:opacity-90">
                                                        <CheckCircle size={13} /> Approve
                                                    </button>
                                                )}
                                                <button onClick={() => remove(r.id)} title="Delete" className="text-[var(--text3)] hover:text-red-600 p-1.5">
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {view && <ViewModal row={view} onClose={() => setView(null)} onApprove={() => { updateStatus(view.id, "ACTIVE"); setView(null) }} />}
        </div>
    )
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
    return (
        <div className="rounded-[12px] border border-[var(--border)] bg-white p-4">
            <p className="text-[12px] text-[var(--text2)]">{label}</p>
            <p className="text-[22px] font-bold" style={{ color: color || "var(--text)" }}>{value}</p>
        </div>
    )
}

function ViewModal({ row, onClose, onApprove }: { row: Joining; onClose: () => void; onApprove: () => void }) {
    const dept = extractNote(row.notes, "Department/Site")
    const rel = extractNote(row.notes, "Emergency relationship")
    const statedId = extractNote(row.notes, "Worker-stated Employee ID")
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[14px] bg-white shadow-xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4 sticky top-0 bg-white">
                    <h2 className="text-[16px] font-bold text-[var(--text)]">Worker Joining Details</h2>
                    <button onClick={onClose} className="text-[var(--text3)] hover:text-[var(--text)]"><X size={18} /></button>
                </div>
                <div className="p-5">
                    <div className="flex items-center gap-4 mb-5">
                        {row.photo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={row.photo} alt="" className="h-20 w-20 rounded-[10px] object-cover border border-[var(--border)]" />
                        ) : (
                            <span className="h-20 w-20 rounded-[10px] bg-[var(--surface2)] flex items-center justify-center text-[var(--text3)]"><User size={28} /></span>
                        )}
                        <div>
                            <p className="text-[18px] font-bold text-[var(--text)]">{row.firstName} {row.lastName}</p>
                            <p className="text-[13px] text-[var(--text2)] flex items-center gap-1.5"><Phone size={13} /> {row.phone}</p>
                            <p className="text-[12px] text-[var(--text3)]">{row.employeeId}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-x-5 gap-y-3 text-[13px]">
                        <Detail label="Father's Name" value={row.fathersName} />
                        <Detail label="Designation" value={row.designation} />
                        <Detail label="Department / Site" value={dept} />
                        <Detail label="Aadhaar Number" value={row.aadharNumber} />
                        <Detail label="Wage Rate" value={row.basicSalary ? fmtRupee(row.basicSalary) : null} />
                        <Detail label="Shift Timing" value={row.shiftStart && row.shiftEnd ? `${shiftTimeLabel(row.shiftStart, row.shiftEnd)} (${row.shiftHours} hr)` : null} />
                        <Detail label="Date of Joining" value={row.dateOfJoining ? format(new Date(row.dateOfJoining), "dd MMM yyyy") : null} />
                        <Detail label="Emergency Relationship" value={rel} />
                        <Detail label="Worker-stated ID" value={statedId} />
                    </div>

                    {/* Documents */}
                    <div className="mt-6">
                        <p className="text-[13px] font-semibold text-[var(--text)] mb-2">Uploaded Documents</p>
                        {row.documents.length === 0 ? (
                            <p className="text-[12px] text-[var(--text3)]">No documents uploaded</p>
                        ) : (
                            <div className="grid grid-cols-3 gap-3">
                                {row.documents.map(d => (
                                    <a key={d.id} href={d.fileUrl} target="_blank" rel="noreferrer" className="block rounded-[10px] border border-[var(--border)] overflow-hidden hover:border-[#1e3799] transition-colors">
                                        {d.fileUrl.startsWith("data:image") ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={d.fileUrl} alt={d.type} className="h-28 w-full object-cover" />
                                        ) : (
                                            <div className="h-28 w-full flex items-center justify-center bg-[var(--surface2)] text-[var(--text3)]"><FileText size={28} /></div>
                                        )}
                                        <p className="px-2 py-1.5 text-[11px] font-medium text-[var(--text2)] truncate">{d.type}</p>
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex justify-end gap-2 border-t border-[var(--border)] px-5 py-4 sticky bottom-0 bg-white">
                    <button onClick={onClose} className="rounded-[8px] border border-[var(--border)] px-4 py-2 text-[13px] font-medium text-[var(--text2)] hover:bg-[var(--surface2)]">Close</button>
                    {row.status !== "ACTIVE" && (
                        <button onClick={onApprove} className="inline-flex items-center gap-2 rounded-[8px] bg-[#1a9e6e] px-4 py-2 text-[13px] font-medium text-white hover:opacity-90">
                            <CheckCircle size={15} /> Approve & Activate
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

function Detail({ label, value }: { label: string; value: string | null }) {
    return (
        <div>
            <p className="text-[11px] font-medium text-[var(--text3)] uppercase tracking-wide">{label}</p>
            <p className="text-[13px] text-[var(--text)]">{value || "—"}</p>
        </div>
    )
}
