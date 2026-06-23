"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import {
    Boxes, Plus, Search, X, Loader2, Trash2, RefreshCw,
    Pencil, Minus, AlertTriangle,
} from "lucide-react"

type StockItem = {
    id: string
    itemCode: string
    itemName: string
    color: string | null
    size: string | null
    sizeUnit: string | null
    quantity: number
    quantityUnit: string
    minStock: number
    createdAt: string
    updatedAt: string
}

type Option = { id: string; type: string; value: string }

const DEFAULT_SIZE_UNITS = ["cm", "inch", "feet"]
const DEFAULT_QTY_UNITS = ["pcs", "kg", "cm", "meter", "box", "litre"]

export default function StockPage() {
    const [items, setItems] = useState<StockItem[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [showForm, setShowForm] = useState(false)
    const [editItem, setEditItem] = useState<StockItem | null>(null)
    const [colors, setColors] = useState<string[]>([])
    const [sizeUnits, setSizeUnits] = useState<string[]>(DEFAULT_SIZE_UNITS)
    const [qtyUnits, setQtyUnits] = useState<string[]>(DEFAULT_QTY_UNITS)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/stock")
            if (!res.ok) throw new Error()
            setItems(await res.json())
        } catch {
            toast.error("Failed to load stock")
        } finally {
            setLoading(false)
        }
    }, [])

    const loadOptions = useCallback(async () => {
        try {
            const res = await fetch("/api/stock/options")
            if (!res.ok) return
            const opts: Option[] = await res.json()
            setColors(opts.filter(o => o.type === "color").map(o => o.value))
            const su = opts.filter(o => o.type === "sizeUnit").map(o => o.value)
            setSizeUnits([...new Set([...DEFAULT_SIZE_UNITS, ...su])])
            const qu = opts.filter(o => o.type === "qtyUnit").map(o => o.value)
            setQtyUnits([...new Set([...DEFAULT_QTY_UNITS, ...qu])])
        } catch {
            // options are best-effort
        }
    }, [])

    useEffect(() => { load(); loadOptions() }, [load, loadOptions])

    async function adjust(id: string, delta: number) {
        const prev = items
        setItems(list => list.map(i => i.id === id ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i))
        try {
            const res = await fetch(`/api/stock/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ adjust: delta }),
            })
            if (!res.ok) throw new Error()
        } catch {
            setItems(prev)
            toast.error("Failed to update quantity")
        }
    }

    async function remove(id: string) {
        if (!confirm("Delete this item?")) return
        const prev = items
        setItems(list => list.filter(i => i.id !== id))
        try {
            const res = await fetch(`/api/stock/${id}`, { method: "DELETE" })
            if (!res.ok) throw new Error()
            toast.success("Item deleted")
        } catch {
            setItems(prev)
            toast.error("Failed to delete")
        }
    }

    async function addOption(type: string, value: string) {
        try {
            await fetch("/api/stock/options", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type, value }),
            })
        } catch {
            // best-effort persist; local state already updated
        }
    }

    const filtered = items.filter(i => {
        const q = search.toLowerCase()
        return !q ||
            i.itemCode.toLowerCase().includes(q) ||
            i.itemName.toLowerCase().includes(q) ||
            (i.color || "").toLowerCase().includes(q)
    })

    const lowStock = items.filter(i => i.minStock > 0 && i.quantity <= i.minStock)

    function isLow(i: StockItem) {
        return i.minStock > 0 && i.quantity <= i.minStock
    }

    function openAdd() { setEditItem(null); setShowForm(true) }
    function openEdit(i: StockItem) { setEditItem(i); setShowForm(true) }

    return (
        <div className="p-6 max-w-[1200px] mx-auto">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-[10px] bg-[#1e3799] flex items-center justify-center text-white">
                        <Boxes size={20} />
                    </div>
                    <div>
                        <h1 className="text-[20px] font-bold text-[var(--text)] leading-tight">Stock Management</h1>
                        <p className="text-[13px] text-[var(--text2)]">Add, adjust and track inventory items</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => { load(); loadOptions() }} className="inline-flex items-center gap-2 rounded-[8px] border border-[var(--border)] bg-white px-3 py-2 text-[13px] font-medium text-[var(--text2)] hover:bg-[var(--surface2)]">
                        <RefreshCw size={15} /> Refresh
                    </button>
                    <button onClick={openAdd} className="inline-flex items-center gap-2 rounded-[8px] bg-[#1e3799] px-3 py-2 text-[13px] font-medium text-white hover:opacity-90">
                        <Plus size={15} /> Add Item
                    </button>
                </div>
            </div>

            {/* Low stock alert */}
            {lowStock.length > 0 && (
                <div className="mb-5 rounded-[12px] border border-red-200 bg-red-50 p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle size={16} className="text-red-600" />
                        <p className="text-[13px] font-semibold text-red-700">{lowStock.length} item{lowStock.length > 1 ? "s" : ""} low on stock</p>
                    </div>
                    <p className="text-[12.5px] text-red-600">
                        {lowStock.map(i => `${i.itemName} (${i.quantity} ${i.quantityUnit})`).join(", ")}
                    </p>
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
                <StatCard label="Total Items" value={items.length} />
                <StatCard label="Low Stock" value={lowStock.length} color="#dc2626" />
                <StatCard label="Colors" value={colors.length} color="#1a9e6e" />
            </div>

            {/* Search */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text3)]" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search item code, name, color…"
                        className="w-full rounded-[8px] border border-[var(--border)] bg-white pl-9 pr-3 py-2 text-[13px] outline-none focus:border-[#1e3799]"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="rounded-[12px] border border-[var(--border)] bg-white overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                        <thead>
                            <tr className="border-b border-[var(--border)] bg-[var(--surface2)]/40 text-left text-[var(--text2)]">
                                <th className="px-4 py-3 font-semibold">S.No</th>
                                <th className="px-4 py-3 font-semibold">Item Code</th>
                                <th className="px-4 py-3 font-semibold">Item Name</th>
                                <th className="px-4 py-3 font-semibold">Color</th>
                                <th className="px-4 py-3 font-semibold">Size</th>
                                <th className="px-4 py-3 font-semibold text-center">Quantity</th>
                                <th className="px-4 py-3 font-semibold text-right">Min Stock</th>
                                <th className="px-4 py-3 font-semibold text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={8} className="px-4 py-10 text-center text-[var(--text3)]">
                                    <Loader2 size={20} className="animate-spin inline" />
                                </td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={8} className="px-4 py-10 text-center text-[var(--text3)]">No items found</td></tr>
                            ) : filtered.map((i, idx) => {
                                const low = isLow(i)
                                return (
                                    <tr key={i.id} className={`border-b border-[var(--border)] last:border-0 ${low ? "bg-red-50 hover:bg-red-100" : "hover:bg-[var(--surface2)]/30"}`}>
                                        <td className={`px-4 py-3 ${low ? "text-red-700" : "text-[var(--text3)]"}`}>{idx + 1}</td>
                                        <td className={`px-4 py-3 font-mono ${low ? "text-red-700 font-semibold" : "text-[var(--text)]"}`}>{i.itemCode}</td>
                                        <td className={`px-4 py-3 font-medium ${low ? "text-red-700" : "text-[var(--text)]"}`}>
                                            {i.itemName}
                                            {low && <span className="ml-2 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10.5px] font-bold text-red-700">LOW</span>}
                                        </td>
                                        <td className="px-4 py-3">
                                            {i.color ? (
                                                <span className="inline-flex items-center gap-1.5">
                                                    <span className="h-3 w-3 rounded-full border border-[var(--border)]" style={{ background: cssColor(i.color) }} />
                                                    <span className={low ? "text-red-700" : "text-[var(--text2)]"}>{i.color}</span>
                                                </span>
                                            ) : <span className="text-[var(--text3)]">—</span>}
                                        </td>
                                        <td className={`px-4 py-3 ${low ? "text-red-700" : "text-[var(--text2)]"}`}>
                                            {i.size ? `${i.size} ${i.sizeUnit || ""}`.trim() : "—"}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-center gap-1.5">
                                                <button onClick={() => adjust(i.id, -1)} className="h-6 w-6 rounded-[6px] border border-[var(--border)] bg-white flex items-center justify-center text-[var(--text2)] hover:bg-red-50 hover:text-red-600 hover:border-red-200" title="Decrease">
                                                    <Minus size={13} />
                                                </button>
                                                <span className={`min-w-[56px] text-center font-semibold ${low ? "text-red-700" : "text-[var(--text)]"}`}>
                                                    {i.quantity} <span className="text-[11px] font-normal text-[var(--text3)]">{i.quantityUnit}</span>
                                                </span>
                                                <button onClick={() => adjust(i.id, 1)} className="h-6 w-6 rounded-[6px] border border-[var(--border)] bg-white flex items-center justify-center text-[var(--text2)] hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200" title="Increase">
                                                    <Plus size={13} />
                                                </button>
                                            </div>
                                        </td>
                                        <td className={`px-4 py-3 text-right ${low ? "text-red-700 font-semibold" : "text-[var(--text2)]"}`}>{i.minStock}</td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="inline-flex items-center gap-1">
                                                <button onClick={() => openEdit(i)} className="text-[var(--text3)] hover:text-[#1e3799] p-1" title="Edit">
                                                    <Pencil size={15} />
                                                </button>
                                                <button onClick={() => remove(i.id)} className="text-[var(--text3)] hover:text-red-600 p-1" title="Delete">
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

            {showForm && (
                <StockFormModal
                    item={editItem}
                    colors={colors}
                    sizeUnits={sizeUnits}
                    qtyUnits={qtyUnits}
                    onAddColor={(v) => { setColors(c => [...new Set([...c, v])]); addOption("color", v) }}
                    onAddSizeUnit={(v) => { setSizeUnits(s => [...new Set([...s, v])]); addOption("sizeUnit", v) }}
                    onAddQtyUnit={(v) => { setQtyUnits(s => [...new Set([...s, v])]); addOption("qtyUnit", v) }}
                    onClose={() => setShowForm(false)}
                    onSaved={() => { setShowForm(false); load() }}
                />
            )}
        </div>
    )
}

function cssColor(name: string): string {
    // Use the color name directly as a CSS color when valid; fall back to a neutral swatch.
    const s = document.createElement("span").style
    s.color = ""
    s.color = name.toLowerCase()
    return s.color ? name.toLowerCase() : "#cbd5e1"
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
    return (
        <div className="rounded-[12px] border border-[var(--border)] bg-white p-4">
            <p className="text-[12px] text-[var(--text2)]">{label}</p>
            <p className="text-[22px] font-bold" style={{ color: color || "var(--text)" }}>{value}</p>
        </div>
    )
}

function StockFormModal({
    item, colors, sizeUnits, qtyUnits,
    onAddColor, onAddSizeUnit, onAddQtyUnit, onClose, onSaved,
}: {
    item: StockItem | null
    colors: string[]
    sizeUnits: string[]
    qtyUnits: string[]
    onAddColor: (v: string) => void
    onAddSizeUnit: (v: string) => void
    onAddQtyUnit: (v: string) => void
    onClose: () => void
    onSaved: () => void
}) {
    const [form, setForm] = useState({
        itemCode: item?.itemCode || "",
        itemName: item?.itemName || "",
        color: item?.color || "",
        size: item?.size || "",
        sizeUnit: item?.sizeUnit || sizeUnits[0] || "cm",
        quantity: item?.quantity != null ? String(item.quantity) : "",
        quantityUnit: item?.quantityUnit || "pcs",
        minStock: item?.minStock != null ? String(item.minStock) : "",
    })
    const [saving, setSaving] = useState(false)
    const [newColor, setNewColor] = useState("")
    const [newSizeUnit, setNewSizeUnit] = useState("")
    const [newQtyUnit, setNewQtyUnit] = useState("")

    function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

    async function submit() {
        if (!form.itemCode.trim() || !form.itemName.trim()) {
            toast.error("Item code and name are required")
            return
        }
        setSaving(true)
        try {
            const url = item ? `/api/stock/${item.id}` : "/api/stock"
            const method = item ? "PATCH" : "POST"
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            })
            if (!res.ok) {
                if (res.status === 409) { toast.error("Item code already exists"); return }
                throw new Error()
            }
            toast.success(item ? "Item updated" : "Item added")
            onSaved()
        } catch {
            toast.error("Failed to save item")
        } finally {
            setSaving(false)
        }
    }

    function commitNewColor() {
        const v = newColor.trim()
        if (!v) return
        onAddColor(v)
        set("color", v)
        setNewColor("")
    }
    function commitNewSizeUnit() {
        const v = newSizeUnit.trim()
        if (!v) return
        onAddSizeUnit(v)
        set("sizeUnit", v)
        setNewSizeUnit("")
    }
    function commitNewQtyUnit() {
        const v = newQtyUnit.trim()
        if (!v) return
        onAddQtyUnit(v)
        set("quantityUnit", v)
        setNewQtyUnit("")
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
            <div className="w-full max-w-lg rounded-[14px] bg-white shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4 sticky top-0 bg-white">
                    <h2 className="text-[16px] font-bold text-[var(--text)]">{item ? "Edit Item" : "Add Item"}</h2>
                    <button onClick={onClose} className="text-[var(--text3)] hover:text-[var(--text)]"><X size={18} /></button>
                </div>
                <div className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Item Code"><Inp value={form.itemCode} onChange={v => set("itemCode", v)} /></Field>
                        <Field label="Item Name"><Inp value={form.itemName} onChange={v => set("itemName", v)} /></Field>
                    </div>

                    {/* Color: dropdown + custom add */}
                    <Field label="Color">
                        <select value={form.color} onChange={e => set("color", e.target.value)} className="w-full rounded-[8px] border border-[var(--border)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#1e3799]">
                            <option value="">— Select color —</option>
                            {colors.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <div className="mt-2 flex gap-2">
                            <input
                                value={newColor}
                                onChange={e => setNewColor(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commitNewColor() } }}
                                placeholder="Add new color…"
                                className="flex-1 rounded-[8px] border border-[var(--border)] bg-white px-3 py-1.5 text-[12.5px] outline-none focus:border-[#1e3799]"
                            />
                            <button type="button" onClick={commitNewColor} className="rounded-[8px] border border-[var(--border)] px-3 py-1.5 text-[12.5px] font-medium text-[#1e3799] hover:bg-[var(--surface2)]">Add</button>
                        </div>
                    </Field>

                    {/* Size value + unit as TOP BUTTONS */}
                    <Field label="Size">
                        <div className="flex gap-2 mb-2">
                            <Inp value={form.size} onChange={v => set("size", v)} type="number" placeholder="Measurement" />
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                            {sizeUnits.map(u => (
                                <button
                                    key={u}
                                    type="button"
                                    onClick={() => set("sizeUnit", u)}
                                    className={`rounded-[8px] border px-3 py-1.5 text-[12.5px] font-medium ${form.sizeUnit === u ? "border-[#1e3799] bg-[#1e3799] text-white" : "border-[var(--border)] bg-white text-[var(--text2)] hover:bg-[var(--surface2)]"}`}
                                >
                                    {u}
                                </button>
                            ))}
                            <input
                                value={newSizeUnit}
                                onChange={e => setNewSizeUnit(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commitNewSizeUnit() } }}
                                placeholder="custom"
                                className="w-[80px] rounded-[8px] border border-dashed border-[var(--border)] bg-white px-2 py-1.5 text-[12.5px] outline-none focus:border-[#1e3799]"
                            />
                            <button type="button" onClick={commitNewSizeUnit} className="rounded-[8px] border border-[var(--border)] px-2.5 py-1.5 text-[12.5px] font-medium text-[#1e3799] hover:bg-[var(--surface2)]">+</button>
                        </div>
                    </Field>

                    {/* Quantity + unit */}
                    <Field label="Quantity">
                        <div className="flex gap-2 mb-2">
                            <Inp value={form.quantity} onChange={v => set("quantity", v)} type="number" placeholder="0" />
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                            {qtyUnits.map(u => (
                                <button
                                    key={u}
                                    type="button"
                                    onClick={() => set("quantityUnit", u)}
                                    className={`rounded-[8px] border px-3 py-1.5 text-[12.5px] font-medium ${form.quantityUnit === u ? "border-[#1e3799] bg-[#1e3799] text-white" : "border-[var(--border)] bg-white text-[var(--text2)] hover:bg-[var(--surface2)]"}`}
                                >
                                    {u}
                                </button>
                            ))}
                            <input
                                value={newQtyUnit}
                                onChange={e => setNewQtyUnit(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commitNewQtyUnit() } }}
                                placeholder="custom"
                                className="w-[80px] rounded-[8px] border border-dashed border-[var(--border)] bg-white px-2 py-1.5 text-[12.5px] outline-none focus:border-[#1e3799]"
                            />
                            <button type="button" onClick={commitNewQtyUnit} className="rounded-[8px] border border-[var(--border)] px-2.5 py-1.5 text-[12.5px] font-medium text-[#1e3799] hover:bg-[var(--surface2)]">+</button>
                        </div>
                    </Field>

                    <Field label="Min Stock (alert when at or below)">
                        <Inp value={form.minStock} onChange={v => set("minStock", v)} type="number" placeholder="0" />
                    </Field>
                </div>
                <div className="flex justify-end gap-2 border-t border-[var(--border)] px-5 py-4 sticky bottom-0 bg-white">
                    <button onClick={onClose} className="rounded-[8px] border border-[var(--border)] px-4 py-2 text-[13px] font-medium text-[var(--text2)] hover:bg-[var(--surface2)]">Cancel</button>
                    <button onClick={submit} disabled={saving} className="inline-flex items-center gap-2 rounded-[8px] bg-[#1e3799] px-4 py-2 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-60">
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

function Inp({ value, onChange, type = "text", placeholder }: { value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
    return (
        <input
            type={type}
            value={value}
            placeholder={placeholder}
            onChange={e => onChange(e.target.value)}
            className="w-full rounded-[8px] border border-[var(--border)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#1e3799]"
        />
    )
}
