"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { format } from "date-fns"
import {
    X, Plus, Minus, Search, History, AlertTriangle, RefreshCw,
    ChevronLeft, ChevronRight, ArrowUpRight, Inbox,
} from "lucide-react"

export type HistoryItemRef = { id: string; itemCode: string; itemName: string; quantityUnit: string }

type Txn = {
    id: string
    stockItemId: string | null
    itemCode: string
    itemName: string
    transactionType: "ADD" | "MINUS"
    quantityChanged: number
    previousQuantity: number
    newQuantity: number
    performedByName: string
    remarks: string | null
    createdAt: string
    quantityUnit: string
}

type HistoryResponse = {
    item: { id: string; itemCode: string; itemName: string; quantity: number; quantityUnit: string } | null
    summary: { totalAdded: number; totalDeducted: number; totalTransactions: number; itemsAffected: number | null }
    transactions: Txn[]
    total: number
    page: number
    pageSize: number
}

type Preset = "all" | "today" | "yesterday" | "last7" | "last30" | "thisMonth" | "lastMonth" | "custom"
type TypeFilter = "" | "ADD" | "MINUS"

const PRESETS: { key: Preset; label: string }[] = [
    { key: "all", label: "All Time" },
    { key: "today", label: "Today" },
    { key: "yesterday", label: "Yesterday" },
    { key: "last7", label: "Last 7 Days" },
    { key: "last30", label: "Last 30 Days" },
    { key: "thisMonth", label: "This Month" },
    { key: "lastMonth", label: "Last Month" },
    { key: "custom", label: "Custom Range" },
]

// ── Date range helpers ───────────────────────────────────────────────────────
// All ranges are half-open [from, to) built from LOCAL midnights, so the whole
// end day is included and nothing is compared as a formatted string.

function startOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()) }
function addDays(d: Date, n: number) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n) }

/** "2026-10-01" (from <input type=date>) → local midnight of that day. */
function parseDateInput(v: string): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
    if (!m) return null
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

export function rangeFor(preset: Preset, customFrom = "", customTo = ""): { from: Date | null; to: Date | null } {
    const today = startOfDay(new Date())
    const tomorrow = addDays(today, 1)
    switch (preset) {
        case "today": return { from: today, to: tomorrow }
        case "yesterday": return { from: addDays(today, -1), to: today }
        case "last7": return { from: addDays(today, -6), to: tomorrow }
        case "last30": return { from: addDays(today, -29), to: tomorrow }
        case "thisMonth": return { from: new Date(today.getFullYear(), today.getMonth(), 1), to: tomorrow }
        case "lastMonth": return {
            from: new Date(today.getFullYear(), today.getMonth() - 1, 1),
            to: new Date(today.getFullYear(), today.getMonth(), 1),
        }
        case "custom": {
            const f = parseDateInput(customFrom)
            const t = parseDateInput(customTo)
            return { from: f, to: t ? addDays(t, 1) : null }
        }
        default: return { from: null, to: null }
    }
}

export function fmtDateTime(iso: string) {
    return format(new Date(iso), "dd MMM yyyy, hh:mm a")
}

function fmtQty(n: number) {
    return Number(n.toFixed(3)).toLocaleString("en-IN")
}

async function readError(res: Response) {
    const t = await res.text().catch(() => "")
    return t && t.length < 200 ? t : `Request failed (${res.status})`
}

function TypeBadge({ type }: { type: "ADD" | "MINUS" }) {
    const add = type === "ADD"
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-bold ${add ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
            {add ? <Plus size={11} strokeWidth={3} /> : <Minus size={11} strokeWidth={3} />}
            {type}
        </span>
    )
}

function ChangedQty({ t }: { t: Txn }) {
    const add = t.transactionType === "ADD"
    return (
        <span className={`font-bold ${add ? "text-emerald-600" : "text-red-600"}`}>
            {add ? "+" : "−"}{fmtQty(t.quantityChanged)}
        </span>
    )
}

// ── Full history modal ───────────────────────────────────────────────────────
// `item` = one product's history; `item={null}` = every product (with an Item column).

export function StockHistoryModal({ item, onClose }: { item: HistoryItemRef | null; onClose: () => void }) {
    const allItems = item === null
    const endpoint = allItems ? "/api/stock/transactions" : `/api/stock/${item.id}/transactions`
    const [preset, setPreset] = useState<Preset>("all")
    const [customFrom, setCustomFrom] = useState("")
    const [customTo, setCustomTo] = useState("")
    // The custom range only takes effect on "Apply Filter".
    const [applied, setApplied] = useState<{ from: Date | null; to: Date | null }>({ from: null, to: null })
    const [type, setType] = useState<TypeFilter>("")
    const [searchInput, setSearchInput] = useState("")
    const [search, setSearch] = useState("")
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)

    const [data, setData] = useState<HistoryResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const reqRef = useRef<AbortController | null>(null)

    // Debounce search
    useEffect(() => {
        const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1) }, 300)
        return () => clearTimeout(t)
    }, [searchInput])

    const load = useCallback(async () => {
        reqRef.current?.abort()
        const ctrl = new AbortController()
        reqRef.current = ctrl
        setLoading(true)
        setError(null)
        try {
            const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
            if (applied.from) qs.set("from", applied.from.toISOString())
            if (applied.to) qs.set("to", applied.to.toISOString())
            if (type) qs.set("type", type)
            if (search) qs.set("search", search)
            const res = await fetch(`${endpoint}?${qs}`, { signal: ctrl.signal })
            if (!res.ok) throw new Error(await readError(res))
            setData(await res.json())
        } catch (e) {
            if ((e as Error).name === "AbortError") return
            setError((e as Error).message || "Failed to load history")
        } finally {
            if (reqRef.current === ctrl) setLoading(false)
        }
    }, [endpoint, page, pageSize, applied, type, search])

    useEffect(() => { load() }, [load])
    useEffect(() => () => reqRef.current?.abort(), [])

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [onClose])

    function choosePreset(p: Preset) {
        setPreset(p)
        if (p !== "custom") { setApplied(rangeFor(p)); setPage(1); return }
        // Prefill the pickers with the range currently shown, so the chip and
        // the results agree until the user applies a new custom range.
        if (applied.from) setCustomFrom(format(applied.from, "yyyy-MM-dd"))
        if (applied.to) setCustomTo(format(addDays(applied.to, -1), "yyyy-MM-dd"))
    }

    const customError = (() => {
        if (preset !== "custom") return null
        const f = parseDateInput(customFrom), t = parseDateInput(customTo)
        if (!f || !t) return null
        return f > t ? "From date must be on or before To date" : null
    })()

    function applyCustom() {
        if (customError) return
        if (!parseDateInput(customFrom) && !parseDateInput(customTo)) return
        setApplied(rangeFor("custom", customFrom, customTo))
        setPage(1)
    }

    function resetFilters() {
        setPreset("all"); setCustomFrom(""); setCustomTo("")
        setApplied({ from: null, to: null }); setType(""); setSearchInput(""); setSearch(""); setPage(1)
    }

    const total = data?.total ?? 0
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const startN = total === 0 ? 0 : (page - 1) * pageSize + 1
    const endN = Math.min(page * pageSize, total)
    // All-products totals mix units (pcs, kg…), so they are shown without a unit.
    const unit = allItems ? "" : (data?.item?.quantityUnit || item.quantityUnit)
    const withUnit = (v: string) => (unit ? `${v} ${unit}` : v)
    const filtersActive = preset !== "all" || !!type || !!search

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={onClose}>
            <div
                role="dialog" aria-modal="true" aria-labelledby="stock-history-title"
                className="w-full sm:max-w-5xl bg-white shadow-xl rounded-t-[18px] sm:rounded-[16px] max-h-[94vh] sm:max-h-[90vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-4 sm:px-5 py-4">
                    <div className="min-w-0">
                        <h2 id="stock-history-title" className="text-[16px] font-bold text-[var(--text)] flex items-center gap-2">
                            <History size={17} className="text-[#0b5cff]" /> Stock Transaction History
                        </h2>
                        <p className="text-[12.5px] text-[var(--text2)] mt-0.5 truncate">
                            {allItems
                                ? "All products"
                                : <><span className="font-mono font-semibold text-[var(--accent-text)]">{item.itemCode}</span> · {item.itemName}</>}
                        </p>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="text-[var(--text3)] hover:text-[var(--text)] p-1"><X size={18} /></button>
                </div>

                <div className="overflow-y-auto">
                    {/* Summary */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 px-4 sm:px-5 pt-4">
                        {allItems
                            ? <SummaryCard label="Products Affected" value={data ? String(data.summary.itemsAffected ?? 0) : null} />
                            : <SummaryCard label="Current Stock" value={data?.item ? withUnit(fmtQty(data.item.quantity)) : null} />}
                        <SummaryCard label="Total Added" value={data ? withUnit(`+${fmtQty(data.summary.totalAdded)}`) : null} tone="add" />
                        <SummaryCard label="Total Deducted" value={data ? withUnit(`−${fmtQty(data.summary.totalDeducted)}`) : null} tone="minus" />
                        <SummaryCard label="Total Transactions" value={data ? String(data.summary.totalTransactions) : null} />
                    </div>
                    {filtersActive && data && (
                        <p className="px-4 sm:px-5 pt-1.5 text-[11.5px] text-[var(--text3)]">Totals reflect the active filters.</p>
                    )}

                    {/* Filters */}
                    <div className="px-4 sm:px-5 pt-4 space-y-3">
                        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
                            {PRESETS.map(p => (
                                <button key={p.key} onClick={() => choosePreset(p.key)}
                                    className={`shrink-0 rounded-[9px] border px-3 py-1.5 text-[12.5px] font-medium transition ${preset === p.key ? "border-[#0b5cff] bg-[#0b5cff] text-white" : "border-[var(--border)] bg-white text-[var(--text2)] hover:bg-[var(--surface2)]"}`}>
                                    {p.label}
                                </button>
                            ))}
                        </div>

                        {preset === "custom" && (
                            <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface2)]/40 p-3">
                                <div className="flex flex-col sm:flex-row sm:items-end gap-2.5">
                                    <label className="flex-1 text-[12px] font-medium text-[var(--text2)]">
                                        From Date
                                        <input type="date" value={customFrom} max={customTo || undefined} onChange={e => setCustomFrom(e.target.value)}
                                            className="mt-1 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#0b5cff]" />
                                    </label>
                                    <label className="flex-1 text-[12px] font-medium text-[var(--text2)]">
                                        To Date
                                        <input type="date" value={customTo} min={customFrom || undefined} onChange={e => setCustomTo(e.target.value)}
                                            className="mt-1 w-full rounded-[8px] border border-[var(--border)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#0b5cff]" />
                                    </label>
                                    <div className="flex gap-2">
                                        <button onClick={applyCustom} disabled={!!customError || (!customFrom && !customTo)}
                                            className="flex-1 sm:flex-none rounded-[8px] bg-[#0b5cff] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#0847c7] disabled:opacity-50">
                                            Apply Filter
                                        </button>
                                        <button onClick={resetFilters}
                                            className="flex-1 sm:flex-none rounded-[8px] border border-[var(--border)] bg-white px-4 py-2 text-[13px] font-medium text-[var(--text2)] hover:bg-[var(--surface2)]">
                                            Reset Filter
                                        </button>
                                    </div>
                                </div>
                                {customError && <p className="mt-2 text-[12px] text-red-600">{customError}</p>}
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-2">
                            <div className="relative flex-1">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text3)]" />
                                <input value={searchInput} onChange={e => setSearchInput(e.target.value)} maxLength={100}
                                    placeholder="Search item code, item name, updated by…"
                                    className="w-full h-10 rounded-[10px] border border-[var(--border)] bg-white pl-9 pr-3 text-[13px] outline-none focus:border-[#0b5cff]" />
                            </div>
                            <div className="flex gap-2">
                                <select value={type} onChange={e => { setType(e.target.value as TypeFilter); setPage(1) }} aria-label="Transaction type"
                                    className="flex-1 sm:flex-none h-10 rounded-[10px] border border-[var(--border)] bg-white px-3 text-[13px] outline-none focus:border-[#0b5cff]">
                                    <option value="">All Transactions</option>
                                    <option value="ADD">ADD Only</option>
                                    <option value="MINUS">MINUS Only</option>
                                </select>
                                {filtersActive && preset !== "custom" && (
                                    <button onClick={resetFilters} className="h-10 rounded-[10px] border border-[var(--border)] bg-white px-3 text-[12.5px] font-medium text-[var(--text2)] hover:bg-[var(--surface2)]">
                                        Reset
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Results */}
                    <div className="px-4 sm:px-5 py-4">
                        {error ? (
                            <div className="rounded-[12px] border border-red-200 bg-red-50 p-6 text-center">
                                <AlertTriangle size={20} className="mx-auto text-red-600" />
                                <p className="mt-2 text-[13.5px] font-semibold text-red-700">Couldn&apos;t load transaction history</p>
                                <p className="text-[12.5px] text-red-600 mt-0.5">{error}</p>
                                <button onClick={load} className="mt-3 inline-flex items-center gap-1.5 rounded-[8px] border border-red-200 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-red-700 hover:bg-red-100">
                                    <RefreshCw size={13} /> Try again
                                </button>
                            </div>
                        ) : loading && !data ? (
                            <SkeletonRows />
                        ) : data && data.transactions.length === 0 ? (
                            <div className="rounded-[12px] border border-dashed border-[var(--border)] py-10 text-center">
                                <Inbox size={22} className="mx-auto text-[var(--text3)]" />
                                <p className="mt-2 text-[13.5px] font-semibold text-[var(--text)]">No transactions found</p>
                                <p className="text-[12.5px] text-[var(--text3)] mt-0.5">
                                    {filtersActive ? "Try a different date range, type or search." : "Stock ADD / MINUS changes will appear here as they happen."}
                                </p>
                            </div>
                        ) : data && (
                            <div className={loading ? "opacity-60 transition-opacity" : ""}>
                                {/* Desktop / tablet table */}
                                <div className="hidden md:block rounded-[12px] border border-[var(--border)] overflow-x-auto">
                                    <table className="w-full text-[13px]">
                                        <thead>
                                            <tr className="border-b border-[var(--border)] bg-[var(--surface2)]/40 text-left text-[var(--text2)]">
                                                <th className="px-3 py-2.5 font-semibold">S.No</th>
                                                <th className="px-3 py-2.5 font-semibold">Date &amp; Time</th>
                                                {allItems && <th className="px-3 py-2.5 font-semibold">Item</th>}
                                                <th className="px-3 py-2.5 font-semibold">Type</th>
                                                <th className="px-3 py-2.5 font-semibold text-right">Previous Qty</th>
                                                <th className="px-3 py-2.5 font-semibold text-right">Changed Qty</th>
                                                <th className="px-3 py-2.5 font-semibold text-right">New Qty</th>
                                                <th className="px-3 py-2.5 font-semibold">Updated By</th>
                                                <th className="px-3 py-2.5 font-semibold">Remarks</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.transactions.map((t, i) => (
                                                <tr key={t.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface2)]/30">
                                                    <td className="px-3 py-2.5 text-[var(--text3)]">{startN + i}</td>
                                                    <td className="px-3 py-2.5 whitespace-nowrap text-[var(--text)]">{fmtDateTime(t.createdAt)}</td>
                                                    {allItems && (
                                                        <td className="px-3 py-2.5 min-w-[150px]">
                                                            <span className="font-mono text-[12px] font-semibold text-[var(--accent-text)]">{t.itemCode}</span>
                                                            <span className="block text-[12.5px] text-[var(--text)] leading-tight">{t.itemName}</span>
                                                            {!t.stockItemId && <span className="text-[10.5px] font-semibold text-[var(--text3)]">DELETED</span>}
                                                        </td>
                                                    )}
                                                    <td className="px-3 py-2.5"><TypeBadge type={t.transactionType} /></td>
                                                    <td className="px-3 py-2.5 text-right text-[var(--text2)]">{fmtQty(t.previousQuantity)}</td>
                                                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                                        <ChangedQty t={t} />
                                                        {allItems && <span className="ml-1 text-[11px] text-[var(--text3)]">{t.quantityUnit}</span>}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right font-semibold text-[var(--text)]">{fmtQty(t.newQuantity)}</td>
                                                    <td className="px-3 py-2.5 text-[var(--text2)]">{t.performedByName}</td>
                                                    <td className="px-3 py-2.5 text-[var(--text2)] max-w-[220px] truncate" title={t.remarks || undefined}>{t.remarks || "—"}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile cards */}
                                <div className="md:hidden space-y-2">
                                    {data.transactions.map((t, i) => (
                                        <div key={t.id} className="rounded-[12px] border border-[var(--border)] p-3">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[11.5px] text-[var(--text3)]">#{startN + i}</span>
                                                    <TypeBadge type={t.transactionType} />
                                                </div>
                                                <span className="text-[14px]"><ChangedQty t={t} /> <span className="text-[11px] text-[var(--text3)]">{t.quantityUnit}</span></span>
                                            </div>
                                            {allItems && (
                                                <p className="mt-1.5 text-[12.5px] text-[var(--text)] truncate">
                                                    <span className="font-mono font-semibold text-[var(--accent-text)]">{t.itemCode}</span> · {t.itemName}
                                                    {!t.stockItemId && <span className="ml-1 text-[10.5px] font-semibold text-[var(--text3)]">DELETED</span>}
                                                </p>
                                            )}
                                            <p className="mt-1.5 text-[12.5px] text-[var(--text2)]">
                                                {fmtQty(t.previousQuantity)} → <span className="font-semibold text-[var(--text)]">{fmtQty(t.newQuantity)}</span>
                                            </p>
                                            <p className="mt-1 text-[11.5px] text-[var(--text3)]">{fmtDateTime(t.createdAt)} · {t.performedByName}</p>
                                            {t.remarks && <p className="mt-1 text-[12px] text-[var(--text2)]">{t.remarks}</p>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Pagination */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-[var(--border)] px-4 sm:px-5 py-3">
                    <p className="text-[12.5px] text-[var(--text2)]">
                        {total > 0 ? <>Showing {startN}–{endN} of {total} transaction{total === 1 ? "" : "s"}</> : "No transactions"}
                    </p>
                    <div className="flex items-center gap-2">
                        <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }} aria-label="Rows per page"
                            className="h-8 rounded-[8px] border border-[var(--border)] bg-white px-2 text-[12.5px] outline-none focus:border-[#0b5cff]">
                            {[10, 25, 50].map(n => <option key={n} value={n}>{n} / page</option>)}
                        </select>
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1 || loading} aria-label="Previous page"
                            className="h-8 w-8 inline-flex items-center justify-center rounded-[8px] border border-[var(--border)] bg-white text-[var(--text2)] hover:bg-[var(--surface2)] disabled:opacity-40">
                            <ChevronLeft size={15} />
                        </button>
                        <span className="text-[12.5px] text-[var(--text2)] min-w-[64px] text-center">{page} / {totalPages}</span>
                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages || loading} aria-label="Next page"
                            className="h-8 w-8 inline-flex items-center justify-center rounded-[8px] border border-[var(--border)] bg-white text-[var(--text2)] hover:bg-[var(--surface2)] disabled:opacity-40">
                            <ChevronRight size={15} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

function SummaryCard({ label, value, tone }: { label: string; value: string | null; tone?: "add" | "minus" }) {
    const color = tone === "add" ? "text-emerald-600" : tone === "minus" ? "text-red-600" : "text-[var(--text)]"
    return (
        <div className="rounded-[12px] border border-[var(--border)] bg-white p-3 shadow-[0_2px_10px_rgba(80,80,170,0.05)]">
            <p className="text-[11.5px] font-medium text-[var(--text2)]">{label}</p>
            {value === null
                ? <div className="mt-1.5 h-5 w-20 animate-pulse rounded bg-[var(--surface2)]" />
                : <p className={`mt-0.5 text-[16px] font-bold truncate ${color}`}>{value}</p>}
        </div>
    )
}

function SkeletonRows() {
    return (
        <div className="space-y-2" aria-busy="true" aria-label="Loading transactions">
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-11 animate-pulse rounded-[10px] bg-[var(--surface2)]" />
            ))}
        </div>
    )
}

// ── "Last Add / Minus" quick view ────────────────────────────────────────────

export function LastTransactionsModal({ item, onClose, onViewAll }: {
    item: HistoryItemRef
    onClose: () => void
    onViewAll: () => void
}) {
    const [rows, setRows] = useState<Txn[] | null>(null)
    const [error, setError] = useState<string | null>(null)

    const load = useCallback(async () => {
        setRows(null); setError(null)
        try {
            const res = await fetch(`/api/stock/${item.id}/transactions?page=1&pageSize=5`)
            if (!res.ok) throw new Error(await readError(res))
            const json: HistoryResponse = await res.json()
            setRows(json.transactions)
        } catch (e) {
            setError((e as Error).message || "Failed to load")
        }
    }, [item.id])

    useEffect(() => { load() }, [load])

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [onClose])

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4" onClick={onClose}>
            <div role="dialog" aria-modal="true" aria-labelledby="last-txn-title"
                className="w-full sm:max-w-sm bg-white shadow-xl rounded-t-[18px] sm:rounded-[16px]" onClick={e => e.stopPropagation()}>
                <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
                    <div className="min-w-0">
                        <h2 id="last-txn-title" className="text-[15px] font-bold text-[var(--text)]">Last Transactions</h2>
                        <p className="text-[12px] text-[var(--text2)] mt-0.5 truncate">
                            <span className="font-mono">{item.itemCode}</span> · {item.itemName}
                        </p>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="text-[var(--text3)] hover:text-[var(--text)] p-1"><X size={18} /></button>
                </div>

                <div className="px-5 py-3">
                    {error ? (
                        <div className="py-6 text-center">
                            <p className="text-[13px] font-semibold text-red-600">{error}</p>
                            <button onClick={load} className="mt-2 text-[12.5px] font-semibold text-[#0b5cff] hover:underline">Try again</button>
                        </div>
                    ) : rows === null ? (
                        <div className="space-y-2 py-1">
                            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-[10px] bg-[var(--surface2)]" />)}
                        </div>
                    ) : rows.length === 0 ? (
                        <div className="py-6 text-center">
                            <Inbox size={20} className="mx-auto text-[var(--text3)]" />
                            <p className="mt-1.5 text-[13px] text-[var(--text3)]">No ADD / MINUS recorded yet</p>
                        </div>
                    ) : (
                        <ul className="divide-y divide-[var(--border)]">
                            {rows.map(t => {
                                const add = t.transactionType === "ADD"
                                return (
                                    <li key={t.id} className="flex items-center gap-3 py-2.5">
                                        <span className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center ${add ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
                                            {add ? <Plus size={15} strokeWidth={2.5} /> : <Minus size={15} strokeWidth={2.5} />}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[13px] font-semibold text-[var(--text)]">{add ? "Added" : "Deducted"}</p>
                                            <p className="text-[11.5px] text-[var(--text3)] truncate">{fmtDateTime(t.createdAt)} · {t.performedByName}</p>
                                        </div>
                                        <span className={`shrink-0 text-[14px] font-bold ${add ? "text-emerald-600" : "text-red-600"}`}>
                                            {add ? "+" : "−"}{fmtQty(t.quantityChanged)} <span className="text-[11px] font-normal text-[var(--text3)]">{t.quantityUnit}</span>
                                        </span>
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </div>

                <div className="border-t border-[var(--border)] px-5 py-3">
                    <button onClick={onViewAll}
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-[10px] bg-[#0b5cff] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#0847c7]">
                        View All Transactions <ArrowUpRight size={14} />
                    </button>
                </div>
            </div>
        </div>
    )
}
