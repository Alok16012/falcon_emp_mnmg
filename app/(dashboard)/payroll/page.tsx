"use client"
import { useState, useEffect, useCallback, useRef } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
    Loader2, IndianRupee, Printer, X, CalendarDays, Clock,
    ChevronLeft, ChevronRight, CheckSquare, Square, Download, Search, SlidersHorizontal
} from "lucide-react"
import * as XLSX from "xlsx"
import { cn, daysInMonth as calendarDays } from "@/lib/utils"

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
const PAGE_SIZES = [10, 20, 40, 100, 500]

function fmt(n: number) { return "₹" + Math.round(n).toLocaleString("en-IN") }

type EmpPayRow = {
    id: string; employeeId: string; name: string; designation: string
    dailyRate: number; hourlyRate: number; shiftHours: number; totalWorkingHrs: number
    otHrs: number; otPay: number; advance: number
    totalSalary: number; netSalary: number
    payrollId: string | null; payrollStatus: string | null
}

// Local YYYY-MM-DD (avoids UTC shift from toISOString)
function ymd(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
function fmtDMY(iso: string) {
    if (!iso) return ""
    const [y, m, d] = iso.split("-").map(Number)
    return `${String(d).padStart(2, "0")} ${MONTHS[m - 1]} ${y}`
}

export default function PayrollPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const now = new Date()
    const [month, setMonth] = useState(now.getMonth() + 1)
    const [year, setYear]   = useState(now.getFullYear())
    // Period mode: "month" (whole month) or "range" (custom from–to dates)
    const [mode, setMode] = useState<"month" | "range">("month")
    const [fromDate, setFromDate] = useState(ymd(new Date(now.getFullYear(), now.getMonth(), 1)))
    const [toDate, setToDate]     = useState(ymd(now))
    const [rows, setRows]   = useState<EmpPayRow[]>([])
    const [loading, setLoading] = useState(true)
    const [slipEmp, setSlipEmp] = useState<EmpPayRow | null>(null)
    const [advOverride, setAdvOverride] = useState<Record<string, number>>({})
    const [otOverride, setOtOverride]   = useState<Record<string, number>>({})
    // Pagination
    const [pageSize, setPageSize] = useState(20)
    const [page, setPage] = useState(1)
    const [q, setQ] = useState("")
    // Selection for bulk action
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const slipRef = useRef<HTMLDivElement>(null)

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            // Attendance query differs by mode; advances/payroll stay keyed to the
            // accounting month (for range mode we use the from-date's month/year).
            const attQuery = mode === "range"
                ? `from=${fromDate}&to=${toDate}`
                : `month=${year}-${String(month).padStart(2, "0")}`
            const advMonth = mode === "range" ? Number(fromDate.split("-")[1]) : month
            const advYear = mode === "range" ? Number(fromDate.split("-")[0]) : year
            // Divisor for the daily rate: real calendar days of the payroll month
            // (range mode uses the month the range starts in).
            const daysInMonth = calendarDays(advYear, advMonth)
            const [empRes, attRes, advRes, payRes] = await Promise.all([
                fetch("/api/employees?limit=1000"),
                fetch(`/api/attendance?${attQuery}&limit=5000`),
                fetch(`/api/advances?month=${advMonth}&year=${advYear}`),
                fetch(`/api/payroll?month=${advMonth}&year=${advYear}&limit=1000`),
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
                const shiftHours = parseFloat(e.shiftHours) || 8
                // Derive the TRUE hourly rate. basicSalary is a MONTHLY figure, so we
                // must convert it — never multiply the monthly salary by hours directly.
                //   • One day's pay = monthly salary ÷ the CALENDAR days in the payroll
                //     month (31 for Jul, 30 for Jun, 28 for Feb) — not a fixed 26, and
                //     not the stored dailyRate (which was frozen at monthly ÷ 30).
                //   • hourly = that daily rate ÷ the employee's shift hours.
                const monthlySalary = parseFloat(e.basicSalary) || 0
                const dailyRate = monthlySalary > 0
                    ? monthlySalary / daysInMonth
                    : (parseFloat(e.dailyRate) || 0)   // fallback: no monthly salary on record
                const hourlyRate = dailyRate > 0
                    ? parseFloat((dailyRate / shiftHours).toFixed(2))
                    : 0
                const totalSalary = parseFloat((totalWorkingHrs * hourlyRate).toFixed(2))
                const pay = (Array.isArray(pays) ? pays : (pays.data ?? [])).find((p: any) => p.employeeId === e.id)
                return {
                    id: e.id, employeeId: e.employeeId,
                    name: `${e.firstName} ${e.lastName}`,
                    designation: e.designation ?? "—",
                    dailyRate: parseFloat(dailyRate.toFixed(2)), hourlyRate, shiftHours, totalWorkingHrs,
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
    }, [month, year, mode, fromDate, toDate])

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

    // Calendar days of the payroll month — the divisor behind every daily rate.
    const daysInMonthLabel = mode === "range"
        ? calendarDays(Number(fromDate.split("-")[0]), Number(fromDate.split("-")[1]))
        : calendarDays(year, month)
    // Human-readable period + a filesystem-safe tag, driven by the selected mode
    const periodLabel = mode === "range"
        ? `${fmtDMY(fromDate)} – ${fmtDMY(toDate)}`
        : `${MONTHS[month - 1]} ${year}`
    const fileTag = mode === "range"
        ? `${fromDate}_to_${toDate}`
        : `${MONTHS[month - 1]}_${year}`
    // Inclusive day count for range mode (e.g. 1–5 Jul = 5 days)
    const dayCount = mode === "range"
        ? Math.max(1, Math.round((new Date(toDate).getTime() - new Date(fromDate).getTime()) / 86400000) + 1)
        : 0

    // PDF via print
    const printSlip = () => window.print()

    // Excel export
    const exportExcel = () => {
        const data = displayRows.map((r, i) => ({
            "#": i + 1,
            "Employee ID": r.employeeId,
            "Name": r.name,
            "Designation": r.designation,
            "Daily Rate (₹)": r.dailyRate,
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
        XLSX.utils.book_append_sheet(wb, ws, `Payroll`)
        XLSX.writeFile(wb, `Payroll_${fileTag}.xlsx`)
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

    // Search + pagination
    const searchedRows = q
        ? displayRows.filter(r => `${r.name} ${r.employeeId}`.toLowerCase().includes(q.toLowerCase()))
        : displayRows
    const totalPages = Math.max(1, Math.ceil(searchedRows.length / pageSize))
    const pageRows   = searchedRows.slice((page - 1) * pageSize, page * pageSize)

    const allPageSelected = pageRows.length > 0 && pageRows.every(r => selected.has(r.id))
    const toggleAll = () => {
        if (allPageSelected) {
            setSelected(prev => { const s = new Set(prev); pageRows.forEach(r => s.delete(r.id)); return s })
        } else {
            setSelected(prev => { const s = new Set(prev); pageRows.forEach(r => s.add(r.id)); return s })
        }
    }

    return (
        <div className="w-full space-y-4 md:space-y-5 max-w-screen-xl mx-auto pb-12 p-4 lg:p-0">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div>
                    <h1 className="text-[26px] font-bold text-[var(--text)]">Payroll</h1>
                    <p className="text-[13px] text-[var(--text3)]">Work Hours × Hourly Rate = Salary</p>
                </div>
                <button onClick={exportExcel}
                    className="self-start flex items-center gap-2 border border-[var(--border)] bg-white rounded-[12px] text-[13px] font-semibold px-4 py-2.5 hover:bg-[var(--surface2)] transition-colors shadow-[0_2px_10px_rgba(80,80,170,0.05)]">
                    <Download size={14} className="text-[var(--accent)]" /> Export
                </button>
            </div>

            {/* Period selector */}
            <div className="bg-white border border-[var(--border)] rounded-[16px] p-3.5 shadow-[0_2px_10px_rgba(80,80,170,0.05)] space-y-3">
                {/* Mode toggle */}
                <div className="inline-flex bg-[var(--surface2)] rounded-full p-1">
                    {([["month", "Full Month"], ["range", "Date Range"]] as const).map(([m, label]) => (
                        <button key={m} onClick={() => setMode(m)}
                            className={cn(
                                "px-4 py-1.5 rounded-full text-[12.5px] font-semibold transition-colors",
                                mode === m ? "bg-[var(--accent)] text-white shadow-sm" : "text-[var(--text2)]"
                            )}>
                            {label}
                        </button>
                    ))}
                </div>

                {mode === "month" ? (
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 bg-[var(--surface2)] border border-[var(--border)] rounded-[12px] px-2.5 py-2">
                            <CalendarDays size={14} className="text-[var(--text3)]" />
                            <select value={month} onChange={e => setMonth(+e.target.value)}
                                className="bg-transparent text-[13px] font-semibold outline-none cursor-pointer">
                                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                            </select>
                        </div>
                        <div className="bg-[var(--surface2)] border border-[var(--border)] rounded-[12px] px-2.5 py-2">
                            <select value={year} onChange={e => setYear(+e.target.value)}
                                className="bg-transparent text-[13px] font-semibold outline-none cursor-pointer">
                                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 3 + i).map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-end gap-2 flex-wrap">
                        <div>
                            <label className="block text-[11px] font-medium text-[var(--text3)] mb-1">From</label>
                            <input type="date" value={fromDate} max={toDate}
                                onChange={e => setFromDate(e.target.value)}
                                className="bg-[var(--surface2)] border border-[var(--border)] rounded-[12px] px-3 py-2 text-[13px] font-semibold outline-none focus:border-[var(--accent)]" />
                        </div>
                        <div>
                            <label className="block text-[11px] font-medium text-[var(--text3)] mb-1">To</label>
                            <input type="date" value={toDate} min={fromDate}
                                onChange={e => setToDate(e.target.value)}
                                className="bg-[var(--surface2)] border border-[var(--border)] rounded-[12px] px-3 py-2 text-[13px] font-semibold outline-none focus:border-[var(--accent)]" />
                        </div>
                    </div>
                )}
                <p className="text-[12px] text-[var(--text2)]">
                    Showing salary for <span className="font-semibold text-[var(--accent-text)]">{periodLabel}</span>
                    {mode === "range" && <span className="text-[var(--text3)]"> · {dayCount} day{dayCount !== 1 ? "s" : ""}</span>}
                </p>
            </div>

            {/* Bulk actions */}
            {selected.size > 0 && (
                <div className="flex items-center gap-2 flex-wrap bg-white border border-[var(--border)] rounded-[14px] px-3.5 py-2.5 shadow-[0_2px_10px_rgba(80,80,170,0.05)]">
                    <span className="text-[12.5px] font-medium text-[var(--text2)]">{selected.size} selected</span>
                    <button onClick={() => bulkMarkPaid("PAID")}
                        className="px-3 py-1.5 bg-green-600 text-white rounded-full text-[12px] font-semibold hover:opacity-90">
                        ✓ Mark All Paid
                    </button>
                    <button onClick={() => bulkMarkPaid("UNPAID")}
                        className="px-3 py-1.5 bg-orange-500 text-white rounded-full text-[12px] font-semibold hover:opacity-90">
                        Mark Unpaid
                    </button>
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    { label: "Total Hrs", value: totalHrs.toFixed(1) + " hrs", color: "#2563eb", bg: "#eff5ff", icon: <Clock size={18} /> },
                    { label: "Total Salary", value: fmt(totalSalarySum), color: "#5b5bd6", bg: "#f0f0fd", icon: <IndianRupee size={18} /> },
                    { label: "Advance", value: fmt(totalAdvance), color: "#ea580c", bg: "#fff5eb", icon: <IndianRupee size={18} /> },
                    { label: "Net Payable", value: fmt(totalNet), color: "#16a34a", bg: "#eefaf2", icon: <IndianRupee size={18} /> },
                ].map(card => (
                    <div key={card.label} className="rounded-[16px] p-3 md:p-4 flex items-center gap-2.5 min-w-0" style={{ background: card.bg }}>
                        <div className="w-9 h-9 md:w-11 md:h-11 rounded-[11px] md:rounded-[13px] bg-white flex items-center justify-center shrink-0 shadow-sm" style={{ color: card.color }}>
                            {card.icon}
                        </div>
                        <div className="min-w-0">
                            <p className="text-[11.5px] md:text-[12px] text-[var(--text2)] font-medium">{card.label}</p>
                            <p className="text-[15px] md:text-[18px] font-bold leading-tight whitespace-nowrap" style={{ color: card.color }}>{card.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Paid counter */}
            <div className="rounded-[16px] p-4 flex items-center gap-3 bg-[#ebfaf6]">
                <div className="w-11 h-11 rounded-[13px] bg-white text-[#0d9488] flex items-center justify-center shrink-0 text-[17px] font-bold shadow-sm">✓</div>
                <div>
                    <p className="text-[12px] text-[var(--text2)] font-medium">Paid</p>
                    <p className="text-[18px] font-bold text-[#0d9488]">{paidCount} / {rows.length}</p>
                </div>
            </div>

            {/* Search */}
            <div className="flex items-center gap-2.5">
                <div className="relative flex-1">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text3)]" />
                    <input value={q} onChange={e => { setQ(e.target.value); setPage(1) }} placeholder="Search employee by name or ID..."
                        className="w-full h-11 pl-10 pr-3 rounded-[14px] border border-[var(--border)] text-[13.5px] outline-none focus:border-[var(--accent)] bg-white shadow-[0_2px_10px_rgba(80,80,170,0.05)]" />
                </div>
                <button className="w-11 h-11 rounded-[14px] border border-[var(--border)] bg-white flex items-center justify-center text-[var(--text2)] shadow-[0_2px_10px_rgba(80,80,170,0.05)] shrink-0">
                    <SlidersHorizontal size={17} />
                </button>
            </div>

            {/* Mobile card list */}
            <div className="md:hidden space-y-2.5">
                {pageRows.length === 0 ? (
                    <div className="py-12 text-center text-[var(--text3)] bg-white border border-[var(--border)] rounded-[16px] text-[13px]">No employees found</div>
                ) : pageRows.map(row => {
                    const isPaid = row.payrollStatus === "PAID"
                    const initials = row.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
                    return (
                        <div key={row.id} className="bg-white border border-[var(--border)] rounded-[16px] px-3.5 py-3 shadow-[0_2px_10px_rgba(80,80,170,0.05)]">
                            {/* Row 1: identity + action */}
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-[var(--accent-light)] flex items-center justify-center text-[12.5px] font-bold text-[var(--accent-text)] shrink-0"
                                    onClick={() => row.hourlyRate > 0 && setSlipEmp(row)}>
                                    {initials}
                                </div>
                                <div className="min-w-0 flex-1" onClick={() => row.hourlyRate > 0 && setSlipEmp(row)}>
                                    <p className="text-[14px] font-semibold text-[var(--text)] truncate leading-tight">{row.name}</p>
                                    <p className="text-[11.5px] text-[var(--accent-text)] font-medium mt-0.5">{row.employeeId}</p>
                                </div>
                                {row.hourlyRate > 0 && (
                                    <button onClick={() => setSlipEmp(row)} title="Salary slip"
                                        className="shrink-0 flex items-center justify-center w-9 h-9 rounded-full border border-[var(--border)] text-[var(--accent)] hover:bg-[var(--accent-light)] transition-colors">
                                        <Printer size={15} />
                                    </button>
                                )}
                                {isPaid ? (
                                    <button onClick={() => markPaid(row.id, row.payrollId, "UNPAID")}
                                        className="shrink-0 px-3 py-2 rounded-full text-[11px] font-bold bg-green-100 text-green-700 whitespace-nowrap">
                                        ✓ PAID
                                    </button>
                                ) : (
                                    <button onClick={() => markPaid(row.id, row.payrollId, "PAID")}
                                        className="shrink-0 px-3 py-2 rounded-full text-[11px] font-semibold bg-[var(--accent-light)] text-[var(--accent-text)] whitespace-nowrap hover:bg-[#e0e0fa] transition-colors">
                                        Mark Paid
                                    </button>
                                )}
                            </div>
                            {/* Row 2: stats */}
                            <div className="grid grid-cols-4 gap-2 mt-2.5 pt-2.5 border-t border-[var(--border)]">
                                <div>
                                    <p className="text-[10px] text-[var(--text3)] font-medium">Work Hrs</p>
                                    <p className="text-[13px] font-bold text-blue-600 mt-0.5">{row.totalWorkingHrs > 0 ? row.totalWorkingHrs.toFixed(2) : "0"}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-[var(--text3)] font-medium">OT Hrs</p>
                                    <p className="text-[13px] font-bold text-orange-500 mt-0.5">{row.otHrs || 0}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-[var(--text3)] font-medium">Advance</p>
                                    <p className="text-[13px] font-bold text-[var(--text)] mt-0.5">{fmt(row.advance)}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-[var(--text3)] font-medium">Net Salary</p>
                                    <p className="text-[13px] font-bold text-green-600 mt-0.5">{fmt(row.netSalary)}</p>
                                </div>
                            </div>
                        </div>
                    )
                })}
                {/* Mobile pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 pt-1">
                        <button disabled={page === 1} onClick={() => setPage(p => p-1)}
                            className="p-2 rounded-full border border-[var(--border)] bg-white disabled:opacity-40">
                            <ChevronLeft size={14} />
                        </button>
                        <span className="text-[12.5px] text-[var(--text3)]">Page {page} of {totalPages}</span>
                        <button disabled={page === totalPages} onClick={() => setPage(p => p+1)}
                            className="p-2 rounded-full border border-[var(--border)] bg-white disabled:opacity-40">
                            <ChevronRight size={14} />
                        </button>
                    </div>
                )}
            </div>

            {/* Table (desktop) */}
            <div className="hidden md:block bg-white border border-[var(--border)] rounded-[16px] overflow-hidden shadow-[0_2px_10px_rgba(80,80,170,0.05)]">
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
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    {/* Print isolation: only the slip prints, not the whole page */}
                    <style>{`@media print { body * { visibility: hidden !important; } #salary-slip, #salary-slip * { visibility: visible !important; } #salary-slip { position: fixed !important; inset: 0 !important; margin: auto !important; box-shadow: none !important; } .no-print { display: none !important; } }`}</style>
                    <div id="salary-slip" className="bg-white rounded-xl shadow-2xl w-full max-w-sm" ref={slipRef}>
                        <div className="flex items-center justify-between px-5 py-3 border-b no-print">
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
                                <div className="text-[11px] text-[var(--text3)]">Salary Slip — {periodLabel}</div>
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] bg-[var(--surface)] rounded-lg p-3">
                                <div><span className="text-[var(--text3)]">Name: </span><span className="font-semibold">{slipEmp.name}</span></div>
                                <div><span className="text-[var(--text3)]">ID: </span><span className="font-mono">{slipEmp.employeeId}</span></div>
                                <div><span className="text-[var(--text3)]">Designation: </span><span>{slipEmp.designation}</span></div>
                                <div className="col-span-2"><span className="text-[var(--text3)]">Period: </span><span className="font-medium">{periodLabel}</span>{mode === "range" && <span className="text-[var(--text3)]"> ({dayCount} days)</span>}</div>
                            </div>
                            <div className="border border-[var(--border)] rounded-lg overflow-hidden">
                                <div className="bg-[var(--surface)] px-3 py-1.5 text-[10px] font-bold text-[var(--text3)] uppercase tracking-wide">Earnings</div>
                                <div className="px-3 py-2 space-y-1.5 text-[11px]">
                                    <div className="flex justify-between">
                                        <span className="text-[var(--text3)]">Daily Rate ({daysInMonthLabel} days)</span><span>₹{slipEmp.dailyRate}/day</span>
                                    </div>
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
