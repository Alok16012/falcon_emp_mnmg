"use client"
import { useState, useEffect, useCallback } from "react"
import { format } from "date-fns"
import { toast } from "sonner"
import { Plus, IndianRupee, X, Trash2, Search, Calendar } from "lucide-react"

type Employee = {
    id: string; employeeId: string; firstName: string; lastName: string
    designation?: string; employeeCategory: string
    department?: { name: string }
}

type Advance = {
    id: string; employeeId: string; amount: number; reason?: string
    advanceDate?: string
    monthToImpact: number; yearToImpact: number; status: string; createdAt: string
    employee: { id: string; firstName: string; lastName: string; employeeId: string; employeeCategory: string; designation?: string; department?: { name: string } }
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

// Today as YYYY-MM-DD for date input default
const todayStr = () => new Date().toISOString().slice(0, 10)

export default function AdvancesPage() {
    const [advances, setAdvances] = useState<Advance[]>([])
    const [employees, setEmployees] = useState<Employee[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [search, setSearch] = useState("")
    const now = new Date()
    const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1)
    const [filterYear, setFilterYear] = useState(now.getFullYear())

    const [form, setForm] = useState({
        employeeId: "",
        amount: "",
        reason: "",
        advanceDate: todayStr(),
        monthToImpact: String(now.getMonth() + 1),
        yearToImpact: String(now.getFullYear()),
    })
    const [saving, setSaving] = useState(false)
    const [empSearch, setEmpSearch] = useState("")

    const fetchAdvances = useCallback(async () => {
        setLoading(true)
        try {
            const r = await fetch(`/api/advances?month=${filterMonth}&year=${filterYear}`)
            if (!r.ok) throw new Error(`HTTP ${r.status}`)
            const data = await r.json()
            setAdvances(Array.isArray(data) ? data : [])
        } catch { toast.error("Failed to load advances") }
        finally { setLoading(false) }
    }, [filterMonth, filterYear])

    useEffect(() => { fetchAdvances() }, [fetchAdvances])
    useEffect(() => {
        fetch("/api/employees?status=ACTIVE")
            .then(r => r.json()).then(d => setEmployees(Array.isArray(d) ? d : []))
    }, [])

    const filteredEmployees = employees.filter(e =>
        `${e.firstName} ${e.lastName} ${e.employeeId}`.toLowerCase().includes(empSearch.toLowerCase())
    )

    // When advanceDate changes, auto-set deduction month/year
    const handleDateChange = (dateStr: string) => {
        const d = new Date(dateStr)
        if (!isNaN(d.getTime())) {
            setForm(f => ({
                ...f,
                advanceDate: dateStr,
                monthToImpact: String(d.getMonth() + 1),
                yearToImpact: String(d.getFullYear()),
            }))
        } else {
            setForm(f => ({ ...f, advanceDate: dateStr }))
        }
    }

    const handleSubmit = async (ev: React.FormEvent) => {
        ev.preventDefault()
        if (!form.employeeId || !form.amount) { toast.error("Employee and amount required"); return }
        setSaving(true)
        try {
            const r = await fetch("/api/advances", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            })
            if (!r.ok) throw new Error()
            toast.success("Advance salary recorded!")
            setShowModal(false)
            setForm({ employeeId: "", amount: "", reason: "", advanceDate: todayStr(), monthToImpact: String(now.getMonth() + 1), yearToImpact: String(now.getFullYear()) })
            setEmpSearch("")
            fetchAdvances()
        } catch { toast.error("Failed to save advance") }
        finally { setSaving(false) }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this advance record?")) return
        try {
            await fetch(`/api/advances?id=${id}`, { method: "DELETE" })
            toast.success("Deleted")
            fetchAdvances()
        } catch { toast.error("Failed to delete") }
    }

    const filtered = advances.filter(a =>
        search
            ? `${a.employee.firstName} ${a.employee.lastName} ${a.employee.employeeId}`.toLowerCase().includes(search.toLowerCase())
            : true
    )

    const totalAmount = filtered.reduce((s, a) => s + a.amount, 0)

    return (
        <div className="flex flex-col gap-4 md:gap-6 p-4 md:p-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-[22px] font-bold text-[var(--text)]">Advance Salary</h1>
                    <p className="text-[13px] text-[var(--text3)] mt-0.5">Track and manage advance salary payments</p>
                </div>
                <button onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-[9px] text-[13px] font-semibold hover:bg-[#4a4ac8] transition-colors">
                    <Plus size={15} /> Give Advance
                </button>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white border border-[var(--border)] rounded-[16px] p-4 shadow-[0_2px_10px_rgba(80,80,170,0.05)]">
                    <p className="text-[12px] text-[var(--text3)] font-medium">Total Advance Given</p>
                    <p className="text-[24px] font-bold text-[var(--text)] mt-1">₹{totalAmount.toLocaleString()}</p>
                    <p className="text-[11px] text-[var(--text3)]">{MONTHS[filterMonth-1]} {filterYear}</p>
                </div>
                <div className="bg-white border border-[var(--border)] rounded-[16px] p-4 shadow-[0_2px_10px_rgba(80,80,170,0.05)]">
                    <p className="text-[12px] text-[var(--text3)] font-medium">Employees with Advance</p>
                    <p className="text-[24px] font-bold text-[var(--text)] mt-1">{new Set(filtered.map(a => a.employeeId)).size}</p>
                </div>
                <div className="bg-white border border-[var(--border)] rounded-[16px] p-4 shadow-[0_2px_10px_rgba(80,80,170,0.05)]">
                    <p className="text-[12px] text-[var(--text3)] font-medium">Total Entries</p>
                    <p className="text-[24px] font-bold text-[var(--text)] mt-1">{filtered.length}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 bg-white border border-[var(--border)] rounded-[16px] px-4 py-3 shadow-[0_2px_10px_rgba(80,80,170,0.05)]">
                <div className="relative flex-1 min-w-[180px] max-w-xs">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text3)]" />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search employee..."
                        className="w-full h-8 pl-8 pr-3 rounded-[7px] border border-[var(--border)] text-[13px] outline-none focus:border-[var(--accent)] bg-[var(--surface2)]" />
                </div>
                <select value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))}
                    className="h-8 px-2 rounded-[7px] border border-[var(--border)] text-[13px] outline-none bg-white">
                    {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                </select>
                <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))}
                    className="h-8 px-2 rounded-[7px] border border-[var(--border)] text-[13px] outline-none bg-white">
                    {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
            </div>

            {/* Mobile card list */}
            <div className="md:hidden space-y-2.5">
                {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-[80px] bg-white border border-[var(--border)] rounded-[16px] animate-pulse" />
                    ))
                ) : filtered.length === 0 ? (
                    <div className="py-14 text-center text-[var(--text3)] bg-white border border-[var(--border)] rounded-[16px]">
                        <IndianRupee size={30} className="mx-auto mb-2 opacity-30" />
                        <p className="text-[13px]">No advance records for {MONTHS[filterMonth-1]} {filterYear}</p>
                    </div>
                ) : (
                    <>
                    {filtered.map(adv => (
                        <div key={adv.id} className="bg-white border border-[var(--border)] rounded-[16px] p-3.5 shadow-[0_2px_10px_rgba(80,80,170,0.05)]">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-[var(--accent-light)] flex items-center justify-center text-[12px] font-bold text-[var(--accent-text)] shrink-0">
                                    {adv.employee.firstName[0]}{adv.employee.lastName?.[0] || ""}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[14px] font-semibold text-[var(--text)] truncate">{adv.employee.firstName} {adv.employee.lastName}</p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className="text-[11.5px] text-[var(--accent-text)] font-medium">{adv.employee.employeeId}</span>
                                        <span className={`px-1.5 py-0.5 rounded-[5px] text-[10px] font-semibold ${adv.employee.employeeCategory === "LABOUR" ? "bg-orange-50 text-orange-700" : "bg-blue-50 text-blue-700"}`}>
                                            {adv.employee.employeeCategory === "LABOUR" ? "🔧 Labour" : "👔 Staff"}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-[16px] font-bold text-[var(--text)]">₹{adv.amount.toLocaleString()}</p>
                                    <p className="text-[10.5px] text-[var(--text3)]">
                                        {adv.advanceDate
                                            ? format(new Date(adv.advanceDate), "dd MMM yyyy")
                                            : format(new Date(adv.createdAt), "dd MMM yyyy")}
                                    </p>
                                </div>
                                <button onClick={() => handleDelete(adv.id)}
                                    className="p-1.5 rounded-[8px] hover:bg-red-50 text-[var(--text3)] hover:text-red-600 transition-colors shrink-0">
                                    <Trash2 size={15} />
                                </button>
                            </div>
                            <div className="flex items-center gap-3 mt-2.5 pt-2.5 border-t border-[var(--border)] text-[11.5px] text-[var(--text2)]">
                                <span><span className="text-[var(--text3)]">Deduct:</span> {MONTHS[adv.monthToImpact - 1]} {adv.yearToImpact}</span>
                                {adv.reason && <span className="truncate"><span className="text-[var(--text3)]">Reason:</span> {adv.reason}</span>}
                            </div>
                        </div>
                    ))}
                    <div className="bg-[var(--accent-light)] rounded-[16px] px-4 py-3 flex items-center justify-between">
                        <span className="text-[12.5px] font-semibold text-[var(--accent-text)]">TOTAL</span>
                        <span className="text-[16px] font-bold text-[var(--accent-text)]">₹{totalAmount.toLocaleString()}</span>
                    </div>
                    </>
                )}
            </div>

            {/* Table (desktop) */}
            <div className="hidden md:block bg-white border border-[var(--border)] rounded-[16px] overflow-hidden shadow-[0_2px_10px_rgba(80,80,170,0.05)]">
                {loading ? (
                    <table className="w-full">
                        <tbody>
                            {Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i} className="border-b border-[var(--border)]">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-[var(--surface2)] animate-pulse" />
                                            <div className="h-3 w-28 bg-[var(--surface2)] rounded animate-pulse" />
                                        </div>
                                    </td>
                                    {Array.from({ length: 5 }).map((_, j) => (
                                        <td key={j} className="px-4 py-3">
                                            <div className="h-3 w-20 bg-[var(--surface2)] rounded animate-pulse" />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : filtered.length === 0 ? (
                    <div className="py-16 text-center text-[var(--text3)]">
                        <IndianRupee size={32} className="mx-auto mb-2 opacity-30" />
                        <p>No advance records for {MONTHS[filterMonth-1]} {filterYear}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                    <table className="w-full min-w-[820px]">
                        <thead>
                            <tr className="border-b border-[var(--border)] bg-[var(--surface2)]">
                                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px]">Employee</th>
                                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px]">Type</th>
                                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px]">Amount</th>
                                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px]">Advance Date</th>
                                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px]">Deduct Month</th>
                                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px]">Reason</th>
                                <th className="px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                            {filtered.map(adv => (
                                <tr key={adv.id} className="hover:bg-[var(--surface2)] transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-full bg-[var(--accent-light)] flex items-center justify-center text-[11px] font-bold text-[var(--accent-text)]">
                                                {adv.employee.firstName[0]}{adv.employee.lastName[0]}
                                            </div>
                                            <div>
                                                <p className="text-[13px] font-medium text-[var(--text)]">{adv.employee.firstName} {adv.employee.lastName}</p>
                                                <p className="text-[11px] text-[var(--text3)]">{adv.employee.employeeId}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-0.5 rounded-[5px] text-[11px] font-semibold ${adv.employee.employeeCategory === "LABOUR" ? "bg-orange-50 text-orange-700" : "bg-blue-50 text-blue-700"}`}>
                                            {adv.employee.employeeCategory === "LABOUR" ? "🔧 Labour" : "👔 Staff"}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-[14px] font-bold text-[var(--text)]">₹{adv.amount.toLocaleString()}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1.5 text-[13px] text-[var(--text)]">
                                            <Calendar size={13} className="text-[var(--text3)]" />
                                            {adv.advanceDate
                                                ? format(new Date(adv.advanceDate), "dd MMM yyyy")
                                                : format(new Date(adv.createdAt), "dd MMM yyyy")}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-[13px] text-[var(--text2)]">
                                        {MONTHS[adv.monthToImpact - 1]} {adv.yearToImpact}
                                    </td>
                                    <td className="px-4 py-3 text-[13px] text-[var(--text2)]">{adv.reason || "—"}</td>
                                    <td className="px-4 py-3">
                                        <button onClick={() => handleDelete(adv.id)}
                                            className="p-1.5 rounded-[6px] hover:bg-red-50 text-[var(--text3)] hover:text-red-600 transition-colors">
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="border-t-2 border-[var(--border)] bg-[var(--surface2)]">
                                <td colSpan={2} className="px-4 py-3 text-[12px] font-semibold text-[var(--text3)]">TOTAL</td>
                                <td className="px-4 py-3 text-[14px] font-bold text-[var(--accent-text)]">₹{totalAmount.toLocaleString()}</td>
                                <td colSpan={4}></td>
                            </tr>
                        </tfoot>
                    </table>
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-[16px] border border-[var(--border)] w-full max-w-md shadow-xl">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
                            <h2 className="text-[16px] font-semibold text-[var(--text)]">Give Advance Salary</h2>
                            <button onClick={() => setShowModal(false)} className="text-[var(--text3)] hover:text-[var(--text)] p-1 rounded-md hover:bg-[var(--surface2)]">
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

                            {/* Employee Search */}
                            <div>
                                <label className="block text-[12px] font-medium text-[var(--text2)] mb-1">Employee *</label>
                                <input value={empSearch} onChange={e => { setEmpSearch(e.target.value); setForm(f => ({ ...f, employeeId: "" })) }}
                                    placeholder="Search name or ID..."
                                    className="w-full h-9 rounded-[8px] border border-[var(--border)] px-3 text-[13px] outline-none focus:border-[var(--accent)] mb-1.5" />
                                {empSearch && !form.employeeId && (
                                    <div className="border border-[var(--border)] rounded-[8px] max-h-40 overflow-y-auto">
                                        {filteredEmployees.slice(0, 8).map(e => (
                                            <button key={e.id} type="button"
                                                onClick={() => { setForm(f => ({ ...f, employeeId: e.id })); setEmpSearch(`${e.firstName} ${e.lastName}`) }}
                                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--surface2)] text-left transition-colors">
                                                <div className="w-7 h-7 rounded-full bg-[var(--accent-light)] flex items-center justify-center text-[11px] font-bold text-[var(--accent-text)] shrink-0">
                                                    {e.firstName[0]}{e.lastName[0]}
                                                </div>
                                                <div>
                                                    <p className="text-[13px] font-medium text-[var(--text)]">{e.firstName} {e.lastName}</p>
                                                    <p className="text-[11px] text-[var(--text3)]">{e.employeeId} · {e.employeeCategory}</p>
                                                </div>
                                            </button>
                                        ))}
                                        {filteredEmployees.length === 0 && (
                                            <p className="px-3 py-3 text-[12px] text-[var(--text3)]">No employee found</p>
                                        )}
                                    </div>
                                )}
                                {form.employeeId && (
                                    <p className="text-[11px] text-emerald-600 font-medium">✓ Employee selected</p>
                                )}
                            </div>

                            {/* Amount */}
                            <div>
                                <label className="block text-[12px] font-medium text-[var(--text2)] mb-1">Advance Amount (₹) *</label>
                                <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                                    placeholder="e.g. 2000" min="1" required
                                    className="w-full h-9 rounded-[8px] border border-[var(--border)] px-3 text-[13px] outline-none focus:border-[var(--accent)]" />
                            </div>

                            {/* Advance Date */}
                            <div>
                                <label className="block text-[12px] font-medium text-[var(--text2)] mb-1">Date of Advance *</label>
                                <div className="relative">
                                    <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text3)] pointer-events-none" />
                                    <input
                                        type="date"
                                        value={form.advanceDate}
                                        onChange={e => handleDateChange(e.target.value)}
                                        max={todayStr()}
                                        required
                                        className="w-full h-9 rounded-[8px] border border-[var(--border)] pl-8 pr-3 text-[13px] outline-none focus:border-[var(--accent)]"
                                    />
                                </div>
                                <p className="text-[11px] text-[var(--text3)] mt-1">Deduct month auto-filled from this date</p>
                            </div>

                            {/* Deduct Month / Year */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[12px] font-medium text-[var(--text2)] mb-1">Deduct in Month *</label>
                                    <select value={form.monthToImpact} onChange={e => setForm(f => ({ ...f, monthToImpact: e.target.value }))}
                                        className="w-full h-9 rounded-[8px] border border-[var(--border)] px-3 text-[13px] outline-none focus:border-[var(--accent)]">
                                        {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[12px] font-medium text-[var(--text2)] mb-1">Year *</label>
                                    <select value={form.yearToImpact} onChange={e => setForm(f => ({ ...f, yearToImpact: e.target.value }))}
                                        className="w-full h-9 rounded-[8px] border border-[var(--border)] px-3 text-[13px] outline-none focus:border-[var(--accent)]">
                                        {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Reason */}
                            <div>
                                <label className="block text-[12px] font-medium text-[var(--text2)] mb-1">Reason <span className="text-[var(--text3)]">(optional)</span></label>
                                <input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                                    placeholder="e.g. Medical emergency"
                                    className="w-full h-9 rounded-[8px] border border-[var(--border)] px-3 text-[13px] outline-none focus:border-[var(--accent)]" />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={() => setShowModal(false)}
                                    className="flex-1 h-9 rounded-[8px] border border-[var(--border)] text-[13px] text-[var(--text2)] hover:bg-[var(--surface2)] transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" disabled={saving || !form.employeeId}
                                    className="flex-1 h-9 rounded-[8px] bg-[var(--accent)] text-white text-[13px] font-semibold hover:bg-[#4a4ac8] transition-colors disabled:opacity-60">
                                    {saving ? "Saving..." : "Give Advance"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
