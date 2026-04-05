"use client"
import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
    Plus, Search, MapPin, Building2, Loader2, X,
    CheckCircle, XCircle, Edit2, Users
} from "lucide-react"

type Site = {
    id: string
    name: string
    address?: string
    city?: string
    branchId: string
    latitude?: number
    longitude?: number
    radius: number
    isActive: boolean
    createdAt: string
    branch: { id: string; name: string }
    _count: { deployments: number; attendances: number }
}

type Branch = { id: string; name: string }

function SiteModal({
    open, onClose, onSaved, branches, site
}: {
    open: boolean
    onClose: () => void
    onSaved: () => void
    branches: Branch[]
    site?: Site | null
}) {
    const [loading, setLoading] = useState(false)
    const [form, setForm] = useState({
        name: "",
        address: "",
        city: "",
        branchId: "",
        latitude: "",
        longitude: "",
        radius: "100",
    })

    useEffect(() => {
        if (site) {
            setForm({
                name: site.name,
                address: site.address || "",
                city: site.city || "",
                branchId: site.branchId,
                latitude: site.latitude?.toString() || "",
                longitude: site.longitude?.toString() || "",
                radius: site.radius.toString(),
            })
        } else {
            setForm({ name: "", address: "", city: "", branchId: "", latitude: "", longitude: "", radius: "100" })
        }
    }, [site, open])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            const res = await fetch("/api/sites", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            })
            if (!res.ok) throw new Error(await res.text())
            toast.success("Site saved!")
            onSaved()
            onClose()
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to save")
        } finally {
            setLoading(false)
        }
    }

    if (!open) return null
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-[16px] border border-[var(--border)] w-full max-w-md shadow-xl">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
                    <h2 className="text-[15px] font-semibold text-[var(--text)]">{site ? "Edit Site" : "Add New Site"}</h2>
                    <button onClick={onClose} className="p-1 text-[var(--text3)] hover:text-[var(--text)] rounded-md hover:bg-[var(--surface2)] transition-colors"><X size={18} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div>
                        <label className="block text-[12px] text-[var(--text2)] mb-1">Site Name *</label>
                        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors"
                            placeholder="Site name" required />
                    </div>
                    <div>
                        <label className="block text-[12px] text-[var(--text2)] mb-1">Branch *</label>
                        <select value={form.branchId} onChange={e => setForm(f => ({ ...f, branchId: e.target.value }))}
                            className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors" required>
                            <option value="">Select Branch</option>
                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[12px] text-[var(--text2)] mb-1">Address</label>
                        <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                            className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors"
                            placeholder="Site address" />
                    </div>
                    <div>
                        <label className="block text-[12px] text-[var(--text2)] mb-1">City</label>
                        <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                            className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors"
                            placeholder="City" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[12px] text-[var(--text2)] mb-1">Latitude</label>
                            <input type="number" step="any" value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))}
                                className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors"
                                placeholder="e.g. 28.6139" />
                        </div>
                        <div>
                            <label className="block text-[12px] text-[var(--text2)] mb-1">Longitude</label>
                            <input type="number" step="any" value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))}
                                className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors"
                                placeholder="e.g. 77.2090" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[12px] text-[var(--text2)] mb-1">Geofence Radius (meters)</label>
                        <input type="number" value={form.radius} onChange={e => setForm(f => ({ ...f, radius: e.target.value }))}
                            className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors"
                            placeholder="100" />
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] font-medium text-[var(--text2)] hover:text-[var(--text)] rounded-[8px] hover:bg-[var(--surface2)] transition-colors">Cancel</button>
                        <button type="submit" disabled={loading}
                            className="inline-flex items-center gap-2 px-5 py-2 bg-[var(--accent)] text-white rounded-[8px] text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                            {loading && <Loader2 size={14} className="animate-spin" />}
                            {site ? "Save Changes" : "Add Site"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default function SitesPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [sites, setSites] = useState<Site[]>([])
    const [branches, setBranches] = useState<Branch[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [branchFilter, setBranchFilter] = useState("")
    const [showModal, setShowModal] = useState(false)
    const [editSite, setEditSite] = useState<Site | null>(null)

    useEffect(() => {
        if (status === "unauthenticated") router.push("/login")
    }, [status, router])

    useEffect(() => {
        fetch("/api/branches").then(r => r.json()).then(d => setBranches(Array.isArray(d) ? d : [])).catch(() => {})
    }, [])

    const fetchSites = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (branchFilter) params.set("branchId", branchFilter)
            const res = await fetch(`/api/sites?${params}`)
            const data = await res.json()
            setSites(Array.isArray(data) ? data : [])
        } catch {
            toast.error("Failed to load sites")
        } finally {
            setLoading(false)
        }
    }, [branchFilter])

    useEffect(() => {
        if (status === "authenticated") fetchSites()
    }, [status, fetchSites])

    const filtered = sites.filter(s =>
        !search || `${s.name} ${s.city || ""} ${s.address || ""}`.toLowerCase().includes(search.toLowerCase())
    )

    if (status === "loading") {
        return <div className="flex items-center justify-center min-h-screen"><Loader2 size={28} className="animate-spin text-[var(--accent)]" /></div>
    }

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-[24px] font-semibold tracking-[-0.4px] text-[var(--text)]">Sites</h1>
                    <p className="text-[13px] text-[var(--text3)] mt-0.5">Manage deployment sites</p>
                </div>
                <button onClick={() => { setEditSite(null); setShowModal(true) }}
                    className="inline-flex items-center gap-2 bg-[var(--accent)] text-white rounded-[10px] text-[13px] font-medium px-4 py-2 hover:opacity-90 transition-opacity">
                    <Plus size={16} /> Add Site
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white border border-[var(--border)] rounded-[12px] p-4 flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text3)]" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search sites..."
                        className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-[var(--surface2)]/30 pl-8 pr-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors" />
                </div>
                <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)}
                    className="h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors">
                    <option value="">All Branches</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: "Total Sites", value: sites.length, color: "#3b82f6", bg: "#eff6ff" },
                    { label: "Active Sites", value: sites.filter(s => s.isActive).length, color: "#1a9e6e", bg: "#e8f7f1" },
                    { label: "With GPS", value: sites.filter(s => s.latitude && s.longitude).length, color: "#8b5cf6", bg: "#f5f3ff" },
                ].map(s => (
                    <div key={s.label} className="bg-white border border-[var(--border)] rounded-[12px] p-4">
                        <p className="text-[22px] font-bold text-[var(--text)]" style={{ color: s.color }}>{s.value}</p>
                        <p className="text-[12px] text-[var(--text3)] mt-0.5">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Site Cards */}
            {loading ? (
                <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin text-[var(--accent)]" /></div>
            ) : filtered.length === 0 ? (
                <div className="flex min-h-[250px] flex-col items-center justify-center rounded-[14px] bg-white border border-dashed border-[var(--border)]">
                    <MapPin size={36} className="text-[var(--text3)] mb-2" />
                    <p className="text-[14px] font-semibold text-[var(--text)]">No sites found</p>
                    <p className="text-[13px] text-[var(--text3)] mt-1">Add your first deployment site</p>
                </div>
            ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
                    {filtered.map(site => (
                        <div key={site.id} className="bg-white border border-[var(--border)] rounded-[14px] overflow-hidden hover:shadow-[0_3px_14px_rgba(0,0,0,0.05)] hover:border-[var(--border2)] transition-all flex flex-col">
                            <div className="p-[18px_20px] flex-1">
                                <div className="flex items-start gap-3 mb-3">
                                    <div className="w-[38px] h-[38px] bg-[var(--accent-light)] rounded-[9px] flex items-center justify-center shrink-0">
                                        <MapPin className="h-5 w-5 text-[var(--accent)]" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-[14px] font-semibold text-[var(--text)] truncate">{site.name}</h3>
                                        <p className="text-[11.5px] text-[var(--text3)] mt-0.5 truncate">{site.city || site.address || "No location set"}</p>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-semibold border ${site.isActive ? "bg-[#e8f7f1] text-[#1a9e6e] border-[#6ee7b7]" : "bg-[#f9fafb] text-[#6b7280] border-[#e5e7eb]"}`}>
                                        {site.isActive ? "Active" : "Inactive"}
                                    </span>
                                </div>
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-2 text-[12px] text-[var(--text2)]">
                                        <Building2 size={13} className="text-[var(--text3)]" />
                                        <span>{site.branch.name}</span>
                                    </div>
                                    {site.latitude && site.longitude && (
                                        <div className="flex items-center gap-2 text-[12px] text-[var(--text2)]">
                                            <MapPin size={13} className="text-[var(--text3)]" />
                                            <span>{site.latitude.toFixed(4)}, {site.longitude.toFixed(4)} · {site.radius}m radius</span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 text-[12px] text-[var(--text2)]">
                                        <Users size={13} className="text-[var(--text3)]" />
                                        <span>{site._count.deployments} deployment{site._count.deployments !== 1 ? "s" : ""}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="border-t border-[var(--border)] px-[20px] py-[12px] flex items-center justify-end bg-[var(--surface2)]/30">
                                <button onClick={() => { setEditSite(site); setShowModal(true) }}
                                    className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--accent-text)] hover:text-[var(--accent)] transition-colors">
                                    <Edit2 size={13} /> Edit
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <SiteModal
                open={showModal}
                onClose={() => { setShowModal(false); setEditSite(null) }}
                onSaved={fetchSites}
                branches={branches}
                site={editSite}
            />
        </div>
    )
}
