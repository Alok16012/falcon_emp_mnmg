"use client"
import { useState, useEffect, useCallback, useMemo } from "react"
import { createPortal } from "react-dom"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
    Loader2, IndianRupee, Printer, X, CalendarDays, Clock, Info, ChevronDown,
    ChevronLeft, ChevronRight, CheckSquare, Square, Download, Search, Sun,
} from "lucide-react"
import * as XLSX from "xlsx"
import { cn } from "@/lib/utils"
import {
    calcHourlyPayroll, monthPeriod, FREE_SUNDAY_SLABS, SALARY_BASE_DAYS,
    type HourlyPayResult, type PayAttendance, type PayAdvance,
} from "@/lib/hourly-payroll"

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
const PAGE_SIZES = [10, 20, 40, 100, 500]
const RULES_KEY = "payroll.rulesOpen"

function fmt(n: number) { return "₹" + Math.round(n).toLocaleString("en-IN") }
function fmt2(n: number) { return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function hrs(n: number) { return `${Number(n.toFixed(2))} h` }

type EmpBase = {
    id: string; employeeId: string; name: string; designation: string
    basicSalary: number; shiftHours: number; shiftStart: string | null; shiftEnd: string | null
    dateOfJoining: string | null; dateOfLeaving: string | null
    att: PayAttendance[]; autoAdvance: number; advances: PayAdvance[]
    carryForward: number          // last month's unpaid balance (net − paid)
    payrollStatus: string | null
    paidAmount: number | null     // saved paid amount for this month
}
type EmpPayRow = EmpBase & { calc: HourlyPayResult }

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
    const [base, setBase]   = useState<EmpBase[]>([])
    const [loading, setLoading] = useState(true)
    const [slipId, setSlipId] = useState<string | null>(null)
    const [advOverride, setAdvOverride] = useState<Record<string, number>>({})
    const [otOverride, setOtOverride]   = useState<Record<string, number>>({})
    // Amount actually paid (blank = full net); a short payment carries to next month
    const [paidOverride, setPaidOverride] = useState<Record<string, number | undefined>>({})
    const [saving, setSaving] = useState<Set<string>>(new Set())
    const [rulesOpen, setRulesOpen] = useState(true)
    // Pagination
    const [pageSize, setPageSize] = useState(20)
    const [page, setPage] = useState(1)
    const [q, setQ] = useState("")
    // Selection for bulk action
    const [selected, setSelected] = useState<Set<string>>(new Set())

    useEffect(() => {
        try { const v = localStorage.getItem(RULES_KEY); if (v !== null) setRulesOpen(v === "1") } catch { /* ignore */ }
    }, [])
    const toggleRules = () => setRulesOpen(o => {
        try { localStorage.setItem(RULES_KEY, o ? "0" : "1") } catch { /* ignore */ }
        return !o
    })

    // Payroll is booked against the month the period starts in
    const payMonth = mode === "range" ? Number(fromDate.split("-")[1]) : month
    const payYear  = mode === "range" ? Number(fromDate.split("-")[0]) : year
    const period = useMemo(
        () => mode === "range" ? { from: fromDate, to: toDate } : monthPeriod(year, month),
        [mode, fromDate, toDate, year, month],
    )

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const attQuery = mode === "range"
                ? `from=${fromDate}&to=${toDate}`
                : `month=${year}-${String(month).padStart(2, "0")}`
            const prevMonth = payMonth === 1 ? 12 : payMonth - 1
            const prevYear  = payMonth === 1 ? payYear - 1 : payYear
            const [empRes, attRes, advRes, payRes, prevRes] = await Promise.all([
                fetch("/api/employees?limit=1000"),
                fetch(`/api/attendance?${attQuery}&limit=5000`),
                fetch(`/api/advances?month=${payMonth}&year=${payYear}&status=APPROVED`),
                fetch(`/api/payroll?month=${payMonth}&year=${payYear}&limit=1000`),
                fetch(`/api/payroll?month=${prevMonth}&year=${prevYear}&limit=1000`),
            ])
            const emps     = empRes.ok ? await empRes.json() : []
            const attData  = attRes.ok ? await attRes.json() : []
            const advances = advRes.ok ? await advRes.json() : []
            const pays     = payRes.ok ? await payRes.json() : []
            const prevPays = prevRes.ok ? await prevRes.json() : []

            const empList: any[] = emps.data ?? emps
            const attList: any[] = Array.isArray(attData) ? attData : (attData.data ?? [])
            const advList: any[] = Array.isArray(advances) ? advances : []
            const payList: any[] = Array.isArray(pays) ? pays : (pays.data ?? [])
            const prevList: any[] = Array.isArray(prevPays) ? prevPays : (prevPays.data ?? [])
            // Same rule as the save API: only a PAID month with a different paid amount carries over
            const carryOf = (empId: string) => {
                const p = prevList.find(x => x.employeeId === empId)
                if (!p || p.status !== "PAID" || p.paidAmount == null) return 0
                return Math.round((p.netSalary - p.paidAmount) * 100) / 100
            }

            const attByEmp = new Map<string, PayAttendance[]>()
            for (const a of attList) {
                if (!attByEmp.has(a.employeeId)) attByEmp.set(a.employeeId, [])
                attByEmp.get(a.employeeId)!.push(a)
            }

            const rows: EmpBase[] = empList.map((e: any) => ({
                id: e.id, employeeId: e.employeeId,
                name: `${e.firstName} ${e.lastName ?? ""}`.trim(),
                designation: e.designation ?? "—",
                basicSalary: parseFloat(e.basicSalary) || 0,
                shiftHours: parseFloat(e.shiftHours) || 8,
                shiftStart: e.shiftStart ?? null, shiftEnd: e.shiftEnd ?? null,
                dateOfJoining: e.dateOfJoining ?? null, dateOfLeaving: e.dateOfLeaving ?? null,
                att: attByEmp.get(e.id) ?? [],
                advances: advList
                    .filter(a => a.employeeId === e.id)
                    .map(a => ({ date: String(a.advanceDate ?? a.createdAt ?? "").slice(0, 10) || null, amount: a.amount ?? 0, reason: a.reason ?? null }))
                    .sort((x, y) => String(x.date).localeCompare(String(y.date))),
                autoAdvance: advList.filter(a => a.employeeId === e.id).reduce((s, a) => s + (a.amount ?? 0), 0),
                carryForward: carryOf(e.id),
                payrollStatus: payList.find(p => p.employeeId === e.id)?.status ?? null,
                paidAmount: payList.find(p => p.employeeId === e.id)?.paidAmount ?? null,
            }))
            setBase(rows)
            setAdvOverride(Object.fromEntries(rows.map(r => [r.id, r.autoAdvance])))
            setOtOverride({})
            setPaidOverride({})
            setPage(1)
            setSelected(new Set())
        } catch (e) {
            console.error(e)
            toast.error("Failed to load payroll data")
        } finally { setLoading(false) }
    }, [month, year, mode, fromDate, toDate, payMonth, payYear])

    useEffect(() => {
        if (status === "unauthenticated") router.push("/login")
        else if (status === "authenticated") loadData()
    }, [status, router, loadData])

    const displayRows: EmpPayRow[] = useMemo(() => base.map(r => ({
        ...r,
        calc: calcHourlyPayroll(r, r.att, period, {
            advances: r.advances,
            advance: advOverride[r.id] ?? r.autoAdvance,
            otHrs: otOverride[r.id] ?? 0,
            carryForward: r.carryForward,
        }),
    })), [base, period, advOverride, otOverride])

    const savePay = async (ids: string[], newStatus: "PAID" | "DRAFT") => {
        if (!ids.length) return
        setSaving(prev => new Set([...prev, ...ids]))
        try {
            const overrides = Object.fromEntries(ids.map(id => [id, { advance: advOverride[id], otHrs: otOverride[id] ?? 0, paidAmount: paidOverride[id] }]))
            const res = await fetch("/api/payroll/hourly", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    month: payMonth, year: payYear, employeeIds: ids, status: newStatus, overrides,
                    ...(mode === "range" ? { from: fromDate, to: toDate } : {}),
                }),
            })
            if (!res.ok) throw new Error(await res.text())
            setBase(prev => prev.map(r => {
                if (!ids.includes(r.id)) return r
                const net = displayRows.find(d => d.id === r.id)?.calc.net ?? 0
                return { ...r, payrollStatus: newStatus, paidAmount: newStatus === "PAID" ? Math.round(paidOverride[r.id] ?? net) : null }
            }))
            toast.success(ids.length === 1
                ? (newStatus === "PAID" ? "Marked as PAID ✓" : "Marked as Unpaid")
                : `${ids.length} employees marked as ${newStatus === "PAID" ? "PAID" : "Unpaid"}`)
        } catch (e: any) {
            toast.error(e.message || "Failed")
        } finally {
            setSaving(prev => { const s = new Set(prev); ids.forEach(id => s.delete(id)); return s })
        }
    }

    const bulkMark = async (newStatus: "PAID" | "DRAFT") => {
        await savePay([...selected], newStatus)
        setSelected(new Set())
    }

    // Human-readable period + a filesystem-safe tag, driven by the selected mode
    const periodLabel = mode === "range"
        ? `${fmtDMY(fromDate)} – ${fmtDMY(toDate)}`
        : `${MONTHS[month - 1]} ${year}`
    const fileTag = mode === "range"
        ? `${fromDate}_to_${toDate}`
        : `${MONTHS[month - 1]}_${year}`
    const calendarDayCount = Math.round((Date.parse(period.to) - Date.parse(period.from)) / 86400000) + 1

    // Excel export: summary sheet + day-wise sheet (so every rupee can be traced)
    const exportExcel = () => {
        if (displayRows.length === 0) { toast.error("No payroll rows to download"); return }
        const summary: Record<string, string | number>[] = displayRows.map((r, i) => ({
            "#": i + 1,
            "Employee ID": r.employeeId,
            "Name": r.name,
            "Designation": r.designation,
            "Shift": r.calc.shiftLabel || `${r.calc.shiftHours} h`,
            "Shift Hours": r.calc.shiftHours,
            "Monthly Salary (₹)": r.calc.monthlySalary,
            "Daily Rate ÷30 (₹)": r.calc.dailyRate,
            "Hourly Rate (₹)": r.calc.hourlyRate,
            "Days Present (Mon–Sat)": r.calc.daysWorked,
            "Days Absent (Mon–Sat)": r.calc.absentDays,
            "Absent Dates": r.calc.absentDates.map(d => fmtDMY(d).slice(0, 6)).join(", "),
            "Absent Cut (₹)": r.calc.absentCut,
            "Late/Early Cut (h)": r.calc.lateEarlyHrs,
            "Late/Early Cut (₹)": r.calc.lateEarlyCut,
            "Free Sundays": r.calc.freeSundays,
            "Unpaid Sundays": r.calc.unpaidSundays,
            "Unpaid Sunday Cut (₹)": r.calc.unpaidSundayCut,
            "Other Days Cut (₹)": r.calc.otherCut,
            "Sundays Worked": r.calc.sundaysWorked,
            "Sunday Pay ×2 (₹)": r.calc.sundayPay,
            "OT Hours": r.calc.otHrs,
            "OT Pay (₹)": r.calc.otPay,
            "Gross (₹)": r.calc.gross,
            "Advance (₹)": r.calc.advance,
            "Advance Details": r.calc.advances.map(a => `${a.date ? fmtDMY(a.date).slice(0, 6) : "-"} ₹${a.amount}${a.reason ? ` (${a.reason})` : ""}`).join("; "),
            "Previous Balance (₹)": r.calc.carryForward,
            "Net Payable (₹)": r.calc.net,
            "Paid (₹)": r.payrollStatus === "PAID" ? (r.paidAmount ?? r.calc.net) : "",
            "Balance to Next Month (₹)": r.payrollStatus === "PAID" ? r.calc.net - (r.paidAmount ?? r.calc.net) : "",
            "Status": r.payrollStatus === "PAID" ? "PAID" : "PENDING",
        }))
        const sum = (f: (r: typeof displayRows[number]) => number) =>
            Math.round(displayRows.reduce((s, r) => s + (f(r) || 0), 0) * 100) / 100
        summary.push({
            "#": "", "Employee ID": "", "Name": "TOTAL",
            "Days Present (Mon–Sat)": sum(r => r.calc.daysWorked),
            "Days Absent (Mon–Sat)": sum(r => r.calc.absentDays),
            "Absent Cut (₹)": sum(r => r.calc.absentCut),
            "Late/Early Cut (₹)": sum(r => r.calc.lateEarlyCut),
            "Unpaid Sunday Cut (₹)": sum(r => r.calc.unpaidSundayCut),
            "Sunday Pay ×2 (₹)": sum(r => r.calc.sundayPay),
            "OT Hours": sum(r => r.calc.otHrs),
            "OT Pay (₹)": sum(r => r.calc.otPay),
            "Gross (₹)": sum(r => r.calc.gross),
            "Advance (₹)": sum(r => r.calc.advance),
            "Previous Balance (₹)": sum(r => r.calc.carryForward),
            "Net Payable (₹)": sum(r => r.calc.net),
        })
        const daywise = displayRows.flatMap(r => r.calc.lines.map(l => ({
            "Employee ID": r.employeeId,
            "Name": r.name,
            "Date": fmtDMY(l.date),
            "Day": l.weekday,
            "In": l.inTime ?? "-",
            "Out": l.outTime ?? "-",
            "Hours Paid": l.kind === "WORK" || l.kind === "SUNDAY_WORK" ? l.hours : "-",
            "Rate (₹/h)": l.kind === "WORK" || l.kind === "SUNDAY_WORK" ? l.rate : "-",
            "Amount (₹)": l.amount,
            "Cut (₹)": l.cut,
            "Remarks": l.remark,
        })))
        const wb = XLSX.utils.book_new()
        for (const [name, data] of [["Payroll", summary], ["Day-wise", daywise]] as const) {
            const ws = XLSX.utils.json_to_sheet(data as any[])
            ws["!cols"] = Object.keys((data as any[])[0] ?? {}).map(k => ({ wch: Math.max(k.length + 2, 12) }))
            XLSX.utils.book_append_sheet(wb, ws, name)
        }
        XLSX.writeFile(wb, `Payroll_${fileTag}.xlsx`)
        toast.success("Excel downloaded!")
    }

    if (status === "loading" || loading) {
        return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="animate-spin text-[var(--accent)]" /></div>
    }
    if (session?.user?.role !== "ADMIN" && session?.user?.role !== "MANAGER") {
        return <div className="p-8 text-center text-red-500">Access Denied</div>
    }

    const totalHrs    = displayRows.reduce((s, r) => s + r.calc.workHours + r.calc.sundayHours, 0)
    const totalGross  = displayRows.reduce((s, r) => s + r.calc.gross, 0)
    const totalAdv    = displayRows.reduce((s, r) => s + r.calc.advance, 0)
    const totalNet    = displayRows.reduce((s, r) => s + r.calc.net, 0)
    const totalSunday = displayRows.reduce((s, r) => s + r.calc.sundayPay, 0)
    const totalAbsCut = displayRows.reduce((s, r) => s + r.calc.absentCut + r.calc.unpaidSundayCut + r.calc.otherCut, 0)
    const totalLate   = displayRows.reduce((s, r) => s + r.calc.lateEarlyCut, 0)
    const totalCarry  = displayRows.reduce((s, r) => s + r.calc.carryForward, 0)
    const paidCount   = displayRows.filter(r => r.payrollStatus === "PAID").length

    // Search + pagination
    const searchedRows = q
        ? displayRows.filter(r => `${r.name} ${r.employeeId}`.toLowerCase().includes(q.toLowerCase()))
        : displayRows
    const totalPages = Math.max(1, Math.ceil(searchedRows.length / pageSize))
    const pageRows   = searchedRows.slice((page - 1) * pageSize, page * pageSize)

    const allPageSelected = pageRows.length > 0 && pageRows.every(r => selected.has(r.id))
    const toggleAll = () => {
        setSelected(prev => {
            const s = new Set(prev)
            pageRows.forEach(r => allPageSelected ? s.delete(r.id) : s.add(r.id))
            return s
        })
    }

    const slip = slipId ? displayRows.find(r => r.id === slipId) ?? null : null

    // Paid amount: blank = full net. Less than net → balance carries to next month.
    const PaidAmount = ({ row, compact }: { row: EmpPayRow; compact?: boolean }) => {
        const c = row.calc
        if (c.hourlyRate <= 0) return null
        if (row.payrollStatus === "PAID") {
            const paid = row.paidAmount ?? c.net
            const bal = c.net - paid
            return (
                <div className={cn("text-[11px] text-right", !compact && "mt-1.5 text-left")}>
                    <span className="font-semibold text-green-700">Paid {fmt(paid)}</span>
                    {bal !== 0 && <Sub className={bal > 0 ? "text-orange-600" : "text-blue-600"}>{bal > 0 ? `${fmt(bal)} to next month` : `${fmt(-bal)} extra, cut next month`}</Sub>}
                </div>
            )
        }
        const v = paidOverride[row.id]
        return (
            <label className={cn("flex items-center gap-1.5", !compact && "mt-2")}>
                {!compact && <span className="text-[11px] text-[var(--text3)]">Paying ₹</span>}
                <input type="number" min="0" inputMode="numeric"
                    value={v ?? ""} placeholder={String(c.net)}
                    onChange={e => setPaidOverride(prev => ({ ...prev, [row.id]: e.target.value === "" ? undefined : Math.max(0, parseFloat(e.target.value) || 0) }))}
                    className={cn("border border-[var(--border)] rounded px-1.5 py-1 text-right text-[11px] outline-none focus:border-green-500", compact ? "w-[76px]" : "w-28")} />
                {v != null && v < c.net && <span className="text-[10px] text-orange-600 whitespace-nowrap">{fmt(c.net - v)} next month</span>}
            </label>
        )
    }

    const PaidButton = ({ row, compact }: { row: EmpPayRow; compact?: boolean }) => {
        const busy = saving.has(row.id)
        if (busy) return <Loader2 size={14} className="animate-spin text-[var(--text3)]" />
        return row.payrollStatus === "PAID" ? (
            <button onClick={() => savePay([row.id], "DRAFT")} title="Click to mark unpaid"
                className={cn("font-bold bg-green-100 text-green-700 border border-green-300 rounded-full hover:bg-green-200 transition-colors whitespace-nowrap",
                    compact ? "px-2 py-0.5 text-[10px]" : "px-3 py-2 text-[11px]")}>
                ✓ PAID
            </button>
        ) : (
            <button onClick={() => savePay([row.id], "PAID")} disabled={row.calc.hourlyRate <= 0}
                className={cn("font-semibold rounded-full transition-colors whitespace-nowrap disabled:opacity-40",
                    compact
                        ? "px-2 py-0.5 text-[10px] bg-white text-[var(--text3)] border border-[var(--border)] hover:bg-green-50 hover:text-green-700 hover:border-green-300"
                        : "px-3 py-2 text-[11px] bg-[var(--accent-light)] text-[var(--accent-text)] hover:bg-[#dbe5ff]")}>
                Mark Paid
            </button>
        )
    }

    return (
        <div className="w-full space-y-4 md:space-y-5 max-w-screen-xl mx-auto pb-12 p-4 lg:p-0">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div>
                    <h1 className="text-[26px] font-bold text-[var(--text)]">Payroll</h1>
                    <p className="text-[13px] text-[var(--text3)]">30-day base · Full salary minus absent & late cuts · Sunday rules</p>
                </div>
                <div className="flex gap-2 self-start">
                    <button onClick={toggleRules}
                        className="flex items-center gap-2 border border-[var(--border)] bg-white rounded-[12px] text-[13px] font-semibold px-4 py-2.5 hover:bg-[var(--surface2)] transition-colors shadow-[0_2px_10px_rgba(80,80,170,0.05)]">
                        <Info size={14} className="text-[var(--accent)]" /> Salary Rules
                        <ChevronDown size={14} className={cn("transition-transform", rulesOpen && "rotate-180")} />
                    </button>
                    <button onClick={exportExcel}
                        className="flex items-center gap-2 border border-[var(--border)] bg-white rounded-[12px] text-[13px] font-semibold px-4 py-2.5 hover:bg-[var(--surface2)] transition-colors shadow-[0_2px_10px_rgba(80,80,170,0.05)]">
                        <Download size={14} className="text-[var(--accent)]" /> Download Excel
                    </button>
                </div>
            </div>

            {/* Rules */}
            {rulesOpen && <RulesPanel />}

            {/* Period selector */}
            <div className="bg-white border border-[var(--border)] rounded-[16px] p-3.5 shadow-[0_2px_10px_rgba(80,80,170,0.05)] space-y-3">
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
                    <span className="text-[var(--text3)]"> · {calendarDayCount} calendar days, salary base always {SALARY_BASE_DAYS} days</span>
                </p>
            </div>

            {/* Bulk actions */}
            {selected.size > 0 && (
                <div className="flex items-center gap-2 flex-wrap bg-white border border-[var(--border)] rounded-[14px] px-3.5 py-2.5 shadow-[0_2px_10px_rgba(80,80,170,0.05)]">
                    <span className="text-[12.5px] font-medium text-[var(--text2)]">{selected.size} selected</span>
                    <button onClick={() => bulkMark("PAID")}
                        className="px-3 py-1.5 bg-green-600 text-white rounded-full text-[12px] font-semibold hover:opacity-90">
                        ✓ Mark All Paid
                    </button>
                    <button onClick={() => bulkMark("DRAFT")}
                        className="px-3 py-1.5 bg-orange-500 text-white rounded-full text-[12px] font-semibold hover:opacity-90">
                        Mark Unpaid
                    </button>
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    { label: "Paid Hours", value: totalHrs.toFixed(1) + " hrs", sub: `${paidCount}/${displayRows.length} paid`, color: "#2563eb", bg: "#eff5ff", icon: <Clock size={18} /> },
                    { label: "Gross Salary", value: fmt(totalGross), sub: `Absent −${fmt(totalAbsCut)} · Late −${fmt(totalLate)}`, color: "#0b5cff", bg: "#f0f0fd", icon: <IndianRupee size={18} /> },
                    { label: "Advance", value: fmt(totalAdv), sub: "deducted from net", color: "#ea580c", bg: "#fff5eb", icon: <IndianRupee size={18} /> },
                    { label: "Net Payable", value: fmt(totalNet), sub: totalCarry ? `incl. prev. balance ${fmt(totalCarry)}` : "gross − advance", color: "#16a34a", bg: "#eefaf2", icon: <IndianRupee size={18} /> },
                ].map(card => (
                    <div key={card.label} className="rounded-[16px] p-3 md:p-4 flex items-center gap-2.5 min-w-0" style={{ background: card.bg }}>
                        <div className="w-9 h-9 md:w-11 md:h-11 rounded-[11px] md:rounded-[13px] bg-white flex items-center justify-center shrink-0 shadow-sm" style={{ color: card.color }}>
                            {card.icon}
                        </div>
                        <div className="min-w-0">
                            <p className="text-[11.5px] md:text-[12px] text-[var(--text2)] font-medium">{card.label}</p>
                            <p className="text-[15px] md:text-[18px] font-bold leading-tight whitespace-nowrap" style={{ color: card.color }}>{card.value}</p>
                            <p className="text-[10.5px] text-[var(--text3)] truncate">{card.sub}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Search */}
            <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text3)]" />
                <input value={q} onChange={e => { setQ(e.target.value); setPage(1) }} placeholder="Search employee by name or ID..."
                    className="w-full h-11 pl-10 pr-3 rounded-[14px] border border-[var(--border)] text-[13.5px] outline-none focus:border-[var(--accent)] bg-white shadow-[0_2px_10px_rgba(80,80,170,0.05)]" />
            </div>

            {/* Mobile card list */}
            <div className="md:hidden space-y-2.5">
                {pageRows.length === 0 ? (
                    <div className="py-12 text-center text-[var(--text3)] bg-white border border-[var(--border)] rounded-[16px] text-[13px]">No employees found</div>
                ) : pageRows.map(row => {
                    const c = row.calc
                    const initials = row.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
                    return (
                        <div key={row.id} className="bg-white border border-[var(--border)] rounded-[16px] px-3.5 py-3 shadow-[0_2px_10px_rgba(80,80,170,0.05)]">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-[var(--accent-light)] flex items-center justify-center text-[12.5px] font-bold text-[var(--accent-text)] shrink-0"
                                    onClick={() => c.hourlyRate > 0 && setSlipId(row.id)}>
                                    {initials}
                                </div>
                                <div className="min-w-0 flex-1" onClick={() => c.hourlyRate > 0 && setSlipId(row.id)}>
                                    <p className="text-[14px] font-semibold text-[var(--text)] truncate leading-tight">{row.name}</p>
                                    <p className="text-[11.5px] text-[var(--accent-text)] font-medium mt-0.5 truncate">
                                        {row.employeeId}{c.hourlyRate > 0 && <span className="text-[var(--text3)]"> · ₹{c.hourlyRate}/hr</span>}
                                    </p>
                                </div>
                                {c.hourlyRate > 0 && (
                                    <button onClick={() => setSlipId(row.id)} title="Salary slip"
                                        className="shrink-0 flex items-center justify-center w-9 h-9 rounded-full border border-[var(--border)] text-[var(--accent)] hover:bg-[var(--accent-light)] transition-colors">
                                        <Printer size={15} />
                                    </button>
                                )}
                                <div className="shrink-0"><PaidButton row={row} /></div>
                            </div>
                            {c.hourlyRate <= 0 ? (
                                <p className="mt-2.5 pt-2.5 border-t border-[var(--border)] text-[11.5px] text-orange-600">Monthly salary not set — add it in Employees.</p>
                            ) : (
                                <>
                                <div className="grid grid-cols-4 gap-2 mt-2.5 pt-2.5 border-t border-[var(--border)]">
                                    <Stat label="Present" value={String(c.daysWorked)} className="text-blue-600" />
                                    <Stat label="Absent" value={String(c.absentDays)} className="text-red-600" />
                                    <Stat label="Advance" value={fmt(c.advance)} className="text-orange-600" />
                                    <Stat label="Net" value={fmt(c.net)} className="text-green-600" />
                                </div>
                                {c.carryForward !== 0 && (
                                    <p className="mt-1.5 text-[11px] text-[var(--text2)]">Prev. month balance {c.carryForward > 0 ? "+" : "−"}{fmt(Math.abs(c.carryForward))} included</p>
                                )}
                                <PaidAmount row={row} />
                                </>
                            )}
                        </div>
                    )
                })}
                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 pt-1">
                        <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                            className="p-2 rounded-full border border-[var(--border)] bg-white disabled:opacity-40">
                            <ChevronLeft size={14} />
                        </button>
                        <span className="text-[12.5px] text-[var(--text3)]">Page {page} of {totalPages}</span>
                        <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
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
                            <tr className="bg-[var(--surface)] border-b border-[var(--border)] align-bottom">
                                <th className="px-2 py-3 w-8">
                                    <button onClick={toggleAll} className="text-[var(--text3)] hover:text-[var(--accent)]">
                                        {allPageSelected ? <CheckSquare size={15} /> : <Square size={15} />}
                                    </button>
                                </th>
                                <th className="px-2 py-3 text-left font-semibold text-[var(--text3)] w-6">#</th>
                                <th className="px-2 py-3 text-left font-semibold text-[var(--text3)]">Employee · Shift</th>
                                <th className="px-2 py-3 text-right font-semibold text-[var(--text3)]">Rate/Hr<Sub>salary ÷ 30 ÷ shift</Sub></th>
                                <th className="px-2 py-3 text-right font-semibold text-[var(--text3)]">Monthly<Sub>30-day base</Sub></th>
                                <th className="px-2 py-3 text-center font-semibold text-blue-600">Present<Sub>Mon–Sat</Sub></th>
                                <th className="px-2 py-3 text-right font-semibold text-red-600">Absent Cut<Sub>days + unpaid Sun</Sub></th>
                                <th className="px-2 py-3 text-right font-semibold text-red-600">Late/Early Cut</th>
                                <th className="px-2 py-3 text-right font-semibold text-purple-600">Sunday Work<Sub>shift hrs × rate × 2</Sub></th>
                                <th className="px-2 py-3 text-center font-semibold text-[var(--text3)]">OT Hrs<Sub>×1.5, manual</Sub></th>
                                <th className="px-2 py-3 text-right font-semibold text-[var(--accent)]">Gross</th>
                                <th className="px-2 py-3 text-center font-semibold text-orange-600">Advance</th>
                                <th className="px-2 py-3 text-right font-semibold text-[var(--text3)]">Prev. Bal<Sub>last month</Sub></th>
                                <th className="px-2 py-3 text-right font-semibold text-green-700">Net</th>
                                <th className="px-2 py-3 text-right font-semibold text-green-700">Paid ₹<Sub>blank = full</Sub></th>
                                <th className="px-2 py-3 text-center font-semibold text-[var(--text3)]">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                            {pageRows.map((row, idx) => {
                                const c = row.calc
                                const noSalary = c.hourlyRate <= 0
                                return (
                                    <tr key={row.id} className={cn("hover:bg-[var(--surface)]", selected.has(row.id) && "bg-blue-50/40")}>
                                        <td className="px-2 py-2 text-center">
                                            <button onClick={() => setSelected(prev => {
                                                const s = new Set(prev)
                                                s.has(row.id) ? s.delete(row.id) : s.add(row.id)
                                                return s
                                            })} className="text-[var(--text3)] hover:text-[var(--accent)]">
                                                {selected.has(row.id) ? <CheckSquare size={14} className="text-[var(--accent)]" /> : <Square size={14} />}
                                            </button>
                                        </td>
                                        <td className="px-2 py-2 text-[var(--text3)]">{(page - 1) * pageSize + idx + 1}</td>
                                        <td className="px-2 py-2">
                                            <button onClick={() => !noSalary && setSlipId(row.id)} className="text-left">
                                                <div className="font-medium text-[var(--text)] hover:text-[var(--accent)]">{row.name}</div>
                                                <div className="text-[10px] text-[var(--text3)]">{row.employeeId} · {c.shiftLabel || `${c.shiftHours} h shift`}</div>
                                            </button>
                                        </td>
                                        {noSalary ? (
                                            <td colSpan={12} className="px-2 py-2 text-[11px] text-orange-600">Monthly salary not set — add it in Employees to calculate pay.</td>
                                        ) : (<>
                                            <td className="px-2 py-2 text-right font-medium whitespace-nowrap">
                                                ₹{c.hourlyRate}
                                                <Sub>{c.shiftHours} h · ₹{Math.round(c.dailyRate)}/day</Sub>
                                            </td>
                                            <td className="px-2 py-2 text-right whitespace-nowrap">{fmt(c.monthlySalary)}</td>
                                            <td className="px-2 py-2 text-center font-semibold text-blue-600">
                                                {c.daysWorked}
                                                {c.missingPunchDays > 0 && <Sub className="text-orange-600">{c.missingPunchDays} out-punch missing</Sub>}
                                            </td>
                                            <td className="px-2 py-2 text-right whitespace-nowrap">
                                                {c.absentCut + c.unpaidSundayCut + c.otherCut > 0 ? (<>
                                                    <span className="font-semibold text-red-600">−{fmt(c.absentCut + c.unpaidSundayCut + c.otherCut)}</span>
                                                    <Sub>{c.absentDays} absent{c.unpaidSundays ? ` · ${c.unpaidSundays} Sun` : ""}{c.notEmployedDays + c.upcomingDays ? ` · ${c.notEmployedDays + c.upcomingDays} other` : ""}</Sub>
                                                </>) : <span className="text-[var(--text3)]">—</span>}
                                            </td>
                                            <td className="px-2 py-2 text-right whitespace-nowrap">
                                                {c.lateEarlyCut > 0 ? (<>
                                                    <span className="font-semibold text-red-600">−{fmt(c.lateEarlyCut)}</span>
                                                    <Sub>{c.lateEarlyHrs} h</Sub>
                                                </>) : <span className="text-[var(--text3)]">—</span>}
                                            </td>
                                            <td className="px-2 py-2 text-right whitespace-nowrap">
                                                {c.sundaysWorked > 0 ? (<>
                                                    <span className="font-semibold text-purple-600">{fmt(c.sundayPay)}</span>
                                                    <Sub>{c.sundaysWorked} day · {c.sundayHours} h</Sub>
                                                </>) : <span className="text-[var(--text3)]">—</span>}
                                            </td>
                                            <td className="px-2 py-2 text-center">
                                                <input type="number" min="0" step="0.5"
                                                    value={otOverride[row.id] ?? 0}
                                                    onChange={e => setOtOverride(prev => ({ ...prev, [row.id]: parseFloat(e.target.value) || 0 }))}
                                                    className="w-14 border border-[var(--border)] rounded px-1.5 py-1 text-center text-[11px] outline-none focus:border-purple-400" />
                                                {c.otPay > 0 && <Sub>{fmt(c.otPay)}</Sub>}
                                            </td>
                                            <td className="px-2 py-2 text-right font-semibold text-[var(--accent)]">{fmt(c.gross)}</td>
                                            <td className="px-2 py-2 text-center">
                                                <input type="number" min="0"
                                                    value={advOverride[row.id] ?? row.autoAdvance}
                                                    onChange={e => setAdvOverride(prev => ({ ...prev, [row.id]: parseFloat(e.target.value) || 0 }))}
                                                    className="w-[72px] border border-[var(--border)] rounded px-1.5 py-1 text-right text-[11px] outline-none focus:border-orange-400" />
                                                {c.advances.length > 0 && <Sub>{c.advances.length} advance{c.advances.length > 1 ? "s" : ""}</Sub>}
                                            </td>
                                            <td className="px-2 py-2 text-right whitespace-nowrap">
                                                {c.carryForward !== 0
                                                    ? <span className={cn("font-semibold", c.carryForward > 0 ? "text-orange-600" : "text-blue-600")}>{c.carryForward > 0 ? "+" : "−"}{fmt(Math.abs(c.carryForward))}</span>
                                                    : <span className="text-[var(--text3)]">—</span>}
                                            </td>
                                            <td className="px-2 py-2 text-right font-bold text-green-700">{fmt(c.net)}</td>
                                            <td className="px-2 py-2 text-right"><PaidAmount row={row} compact /></td>
                                        </>)}
                                        <td className="px-2 py-2">
                                            <div className="flex items-center justify-center gap-1.5">
                                                <PaidButton row={row} compact />
                                                {!noSalary && (
                                                    <button onClick={() => setSlipId(row.id)}
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
                        <tfoot>
                            <tr className="bg-[var(--surface)] border-t-2 border-[var(--border)] font-bold text-[12px]">
                                <td colSpan={5} className="px-2 py-3 text-[var(--text3)]">TOTAL — {displayRows.length} employees</td>
                                <td className="px-2 py-3 text-center text-blue-600">{displayRows.reduce((s, r) => s + r.calc.daysWorked, 0)}</td>
                                <td className="px-2 py-3 text-right text-red-600">−{fmt(totalAbsCut)}</td>
                                <td className="px-2 py-3 text-right text-red-600">−{fmt(totalLate)}</td>
                                <td className="px-2 py-3 text-right text-purple-600">{fmt(totalSunday)}</td>
                                <td className="px-2 py-3 text-center text-[var(--text3)]">{fmt(displayRows.reduce((s, r) => s + r.calc.otPay, 0))}</td>
                                <td className="px-2 py-3 text-right text-[var(--accent)]">{fmt(totalGross)}</td>
                                <td className="px-2 py-3 text-right text-orange-600">{fmt(totalAdv)}</td>
                                <td className="px-2 py-3 text-right text-[var(--text2)]">{fmt(totalCarry)}</td>
                                <td className="px-2 py-3 text-right text-green-700">{fmt(totalNet)}</td>
                                <td />
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
                                className={cn("px-2.5 py-1 rounded-lg border text-[12px] font-medium transition-colors", pageSize === s
                                    ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                                    : "bg-white border-[var(--border)] hover:border-[var(--accent)] text-[var(--text2)]")}>
                                {s}
                            </button>
                        ))}
                        <span className="ml-1">per page</span>
                    </div>
                    <div className="flex items-center gap-2 text-[12px]">
                        <span className="text-[var(--text3)]">
                            {Math.min((page - 1) * pageSize + 1, searchedRows.length)}–{Math.min(page * pageSize, searchedRows.length)} of {searchedRows.length}
                        </span>
                        <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                            className="p-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--surface)] disabled:opacity-40 disabled:cursor-not-allowed">
                            <ChevronLeft size={14} />
                        </button>
                        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                            const p = totalPages <= 5 ? i + 1 : page <= 3 ? i + 1 : page >= totalPages - 2 ? totalPages - 4 + i : page - 2 + i
                            return (
                                <button key={p} onClick={() => setPage(p)}
                                    className={cn("w-7 h-7 rounded-lg border text-[12px] font-medium transition-colors", page === p
                                        ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                                        : "bg-white border-[var(--border)] hover:border-[var(--accent)] text-[var(--text2)]")}>
                                    {p}
                                </button>
                            )
                        })}
                        <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                            className="p-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--surface)] disabled:opacity-40 disabled:cursor-not-allowed">
                            <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
            </div>

            {slip && <SalarySlip row={slip} periodLabel={periodLabel} onClose={() => setSlipId(null)} />}
        </div>
    )
}

function Sub({ children, className }: { children: React.ReactNode; className?: string }) {
    return <span className={cn("block text-[9.5px] font-normal text-[var(--text3)] leading-tight mt-0.5", className)}>{children}</span>
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
    return (
        <div className="min-w-0">
            <p className="text-[10px] text-[var(--text3)] font-medium">{label}</p>
            <p className={cn("text-[13px] font-bold mt-0.5 truncate", className)}>{value}</p>
        </div>
    )
}

// ─── Rules panel — the payroll policy, in short ─────────────────────────────
function RulesPanel() {
    const rules = [
        {
            n: 1, color: "#2563eb", bg: "#eff5ff", title: "Full salary, 30 days",
            body: <>Every month starts from the <b>full monthly salary</b> (30-day base) — 28, 30 or 31 days. Each <b>absent</b> day is cut 1 day (31st included); working the 31st adds nothing.<br />
                <span className="font-mono text-[11px]">Day = Monthly ÷ 30 · Hourly = Day ÷ shift hrs</span></>,
        },
        {
            n: 2, color: "#dc2626", bg: "#fff1f1", title: "Late / early cut",
            body: <><b>7 min briefing grace</b>: an 8:30 shift may punch in till <b>8:37</b>. From 8:38 the full lateness from 8:30 is cut; leaving early is cut by the minute. Lunch is <b>37 min</b>, company-paid.<br />
                <span className="font-mono text-[11px]">Cut = (late + early hrs) × hourly</span></>,
        },
        {
            n: 3, color: "#0d9488", bg: "#ebfaf6", title: "Sundays (max 4 free)",
            body: <>Sundays are paid by days worked (table below). A Sunday that is not earned is cut 1 day. Full attendance → every Sunday paid.</>,
        },
        {
            n: 4, color: "#7c3aed", bg: "#f5f0ff", title: "Sunday duty 9 – 5 = 2×",
            body: <>Sunday duty is <b>9:00 AM – 5:00 PM</b> = <b>full shift hours</b>, paid <b>double</b>. After 9:07 / before 5:00 is cut.<br />
                <span className="font-mono text-[11px]">Sunday pay = (shift hrs − late − early) × hourly × 2</span></>,
        },
        {
            n: 5, color: "#ea580c", bg: "#fff5eb", title: "Advance & balance",
            body: <>Each advance (date, reason, amount) is cut from net. If <b>less than net is paid</b>, the balance is added to next month&apos;s salary.</>,
        },
    ]
    return (
        <div className="bg-white border border-[var(--border)] rounded-[16px] p-3.5 md:p-4 shadow-[0_2px_10px_rgba(80,80,170,0.05)] space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2.5">
                {rules.map(r => (
                    <div key={r.n} className="rounded-[12px] p-3" style={{ background: r.bg }}>
                        <div className="flex items-center gap-2 mb-1.5">
                            <span className="w-6 h-6 rounded-full text-white text-[12px] font-bold flex items-center justify-center shrink-0" style={{ background: r.color }}>{r.n}</span>
                            <span className="text-[13px] font-bold" style={{ color: r.color }}>{r.title}</span>
                        </div>
                        <p className="text-[12px] text-[var(--text2)] leading-relaxed">{r.body}</p>
                    </div>
                ))}
            </div>
            <div className="flex flex-col lg:flex-row gap-2.5">
                <div className="flex-1 border border-[var(--border)] rounded-[12px] overflow-hidden">
                    <div className="bg-[var(--surface)] px-3 py-1.5 text-[11px] font-bold text-[var(--text2)] flex items-center gap-1.5">
                        <Sun size={12} className="text-teal-600" /> Free Sunday table
                    </div>
                    <div className="grid grid-cols-5 text-center text-[11.5px]">
                        {FREE_SUNDAY_SLABS.map(s => (
                            <div key={s.sundays} className="px-1 py-2 border-r last:border-r-0 border-[var(--border)]">
                                <div className="text-[var(--text3)]">{s.sundays === 4 ? "24+ days" : `${s.from}–${s.to} days`}</div>
                                <div className={cn("font-bold mt-0.5", s.sundays ? "text-teal-600" : "text-red-500")}>
                                    {s.sundays} Sunday{s.sundays !== 1 ? "s" : ""}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="lg:w-[42%] border border-[var(--border)] rounded-[12px] px-3 py-2 text-[11.5px] text-[var(--text2)] space-y-0.5">
                    <div className="font-bold text-[var(--text)] text-[11px] mb-1">Example — ₹30,000 salary, 12-hour shift</div>
                    <div>Daily = 30,000 ÷ 30 = <b>₹1,000</b> · Hourly = 1,000 ÷ 12 = <b>₹83.33</b></div>
                    <div>2 days absent → 30,000 − 2,000 = <b>₹28,000</b></div>
                    <div>In at 8:45 (shift 8:30) → 15 min = 0.25 h × 83.33 = <b>−₹20.83</b></div>
                    <div>Sunday 9:00 – 5:00 → 12 h × 83.33 × 2 = <b>₹2,000</b></div>
                </div>
            </div>
        </div>
    )
}

// ─── Salary slip with day-wise breakdown (also used for PDF print) ───────────
function SalarySlip({ row, periodLabel, onClose }: { row: EmpPayRow; periodLabel: string; onClose: () => void }) {
    const c = row.calc
    const lineTone = (kind: string, cut: boolean) =>
        kind === "ABSENT" || kind === "UNPAID_SUNDAY" || kind === "NOT_EMPLOYED" ? "bg-red-50 text-red-700"
            : kind === "SUNDAY_WORK" ? "bg-purple-50" : kind === "FREE_SUNDAY" || kind === "HOLIDAY" ? "bg-teal-50" : cut ? "bg-orange-50" : ""
    const paid = row.payrollStatus === "PAID" ? (row.paidAmount ?? c.net) : null
    const daysCut = c.absentDays + c.unpaidSundays + c.notEmployedDays + c.upcomingDays
    return createPortal(
        <div className="salary-slip-overlay fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3 md:p-4" onClick={onClose}>
            {/* Print isolation: the overlay is portalled to <body>, so every other
                body child can be dropped from the print. Printing a position:fixed
                box makes Chrome repeat it on every page, overlapping the table —
                so in print the overlay and slip become plain static blocks. */}
            <style>{`@media print {
                @page { size: A4; margin: 10mm; }
                body > *:not(.salary-slip-overlay) { display: none !important; }
                html, body { background: #fff !important; }
                .salary-slip-overlay { position: static !important; display: block !important; inset: auto !important; padding: 0 !important; background: none !important; }
                #salary-slip { position: static !important; width: 100% !important; max-width: none !important; max-height: none !important; overflow: visible !important; box-shadow: none !important; border-radius: 0 !important; }
                #salary-slip, #salary-slip * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                #salary-slip .overflow-x-auto, #salary-slip .overflow-hidden { overflow: visible !important; }
                #salary-slip tr, #salary-slip .slip-block { break-inside: avoid; }
                #salary-slip thead { display: table-header-group; }
                .no-print { display: none !important; }
                /* Compact print so a full month (31 rows) fits one A4 page */
                #salary-slip .slip-body { padding: 0 !important; }
                #salary-slip .slip-body > * + * { margin-top: 6px !important; }
                #salary-slip .slip-body .space-y-1 > * + *, #salary-slip .slip-body .space-y-1\\.5 > * + * { margin-top: 1px !important; }
                #salary-slip .slip-body .p-3, #salary-slip .slip-body .py-2 { padding-top: 4px !important; padding-bottom: 4px !important; }
                #salary-slip .slip-body, #salary-slip .slip-body .text-\\[11\\.5px\\] { font-size: 10px !important; line-height: 1.3 !important; }
                #salary-slip th, #salary-slip td { padding-top: 1.5px !important; padding-bottom: 1.5px !important; font-size: 9.5px !important; line-height: 1.25 !important; }
                #salary-slip .slip-net { padding-top: 6px !important; padding-bottom: 6px !important; }
                #salary-slip .slip-net span:last-child { font-size: 16px !important; }
            }`}</style>
            <div id="salary-slip" onClick={e => e.stopPropagation()}
                className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
                <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-5 py-3 border-b no-print">
                    <h2 className="text-[14px] font-bold">Salary Slip</h2>
                    <div className="flex gap-2">
                        <button onClick={() => window.print()}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] text-white rounded-lg text-[12px] font-medium">
                            <Printer size={13} /> Print / Save PDF
                        </button>
                        <button onClick={onClose} className="p-1.5 rounded hover:bg-[var(--surface2)]">
                            <X size={15} />
                        </button>
                    </div>
                </div>
                <div className="slip-body px-4 md:px-5 py-4 text-[12px] space-y-3">
                    <div className="text-center pb-2 border-b border-[var(--border)]">
                        <div className="text-[17px] font-bold text-[var(--accent)]">Falcon Plus</div>
                        <div className="text-[11px] text-[var(--text3)]">Salary Slip — {periodLabel} · 30-day base, full salary minus cuts</div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="bg-[var(--surface)] rounded-lg p-3 space-y-1 text-[11.5px]">
                            <Row k="Employee" v={<b>{row.name}</b>} />
                            <Row k="ID" v={<span className="font-mono">{row.employeeId}</span>} />
                            <Row k="Designation" v={row.designation} />
                            <Row k="Shift" v={`${c.shiftLabel || "—"} (${c.shiftHours} h)`} />
                        </div>
                        <div className="bg-[var(--surface)] rounded-lg p-3 space-y-1 text-[11.5px]">
                            <Row k="Monthly Salary" v={fmt(c.monthlySalary)} />
                            <Row k="Daily Rate" v={`${fmt(c.monthlySalary)} ÷ 30 = ${fmt2(c.dailyRate)}`} />
                            <Row k="Hourly Rate" v={<b>{`${fmt(c.monthlySalary)} ÷ (30 × ${c.shiftHours}) = ${fmt2(c.hourlyRate)}`}</b>} />
                            <Row k="Sunday Rate" v={`${fmt2(c.hourlyRate)} × 2 = ${fmt2(c.hourlyRate * 2)}`} />
                        </div>
                    </div>

                    {/* Day-wise */}
                    <div className="border border-[var(--border)] rounded-lg overflow-x-auto">
                        <table className="w-full text-[11px]">
                            <thead>
                                <tr className="bg-[var(--surface)] text-[var(--text3)]">
                                    <th className="px-2 py-1.5 text-left">Date</th>
                                    <th className="px-2 py-1.5 text-left">Day</th>
                                    <th className="px-2 py-1.5 text-left">In</th>
                                    <th className="px-2 py-1.5 text-left">Out</th>
                                    <th className="px-2 py-1.5 text-right">Hours</th>
                                    <th className="px-2 py-1.5 text-right">Rate</th>
                                    <th className="px-2 py-1.5 text-right">Amount</th>
                                    <th className="px-2 py-1.5 text-right">Cut</th>
                                    <th className="px-2 py-1.5 text-left">Remarks</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border)]">
                                {c.lines.length === 0 ? (
                                    <tr><td colSpan={9} className="px-2 py-4 text-center text-[var(--text3)]">No days in this period</td></tr>
                                ) : c.lines.map(l => (
                                    <tr key={l.date + l.kind} className={lineTone(l.kind, l.lateHrs + l.earlyHrs > 0)}>
                                        <td className="px-2 py-1 whitespace-nowrap">{fmtDMY(l.date).slice(0, 6)}</td>
                                        <td className={cn("px-2 py-1", l.isSunday && "font-semibold text-red-600")}>{l.weekday}</td>
                                        <td className="px-2 py-1 whitespace-nowrap">{l.inTime ?? "–"}</td>
                                        <td className="px-2 py-1 whitespace-nowrap">{l.outTime ?? "–"}</td>
                                        <td className="px-2 py-1 text-right">{l.kind === "WORK" || l.kind === "SUNDAY_WORK" ? l.hours : "–"}</td>
                                        <td className="px-2 py-1 text-right whitespace-nowrap">{l.kind === "SUNDAY_WORK" ? `${c.hourlyRate} × 2` : l.kind === "WORK" ? c.hourlyRate : "–"}</td>
                                        <td className="px-2 py-1 text-right font-medium">{l.amount ? fmt2(l.amount) : "–"}</td>
                                        <td className={cn("px-2 py-1 text-right whitespace-nowrap", l.cut > 0 && "font-semibold text-red-600")}>{l.cut > 0 ? `−${fmt2(l.cut)}` : "–"}</td>
                                        <td className="px-2 py-1 text-[var(--text2)]">{l.remark}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Summary */}
                    <div className="slip-block border border-[var(--border)] rounded-lg overflow-hidden">
                        <div className="bg-[var(--surface)] px-3 py-1.5 text-[10px] font-bold text-[var(--text3)] uppercase tracking-wide">Summary</div>
                        <div className="px-3 py-2 space-y-1.5 text-[11.5px]">
                            <Row k="Monthly salary (30-day base)" v={fmt2(c.monthlySalary)} />
                            {c.absentDays > 0 && (
                                <Row k={<>Absent {c.absentDays} day{c.absentDays > 1 ? "s" : ""} × {fmt2(c.dailyRate)}
                                    <span className="block text-[10px] text-red-600">{c.absentDates.map(d => fmtDMY(d).slice(0, 6)).join(", ")}</span></>}
                                    v={<span className="text-red-600">−{fmt2(c.absentCut)}</span>} />
                            )}
                            {c.lateEarlyCut > 0 && <Row k={`Late / early: ${c.lateEarlyHrs} h × ${fmt2(c.hourlyRate)}`} v={<span className="text-red-600">−{fmt2(c.lateEarlyCut)}</span>} />}
                            {c.halfDays > 0 && <Row k={`Half days: ${c.halfDays} × ½ day`} v={<span className="text-red-600">−{fmt2(c.halfDays * c.dailyRate / 2)}</span>} />}
                            {c.unpaidSundays > 0 && (
                                <Row k={`Sundays not paid: ${c.unpaidSundays} (only ${c.freeSundaysEarned} free for ${c.daysWorked} days worked)`}
                                    v={<span className="text-red-600">−{fmt2(c.unpaidSundayCut)}</span>} />
                            )}
                            {c.notEmployedDays > 0 && <Row k={`Before joining / after leaving: ${c.notEmployedDays} day(s)`} v={<span className="text-red-600">−{fmt2(c.notEmployedDays * c.dailyRate)}</span>} />}
                            {c.upcomingDays > 0 && <Row k={`Days not reached yet: ${c.upcomingDays}`} v={<span className="text-red-600">−{fmt2(c.upcomingDays * c.dailyRate)}</span>} />}
                            {c.sundaysWorked > 0 && (
                                <Row k={`Sunday worked: ${c.sundaysWorked} (${c.sundayHours} h × ${fmt2(c.hourlyRate)} × 2 = ${fmt2(c.sundayPay)}, replaces ${c.sundaysWorked} day)`}
                                    v={<span className="text-purple-700">{c.sundayExtra >= 0 ? "+" : "−"}{fmt2(Math.abs(c.sundayExtra))}</span>} />
                            )}
                            {c.otHrs > 0 && <Row k={`OT: ${c.otHrs} h × ${fmt2(c.hourlyRate)} × 1.5`} v={<span className="text-purple-700">+{fmt2(c.otPay)}</span>} />}
                            <div className="flex justify-between border-t border-[var(--border)] pt-1.5 font-bold text-[var(--accent)]">
                                <span>Gross Salary{daysCut > 0 ? ` (${daysCut} day${daysCut > 1 ? "s" : ""} cut)` : ""}</span><span>{fmt2(c.gross)}</span>
                            </div>
                            {c.missingPunchDays > 0 && (
                                <p className="text-[10.5px] text-orange-600">⚠ {c.missingPunchDays} day(s) have only an IN punch — cut as absent until attendance is corrected.</p>
                            )}
                        </div>
                    </div>

                    {/* Advances + carry forward */}
                    {(c.advance > 0 || c.carryForward !== 0) && (
                        <div className="slip-block border border-[var(--border)] rounded-lg overflow-hidden">
                            <div className="bg-[var(--surface)] px-3 py-1.5 text-[10px] font-bold text-[var(--text3)] uppercase tracking-wide">Advance & balance</div>
                            <div className="px-3 py-2 space-y-1.5 text-[11.5px]">
                                {c.advances.map((a, i) => (
                                    <Row key={i}
                                        k={<>Advance{a.date ? ` · ${fmtDMY(a.date)}` : ""}{a.reason ? <span className="text-[var(--text2)]"> · {a.reason}</span> : ""}</>}
                                        v={<span className="text-orange-700">−{fmt2(a.amount)}</span>} />
                                ))}
                                {c.advance !== c.advances.reduce((t, a) => t + a.amount, 0) && (
                                    <Row k="Advance (adjusted on payroll)" v={<span className="text-orange-700">−{fmt2(c.advance)}</span>} />
                                )}
                                {c.carryForward !== 0 && (
                                    <Row k={c.carryForward > 0 ? "Balance from last month (paid less)" : "Paid extra last month"}
                                        v={<span className={c.carryForward > 0 ? "text-green-700" : "text-orange-700"}>{c.carryForward > 0 ? "+" : "−"}{fmt2(Math.abs(c.carryForward))}</span>} />
                                )}
                            </div>
                        </div>
                    )}
                    <div className="slip-block slip-net bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex justify-between items-center">
                        <span className="font-bold text-[13px] text-green-800">NET PAYABLE</span>
                        <span className="font-bold text-[20px] text-green-700">{fmt(c.net)}</span>
                    </div>
                    {paid != null && paid !== c.net && (
                        <div className="slip-block flex justify-between text-[12px] px-4">
                            <span className="text-[var(--text2)]">Paid {fmt(paid)}</span>
                            <span className={cn("font-semibold", c.net - paid > 0 ? "text-orange-600" : "text-blue-600")}>
                                {c.net - paid > 0 ? `${fmt(c.net - paid)} carried to next month` : `${fmt(paid - c.net)} extra, cut next month`}
                            </span>
                        </div>
                    )}
                    {row.payrollStatus === "PAID" && (
                        <div className="text-center text-[11px] font-bold text-green-700 bg-green-100 rounded py-1.5 border border-green-200">
                            ✓ PAID & CONFIRMED
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    )
}

function Row({ k, v }: { k: React.ReactNode; v: React.ReactNode }) {
    return (
        <div className="flex justify-between gap-3">
            <span className="text-[var(--text3)]">{k}</span>
            <span className="text-right">{v}</span>
        </div>
    )
}
