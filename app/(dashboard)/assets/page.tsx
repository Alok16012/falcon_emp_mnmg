"use client"
import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
    Plus, Search, Loader2, X, Package, Shirt, CreditCard,
    Wrench, Shield, Box, Edit2, RotateCcw, Users, Archive,
    CheckCircle, AlertTriangle
} from "lucide-react"
import { format } from "date-fns"

// ─── Types ────────────────────────────────────────────────────────────────────

type Asset = {
    id: string
    name: string
    category: string
    serialNo?: string | null
    totalQty: number
    availableQty: number
    createdAt: string
}

type Employee = {
    id: string
    firstName: string
    lastName: string
    employeeId: string
    designation?: string | null
    photo?: string | null
}

type Assignment = {
    id: string
    employeeId: string
    assetId: string
    issuedAt: string
    returnedAt?: string | null
    remarks?: string | null
    employee: {
        id: string
        firstName: string
        lastName: string
        employeeId: string
        designation?: string | null
        photo?: string | null
    }
    asset: {
        id: string
        name: string
        category: string
        serialNo?: string | null
    }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = ["All", "Uniform", "ID Card", "Tool", "Equipment", "Safety Gear", "Other"]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCategoryIcon(category: string) {
    switch (category) {
        case "Uniform": return <Shirt size={18} />
        case "ID Card": return <CreditCard size={18} />
        case "Tool": return <Wrench size={18} />
        case "Equipment": return <Package size={18} />
        case "Safety Gear": return <Shield size={18} />
        default: return <Box size={18} />
    }
}

function getCategoryColor(category: string): { bg: string; color: string } {
    switch (category) {
        case "Uniform": return { bg: "#eff6ff", color: "#3b82f6" }
        case "ID Card": return { bg: "#fdf4ff", color: "#a855f7" }
        case "Tool": return { bg: "#fff7ed", color: "#f97316" }
        case "Equipment": return { bg: "#f0fdf4", color: "#22c55e" }
        case "Safety Gear": return { bg: "#fef2f2", color: "#ef4444" }
        default: return { bg: "#f9fafb", color: "#6b7280" }
    }
}

function Avatar({
    firstName, lastName, photo, size = 36
}: {
    firstName: string; lastName: string; photo?: string | null; size?: number
}) {
    const initials = `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase()
    const colors = ["#1a9e6e", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444"]
    const bg = colors[(firstName.charCodeAt(0) + lastName.charCodeAt(0)) % colors.length]
    if (photo) return <img src={photo} alt="" style={{ width: size, height: size }} className="rounded-full object-cover" />
    return (
        <div style={{ width: size, height: size, background: bg }}
            className="rounded-full flex items-center justify-center text-white font-semibold text-[12px] shrink-0">
            {initials}
        </div>
    )
}

// ─── Add/Edit Asset Modal ─────────────────────────────────────────────────────

function AssetModal({
    open, onClose, onSaved, editAsset
}: {
    open: boolean
    onClose: () => void
    onSaved: () => void
    editAsset?: Asset | null
}) {
    const [loading, setLoading] = useState(false)
    const [form, setForm] = useState({
        name: "",
        category: "Uniform",
        serialNo: "",
        totalQty: "1",
    })

    useEffect(() => {
        if (open) {
            if (editAsset) {
                setForm({
                    name: editAsset.name,
                    category: editAsset.category,
                    serialNo: editAsset.serialNo || "",
                    totalQty: String(editAsset.totalQty),
                })
            } else {
                setForm({ name: "", category: "Uniform", serialNo: "", totalQty: "1" })
            }
        }
    }, [open, editAsset])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            const url = editAsset ? `/api/assets/${editAsset.id}` : "/api/assets"
            const method = editAsset ? "PUT" : "POST"
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            })
            if (!res.ok) throw new Error(await res.text())
            toast.success(editAsset ? "Asset updated!" : "Asset created!")
            onSaved()
            onClose()
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to save asset")
        } finally {
            setLoading(false)
        }
    }

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-[16px] border border-[var(--border)] w-full max-w-md shadow-xl">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
                    <h2 className="text-[15px] font-semibold text-[var(--text)]">
                        {editAsset ? "Edit Asset" : "Add Asset"}
                    </h2>
                    <button onClick={onClose} className="p-1 text-[var(--text3)] hover:text-[var(--text)] rounded-md hover:bg-[var(--surface2)] transition-colors">
                        <X size={18} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div>
                        <label className="block text-[12px] text-[var(--text2)] mb-1">Asset Name *</label>
                        <input
                            value={form.name}
                            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            placeholder="e.g. Safety Helmet"
                            className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-[12px] text-[var(--text2)] mb-1">Category *</label>
                        <select
                            value={form.category}
                            onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                            className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors"
                            required
                        >
                            {CATEGORIES.filter(c => c !== "All").map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[12px] text-[var(--text2)] mb-1">Serial No</label>
                        <input
                            value={form.serialNo}
                            onChange={e => setForm(f => ({ ...f, serialNo: e.target.value }))}
                            placeholder="Optional serial number"
                            className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors"
                        />
                    </div>
                    <div>
                        <label className="block text-[12px] text-[var(--text2)] mb-1">Total Quantity *</label>
                        <input
                            type="number"
                            min="1"
                            value={form.totalQty}
                            onChange={e => setForm(f => ({ ...f, totalQty: e.target.value }))}
                            className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors"
                            required
                        />
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-[13px] font-medium text-[var(--text2)] hover:text-[var(--text)] rounded-[8px] hover:bg-[var(--surface2)] transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="inline-flex items-center gap-2 px-5 py-2 bg-[var(--accent)] text-white rounded-[8px] text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                            {loading && <Loader2 size={14} className="animate-spin" />}
                            {editAsset ? "Save Changes" : "Add Asset"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// ─── Assign Asset Modal ───────────────────────────────────────────────────────

function AssignModal({
    open, onClose, onSaved, assets
}: {
    open: boolean
    onClose: () => void
    onSaved: () => void
    assets: Asset[]
}) {
    const [loading, setLoading] = useState(false)
    const [employees, setEmployees] = useState<Employee[]>([])
    const [empSearch, setEmpSearch] = useState("")
    const [form, setForm] = useState({
        employeeId: "",
        assetId: "",
        remarks: "",
    })

    useEffect(() => {
        if (open) {
            setForm({ employeeId: "", assetId: "", remarks: "" })
            setEmpSearch("")
            fetch("/api/employees?status=ACTIVE")
                .then(r => r.json())
                .then(data => setEmployees(Array.isArray(data) ? data : []))
                .catch(() => { })
        }
    }, [open])

    const filteredEmployees = employees.filter(e => {
        if (!empSearch) return true
        const q = empSearch.toLowerCase()
        return (
            e.firstName.toLowerCase().includes(q) ||
            e.lastName.toLowerCase().includes(q) ||
            e.employeeId.toLowerCase().includes(q)
        )
    })

    const availableAssets = assets.filter(a => a.availableQty > 0)
    const selectedAsset = assets.find(a => a.id === form.assetId)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            const res = await fetch("/api/assets/assign", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            })
            if (!res.ok) throw new Error(await res.text())
            toast.success("Asset assigned successfully!")
            onSaved()
            onClose()
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to assign asset")
        } finally {
            setLoading(false)
        }
    }

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-[16px] border border-[var(--border)] w-full max-w-md shadow-xl">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
                    <h2 className="text-[15px] font-semibold text-[var(--text)]">Assign Asset</h2>
                    <button onClick={onClose} className="p-1 text-[var(--text3)] hover:text-[var(--text)] rounded-md hover:bg-[var(--surface2)] transition-colors">
                        <X size={18} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div>
                        <label className="block text-[12px] text-[var(--text2)] mb-1">Search Employee</label>
                        <input
                            value={empSearch}
                            onChange={e => setEmpSearch(e.target.value)}
                            placeholder="Type to search..."
                            className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors mb-1"
                        />
                        <select
                            value={form.employeeId}
                            onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))}
                            className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors"
                            required
                            size={4}
                        >
                            <option value="">Select employee</option>
                            {filteredEmployees.map(e => (
                                <option key={e.id} value={e.id}>
                                    {e.firstName} {e.lastName} ({e.employeeId})
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[12px] text-[var(--text2)] mb-1">Asset *</label>
                        <select
                            value={form.assetId}
                            onChange={e => setForm(f => ({ ...f, assetId: e.target.value }))}
                            className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors"
                            required
                        >
                            <option value="">Select asset</option>
                            {availableAssets.map(a => (
                                <option key={a.id} value={a.id}>
                                    {a.name} — {a.availableQty} available
                                </option>
                            ))}
                        </select>
                        {selectedAsset && (
                            <p className="text-[11px] text-[var(--text3)] mt-1">
                                {selectedAsset.availableQty} of {selectedAsset.totalQty} units available
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="block text-[12px] text-[var(--text2)] mb-1">Remarks</label>
                        <textarea
                            value={form.remarks}
                            onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                            placeholder="Optional notes..."
                            className="w-full rounded-[8px] border border-[var(--border)] bg-white px-3 py-2 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors resize-none"
                            rows={2}
                        />
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-[13px] font-medium text-[var(--text2)] hover:text-[var(--text)] rounded-[8px] hover:bg-[var(--surface2)] transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="inline-flex items-center gap-2 px-5 py-2 bg-[var(--accent)] text-white rounded-[8px] text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                            {loading && <Loader2 size={14} className="animate-spin" />}
                            Assign Asset
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// ─── Stock Bar ────────────────────────────────────────────────────────────────

function StockBar({ available, total }: { available: number; total: number }) {
    const pct = total === 0 ? 0 : Math.round((available / total) * 100)
    const color = pct > 50 ? "#1a9e6e" : pct >= 20 ? "#f59e0b" : "#ef4444"
    return (
        <div>
            <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-[var(--text3)]">{available} / {total} available</span>
                <span className="text-[11px] font-medium" style={{ color }}>{pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--surface2)] overflow-hidden">
                <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: color }}
                />
            </div>
        </div>
    )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AssetsPage() {
    const { data: session, status } = useSession()
    const router = useRouter()

    const [activeTab, setActiveTab] = useState<"assets" | "assignments">("assets")
    const [assets, setAssets] = useState<Asset[]>([])
    const [assignments, setAssignments] = useState<Assignment[]>([])
    const [loading, setLoading] = useState(true)
    const [assignLoading, setAssignLoading] = useState(false)

    const [search, setSearch] = useState("")
    const [categoryFilter, setCategoryFilter] = useState("All")
    const [assignSearch, setAssignSearch] = useState("")

    const [showAddAsset, setShowAddAsset] = useState(false)
    const [editAsset, setEditAsset] = useState<Asset | null>(null)
    const [showAssign, setShowAssign] = useState(false)
    const [returningId, setReturningId] = useState<string | null>(null)

    useEffect(() => {
        if (status === "unauthenticated") router.push("/login")
    }, [status, router])

    const fetchAssets = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (search) params.set("search", search)
            if (categoryFilter && categoryFilter !== "All") params.set("category", categoryFilter)
            const res = await fetch(`/api/assets?${params}`)
            const data = await res.json()
            setAssets(Array.isArray(data) ? data : [])
        } catch {
            toast.error("Failed to load assets")
        } finally {
            setLoading(false)
        }
    }, [search, categoryFilter])

    const fetchAssignments = useCallback(async () => {
        setAssignLoading(true)
        try {
            const params = new URLSearchParams()
            if (assignSearch) params.set("search", assignSearch)
            const res = await fetch(`/api/assets/assign?${params}`)
            const data = await res.json()
            setAssignments(Array.isArray(data) ? data : [])
        } catch {
            toast.error("Failed to load assignments")
        } finally {
            setAssignLoading(false)
        }
    }, [assignSearch])

    useEffect(() => {
        if (status === "authenticated") fetchAssets()
    }, [status, fetchAssets])

    useEffect(() => {
        if (status === "authenticated" && activeTab === "assignments") fetchAssignments()
    }, [status, activeTab, fetchAssignments])

    const handleReturn = async (assignmentId: string) => {
        if (!confirm("Mark this asset as returned?")) return
        setReturningId(assignmentId)
        try {
            const res = await fetch(`/api/assets/assign/${assignmentId}`, { method: "PUT" })
            if (!res.ok) throw new Error(await res.text())
            toast.success("Asset returned successfully!")
            fetchAssignments()
            fetchAssets()
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to return asset")
        } finally {
            setReturningId(null)
        }
    }

    // Stats
    const totalAssets = assets.length
    const totalItems = assets.reduce((s, a) => s + a.totalQty, 0)
    const assignedItems = assets.reduce((s, a) => s + (a.totalQty - a.availableQty), 0)
    const availableItems = assets.reduce((s, a) => s + a.availableQty, 0)

    // Filter assignments
    const filteredAssignments = assignments.filter(a => {
        if (!assignSearch) return true
        const q = assignSearch.toLowerCase()
        return (
            a.employee.firstName.toLowerCase().includes(q) ||
            a.employee.lastName.toLowerCase().includes(q) ||
            a.employee.employeeId.toLowerCase().includes(q)
        )
    })

    if (status === "loading") {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 size={28} className="animate-spin text-[var(--accent)]" />
            </div>
        )
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-[24px] font-semibold tracking-[-0.4px] text-[var(--text)]">Asset Management</h1>
                    <p className="text-[13px] text-[var(--text3)] mt-0.5">Track and manage company assets assigned to employees</p>
                </div>
                {activeTab === "assets" ? (
                    <button
                        onClick={() => setShowAddAsset(true)}
                        className="inline-flex items-center gap-2 bg-[var(--accent)] text-white rounded-[10px] text-[13px] font-medium px-4 py-2 hover:opacity-90 transition-opacity"
                    >
                        <Plus size={16} /> Add Asset
                    </button>
                ) : (
                    <button
                        onClick={() => setShowAssign(true)}
                        className="inline-flex items-center gap-2 bg-[var(--accent)] text-white rounded-[10px] text-[13px] font-medium px-4 py-2 hover:opacity-90 transition-opacity"
                    >
                        <Plus size={16} /> Assign Asset
                    </button>
                )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: "Total Assets", value: totalAssets, color: "#3b82f6", bg: "#eff6ff", icon: <Archive size={18} /> },
                    { label: "Total Items", value: totalItems, color: "#8b5cf6", bg: "#fdf4ff", icon: <Package size={18} /> },
                    { label: "Assigned Items", value: assignedItems, color: "#f59e0b", bg: "#fffbeb", icon: <Users size={18} /> },
                    { label: "Available Items", value: availableItems, color: "#1a9e6e", bg: "#e8f7f1", icon: <CheckCircle size={18} /> },
                ].map(s => (
                    <div key={s.label} className="bg-white border border-[var(--border)] rounded-[12px] p-4 flex items-center gap-3">
                        <div style={{ background: s.bg, color: s.color }} className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0">
                            {s.icon}
                        </div>
                        <div>
                            <p className="text-[22px] font-bold text-[var(--text)] leading-tight">{s.value}</p>
                            <p className="text-[11.5px] text-[var(--text3)]">{s.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 border-b border-[var(--border)]">
                {(["assets", "assignments"] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2.5 text-[13px] font-medium capitalize border-b-2 transition-colors ${activeTab === tab
                            ? "border-[var(--accent)] text-[var(--accent)]"
                            : "border-transparent text-[var(--text2)] hover:text-[var(--text)]"
                            }`}
                    >
                        {tab === "assets" ? "Assets" : "Assignments"}
                    </button>
                ))}
            </div>

            {/* ── ASSETS TAB ── */}
            {activeTab === "assets" && (
                <>
                    {/* Filters */}
                    <div className="bg-white border border-[var(--border)] rounded-[12px] p-4 flex flex-col gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative flex-1 min-w-[200px]">
                                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text3)]" />
                                <input
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Search assets..."
                                    className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-[var(--surface2)]/30 pl-8 pr-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors"
                                />
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {CATEGORIES.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setCategoryFilter(cat)}
                                    className={`px-3 py-1.5 rounded-[7px] text-[12px] font-medium transition-colors ${categoryFilter === cat
                                        ? "bg-[var(--accent)] text-white"
                                        : "border border-[var(--border)] text-[var(--text2)] hover:bg-[var(--surface2)]"
                                        }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Asset Cards Grid */}
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 size={28} className="animate-spin text-[var(--accent)]" />
                        </div>
                    ) : assets.length === 0 ? (
                        <div className="flex min-h-[250px] flex-col items-center justify-center rounded-[14px] bg-white border border-dashed border-[var(--border)]">
                            <Package size={36} className="text-[var(--text3)] mb-2" />
                            <p className="text-[14px] font-semibold text-[var(--text)]">No assets found</p>
                            <p className="text-[13px] text-[var(--text3)] mt-1">Add your first asset to get started</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {assets.map(asset => {
                                const catColors = getCategoryColor(asset.category)
                                return (
                                    <div key={asset.id} className="bg-white border border-[var(--border)] rounded-[12px] p-4 flex flex-col gap-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-3">
                                                <div
                                                    style={{ background: catColors.bg, color: catColors.color }}
                                                    className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0"
                                                >
                                                    {getCategoryIcon(asset.category)}
                                                </div>
                                                <div className="min-w-0">
                                                    <h3 className="text-[14px] font-semibold text-[var(--text)] truncate">{asset.name}</h3>
                                                    <span
                                                        style={{ background: catColors.bg, color: catColors.color }}
                                                        className="inline-block text-[10.5px] font-medium px-2 py-0.5 rounded-full mt-0.5"
                                                    >
                                                        {asset.category}
                                                    </span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setEditAsset(asset)}
                                                className="p-1.5 text-[var(--text3)] hover:text-[var(--text)] hover:bg-[var(--surface2)] rounded-[6px] transition-colors shrink-0"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                        </div>

                                        <StockBar available={asset.availableQty} total={asset.totalQty} />

                                        {asset.serialNo && (
                                            <p className="text-[11px] text-[var(--text3)]">
                                                <span className="font-medium">S/N:</span> {asset.serialNo}
                                            </p>
                                        )}

                                        {asset.availableQty === 0 && (
                                            <div className="flex items-center gap-1.5 text-[11.5px] text-[#ef4444]">
                                                <AlertTriangle size={12} />
                                                <span>Out of stock</span>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </>
            )}

            {/* ── ASSIGNMENTS TAB ── */}
            {activeTab === "assignments" && (
                <>
                    {/* Search */}
                    <div className="bg-white border border-[var(--border)] rounded-[12px] p-4">
                        <div className="relative">
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text3)]" />
                            <input
                                value={assignSearch}
                                onChange={e => setAssignSearch(e.target.value)}
                                placeholder="Search by employee name or ID..."
                                className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-[var(--surface2)]/30 pl-8 pr-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors"
                            />
                        </div>
                    </div>

                    {/* Assignment List */}
                    {assignLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 size={28} className="animate-spin text-[var(--accent)]" />
                        </div>
                    ) : filteredAssignments.length === 0 ? (
                        <div className="flex min-h-[250px] flex-col items-center justify-center rounded-[14px] bg-white border border-dashed border-[var(--border)]">
                            <Users size={36} className="text-[var(--text3)] mb-2" />
                            <p className="text-[14px] font-semibold text-[var(--text)]">No assignments found</p>
                            <p className="text-[13px] text-[var(--text3)] mt-1">Assign an asset to an employee to get started</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredAssignments.map(a => {
                                const isReturned = !!a.returnedAt
                                const catColors = getCategoryColor(a.asset.category)
                                return (
                                    <div key={a.id} className="bg-white border border-[var(--border)] rounded-[12px] p-4">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex items-start gap-3 flex-1 min-w-0">
                                                <Avatar
                                                    firstName={a.employee.firstName}
                                                    lastName={a.employee.lastName}
                                                    photo={a.employee.photo}
                                                    size={40}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h3 className="text-[14px] font-semibold text-[var(--text)]">
                                                            {a.employee.firstName} {a.employee.lastName}
                                                        </h3>
                                                        <span className="text-[11px] text-[var(--text3)]">· {a.employee.employeeId}</span>
                                                        {a.employee.designation && (
                                                            <span className="text-[11px] text-[var(--text3)]">· {a.employee.designation}</span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1.5">
                                                        <div
                                                            style={{ background: catColors.bg, color: catColors.color }}
                                                            className="w-6 h-6 rounded-[6px] flex items-center justify-center shrink-0"
                                                        >
                                                            {getCategoryIcon(a.asset.category)}
                                                        </div>
                                                        <span className="text-[13px] font-medium text-[var(--text)]">{a.asset.name}</span>
                                                        <span
                                                            style={{ background: catColors.bg, color: catColors.color }}
                                                            className="text-[10.5px] font-medium px-1.5 py-0.5 rounded-full"
                                                        >
                                                            {a.asset.category}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11.5px] text-[var(--text3)]">
                                                        <span>Issued: {format(new Date(a.issuedAt), "dd MMM yyyy")}</span>
                                                        {a.returnedAt && (
                                                            <span>Returned: {format(new Date(a.returnedAt), "dd MMM yyyy")}</span>
                                                        )}
                                                        {a.asset.serialNo && (
                                                            <span>S/N: {a.asset.serialNo}</span>
                                                        )}
                                                    </div>
                                                    {a.remarks && (
                                                        <p className="text-[11.5px] text-[var(--text3)] mt-1 italic">&ldquo;{a.remarks}&rdquo;</p>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex flex-col items-end gap-2 shrink-0">
                                                <span
                                                    className="px-2.5 py-1 rounded-full text-[11.5px] font-semibold border whitespace-nowrap"
                                                    style={
                                                        isReturned
                                                            ? { color: "#6b7280", background: "#f9fafb", borderColor: "#e5e7eb" }
                                                            : { color: "#1a9e6e", background: "#e8f7f1", borderColor: "#6ee7b7" }
                                                    }
                                                >
                                                    {isReturned ? "Returned" : "Issued"}
                                                </span>
                                                {!isReturned && (
                                                    <button
                                                        onClick={() => handleReturn(a.id)}
                                                        disabled={returningId === a.id}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] border border-[var(--border)] text-[var(--text2)] bg-[var(--surface2)] text-[12px] font-medium hover:bg-[var(--border)] transition-colors disabled:opacity-50"
                                                    >
                                                        {returningId === a.id ? (
                                                            <Loader2 size={12} className="animate-spin" />
                                                        ) : (
                                                            <RotateCcw size={12} />
                                                        )}
                                                        Return
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </>
            )}

            {/* Modals */}
            <AssetModal
                open={showAddAsset}
                onClose={() => setShowAddAsset(false)}
                onSaved={fetchAssets}
            />
            <AssetModal
                open={!!editAsset}
                onClose={() => setEditAsset(null)}
                onSaved={fetchAssets}
                editAsset={editAsset}
            />
            <AssignModal
                open={showAssign}
                onClose={() => setShowAssign(false)}
                onSaved={() => { fetchAssets(); fetchAssignments() }}
                assets={assets}
            />
        </div>
    )
}
