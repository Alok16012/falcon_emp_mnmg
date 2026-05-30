"use client"
import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
    Calculator, Loader2, IndianRupee, Printer, X, FileSpreadsheet, BadgeCheck, Clock
} from "lucide-react"
import * as XLSX from "xlsx"

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

function fmt(n: number) {
    return "₹" + Math.round(n).toLocaleString("en-IN")
}

type EmpPayRow = {
    id: string
    employeeId: string
    name: string
    designation: string
    hourlyRate: number        // basicSalary field repurposed
    shiftHours: number
    totalWorkingHrs: number   // from attendance this month
    otHrs: number             // overtime hours (manual input)
    otPay: number             // otHrs × hourlyRate × 1.5
    advance: number           // from advances
    totalSalary: number       // (totalWorkingHrs × hourlyRate) + otPay
    netSalary: number         // totalSalary - advance
    payrollId: string | null
    payrollStatus: string | null
}

type SlipData = EmpPayRow

export default function PayrollPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [month, setMonth] = useState(new Date().getMonth() + 1)
    const [year, setYear]   = useState(new Date().getFullYear())
    const [rows, setRows]   = useState<EmpPayRow[]>([])
    const [loading, setLoading]     = useState(true)
    const [processing, setProcessing] = useState(false)
    const [slipEmp, setSlipEmp]     = useState<SlipData | null>(null)
    // editable overrides per employee
    const [advOverride, setAdvOverride] = useState<Record<string, number>>({})
    const [otOverride, setOtOverride]   = useState<Record<string, number>>({})

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const [empRes, attRes, advRes, payRes] = await Promise.all([
                fetch("/api/employees?limit=1000"),
                fetch(`/api/attendance?month=${year}-${String(month).padStart(2,"0")}&limit=2000`),
                fetch(`/api/advances?month=${month}&year=${year}`),
                fetch(`/api/payroll?month=${month}&year=${year}&limit=1000`),
            ])
            const emps     = empRes.ok  ? await empRes.json()  : []
            const attData  = attRes.ok  ? await attRes.json()  : []
            const advances = advRes.ok  ? await advRes.json()  : []
            const pays     = payRes.ok  ? await payRes.json()  : []

            const empList: any[] = emps.data ?? emps
            const attList: any[] = Array.isArray(attData) ? attData : (attData.data ?? [])

            const newRows: EmpPayRow[] = empList.map((e: any) => {
                // Sum all workingHrs for this employee this month
                const empAtt = attList.filter((a: any) => a.employeeId === e.id)
                const totalWorkingHrs = empAtt.reduce((s: number, a: any) => s + (parseFloat(a.workingHrs) || 0), 0)

                // Auto-sum advances
                const autoAdvance = (Array.isArray(advances) ? advances : [])
                    .filter((a: any) => a.employeeId === e.id)
                    .reduce((s: number, a: any) => s + (a.amount ?? 0), 0)

                const hourlyRate = parseFloat(e.basicSalary) || 0
                const shiftHours = parseInt(e.shiftHours) || 8
                const otHrs = 0  // starts at 0, user can edit
                const otPay = parseFloat((otHrs * hourlyRate * 1.5).toFixed(2))
                const totalSalary = parseFloat(((totalWorkingHrs * hourlyRate) + otPay).toFixed(2))
                const advance = autoAdvance
                const netSalary = Math.max(0, totalSalary - advance)

                const pay = (Array.isArray(pays) ? pays : (pays.data ?? [])).find((p: any) => p.employeeId === e.id)

                return {
                    id: e.id,
                    employeeId: e.employeeId,
                    name: `${e.firstName} ${e.lastName}`,
                    designation: e.designation ?? "—",
                    hourlyRate,
                    shiftHours,
                    totalWorkingHrs: parseFloat(totalWorkingHrs.toFixed(2)),
                    otHrs,
                    otPay,
                    advance,
                    totalSalary,
                    netSalary,
                    payrollId: pay?.id ?? null,
                    payrollStatus: pay?.status ?? null,
                }
            })

            setRows(newRows)
            // init overrides from auto-values
            const advInit: Record<string, number> = {}
            const otInit: Record<string, number> = {}
            newRows.forEach(r => { advInit[r.id] = r.advance; otInit[r.id] = 0 })
            setAdvOverride(advInit)
            setOtOverride(otInit)
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
        const adv   = advOverride[r.id] ?? r.advance
        const ot    = otOverride[r.id]  ?? 0
        const otPay = parseFloat((ot * r.hourlyRate * 1.5).toFixed(2))
        const totalSalary = parseFloat(((r.totalWorkingHrs * r.hourlyRate) + otPay).toFixed(2))
        return {
            ...r,
            otHrs: ot,
            otPay,
            advance: adv,
            totalSalary,
            netSalary: Math.max(0, totalSalary - adv),
        }
    }

    const processPayroll = async () => {
        setProcessing(true)
        try {
            const attendance = rows.map(r => {
                const row = getRow(r)
                return {
                    employeeId: r.id,
                    workedDays: 0,
                    monthDays: new Date(year, month, 0).getDate(),
                    otDays: 0,
                    canteenDays: 0,
                    penalty: 0,
                    advance: row.advance,
                    otherDeductions: 0,
                    productionIncentive: 0,
                    lwf: 0,
                    totalWorkingHrs: r.totalWorkingHrs,
                    hourlyRate: r.hourlyRate,
                    totalSalary: row.totalSalary,
                    netSalary: row.netSalary,
                }
            })
            const res = await fetch("/api/payroll/calculate", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ month, year, attendance })
            })
            if (!res.ok) throw new Error(await res.text())
            const data = await res.json()
            toast.success(`Payroll processed for ${data.processedCount ?? rows.length} employees!`)
            await loadData()
        } catch (e: any) {
            toast.error(e.message || "Failed to process payroll")
        } finally { setProcessing(false) }
    }

    const markPaid = async (payrollId: string) => {
        try {
            const res = await fetch(`/api/payroll/${payrollId}`, {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "PAID" })
            })
            if (!res.ok) throw new Error(await res.text())
            toast.success("Marked as PAID ✓")
            setRows(prev => prev.map(r => r.payrollId === payrollId ? { ...r, payrollStatus: "PAID" } : r))
        } catch (e: any) {
            toast.error(e.message || "Failed")
        }
    }

    const exportExcel = () => {
        const data = rows.map((r, i) => {
            const row = getRow(r)
            return {
                "#": i + 1,
                "Employee ID": r.employeeId,
                "Name": r.name,
                "Designation": r.designation,
                "Hourly Rate (₹)": r.hourlyRate,
                "Shift Hours": r.shiftHours,
                "Work Hrs": r.totalWorkingHrs,
                "OT Hrs": row.otHrs,
                "OT Pay (₹)": row.otPay,
                "Total Salary (₹)": row.totalSalary,
                "Advance (₹)": row.advance,
                "Net Salary (₹)": row.netSalary,
                "Status": r.payrollStatus ?? "PENDING",
            }
        })
        const ws = XLSX.utils.json_to_sheet(data)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Payroll")
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
    const totalSalarySum = displayRows.reduce((s, r) => s + r.totalSalary, 0)
    const totalAdvance   = displayRows.reduce((s, r) => s + r.advance, 0)
    const totalNet       = displayRows.reduce((s, r) => s + r.netSalary, 0)
    const totalHrs       = displayRows.reduce((s, r) => s + r.totalWorkingHrs, 0)

    return (
        <div className="space-y-5 max-w-screen-xl mx-auto pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-[22px] font-semibold text-[var(--text)]">Payroll</h1>
                    <p className="text-[13px] text-[var(--text3)]">Total Hours × Hourly Rate = Salary</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
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
                        <FileSpreadsheet size={15} className="text-green-600" /> Export Excel
                    </button>
                    <button onClick={processPayroll} disabled={processing}
                        className="flex items-center gap-2 bg-[var(--accent)] text-white rounded-xl text-[13px] font-medium px-4 py-2 hover:opacity-90 disabled:opacity-60">
                        {processing ? <Loader2 size={15} className="animate-spin" /> : <Calculator size={15} />}
                        {processing ? "Processing…" : "Process Payroll"}
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: "Total Hours Worked", value: totalHrs.toFixed(1) + " hrs", color: "text-blue-600", icon: <Clock size={16} /> },
                    { label: "Total Salary", value: fmt(totalSalarySum), color: "text-[var(--accent)]", icon: <IndianRupee size={16} /> },
                    { label: "Total Advance", value: fmt(totalAdvance), color: "text-orange-600", icon: <IndianRupee size={16} /> },
                    { label: "Net Payable", value: fmt(totalNet), color: "text-green-600", icon: <IndianRupee size={16} /> },
                ].map(card => (
                    <div key={card.label} className="bg-white border border-[var(--border)] rounded-xl p-4">
                        <div className="flex items-center gap-1.5 mb-1">
                            <span className={card.color}>{card.icon}</span>
                            <p className="text-[11px] text-[var(--text3)]">{card.label}</p>
                        </div>
                        <p className={`text-[20px] font-bold ${card.color}`}>{card.value}</p>
                    </div>
                ))}
            </div>

            {/* Table */}
            <div className="bg-white border border-[var(--border)] rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-[12px]">
                        <thead>
                            <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
                                <th className="px-4 py-3 text-left font-semibold text-[var(--text3)]">#</th>
                                <th className="px-4 py-3 text-left font-semibold text-[var(--text3)]">Employee</th>
                                <th className="px-4 py-3 text-right font-semibold text-[var(--text3)]">Rate/Hr</th>
                                <th className="px-4 py-3 text-right font-semibold text-blue-600">Work Hrs</th>
                                <th className="px-4 py-3 text-center font-semibold text-purple-600">OT Hrs <span className="text-[10px] font-normal">(×1.5)</span></th>
                                <th className="px-4 py-3 text-right font-semibold text-purple-600">OT Pay</th>
                                <th className="px-4 py-3 text-right font-semibold text-[var(--accent)]">Total Salary</th>
                                <th className="px-4 py-3 text-center font-semibold text-orange-600">Advance</th>
                                <th className="px-4 py-3 text-right font-semibold text-green-700">Net Salary</th>
                                <th className="px-4 py-3 text-center font-semibold text-[var(--text3)]">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                            {displayRows.map((row, idx) => (
                                <tr key={row.id} className="hover:bg-[var(--surface)]">
                                    <td className="px-4 py-3 text-[var(--text3)]">{idx + 1}</td>
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-[var(--text)]">{row.name}</div>
                                        <div className="text-[10px] text-[var(--text3)]">{row.employeeId} · {row.designation}</div>
                                    </td>
                                    <td className="px-4 py-3 text-right font-medium">
                                        {row.hourlyRate ? `₹${row.hourlyRate}/hr` : <span className="text-[var(--text3)]">—</span>}
                                    </td>
                                    <td className="px-4 py-3 text-right font-semibold text-blue-600">
                                        {row.totalWorkingHrs > 0 ? row.totalWorkingHrs.toFixed(2) : <span className="text-[var(--text3)]">0</span>}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.5"
                                            value={otOverride[row.id] ?? 0}
                                            onChange={e => setOtOverride(prev => ({ ...prev, [row.id]: parseFloat(e.target.value) || 0 }))}
                                            className="w-16 border border-[var(--border)] rounded px-2 py-1 text-center text-[12px] outline-none focus:border-purple-400"
                                        />
                                    </td>
                                    <td className="px-4 py-3 text-right font-semibold text-purple-600">
                                        {row.otPay > 0 ? fmt(row.otPay) : <span className="text-[var(--text3)]">—</span>}
                                    </td>
                                    <td className="px-4 py-3 text-right font-semibold text-[var(--accent)]">
                                        {row.hourlyRate > 0 ? fmt(row.totalSalary) : <span className="text-[var(--text3)]">—</span>}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        <input
                                            type="number"
                                            min="0"
                                            value={advOverride[row.id] ?? row.advance}
                                            onChange={e => setAdvOverride(prev => ({ ...prev, [row.id]: parseFloat(e.target.value) || 0 }))}
                                            className="w-20 border border-[var(--border)] rounded px-2 py-1 text-right text-[12px] outline-none focus:border-orange-400"
                                        />
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-green-700">
                                        {row.hourlyRate > 0 ? fmt(row.netSalary) : <span className="text-[var(--text3)]">—</span>}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-center gap-1">
                                            {row.payrollId && row.payrollStatus !== "PAID" && (
                                                <button onClick={() => markPaid(row.payrollId!)}
                                                    title="Mark as PAID"
                                                    className="p-1 rounded hover:bg-green-50 text-green-600">
                                                    <BadgeCheck size={15} />
                                                </button>
                                            )}
                                            {row.payrollStatus === "PAID" && (
                                                <span className="text-[10px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded">PAID</span>
                                            )}
                                            {row.hourlyRate > 0 && (
                                                <button onClick={() => setSlipEmp(row)}
                                                    title="Salary Slip"
                                                    className="p-1 rounded hover:bg-blue-50 text-blue-500">
                                                    <Printer size={15} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        {/* Totals row */}
                        <tfoot>
                            <tr className="bg-[var(--surface)] border-t-2 border-[var(--border)] font-bold text-[12px]">
                                <td colSpan={3} className="px-4 py-3 text-[var(--text3)]">TOTAL ({rows.length} employees)</td>
                                <td className="px-4 py-3 text-right text-blue-600">{totalHrs.toFixed(2)}</td>
                                <td />
                                <td className="px-4 py-3 text-right text-purple-600">{fmt(displayRows.reduce((s,r) => s + r.otPay, 0))}</td>
                                <td className="px-4 py-3 text-right text-[var(--accent)]">{fmt(totalSalarySum)}</td>
                                <td className="px-4 py-3 text-right text-orange-600">{fmt(totalAdvance)}</td>
                                <td className="px-4 py-3 text-right text-green-700">{fmt(totalNet)}</td>
                                <td />
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* Salary Slip Modal */}
            {slipEmp && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
                        <div className="flex items-center justify-between px-5 py-4 border-b print:hidden">
                            <h2 className="text-[15px] font-bold">Salary Slip</h2>
                            <div className="flex gap-2">
                                <button onClick={() => window.print()}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] text-white rounded-lg text-[12px] font-medium">
                                    <Printer size={13} /> Print
                                </button>
                                <button onClick={() => setSlipEmp(null)} className="p-1.5 rounded hover:bg-[var(--surface2)]">
                                    <X size={15} />
                                </button>
                            </div>
                        </div>
                        <div id="salary-slip" className="px-5 py-4 text-[12px] space-y-3">
                            <div className="text-center">
                                <div className="text-[16px] font-bold text-[var(--accent)]">Falcon Plus</div>
                                <div className="text-[11px] text-[var(--text3)]">Salary Slip — {MONTHS[month-1]} {year}</div>
                            </div>
                            <div className="bg-[var(--surface)] rounded-lg p-3 space-y-1 text-[11px]">
                                <div className="flex justify-between"><span className="text-[var(--text3)]">Name</span><span className="font-semibold">{slipEmp.name}</span></div>
                                <div className="flex justify-between"><span className="text-[var(--text3)]">Employee ID</span><span className="font-mono">{slipEmp.employeeId}</span></div>
                                <div className="flex justify-between"><span className="text-[var(--text3)]">Designation</span><span>{slipEmp.designation}</span></div>
                                <div className="flex justify-between"><span className="text-[var(--text3)]">Month</span><span>{MONTHS[month-1]} {year}</span></div>
                            </div>
                            <div className="border border-[var(--border)] rounded-lg overflow-hidden">
                                <div className="bg-[var(--surface)] px-3 py-1.5 font-semibold text-[11px] text-[var(--text3)] uppercase tracking-wide">Earnings</div>
                                <div className="px-3 py-2 space-y-1.5">
                                    <div className="flex justify-between">
                                        <span className="text-[var(--text3)]">Hourly Rate</span>
                                        <span>₹{slipEmp.hourlyRate}/hr</span>
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
                                        <>
                                            <div className="flex justify-between text-purple-700">
                                                <span>OT Hours ({slipEmp.otHrs} hrs × ₹{slipEmp.hourlyRate} × 1.5)</span>
                                                <span className="font-semibold">+{fmt(slipEmp.otPay)}</span>
                                            </div>
                                        </>
                                    )}
                                    <div className="flex justify-between border-t border-[var(--border)] pt-1.5 font-bold text-[var(--accent)]">
                                        <span>Total Salary</span>
                                        <span>{fmt(slipEmp.totalSalary)}</span>
                                    </div>
                                </div>
                                {slipEmp.advance > 0 && (
                                    <>
                                        <div className="bg-[var(--surface)] px-3 py-1.5 font-semibold text-[11px] text-[var(--text3)] uppercase tracking-wide border-t border-[var(--border)]">Deductions</div>
                                        <div className="px-3 py-2">
                                            <div className="flex justify-between text-orange-700">
                                                <span>Advance Salary</span>
                                                <span>-{fmt(slipEmp.advance)}</span>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex justify-between items-center">
                                <span className="font-bold text-[13px] text-green-800">NET PAYABLE</span>
                                <span className="font-bold text-[18px] text-green-700">{fmt(slipEmp.netSalary)}</span>
                            </div>
                            {slipEmp.payrollStatus === "PAID" && (
                                <div className="text-center text-[11px] font-bold text-green-700 bg-green-100 rounded py-1">✓ PAID & CONFIRMED</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
