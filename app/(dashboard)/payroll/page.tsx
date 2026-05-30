"use client"
import { useState, useEffect, useCallback, useRef } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
    Loader2, IndianRupee, Printer, X, FileSpreadsheet, Clock,
    ChevronLeft, ChevronRight, CheckSquare, Square, Download
} from "lucide-react"
import * as XLSX from "xlsx"

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
const PAGE_SIZES = [10, 20, 40, 100, 500]

function fmt(n: number) { return "₹" + Math.round(n).toLocaleString("en-IN") }

type EmpPayRow = {
    id: string; employeeId: string; name: string; designation: string
    hourlyRate: number; shiftHours: number; totalWorkingHrs: number
    otHrs: number; otPay: number; advance: number
    totalSalary: number; netSalary: number
    payrollId: string | null; payrollStatus: string | null
}

export default function PayrollPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [month, setMonth] = useState(new Date().getMonth() + 1)
    const [year, setYear]   = useState(new Date().getFullYear())
    const [rows, setRows]   = useState<EmpPayRow[]>([])
    const [loading, setLoading] = useState(true)
    const [slipEmp, setSlipEmp] = useState<EmpPayRow | null>(null)
    const [advOverride, setAdvOverride] = useState<Record<string, number>>({})
    const [otOverride, setOtOverride]   = useState<Record<string, number>>({})
    // Pagination
    const [pageSize, setPageSize] = useState(20)
    const [page, setPage] = useState(1)
    // Selection for bulk action
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const slipRef = useRef<HTMLDivElement>(null)

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const [empRes, attRes, advRes, payRes] = await Promise.all([
                fetch("/api/employees?limit=1000"),
                fetch(`/api/attendance?month=${year}-${String(month).padStart(2,"0")}&limit=5000`),
                fetch(`/api/advances?month=${month}&year=${year}`),
                fetch(`/api/payroll?month=${month}&year=${year}&limit=1000`),
            ])
            const emps     = empRes.ok ? await empRes.json() : []
            const attData  = attRes.ok ? await attRes.json() : []
            const advances = advRes.ok ? await advRes.json() : []
            const pays     = payRes.ok ? await payRes.json() : []

            const empList: any[] = emps.data ?? emps
            const attList: any[] = Array.isArray(attData) ? attData : (attData.data ?? [])

            const newRows: EmpPayRow[] = empList.map((e: any) => {
                const empAtt = attList.filter((a: any) => a.employeeId === e.id)
                const totalWorkingHrs = parseFloat(empAtt.reduce((s: number, a: any) => s + (parseFloat(a.workingHrs) || 0), 0).toFixed(2))
                const autoAdvance = (Array.isArray(advances) ? advances : [])
                    .filter((a: any) => a.employeeId === e.id)
                    .reduce((s: number, a: any) => s + (a.amount ?? 0), 0)
                const hourlyRate = parseFloat(e.basicSalary) || 0
                const shiftHours = parseInt(e.shiftHours) || 8
                const totalSalary = parseFloat((totalWorkingHrs * hourlyRate).toFixed(2))
                const pay = (Array.isArray(pays) ? pays : (pays.data ?? [])).find((p: any) => p.employeeId === e.id)
                return {
                    id: e.id, employeeId: e.employeeId,
                    name: `${e.firstName} ${e.lastName}`,
                    designation: e.designation ?? "—",
                    hourlyRate, shiftHours, totalWorkingHrs,
                    otHrs: 0, otPay: 0,
                    advance: autoAdvance,
                    totalSalary, netSalary: Math.max(0, totalSalary - autoAdvance),
                    payrollId: pay?.id ?? null,
                    payrollStatus: pay?.status ?? null,
                }
            })
            setRows(newRows)
            const advInit: Record<string, number> = {}
            const otInit: Record<string, number> = {}
            newRows.forEach(r => { advInit[r.id] = r.advance; otInit[r.id] = 0 })
            setAdvOverride(advInit)
            setOtOverride(otInit)
            setPage(1)
            setSelected(new Set())
        } catch (e) {
            console.error(e)
            toast.error("Failed to load payroll data")
        } finally { setLoading(false) }
    }, [month, year])

    useEffect(() => {
        if (status === "unauthenticated") router.push("/login")
        else if (status === "authenticated") loadData()
    }, [status, router, loadData])

    const getRow = (r: EmpPayRow): EmpPayRow => {
        const adv = advOverride[r.id] ?? r.advance
        const ot  = otOverride[r.id]  ?? 0
        const otPay = parseFloat((ot * r.hourlyRate * 1.5).toFixed(2))
        const totalSalary = parseFloat(((r.totalWorkingHrs * r.hourlyRate) + otPay).toFixed(2))
        return { ...r, otHrs: ot, otPay, advance: adv, totalSalary, netSalary: Math.max(0, totalSalary - adv) }
    }

    const markPaid = async (id: string, payrollId: string | null, newStatus: "PAID" | "UNPAID") => {
        try {
            if (payrollId) {
                const res = await fetch(`/api/payroll/${payrollId}`, {
                    method: "PUT", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: newStatus })
                })
                if (!res.ok) throw new Error(await res.text())
            } else {
                // create payroll record first
                const row = getRow(rows.find(r => r.id === id)!)
                const res = await fetch("/api/payroll/calculate", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ month, year, attendance: [{
                        employeeId: id, workedDays: 0,
                        monthDays: new Date(year, month, 0).getDate(),
                        otDays: 0, canteenDays: 0, penalty: 0,
                        advance: row.advance, otherDeductions: 0,
                        productionIncentive: 0, lwf: 0,
                        totalWorkingHrs: row.totalWorkingHrs,
                        hourlyRate: row.hourlyRate,
                        totalSalary: row.totalSalary, netSalary: row.netSalary,
                    }]})
                })
                if (!res.ok) throw new Error(await res.text())
                await loadData(); return
            }
            toast.success(newStatus === "PAID" ? "Marked as PAID ✓" : "Marked as Unpaid")
            setRows(prev => prev.map(r => r.payrollId === payrollId ? { ...r, payrollStatus: newStatus } : r))
        } catch (e: any) { toast.error(e.message || "Failed") }
    }

    const bulkMarkPaid = async (newStatus: "PAID" | "UNPAID") => {
        const targets = [...selected]
        for (const id of targets) {
            const r = rows.find(x => x.id === id)
            if (r) await markPaid(id, r.payrollId, newStatus)
        }
        setSelected(new Set())
        toast.success(`${targets.length} employees marked as ${newStatus}`)
    }

    // PDF via print
    const printSlip = () => window.print()

    // Excel export
    const exportExcel = () => {
        const data = displayRows.map((r, i) => ({
            "#": i + 1,
            "Employee ID": r.employeeId,
            "Name": r.name,
            "Designation": r.designation,
            "Hourly Rate (₹)": r.hourlyRate,
            "Shift Hours": r.shiftHours,
            "Work Hours": r.totalWorkingHrs,
            "OT Hours": r.otHrs,
            "OT Pay (₹)": r.otPay,
            "Total Salary (₹)": r.totalSalary,
            "Advance (₹)": r.advance,
            "Net Salary (₹)": r.netSalary,
            "Status": r.payrollStatus ?? "PENDING",
        }))
        const ws = XLSX.utils.json_to_sheet(data)
        // Auto column widths
        const colWidths = Object.keys(data[0] ?? {}).map(k => ({ wch: Math.max(k.length + 2, 14) }))
        ws["!cols"] = colWidths
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, `Payroll ${MONTHS[month-1]} ${year}`)
        XLSX.writeFile(wb, `Payroll_${MONTHS[month-1]}_${year}.xlsx`)
        toast.success("Excel downloaded!")
    }

    if (status === "loading" || loading) {
        return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="animate-spin text-[var(--accent)]" /></div>
    }
    if (session?.user?.role !== "ADMIN" && session?.user?.role !== "MANAGER") {
        return <div className="p-8 text-center text-red-500">Access Denied</div>
    }

    const displayRows = rows.map(getRow)
    const totalHrs       = displayRows.reduce((s, r) => s + r.totalWorkingHrs, 0)
    const totalSalarySum = displayRows.reduce((s, r) => s + r.totalSalary, 0)
    const totalAdvance   = displayRows.reduce((s, r) => s + r.advance, 0)
    const totalNet       = displayRows.reduce((s, r) => s + r.netSalary, 0)
    const paidCount      = displayRows.filter(r => r.payrollStatus === "PAID").length

    // Pagination
    const totalPages = Math.ceil(displayRows.length / pageSize)
    const pageRows   = displayRows.slice((page - 1) * pageSize, page * pageSize)

    const allPageSelected = pageRows.length > 0 && pageRows.every(r => selected.has(r.id))
    const toggleAll = () => {
        if (allPageSelected) {
            setSelected(prev => { const s = new Set(prev); pageRows.forEach(r => s.delete(r.id)); return s })
        } else {
            setSelected(prev => { const s = new Set(prev); pageRows.forEach(r => s.add(r.id)); return s })
        }
    }

    return (
        <div className="space-y-5 max-w-screen-xl mx-auto pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-[22px] font-semibold text-[var(--text)]">Payroll</h1>
                    <p className="text-[13px] text-[var(--text3)]">Work Hours × Hourly Rate = Salary</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Month/Year */}
                    <div className="flex items-center gap-2 bg-white border border-[var(--border)] rounded-xl px-3 py-2">
                        <select value={month} onChange={e => setMonth(+e.target.value)}
                            className="bg-transparent text-[13px] font-medium outline-none">
                            {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                        </select>
                        <input type="number" value={year} onChange={e => setYear(+e.target.value)}
                            className="bg-transparent text-[13px] font-medium w-16 outline-none" />
                    </div>
                    <button onClick={exportExcel}
                        className="flex items-center gap-2 border border-[var(--border)] bg-white rounded-xl text-[13px] font-medium px-4 py-2 hover:bg-[var(--surface)] transition-colors">
                        <FileSpreadsheet size={15} className="text-green-600" /> Excel
                    </button>
                    {slipEmp && (
                        <button onClick={printSlip}
                            className="flex items-center gap-2 border border-[var(--border)] bg-white rounded-xl text-[13px] font-medium px-4 py-2 hover:bg-[var(--surface)] transition-colors">
                            <Download size={15} className="text-blue-600" /> PDF
                        </button>
                    )}
                    {/* Bulk actions */}
                    {selected.size > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="text-[12px] text-[var(--text3)]">{selected.size} selected</span>
                            <button onClick={() => bulkMarkPaid("PAID")}
                                className="px-3 py-2 bg-green-600 text-white rounded-xl text-[12px] font-medium hover:opacity-90">
                                ✓ Mark All Paid
                            </button>
                            <button onClick={() => bulkMarkPaid("UNPAID")}
                                className="px-3 py-2 bg-orange-500 text-white rounded-xl text-[12px] font-medium hover:opacity-90">
                                Mark Unpaid
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                    { label: "Total Hrs", value: totalHrs.toFixed(1) + " hrs", color: "text-blue-600", icon: <Clock size={15} /> },
                    { label: "Total Salary", value: fmt(totalSalarySum), color: "text-[var(--accent)]", icon: <IndianRupee size={15} /> },
                    { label: "Advance", value: fmt(totalAdvance), color: "text-orange-600", icon: <IndianRupee size={15} /> },
                    { label: "Net Payable", value: fmt(totalNet), color: "text-green-600", icon: <IndianRupee size={15} /> },
                    { label: "Paid", value: `${paidCount} / ${rows.length}`, color: "text-teal-600", icon: <span className="text-[14px]">✓</span> },
                ].map(card => (
                    <div key={card.label} className="bg-white border border-[var(--border)] rounded-xl p-3">
                        <div className="flex items-center gap-1 mb-0.5">
                            <span className={card.color}>{card.icon}</span>
                            <p className="text-[10px] text-[var(--text3)]">{card.label}</p>
                        </div>
                        <p className={`text-[17px] font-bold ${card.color}`}>{card.value}</p>
                    </div>
                ))}
            </div>

            {/* Table */}
            <div className="bg-white border border-[var(--border)] rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-[12px]">
                        <thead>
                            <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
                                <th className="px-3 py-3 w-8">
                                    <button onClick={toggleAll} className="text-[var(--text3)] hover:text-[var(--accent)]">
                                        {allPageSelected ? <CheckSquare size={15} /> : <Square size={15} />}
                                    </button>
                                </th>
                                <th className="px-3 py-3 text-left font-semibold text-[var(--text3)] w-6">#</th>
                                <th className="px-3 py-3 text-left font-semibold text-[var(--text3)]">Employee</th>
                                <th className="px-3 py-3 text-right font-semibold text-[var(--text3)]">Rate/Hr</th>
                                <th className="px-3 py-3 text-right font-semibold text-blue-600">Work Hrs</th>
                                <th className="px-3 py-3 text-center font-semibold text-purple-600">OT Hrs<br/><span className="text-[9px] font-normal">(×1.5 rate)</span></th>
                                <th className="px-3 py-3 text-right font-semibold text-purple-600">OT Pay</th>
                                <th className="px-3 py-3 text-right font-semibold text-[var(--accent)]">Total Salary</th>
                                <th className="px-3 py-3 text-center font-semibold text-orange-600">Advance</th>
                                <th className="px-3 py-3 text-right font-semibold text-green-700">Net Salary</th>
                                <th className="px-3 py-3 text-center font-semibold text-[var(--text3)]">Status / Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                            {pageRows.map((row, idx) => {
                                const globalIdx = (page - 1) * pageSize + idx + 1
                                const isPaid = row.payrollStatus === "PAID"
                                return (
                                    <tr key={row.id} className={`hover:bg-[var(--surface)] ${selected.has(row.id) ? "bg-blue-50/40" : ""}`}>
                                        <td className="px-3 py-2 text-center">
                                            <button onClick={() => setSelected(prev => {
                                                const s = new Set(prev)
                                                s.has(row.id) ? s.delete(row.id) : s.add(row.id)
                                                return s
                                            })} className="text-[var(--text3)] hover:text-[var(--accent)]">
                                                {selected.has(row.id) ? <CheckSquare size={14} className="text-[var(--accent)]" /> : <Square size={14} />}
                                            </button>
                                        </td>
                                        <td className="px-3 py-2 text-[var(--text3)]">{globalIdx}</td>
                                        <td className="px-3 py-2">
                                            <div className="font-medium text-[var(--text)]">{row.name}</div>
                                            <div className="text-[10px] text-[var(--text3)]">{row.employeeId} · {row.designation}</div>
                                        </td>
                                        <td className="px-3 py-2 text-right font-medium">
                                            {row.hourlyRate ? `₹${row.hourlyRate}/hr` : <span className="text-[var(--text3)]">—</span>}
                                        </td>
                                        <td className="px-3 py-2 text-right font-semibold text-blue-600">
                                            {row.totalWorkingHrs > 0 ? row.totalWorkingHrs.toFixed(2) : <span className="text-[var(--text3)]">0</span>}
                                        </td>
                                        <td className="px-2 py-2 text-center">
                                            <input type="number" min="0" step="0.5"
                                                value={otOverride[row.id] ?? 0}
                                                onChange={e => setOtOverride(prev => ({ ...prev, [row.id]: parseFloat(e.target.value) || 0 }))}
                                                className="w-14 border border-[var(--border)] rounded px-1.5 py-1 text-center text-[11px] outline-none focus:border-purple-400" />
                                        </td>
                                        <td className="px-3 py-2 text-right font-semibold text-purple-600">
                                            {row.otPay > 0 ? fmt(row.otPay) : <span className="text-[var(--text3)]">—</span>}
                                        </td>
                                        <td className="px-3 py-2 text-right font-semibold text-[var(--accent)]">
                                            {row.hourlyRate > 0 ? fmt(row.totalSalary) : <span className="text-[var(--text3)]">—</span>}
                                        </td>
                                        <td className="px-2 py-2 text-center">
                                            <input type="number" min="0"
                                                value={advOverride[row.id] ?? row.advance}
                                                onChange={e => setAdvOverride(prev => ({ ...prev, [row.id]: parseFloat(e.target.value) || 0 }))}
                                                className="w-18 border border-[var(--border)] rounded px-1.5 py-1 text-right text-[11px] outline-none focus:border-orange-400" />
                                        </td>
                                        <td className="px-3 py-2 text-right font-bold text-green-700">
                                            {row.hourlyRate > 0 ? fmt(row.netSalary) : <span className="text-[var(--text3)]">—</span>}
                                        </td>
                                        <td className="px-3 py-2">
                                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                                {/* Paid / Unpaid toggle */}
                                                {isPaid ? (
                                                    <button
                                                        onClick={() => markPaid(row.id, row.payrollId, "UNPAID")}
                                                        className="px-2 py-0.5 text-[10px] font-bold bg-green-100 text-green-700 border border-green-300 rounded-full hover:bg-green-200 transition-colors whitespace-nowrap">
                                                        ✓ PAID
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => markPaid(row.id, row.payrollId, "PAID")}
                                                        className="px-2 py-0.5 text-[10px] font-semibold bg-white text-[var(--text3)] border border-[var(--border)] rounded-full hover:bg-green-50 hover:text-green-700 hover:border-green-300 transition-colors whitespace-nowrap">
                                                        Mark Paid
                                                    </button>
                                                )}
                                                {/* Salary slip / PDF */}
                                                {row.hourlyRate > 0 && (
                                                    <button onClick={() => setSlipEmp(row)}
                                                        className="p-1 rounded hover:bg-blue-50 text-blue-400 hover:text-blue-600 transition-colors" title="Salary Slip / PDF">
                                                        <Printer size={13} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                        {/* Totals */}
                        <tfoot>
                            <tr className="bg-[var(--surface)] border-t-2 border-[var(--border)] font-bold text-[12px]">
                                <td colSpan={4} className="px-3 py-3 text-[var(--text3)]">TOTAL — {rows.length} employees</td>
                                <td className="px-3 py-3 text-right text-blue-600">{totalHrs.toFixed(2)}</td>
                                <td />
                                <td className="px-3 py-3 text-right text-purple-600">{fmt(displayRows.reduce((s,r) => s+r.otPay,0))}</td>
                                <td className="px-3 py-3 text-right text-[var(--accent)]">{fmt(totalSalarySum)}</td>
                                <td className="px-3 py-3 text-right text-orange-600">{fmt(totalAdvance)}</td>
                                <td className="px-3 py-3 text-right text-green-700">{fmt(totalNet)}</td>
                                <td />
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {/* Pagination bar */}
                <div className="px-4 py-3 border-t border-[var(--border)] flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2 text-[12px] text-[var(--text3)]">
                        <span>Show</span>
                        {PAGE_SIZES.map(s => (
                            <button key={s} onClick={() => { setPageSize(s); setPage(1) }}
                                className={`px-2.5 py-1 rounded-lg border text-[12px] font-medium transition-colors ${pageSize === s
                                    ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                                    : "bg-white border-[var(--border)] hover:border-[var(--accent)] text-[var(--text2)]"}`}>
                                {s}
                            </button>
                        ))}
                        <span className="ml-1">per page</span>
                    </div>
                    <div className="flex items-center gap-2 text-[12px]">
                        <span className="text-[var(--text3)]">
                            {Math.min((page-1)*pageSize+1, rows.length)}–{Math.min(page*pageSize, rows.length)} of {rows.length}
                        </span>
                        <button disabled={page === 1} onClick={() => setPage(p => p-1)}
                            className="p-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--surface)] disabled:opacity-40 disabled:cursor-not-allowed">
                            <ChevronLeft size={14} />
                        </button>
                        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                            const p = totalPages <= 5 ? i+1 : page <= 3 ? i+1 : page >= totalPages-2 ? totalPages-4+i : page-2+i
                            return (
                                <button key={p} onClick={() => setPage(p)}
                                    className={`w-7 h-7 rounded-lg border text-[12px] font-medium transition-colors ${page === p
                                        ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                                        : "bg-white border-[var(--border)] hover:border-[var(--accent)] text-[var(--text2)]"}`}>
                                    {p}
                                </button>
                            )
                        })}
                        <button disabled={page === totalPages} onClick={() => setPage(p => p+1)}
                            className="p-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--surface)] disabled:opacity-40 disabled:cursor-not-allowed">
                            <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Salary Slip Modal (also used for PDF print) */}
            {slipEmp && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 print:bg-transparent print:inset-auto print:p-0">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm print:shadow-none print:rounded-none" ref={slipRef}>
                        <div className="flex items-center justify-between px-5 py-3 border-b print:hidden">
                            <h2 className="text-[14px] font-bold">Salary Slip</h2>
                            <div className="flex gap-2">
                                <button onClick={printSlip}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[12px] font-medium">
                                    <Download size={13} /> Save PDF
                                </button>
                                <button onClick={printSlip}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] text-white rounded-lg text-[12px] font-medium">
                                    <Printer size={13} /> Print
                                </button>
                                <button onClick={() => setSlipEmp(null)} className="p-1.5 rounded hover:bg-[var(--surface2)]">
                                    <X size={15} />
                                </button>
                            </div>
                        </div>
                        <div className="px-5 py-4 text-[12px] space-y-3">
                            <div className="text-center pb-1 border-b border-[var(--border)]">
                                <div className="text-[17px] font-bold text-[var(--accent)]">Falcon Plus</div>
                                <div className="text-[11px] text-[var(--text3)]">Salary Slip — {MONTHS[month-1]} {year}</div>
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] bg-[var(--surface)] rounded-lg p-3">
                                <div><span className="text-[var(--text3)]">Name: </span><span className="font-semibold">{slipEmp.name}</span></div>
                                <div><span className="text-[var(--text3)]">ID: </span><span className="font-mono">{slipEmp.employeeId}</span></div>
                                <div><span className="text-[var(--text3)]">Designation: </span><span>{slipEmp.designation}</span></div>
                                <div><span className="text-[var(--text3)]">Month: </span><span>{MONTHS[month-1]} {year}</span></div>
                            </div>
                            <div className="border border-[var(--border)] rounded-lg overflow-hidden">
                                <div className="bg-[var(--surface)] px-3 py-1.5 text-[10px] font-bold text-[var(--text3)] uppercase tracking-wide">Earnings</div>
                                <div className="px-3 py-2 space-y-1.5 text-[11px]">
                                    <div className="flex justify-between">
                                        <span className="text-[var(--text3)]">Hourly Rate</span><span>₹{slipEmp.hourlyRate}/hr</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-[var(--text3)]">Work Hours</span>
                                        <span className="font-semibold text-blue-600">{slipEmp.totalWorkingHrs.toFixed(2)} hrs</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-[var(--text3)]">Regular Pay</span>
                                        <span>{fmt(slipEmp.totalWorkingHrs * slipEmp.hourlyRate)}</span>
                                    </div>
                                    {slipEmp.otHrs > 0 && (
                                        <div className="flex justify-between text-purple-700">
                                            <span>OT ({slipEmp.otHrs} hrs × ₹{slipEmp.hourlyRate} × 1.5)</span>
                                            <span className="font-semibold">+{fmt(slipEmp.otPay)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between border-t border-[var(--border)] pt-1.5 font-bold text-[var(--accent)]">
                                        <span>Total Salary</span><span>{fmt(slipEmp.totalSalary)}</span>
                                    </div>
                                </div>
                                {slipEmp.advance > 0 && (
                                    <>
                                        <div className="bg-[var(--surface)] px-3 py-1.5 text-[10px] font-bold text-[var(--text3)] uppercase tracking-wide border-t border-[var(--border)]">Deductions</div>
                                        <div className="px-3 py-2 text-[11px]">
                                            <div className="flex justify-between text-orange-700">
                                                <span>Advance Salary</span><span>-{fmt(slipEmp.advance)}</span>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex justify-between items-center">
                                <span className="font-bold text-[13px] text-green-800">NET PAYABLE</span>
                                <span className="font-bold text-[20px] text-green-700">{fmt(slipEmp.netSalary)}</span>
                            </div>
                            {slipEmp.payrollStatus === "PAID" && (
                                <div className="text-center text-[11px] font-bold text-green-700 bg-green-100 rounded py-1.5 border border-green-200">
                                    ✓ PAID & CONFIRMED
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
