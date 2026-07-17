"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import {
    PackageSearch, Plus, Search, X, Loader2, Link2, Copy,
    Trash2, RefreshCw, ExternalLink,
} from "lucide-react"
import { format } from "date-fns"

type Inquiry = {
    id: string
    name: string
    productName: string
    quantity: number
    rate: number
    location: string
    partyName: string
    status: string
    createdAt: string
    updatedAt: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
    ACTIVE: { label: "Active", color: "#1a9e6e", bg: "#e8f7f1", border: "#6ee7b7" },
    INACTIVE: { label: "Inactive", color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb" },
    PENDING: { label: "Pending", color: "#f59e0b", bg: "#fffbeb", border: "#fde68a" },
}

const STATUS_OPTIONS = ["PENDING", "ACTIVE", "INACTIVE"]

function fmtRupee(n: number) {
    return `₹${n.toLocaleString("en-IN")}`
}

export default function InquiriesPage() {
    const [inquiries, setInquiries] = useState<Inquiry[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState("")
    const [showAdd, setShowAdd] = useState(false)
    const [publicUrl, setPublicUrl] = useState("")

    useEffect(() => {
        if (typeof window !== "undefined") {
            setPublicUrl(`${window.location.origin}/inquiry`)
        }
    }, [])

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/inquiries")
            if (!res.ok) throw new Error()
            setInquiries(await res.json())
        } catch {
            toast.error("Failed to load inquiries")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { load() }, [load])

    async function updateStatus(id: string, status: string) {
        const prev = inquiries
        setInquiries(list => list.map(i => i.id === id ? { ...i, status } : i))
        try {
            const res = await fetch(`/api/inquiries/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
            })
            if (!res.ok) throw new Error()
            toast.success("Status updated")
        } catch {
            setInquiries(prev)
            toast.error("Failed to update status")
        }
    }

    async function remove(id: string) {
        if (!confirm("Delete this inquiry?")) return
        const prev = inquiries
        setInquiries(list => list.filter(i => i.id !== id))
        try {
            const res = await fetch(`/api/inquiries/${id}`, { method: "DELETE" })
            if (!res.ok) throw new Error()
            toast.success("Inquiry deleted")
        } catch {
            setInquiries(prev)
            toast.error("Failed to delete")
        }
    }

    function copyLink() {
        navigator.clipboard.writeText(publicUrl)
        toast.success("External link copied")
    }

    const filtered = inquiries.filter(i => {
        const q = search.toLowerCase()
        const matchesSearch = !q ||
            i.name.toLowerCase().includes(q) ||
            i.productName.toLowerCase().includes(q) ||
            i.partyName.toLowerCase().includes(q) ||
            i.location.toLowerCase().includes(q)
        const matchesStatus = !statusFilter || i.status === statusFilter
        return matchesSearch && matchesStatus
    })

    const counts = {
        total: inquiries.length,
        pending: inquiries.filter(i => i.status === "PENDING").length,
        active: inquiries.filter(i => i.status === "ACTIVE").length,
        inactive: inquiries.filter(i => i.status === "INACTIVE").length,
    }

    return (
        <div className="w-full p-4 md:p-6 max-w-[1200px] mx-auto">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-[10px] bg-[#5b5bd6] flex items-center justify-center text-white">
                        <PackageSearch size={20} />
                    </div>
                    <div>
                        <h1 className="text-[20px] font-bold text-[var(--text)] leading-tight">Product Inquiry</h1>
                        <p className="text-[13px] text-[var(--text2)]">Manage inquiries submitted via the external form</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={load} className="inline-flex items-center gap-2 rounded-[8px] border border-[var(--border)] bg-white px-3 py-2 text-[13px] font-medium text-[var(--text2)] hover:bg-[var(--surface2)]">
                        <RefreshCw size={15} /> Refresh
                    </button>
                    <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 rounded-[8px] bg-[#5b5bd6] px-3 py-2 text-[13px] font-medium text-white hover:opacity-90">
                        <Plus size={15} /> Add Inquiry
                    </button>
                </div>
            </div>

            {/* External link box */}
            <div className="mb-5 rounded-[12px] border border-[var(--border)] bg-[var(--surface2)]/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                        <Link2 size={16} className="text-[#5b5bd6] shrink-0" />
                        <div className="min-w-0">
                            <p className="text-[12.5px] font-semibold text-[var(--text)]">External inquiry form link</p>
                            <p className="text-[12px] text-[var(--text2)] truncate">{publicUrl || "…"}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={copyLink} className="inline-flex items-center gap-1.5 rounded-[8px] border border-[var(--border)] bg-white px-3 py-1.5 text-[12.5px] font-medium text-[var(--text2)] hover:bg-[var(--surface2)]">
                            <Copy size={14} /> Copy
                        </button>
                        <a href={publicUrl || "/inquiry"} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-[8px] border border-[var(--border)] bg-white px-3 py-1.5 text-[12.5px] font-medium text-[var(--text2)] hover:bg-[var(--surface2)]">
                            <ExternalLink size={14} /> Open
                        </a>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                <StatCard label="Total" value={counts.total} />
                <StatCard label="Pending" value={counts.pending} color="#f59e0b" />
                <StatCard label="Active" value={counts.active} color="#1a9e6e" />
                <StatCard label="Inactive" value={counts.inactive} color="#6b7280" />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text3)]" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search name, product, party, location…"
                        className="w-full rounded-[8px] border border-[var(--border)] bg-white pl-9 pr-3 py-2 text-[13px] outline-none focus:border-[#5b5bd6]"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="rounded-[8px] border border-[var(--border)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#5b5bd6]"
                >
                    <option value="">All status</option>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
                </select>
            </div>

            {/* Mobile card list */}
            <div className="md:hidden space-y-2.5">
                {loading ? (
                    <div className="py-12 text-center text-[var(--text3)] bg-white border border-[var(--border)] rounded-[16px]">
                        <Loader2 size={20} className="animate-spin inline" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="py-12 text-center text-[var(--text3)] bg-white border border-[var(--border)] rounded-[16px] text-[13px]">No inquiries found</div>
                ) : filtered.map(i => {
                    const sc = STATUS_CONFIG[i.status] || STATUS_CONFIG.PENDING
                    return (
                        <div key={i.id} className="bg-white border border-[var(--border)] rounded-[16px] p-3.5 shadow-[0_2px_10px_rgba(80,80,170,0.05)]">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="text-[14px] font-semibold text-[var(--text)] truncate">{i.partyName}</p>
                                    <p className="text-[12px] text-[var(--text3)]">{i.name}</p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <select
                                        value={i.status}
                                        onChange={e => updateStatus(i.id, e.target.value)}
                                        style={{ color: sc.color, background: sc.bg, borderColor: sc.border }}
                                        className="rounded-full border px-2.5 py-1 text-[11.5px] font-semibold outline-none cursor-pointer"
                                    >
                                        {STATUS_OPTIONS.map(s => <option key={s} value={s} style={{ color: "#111", background: "#fff" }}>{STATUS_CONFIG[s].label}</option>)}
                                    </select>
                                    <button onClick={() => remove(i.id)} className="text-[var(--text3)] hover:text-red-600 p-1">
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-2.5 pt-2.5 border-t border-[var(--border)] text-[12px]">
                                <p className="col-span-2"><span className="text-[var(--text3)]">Product:</span> <span className="font-medium text-[var(--text)]">{i.productName}</span></p>
                                <p><span className="text-[var(--text3)]">Qty:</span> <span className="font-medium text-[var(--text)]">{i.quantity}</span></p>
                                <p><span className="text-[var(--text3)]">Rate:</span> <span className="font-medium text-[var(--text)]">{fmtRupee(i.rate)}</span></p>
                                <p className="truncate"><span className="text-[var(--text3)]">Location:</span> <span className="text-[var(--text2)]">{i.location}</span></p>
                                <p><span className="text-[var(--text3)]">Date:</span> <span className="text-[var(--text2)]">{format(new Date(i.createdAt), "dd MMM yyyy")}</span></p>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Table (desktop) */}
            <div className="hidden md:block rounded-[16px] border border-[var(--border)] bg-white overflow-hidden shadow-[0_2px_10px_rgba(80,80,170,0.05)]">
                <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                        <thead>
                            <tr className="border-b border-[var(--border)] bg-[var(--surface2)]/40 text-left text-[var(--text2)]">
                                <th className="px-4 py-3 font-semibold">Party / Name</th>
                                <th className="px-4 py-3 font-semibold">Product</th>
                                <th className="px-4 py-3 font-semibold text-right">Qty</th>
                                <th className="px-4 py-3 font-semibold text-right">Rate</th>
                                <th className="px-4 py-3 font-semibold">Location</th>
                                <th className="px-4 py-3 font-semibold">Date</th>
                                <th className="px-4 py-3 font-semibold">Status</th>
                                <th className="px-4 py-3 font-semibold text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={8} className="px-4 py-10 text-center text-[var(--text3)]">
                                    <Loader2 size={20} className="animate-spin inline" />
                                </td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={8} className="px-4 py-10 text-center text-[var(--text3)]">No inquiries found</td></tr>
                            ) : filtered.map(i => {
                                const sc = STATUS_CONFIG[i.status] || STATUS_CONFIG.PENDING
                                return (
                                    <tr key={i.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface2)]/30">
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-[var(--text)]">{i.partyName}</div>
                                            <div className="text-[12px] text-[var(--text3)]">{i.name}</div>
                                        </td>
                                        <td className="px-4 py-3 text-[var(--text)]">{i.productName}</td>
                                        <td className="px-4 py-3 text-right text-[var(--text)]">{i.quantity}</td>
                                        <td className="px-4 py-3 text-right text-[var(--text)]">{fmtRupee(i.rate)}</td>
                                        <td className="px-4 py-3 text-[var(--text2)]">{i.location}</td>
                                        <td className="px-4 py-3 text-[var(--text2)] whitespace-nowrap">{format(new Date(i.createdAt), "dd MMM yyyy")}</td>
                                        <td className="px-4 py-3">
                                            <select
                                                value={i.status}
                                                onChange={e => updateStatus(i.id, e.target.value)}
                                                style={{ color: sc.color, background: sc.bg, borderColor: sc.border }}
                                                className="rounded-full border px-2.5 py-1 text-[12px] font-semibold outline-none cursor-pointer"
                                            >
                                                {STATUS_OPTIONS.map(s => <option key={s} value={s} style={{ color: "#111", background: "#fff" }}>{STATUS_CONFIG[s].label}</option>)}
                                            </select>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button onClick={() => remove(i.id)} className="text-[var(--text3)] hover:text-red-600 p-1">
                                                <Trash2 size={15} />
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {showAdd && <AddInquiryModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load() }} />}
        </div>
    )
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
    return (
        <div className="rounded-[16px] border border-[var(--border)] bg-white p-4 shadow-[0_2px_10px_rgba(80,80,170,0.05)]">
            <p className="text-[12.5px] text-[var(--text2)] font-medium">{label}</p>
            <p className="text-[24px] font-bold mt-1" style={{ color: color || "var(--text)" }}>{value}</p>
        </div>
    )
}

function AddInquiryModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
    const [form, setForm] = useState({ name: "", productName: "", quantity: "", rate: "", location: "", partyName: "", status: "PENDING" })
    const [saving, setSaving] = useState(false)

    function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

    async function submit() {
        if (!form.name || !form.productName || !form.quantity || !form.rate || !form.location || !form.partyName) {
            toast.error("Please fill all fields")
            return
        }
        setSaving(true)
        try {
            const res = await fetch("/api/inquiries", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            })
            if (!res.ok) throw new Error()
            toast.success("Inquiry added")
            onSaved()
        } catch {
            toast.error("Failed to add inquiry")
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
            <div className="w-full max-w-md rounded-[14px] bg-white shadow-xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
                    <h2 className="text-[16px] font-bold text-[var(--text)]">Add Inquiry</h2>
                    <button onClick={onClose} className="text-[var(--text3)] hover:text-[var(--text)]"><X size={18} /></button>
                </div>
                <div className="grid grid-cols-2 gap-3 p-5">
                    <Field label="Party Name" className="col-span-2"><Inp value={form.partyName} onChange={v => set("partyName", v)} /></Field>
                    <Field label="Contact Name" className="col-span-2"><Inp value={form.name} onChange={v => set("name", v)} /></Field>
                    <Field label="Product Name" className="col-span-2"><Inp value={form.productName} onChange={v => set("productName", v)} /></Field>
                    <Field label="Quantity"><Inp type="number" value={form.quantity} onChange={v => set("quantity", v)} /></Field>
                    <Field label="Rate (₹)"><Inp type="number" value={form.rate} onChange={v => set("rate", v)} /></Field>
                    <Field label="Location" className="col-span-2"><Inp value={form.location} onChange={v => set("location", v)} /></Field>
                    <Field label="Status" className="col-span-2">
                        <select value={form.status} onChange={e => set("status", e.target.value)} className="w-full rounded-[8px] border border-[var(--border)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#5b5bd6]">
                            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
                        </select>
                    </Field>
                </div>
                <div className="flex justify-end gap-2 border-t border-[var(--border)] px-5 py-4">
                    <button onClick={onClose} className="rounded-[8px] border border-[var(--border)] px-4 py-2 text-[13px] font-medium text-[var(--text2)] hover:bg-[var(--surface2)]">Cancel</button>
                    <button onClick={submit} disabled={saving} className="inline-flex items-center gap-2 rounded-[8px] bg-[#5b5bd6] px-4 py-2 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-60">
                        {saving && <Loader2 size={15} className="animate-spin" />} Save
                    </button>
                </div>
            </div>
        </div>
    )
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
    return (
        <div className={className}>
            <label className="mb-1 block text-[12px] font-medium text-[var(--text2)]">{label}</label>
            {children}
        </div>
    )
}

function Inp({ value, onChange, type = "text" }: { value: string; onChange: (v: string) => void; type?: string }) {
    return (
        <input
            type={type}
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-full rounded-[8px] border border-[var(--border)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#5b5bd6]"
        />
    )
}
