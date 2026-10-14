"use client"
import { useState, useEffect, useCallback, useMemo } from "react"
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
    type HourlyPayResult, type PayAttendance,
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
    att: PayAttendance[]; autoAdvance: number
    payrollStatus: string | null
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
            const [empRes, attRes, advRes, payRes] = await Promise.all([
                fetch("/api/employees?limit=1000"),
                fetch(`/api/attendance?${attQuery}&limit=5000`),
                fetch(`/api/advances?month=${payMonth}&year=${payYear}`),
                fetch(`/api/payroll?month=${payMonth}&year=${payYear}&limit=1000`),
            ])
            const emps     = empRes.ok ? await empRes.json() : []
            const attData  = attRes.ok ? await attRes.json() : []
            const advances = advRes.ok ? await advRes.json() : []
            const pays     = payRes.ok ? await payRes.json() : []

            const empList: any[] = emps.data ?? emps
            const attList: any[] = Array.isArray(attData) ? attData : (attData.data ?? [])
            const advList: any[] = Array.isArray(advances) ? advances : []
            const payList: any[] = Array.isArray(pays) ? pays : (pays.data ?? [])

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
                att: attByEmp.get(e.id) ?? [],
                autoAdvance: advList.filter(a => a.employeeId === e.id).reduce((s, a) => s + (a.amount ?? 0), 0),
                payrollStatus: payList.find(p => p.employeeId === e.id)?.status ?? null,
            }))
            setBase(rows)
            setAdvOverride(Object.fromEntries(rows.map(r => [r.id, r.autoAdvance])))
            setOtOverride({})
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
            advance: advOverride[r.id] ?? r.autoAdvance,
            otHrs: otOverride[r.id] ?? 0,
        }),
    })), [base, period, advOverride, otOverride])

    const savePay = async (ids: string[], newStatus: "PAID" | "DRAFT") => {
        if (!ids.length) return
        setSaving(prev => new Set([...prev, ...ids]))
        try {
            const overrides = Object.fromEntries(ids.map(id => [id, { advance: advOverride[id], otHrs: otOverride[id] ?? 0 }]))
            const res = await fetch("/api/payroll/hourly", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    month: payMonth, year: payYear, employeeIds: ids, status: newStatus, overrides,
                    ...(mode === "range" ? { from: fromDate, to: toDate } : {}),
                }),
            })
            if (!res.ok) throw new Error(await res.text())
            setBase(prev => prev.map(r => ids.includes(r.id) ? { ...r, payrollStatus: newStatus } : r))
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
        const summary = displayRows.map((r, i) => ({
            "#": i + 1,
            "Employee ID": r.employeeId,
            "Name": r.name,
            "Designation": r.designation,
            "Shift": r.calc.shiftLabel || `${r.calc.shiftHours} h`,
            "Shift Hours": r.calc.shiftHours,
            "Monthly Salary (₹)": r.calc.monthlySalary,
            "Daily Rate ÷30 (₹)": r.calc.dailyRate,
            "Hourly Rate (₹)": r.calc.hourlyRate,
            "Days Worked (Mon–Sat)": r.calc.daysWorked,
            "Paid Hours": r.calc.workHours,
            "Late/Early Cut (h)": r.calc.lateEarlyHrs,
            "Working Day Pay (₹)": r.calc.workPay,
            "Sundays Worked": r.calc.sundaysWorked,
            "Sunday Hours": r.calc.sundayHours,
            "Sunday Pay ×2 (₹)": r.calc.sundayPay,
            "Free Sundays": r.calc.freeSundays,
            "Free Sunday Pay (₹)": r.calc.freeSundayPay,
            "OT Hours": r.calc.otHrs,
            "OT Pay (₹)": r.calc.otPay,
            "Gross (₹)": r.calc.gross,
            "Advance (₹)": r.calc.advance,
            "Net Payable (₹)": r.calc.net,
            "Status": r.payrollStatus === "PAID" ? "PAID" : "PENDING",
        }))
        const daywise = displayRows.flatMap(r => r.calc.lines.map(l => ({
            "Employee ID": r.employeeId,
            "Name": r.name,
            "Date": fmtDMY(l.date),
            "Day": l.weekday,
            "In": l.inTime ?? "-",
            "Out": l.outTime ?? "-",
            "Hours Paid": l.kind === "FREE_SUNDAY" ? "-" : l.hours,
            "Rate (₹/h)": l.kind === "FREE_SUNDAY" ? "-" : l.rate,
            "Amount (₹)": l.amount,
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
    const totalFree   = displayRows.reduce((s, r) => s + r.calc.freeSundayPay, 0)
    const totalWork   = displayRows.reduce((s, r) => s + r.calc.workPay, 0)
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
                    <p className="text-[13px] text-[var(--text3)]">30-day base · Shift-wise hourly salary · Sunday rules</p>
                </div>
                <div className="flex gap-2 self-start">
                    <button onClick={toggleRules}
                        className="flex items-center gap-2 border border-[var(--border)] bg-white rounded-[12px] text-[13px] font-semibold px-4 py-2.5 hover:bg-[var(--surface2)] transition-colors shadow-[0_2px_10px_rgba(80,80,170,0.05)]">
                        <Info size={14} className="text-[var(--accent)]" /> Salary Rules
                        <ChevronDown size={14} className={cn("transition-transform", rulesOpen && "rotate-180")} />
                    </button>
                    <button onClick={exportExcel}
                        className="flex items-center gap-2 border border-[var(--border)] bg-white rounded-[12px] text-[13px] font-semibold px-4 py-2.5 hover:bg-[var(--surface2)] transition-colors shadow-[0_2px_10px_rgba(80,80,170,0.05)]">
                        <Download size={14} className="text-[var(--accent)]" /> Export
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
                    { label: "Gross Salary", value: fmt(totalGross), sub: `Days ${fmt(totalWork)} · Sun ${fmt(totalSunday + totalFree)}`, color: "#0b5cff", bg: "#f0f0fd", icon: <IndianRupee size={18} /> },
                    { label: "Advance", value: fmt(totalAdv), sub: "deducted from net", color: "#ea580c", bg: "#fff5eb", icon: <IndianRupee size={18} /> },
                    { label: "Net Payable", value: fmt(totalNet), sub: "gross − advance", color: "#16a34a", bg: "#eefaf2", icon: <IndianRupee size={18} /> },
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
                                <div className="grid grid-cols-4 gap-2 mt-2.5 pt-2.5 border-t border-[var(--border)]">
                                    <Stat label="Days" value={String(c.daysWorked)} className="text-blue-600" />
                                    <Stat label="Hours" value={String(c.workHours)} className="text-blue-600" />
                                    <Stat label="Sundays" value={fmt(c.sundayPay + c.freeSundayPay)} className="text-purple-600" />
                                    <Stat label="Net" value={fmt(c.net)} className="text-green-600" />
                                </div>
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
                                <th className="px-2 py-3 text-center font-semibold text-blue-600">Days<Sub>Mon–Sat</Sub></th>
                                <th className="px-2 py-3 text-right font-semibold text-blue-600">Paid Hrs<Sub>after late/early</Sub></th>
                                <th className="px-2 py-3 text-right font-semibold text-blue-600">Day Pay</th>
                                <th className="px-2 py-3 text-right font-semibold text-purple-600">Sunday Work<Sub>shift hrs × rate × 2</Sub></th>
                                <th className="px-2 py-3 text-right font-semibold text-teal-600">Free Sundays<Sub>by days worked</Sub></th>
                                <th className="px-2 py-3 text-center font-semibold text-[var(--text3)]">OT Hrs<Sub>×1.5, manual</Sub></th>
                                <th className="px-2 py-3 text-right font-semibold text-[var(--accent)]">Gross</th>
                                <th className="px-2 py-3 text-center font-semibold text-orange-600">Advance</th>
                                <th className="px-2 py-3 text-right font-semibold text-green-700">Net</th>
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
                                            <td colSpan={9} className="px-2 py-2 text-[11px] text-orange-600">Monthly salary not set — add it in Employees to calculate pay.</td>
                                        ) : (<>
                                            <td className="px-2 py-2 text-right font-medium whitespace-nowrap">
                                                ₹{c.hourlyRate}
                                                <Sub>{c.shiftHours} h · ₹{Math.round(c.dailyRate)}/day</Sub>
                                            </td>
                                            <td className="px-2 py-2 text-center font-semibold text-blue-600">{c.daysWorked}</td>
                                            <td className="px-2 py-2 text-right font-semibold text-blue-600 whitespace-nowrap">
                                                {hrs(c.workHours)}
                                                {c.lateEarlyHrs > 0 && <Sub className="text-red-500">−{c.lateEarlyHrs} h cut</Sub>}
                                                {c.missingPunchDays > 0 && <Sub className="text-orange-600">{c.missingPunchDays} out-punch missing</Sub>}
                                            </td>
                                            <td className="px-2 py-2 text-right font-semibold text-blue-700">{fmt(c.workPay)}</td>
                                            <td className="px-2 py-2 text-right whitespace-nowrap">
                                                {c.sundaysWorked > 0 ? (<>
                                                    <span className="font-semibold text-purple-600">{fmt(c.sundayPay)}</span>
                                                    <Sub>{c.sundaysWorked} day · {c.sundayHours} h</Sub>
                                                </>) : <span className="text-[var(--text3)]">—</span>}
                                            </td>
                                            <td className="px-2 py-2 text-right whitespace-nowrap">
                                                {c.freeSundays > 0
                                                    ? <span className="font-semibold text-teal-600">{fmt(c.freeSundayPay)}</span>
                                                    : <span className="text-[var(--text3)]">₹0</span>}
                                                <Sub>{c.freeSundays} Sunday{c.freeSundays !== 1 ? "s" : ""}</Sub>
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
                                            </td>
                                            <td className="px-2 py-2 text-right font-bold text-green-700">{fmt(c.net)}</td>
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
                                <td className="px-2 py-3 text-right text-blue-600">{hrs(displayRows.reduce((s, r) => s + r.calc.workHours, 0))}</td>
                                <td className="px-2 py-3 text-right text-blue-700">{fmt(totalWork)}</td>
                                <td className="px-2 py-3 text-right text-purple-600">{fmt(totalSunday)}</td>
                                <td className="px-2 py-3 text-right text-teal-600">{fmt(totalFree)}</td>
                                <td className="px-2 py-3 text-center text-[var(--text3)]">{fmt(displayRows.reduce((s, r) => s + r.calc.otPay, 0))}</td>
                                <td className="px-2 py-3 text-right text-[var(--accent)]">{fmt(totalGross)}</td>
                                <td className="px-2 py-3 text-right text-orange-600">{fmt(totalAdv)}</td>
                                <td className="px-2 py-3 text-right text-green-700">{fmt(totalNet)}</td>
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
            n: 1, color: "#2563eb", bg: "#eff5ff", title: "Always 30 days",
            body: <>Salary is calculated on <b>30 days</b> every month — even if the month has 28 or 31 days.<br />
                <span className="font-mono text-[11px]">Hourly = Monthly ÷ (30 × shift hours)</span></>,
        },
        {
            n: 2, color: "#dc2626", bg: "#fff1f1", title: "Hourly, shift-wise",
            body: <>Each employee is paid for their own shift timing. Coming <b>late</b> or leaving <b>early</b> is cut by the exact minutes.<br />
                <span className="font-mono text-[11px]">Day pay = (shift hrs − late − early) × hourly</span></>,
        },
        {
            n: 3, color: "#0d9488", bg: "#ebfaf6", title: "Free Sundays (max 4)",
            body: <>Sundays are paid free, based on days worked (Mon–Sat). 1 free Sunday = 1 day salary (Monthly ÷ 30).</>,
        },
        {
            n: 4, color: "#7c3aed", bg: "#f5f0ff", title: "Working on Sunday = 2×",
            body: <>Sunday shift ends at <b>5:30 PM</b>. Working till 5:30 PM = <b>full shift hours</b>, paid <b>double</b>. Late / leaving before 5:30 is cut. No extra free-day salary for that Sunday.<br />
                <span className="font-mono text-[11px]">Sunday pay = (shift hrs − late − early) × hourly × 2</span></>,
        },
    ]
    return (
        <div className="bg-white border border-[var(--border)] rounded-[16px] p-3.5 md:p-4 shadow-[0_2px_10px_rgba(80,80,170,0.05)] space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
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
                    <div className="font-bold text-[var(--text)] text-[11px] mb-1">Example — ₹30,000 salary, 9-hour shift</div>
                    <div>Hourly = 30,000 ÷ (30 × 9) = <b>₹111.11</b> · Daily = <b>₹1,000</b></div>
                    <div>Left 30 min early → 8.5 h × 111.11 = <b>₹944.44</b></div>
                    <div>Sunday 8:30 AM – 5:30 PM → full 9 h × 111.11 × 2 = <b>₹2,000</b></div>
                    <div>Worked 18 days → 3 free Sundays = <b>₹3,000</b></div>
                </div>
            </div>
        </div>
    )
}

// ─── Salary slip with day-wise breakdown (also used for PDF print) ───────────
function SalarySlip({ row, periodLabel, onClose }: { row: EmpPayRow; periodLabel: string; onClose: () => void }) {
    const c = row.calc
    const lineTone = (kind: string, cut: boolean) =>
        kind === "SUNDAY_WORK" ? "bg-purple-50" : kind === "FREE_SUNDAY" ? "bg-teal-50" : cut ? "bg-red-50" : ""
    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3 md:p-4" onClick={onClose}>
            {/* Print isolation: only the slip prints, not the whole page */}
            <style>{`@media print { body * { visibility: hidden !important; } #salary-slip, #salary-slip * { visibility: visible !important; } #salary-slip { position: absolute !important; inset: 0 auto auto 0 !important; width: 100% !important; max-width: none !important; max-height: none !important; overflow: visible !important; box-shadow: none !important; } .no-print { display: none !important; } }`}</style>
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
                <div className="px-4 md:px-5 py-4 text-[12px] space-y-3">
                    <div className="text-center pb-2 border-b border-[var(--border)]">
                        <div className="text-[17px] font-bold text-[var(--accent)]">Falcon Plus</div>
                        <div className="text-[11px] text-[var(--text3)]">Salary Slip — {periodLabel} · Hourly, 30-day base</div>
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
                                    <th className="px-2 py-1.5 text-left">Remarks</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border)]">
                                {c.lines.length === 0 ? (
                                    <tr><td colSpan={8} className="px-2 py-4 text-center text-[var(--text3)]">No attendance in this period</td></tr>
                                ) : c.lines.map(l => (
                                    <tr key={l.date + l.kind} className={lineTone(l.kind, l.lateHrs + l.earlyHrs > 0)}>
                                        <td className="px-2 py-1 whitespace-nowrap">{fmtDMY(l.date).slice(0, 6)}</td>
                                        <td className={cn("px-2 py-1", l.isSunday && "font-semibold text-red-600")}>{l.weekday}</td>
                                        <td className="px-2 py-1 whitespace-nowrap">{l.inTime ?? "–"}</td>
                                        <td className="px-2 py-1 whitespace-nowrap">{l.outTime ?? "–"}</td>
                                        <td className="px-2 py-1 text-right">{l.kind === "FREE_SUNDAY" ? "–" : l.hours}</td>
                                        <td className="px-2 py-1 text-right whitespace-nowrap">{l.kind === "FREE_SUNDAY" ? "–" : l.kind === "SUNDAY_WORK" ? `${c.hourlyRate} × 2` : c.hourlyRate}</td>
                                        <td className="px-2 py-1 text-right font-medium">{fmt2(l.amount)}</td>
                                        <td className="px-2 py-1 text-[var(--text2)]">{l.remark}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Summary */}
                    <div className="border border-[var(--border)] rounded-lg overflow-hidden">
                        <div className="bg-[var(--surface)] px-3 py-1.5 text-[10px] font-bold text-[var(--text3)] uppercase tracking-wide">Summary</div>
                        <div className="px-3 py-2 space-y-1.5 text-[11.5px]">
                            <Row k={`Working days (Mon–Sat): ${c.daysWorked} · ${c.workHours} h paid${c.lateEarlyHrs > 0 ? ` (−${c.lateEarlyHrs} h late/early)` : ""}`} v={fmt2(c.workPay)} />
                            <Row k={`Sunday worked: ${c.sundaysWorked} (${c.sundayHours} h × ${fmt2(c.hourlyRate)} × 2)`} v={fmt2(c.sundayPay)} />
                            <Row k={`Free Sundays: ${c.freeSundays} × ${fmt2(c.dailyRate)}${c.freeSundaysEarned > c.freeSundays ? ` (earned ${c.freeSundaysEarned}, ${c.sundaysWorked} Sunday worked)` : ` (for ${c.daysWorked} days worked)`}`} v={fmt2(c.freeSundayPay)} />
                            {c.otHrs > 0 && <Row k={`OT: ${c.otHrs} h × ${fmt2(c.hourlyRate)} × 1.5`} v={fmt2(c.otPay)} />}
                            <div className="flex justify-between border-t border-[var(--border)] pt-1.5 font-bold text-[var(--accent)]">
                                <span>Gross Salary</span><span>{fmt2(c.gross)}</span>
                            </div>
                            {c.advance > 0 && <Row k="Less: Advance" v={<span className="text-orange-700">−{fmt2(c.advance)}</span>} />}
                            {c.missingPunchDays > 0 && (
                                <p className="text-[10.5px] text-orange-600">⚠ {c.missingPunchDays} day(s) have only an IN punch — paid 0 hours until attendance is corrected.</p>
                            )}
                        </div>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex justify-between items-center">
                        <span className="font-bold text-[13px] text-green-800">NET PAYABLE</span>
                        <span className="font-bold text-[20px] text-green-700">{fmt(c.net)}</span>
                    </div>
                    {row.payrollStatus === "PAID" && (
                        <div className="text-center text-[11px] font-bold text-green-700 bg-green-100 rounded py-1.5 border border-green-200">
                            ✓ PAID & CONFIRMED
                        </div>
                    )}
                </div>
            </div>
        </div>
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
