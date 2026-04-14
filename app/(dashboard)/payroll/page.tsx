"use client"
import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
    Calculator, Download, Loader2, Settings, CheckCircle2,
    IndianRupee, Users, ChevronDown, ChevronUp, Edit2, Save, X, FileSpreadsheet, Printer, BadgeCheck
} from "lucide-react"
import * as XLSX from "xlsx"

// ─── Types ────────────────────────────────────────────────────────────────────
type SalarySalary = {
    basic: number; da: number; washing: number; conveyance: number
    leaveWithWages: number; otherAllowance: number
    otRatePerHour: number; canteenRatePerDay: number; status: string
}

type AttInput = {
    monthDays: number; workedDays: number; otDays: number; canteenDays: number
    penalty: number; advance: number; otherDeductions: number; productionIncentive: number; lwf: number
}

type CalcResult = {
    basicFull: number; daFull: number; hraFull: number; washingFull: number
    conveyanceFull: number; lwwFull: number; bonusFull: number; otherFull: number; grossFullMonth: number
    basicSalary: number; da: number; hra: number; washing: number; conveyance: number
    lwwEarned: number; bonus: number; allowances: number; otDays: number
    overtimePay: number; productionIncentive: number; grossSalary: number
    pfEmployee: number; esiEmployee: number; pfEmployer: number; esiEmployer: number
    pt: number; lwf: number; canteenDays: number; canteen: number
    penalty: number; advance: number; otherDeductions: number; totalDeductions: number
    netSalary: number; ctc: number
    // saved payroll fields
    workingDays?: number; presentDays?: number
}

type EmpRow = {
    id: string; employeeId: string; name: string; designation: string; branch: string
    salary: SalarySalary | null; payroll: CalcResult | null; payrollId: string | null
    payrollStatus: string | null
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

function fmt(n: number) {
    return "₹" + Math.round(n).toLocaleString("en-IN")
}

// ─── Falcon Plus formula (client-side preview) ───────────────────────────────
function calcPreview(sal: SalarySalary, att: AttInput): CalcResult {
    const { basic, da, washing, conveyance, leaveWithWages, otherAllowance, otRatePerHour, canteenRatePerDay } = sal
    const { monthDays, workedDays, otDays, canteenDays, penalty, advance, otherDeductions, productionIncentive, lwf } = att
    const hraFull = (basic + da) * 0.05
    const bonusFull = 7000 / 12
    const grossFullMonth = basic + da + hraFull + washing + conveyance + leaveWithWages + bonusFull + otherAllowance
    const r = (x: number) => Math.round(x / monthDays * workedDays)
    const basicSalary = r(basic), daE = r(da), hraE = r(hraFull)
    const washingE = r(washing), convE = r(conveyance), lwwE = r(leaveWithWages)
    const bonusE = r(bonusFull), otherE = r(otherAllowance)
    const otPay = Math.round(otRatePerHour * otDays * 4)
    const grossSalary = basicSalary + daE + hraE + washingE + convE + lwwE + bonusE + otherE + otPay + (productionIncentive || 0)
    const pfEmployee = workedDays > 26 ? 1800 : Math.round((15000 / 26) * workedDays * 0.12)
    const esiEmployee = Math.ceil((grossSalary - washingE - bonusE) * 0.0075)
    const pt = grossSalary > 10000 ? 200 : (grossSalary > 7500 ? 175 : 0)
    const canteen = canteenDays * canteenRatePerDay
    const totalDeductions = pfEmployee + esiEmployee + pt + (lwf||0) + (otherDeductions||0) + canteen + (penalty||0) + (advance||0)
    const netSalary = grossSalary - totalDeductions
    const pfEmployer = Math.round(15000 * 0.13)
    const esiEmployer = Math.ceil((grossFullMonth - washing - bonusFull) * 0.0325)
    const ctc = grossFullMonth + pfEmployer + esiEmployer
    return {
        basicFull: basic, daFull: da, hraFull, washingFull: washing, conveyanceFull: conveyance,
        lwwFull: leaveWithWages, bonusFull, otherFull: otherAllowance, grossFullMonth,
        basicSalary, da: daE, hra: hraE, washing: washingE, conveyance: convE, lwwEarned: lwwE,
        bonus: bonusE, allowances: otherE, otDays, overtimePay: otPay,
        productionIncentive: productionIncentive || 0, grossSalary,
        pfEmployee, esiEmployee, pfEmployer, esiEmployer, pt, lwf: lwf||0,
        canteenDays, canteen, penalty: penalty||0, advance: advance||0,
        otherDeductions: otherDeductions||0, totalDeductions, netSalary, ctc,
    }
}

// ─── Salary Setup Modal ───────────────────────────────────────────────────────
function SalaryModal({ emp, onClose, onSaved }: {
    emp: EmpRow; onClose: () => void; onSaved: (s: SalarySalary) => void
}) {
    const [form, setForm] = useState<SalarySalary>(emp.salary ?? {
        basic: 0, da: 0, washing: 0, conveyance: 0, leaveWithWages: 0,
        otherAllowance: 0, otRatePerHour: 170, canteenRatePerDay: 55, status: "APPROVED"
    })
    const [saving, setSaving] = useState(false)

    const hra = (form.basic + form.da) * 0.05
    const gross = form.basic + form.da + hra + form.washing + form.conveyance + form.leaveWithWages + (7000/12) + form.otherAllowance

    const save = async () => {
        setSaving(true)
        try {
            const res = await fetch(`/api/payroll/salary-structure/${emp.id}`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form)
            })
            if (!res.ok) throw new Error(await res.text())
            const data = await res.json()
            toast.success("Salary structure saved!")
            onSaved(data)
            onClose()
        } catch {
            toast.error("Failed to save salary structure")
        } finally { setSaving(false) }
    }

    const n = (field: keyof SalarySalary) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm(f => ({ ...f, [field]: parseFloat(e.target.value) || 0 }))

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
                    <div>
                        <h2 className="text-[16px] font-semibold">{emp.name}</h2>
                        <p className="text-[12px] text-[var(--text3)]">Set Salary Components</p>
                    </div>
                    <button onClick={onClose}><X size={18} /></button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        {([
                            ["basic","BASIC",true],["da","DA (Dearness Allowance)",true],
                            ["washing","Washing Allowance",false],["conveyance","Conveyance",false],
                            ["leaveWithWages","Leave With Wages",false],["otherAllowance","Other Allowance",false],
                            ["otRatePerHour","OT Rate/Hour (₹)",false],["canteenRatePerDay","Canteen Rate/Day (₹)",false],
                        ] as [keyof SalarySalary, string, boolean][]).map(([key, label, required]) => (
                            <div key={key}>
                                <label className="text-[11px] font-medium text-[var(--text3)] block mb-1">
                                    {label}{required && <span className="text-red-500 ml-0.5">*</span>}
                                </label>
                                <input type="number" value={form[key] as number}
                                    onChange={n(key)}
                                    className="w-full border border-[var(--border)] rounded-lg px-3 py-1.5 text-[13px] outline-none focus:border-[var(--accent)]" />
                            </div>
                        ))}
                    </div>
                    {/* Auto-calculated preview */}
                    <div className="bg-[var(--surface)] rounded-xl p-4 text-[12px] space-y-1">
                        <div className="font-semibold text-[var(--text)] mb-2">Auto-calculated</div>
                        <div className="flex justify-between"><span className="text-[var(--text3)]">HRA (Basic+DA × 5%)</span><span className="font-medium">₹{Math.round(hra).toLocaleString()}</span></div>
                        <div className="flex justify-between"><span className="text-[var(--text3)]">Statutory Bonus</span><span className="font-medium">₹{Math.round(7000/12).toLocaleString()}</span></div>
                        <div className="flex justify-between border-t border-[var(--border)] pt-1 mt-1">
                            <span className="font-semibold">Full Month GROSS</span>
                            <span className="font-bold text-[var(--accent)]">₹{Math.round(gross).toLocaleString()}</span>
                        </div>
                    </div>
                </div>
                <div className="px-6 py-4 border-t border-[var(--border)] flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-[13px] border border-[var(--border)] rounded-lg">Cancel</button>
                    <button onClick={save} disabled={saving}
                        className="px-4 py-2 text-[13px] bg-[var(--accent)] text-white rounded-lg flex items-center gap-2 disabled:opacity-60">
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PayrollPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [month, setMonth] = useState(new Date().getMonth() + 1)
    const [year, setYear]   = useState(new Date().getFullYear())
    const [employees, setEmployees] = useState<EmpRow[]>([])
    const [loading, setLoading] = useState(true)
    const [processing, setProcessing] = useState(false)
    const [salaryModal, setSalaryModal] = useState<EmpRow | null>(null)
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [tab, setTab] = useState<"payroll"|"setup">("payroll")
    const [slipEmployee, setSlipEmployee] = useState<{ emp: EmpRow; att: AttInput; preview: CalcResult } | null>(null)
    // Attendance inputs per employee
    const [attInputs, setAttInputs] = useState<Record<string, AttInput>>({})

    const defaultAtt = useCallback((): AttInput => ({
        monthDays: new Date(year, month, 0).getDate(),
        workedDays: new Date(year, month, 0).getDate(),
        otDays: 0, canteenDays: 0, penalty: 0, advance: 0,
        otherDeductions: 0, productionIncentive: 0, lwf: 0
    }), [month, year])

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const [empRes, payRes, advRes, leaveRes] = await Promise.all([
                fetch("/api/employees?limit=1000"),
                fetch(`/api/payroll?month=${month}&year=${year}&limit=1000`),
                fetch(`/api/advances?month=${month}&year=${year}`),
                fetch(`/api/leaves?month=${year}-${String(month).padStart(2,"0")}&status=APPROVED`),
            ])
            const emps   = empRes.ok   ? await empRes.json()   : []
            const pays   = payRes.ok   ? await payRes.json()   : []
            const advances = advRes.ok ? await advRes.json()   : []
            const leaves   = leaveRes.ok ? await leaveRes.json() : []

            const rows: EmpRow[] = (emps.data ?? emps).map((e: any) => {
                const pay = pays.find((p: any) => p.employeeId === e.id)
                return {
                    id: e.id, employeeId: e.employeeId,
                    name: `${e.firstName} ${e.lastName}`,
                    designation: e.designation ?? "-",
                    branch: e.branch?.name ?? "-",
                    salary: e.employeeSalary ?? null,
                    payroll: pay ?? null,
                    payrollId: pay?.id ?? null,
                    payrollStatus: pay?.status ?? null,
                }
            })
            setEmployees(rows)

            const mDays = new Date(year, month, 0).getDate()

            // Init attendance inputs from saved payroll or defaults + auto-fill advance & leave
            const init: Record<string, AttInput> = {}
            rows.forEach(r => {
                // Auto-sum advances for this employee this month
                const autoAdvance = (Array.isArray(advances) ? advances : [])
                    .filter((a: any) => a.employeeId === r.id)
                    .reduce((s: number, a: any) => s + (a.amount ?? 0), 0)

                // Auto-calc leave days
                const empLeaves = (Array.isArray(leaves) ? leaves : []).filter((l: any) => l.employeeId === r.id)
                let leaveDays = 0
                for (const lv of empLeaves) {
                    const start = new Date(lv.startDate)
                    const end   = new Date(lv.endDate)
                    leaveDays  += Math.round((end.getTime() - start.getTime()) / 86400000) + 1
                }
                const autoWorkedDays = Math.max(0, mDays - leaveDays)

                if (r.payroll) {
                    init[r.id] = {
                        monthDays:           r.payroll.workingDays ?? mDays,
                        workedDays:          r.payroll.presentDays ?? mDays,
                        otDays:              r.payroll.otDays ?? 0,
                        canteenDays:         r.payroll.canteenDays ?? 0,
                        penalty:             r.payroll.penalty ?? 0,
                        advance:             autoAdvance > 0 ? autoAdvance : (r.payroll.advance ?? 0),
                        otherDeductions:     r.payroll.otherDeductions ?? 0,
                        productionIncentive: r.payroll.productionIncentive ?? 0,
                        lwf:                 r.payroll.lwf ?? 0,
                    } as AttInput
                } else {
                    init[r.id] = {
                        ...defaultAtt(),
                        advance: autoAdvance,
                        workedDays: autoWorkedDays,
                    }
                }
            })
            setAttInputs(init)
        } catch (e) {
            console.error(e)
        } finally { setLoading(false) }
    }, [month, year, defaultAtt])

    useEffect(() => {
        if (status === "unauthenticated") router.push("/login")
        else if (status === "authenticated") loadData()
    }, [status, router, loadData])

    const setAtt = (empId: string, field: keyof AttInput, val: number) => {
        setAttInputs(prev => ({
            ...prev,
            [empId]: { ...(prev[empId] ?? defaultAtt()), [field]: val }
        }))
    }

    const processPayroll = async () => {
        setProcessing(true)
        try {
            const attendance = Object.entries(attInputs).map(([employeeId, att]) => ({ employeeId, ...att }))
            const res = await fetch("/api/payroll/calculate", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ month, year, attendance })
            })
            if (!res.ok) throw new Error(await res.text())
            const data = await res.json()
            toast.success(`Payroll processed for ${data.processedCount} employees!`)
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
            toast.success("Payroll marked as PAID ✓")
            setEmployees(prev => prev.map(e => e.payrollId === payrollId ? { ...e, payrollStatus: "PAID" } : e))
        } catch (e: any) {
            toast.error(e.message || "Failed to mark as paid")
        }
    }

    const exportExcel = async () => {
        try {
            const res = await fetch(`/api/payroll/export?month=${month}&year=${year}`)
            if (!res.ok) throw new Error("No payroll data found. Process payroll first.")
            const rows = await res.json()
            const ws = XLSX.utils.json_to_sheet(rows)
            const wb = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(wb, ws, "STRUCTURE")
            XLSX.writeFile(wb, `FalconPlus_Payroll_${MONTHS[month-1]}_${year}.xlsx`)
            toast.success("Excel downloaded!")
        } catch (e: any) { toast.error(e.message) }
    }

    if (status === "loading" || loading) {
        return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="animate-spin text-[var(--accent)]" /></div>
    }
    if (session?.user?.role !== "ADMIN" && session?.user?.role !== "MANAGER") {
        return <div className="p-8 text-center text-red-500">Access Denied</div>
    }

    const withSalary  = employees.filter(e => e.salary)
    const noSalary    = employees.filter(e => !e.salary)
    const processed   = employees.filter(e => e.payroll)

    // Summary totals
    const totalGross = processed.reduce((s, e) => s + (e.payroll?.grossSalary ?? 0), 0)
    const totalNet   = processed.reduce((s, e) => s + (e.payroll?.netSalary ?? 0), 0)
    const totalPF    = processed.reduce((s, e) => s + (e.payroll?.pfEmployee ?? 0), 0)
    const totalESIC  = processed.reduce((s, e) => s + (e.payroll?.esiEmployee ?? 0), 0)
    const totalCTC   = processed.reduce((s, e) => s + (e.payroll?.ctc ?? 0), 0)

    return (
        <div className="space-y-5 max-w-screen-2xl mx-auto pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-[22px] font-semibold text-[var(--text)]">Payroll</h1>
                    <p className="text-[13px] text-[var(--text3)]">Falcon Plus salary structure — net salary calculator</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    {/* Month/Year selector */}
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
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                    { label: "Gross Salary", value: fmt(totalGross), color: "text-[var(--accent)]" },
                    { label: "Net Salary", value: fmt(totalNet), color: "text-green-600" },
                    { label: "PF (Employee)", value: fmt(totalPF), color: "text-blue-600" },
                    { label: "ESIC (Employee)", value: fmt(totalESIC), color: "text-orange-600" },
                    { label: "Total CTC", value: fmt(totalCTC), color: "text-purple-600" },
                ].map(card => (
                    <div key={card.label} className="bg-white border border-[var(--border)] rounded-xl p-4">
                        <p className="text-[11px] text-[var(--text3)] mb-1">{card.label}</p>
                        <p className={`text-[18px] font-bold ${card.color}`}>{card.value}</p>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-[var(--surface)] rounded-xl p-1 w-fit">
                {[["payroll","Calculate Payroll"],["setup","Salary Setup"]] .map(([t, label]) => (
                    <button key={t} onClick={() => setTab(t as any)}
                        className={`px-4 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${tab === t ? "bg-white text-[var(--text)] shadow-sm" : "text-[var(--text3)] hover:text-[var(--text)]"}`}>
                        {label}
                    </button>
                ))}
            </div>

            {/* ── TAB: PAYROLL CALCULATOR ── */}
            {tab === "payroll" && (
                <div className="space-y-3">
                    {noSalary.length > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-[13px] text-amber-800">
                            ⚠️ {noSalary.length} employees have no salary structure set. Go to <b>Salary Setup</b> tab.
                        </div>
                    )}

                    {/* Table */}
                    <div className="bg-white border border-[var(--border)] rounded-xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-[12px]">
                                <thead>
                                    <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
                                        <th className="px-3 py-3 text-left font-semibold text-[var(--text3)] w-8">#</th>
                                        <th className="px-3 py-3 text-left font-semibold text-[var(--text3)]">Employee</th>
                                        <th className="px-3 py-3 text-center font-semibold text-[var(--text3)]">Month Days</th>
                                        <th className="px-3 py-3 text-center font-semibold text-[var(--text3)]">LOP</th>
                                        <th className="px-3 py-3 text-center font-semibold text-[var(--text3)]">Worked</th>
                                        <th className="px-3 py-3 text-center font-semibold text-[var(--text3)]">OT Days</th>
                                        <th className="px-3 py-3 text-center font-semibold text-[var(--text3)]">Canteen Days</th>
                                        <th className="px-3 py-3 text-right font-semibold text-[var(--text3)]">Gross</th>
                                        <th className="px-3 py-3 text-right font-semibold text-[var(--text3)]">Deductions</th>
                                        <th className="px-3 py-3 text-right font-semibold text-green-700">NET</th>
                                        <th className="px-3 py-3 text-right font-semibold text-purple-700">CTC</th>
                                        <th className="px-3 py-3 text-center font-semibold text-[var(--text3)]">Detail</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border)]">
                                    {employees.map((emp, idx) => {
                                        const att = attInputs[emp.id] ?? defaultAtt()
                                        const lop = att.monthDays - att.workedDays
                                        const preview = emp.salary ? calcPreview(emp.salary, att) : null
                                        const isExpanded = expandedId === emp.id

                                        return (
                                            <>
                                                <tr key={emp.id} className="hover:bg-[var(--surface)]">
                                                    <td className="px-3 py-2 text-[var(--text3)]">{idx+1}</td>
                                                    <td className="px-3 py-2">
                                                        <div className="font-medium text-[var(--text)]">{emp.name}</div>
                                                        <div className="text-[10px] text-[var(--text3)]">{emp.employeeId} · {emp.designation}</div>
                                                    </td>
                                                    {/* Attendance inputs */}
                                                    <td className="px-2 py-2">
                                                        <input type="number" value={att.monthDays}
                                                            onChange={e => setAtt(emp.id, "monthDays", +e.target.value)}
                                                            className="w-14 border border-[var(--border)] rounded px-2 py-1 text-center text-[12px] outline-none focus:border-[var(--accent)]" />
                                                    </td>
                                                    <td className="px-2 py-2 text-center font-medium text-red-600">{lop}</td>
                                                    <td className="px-2 py-2">
                                                        <input type="number" value={att.workedDays}
                                                            onChange={e => setAtt(emp.id, "workedDays", +e.target.value)}
                                                            className="w-14 border border-[var(--border)] rounded px-2 py-1 text-center text-[12px] outline-none focus:border-[var(--accent)]" />
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        <input type="number" step="0.25" value={att.otDays}
                                                            onChange={e => setAtt(emp.id, "otDays", +e.target.value)}
                                                            className="w-14 border border-[var(--border)] rounded px-2 py-1 text-center text-[12px] outline-none focus:border-[var(--accent)]" />
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        <input type="number" value={att.canteenDays}
                                                            onChange={e => setAtt(emp.id, "canteenDays", +e.target.value)}
                                                            className="w-14 border border-[var(--border)] rounded px-2 py-1 text-center text-[12px] outline-none focus:border-[var(--accent)]" />
                                                    </td>
                                                    <td className="px-3 py-2 text-right font-medium">
                                                        {preview ? fmt(preview.grossSalary) : <span className="text-[var(--text3)]">—</span>}
                                                    </td>
                                                    <td className="px-3 py-2 text-right text-red-600">
                                                        {preview ? fmt(preview.totalDeductions) : "—"}
                                                    </td>
                                                    <td className="px-3 py-2 text-right font-bold text-green-700">
                                                        {preview ? fmt(preview.netSalary) : "—"}
                                                    </td>
                                                    <td className="px-3 py-2 text-right font-medium text-purple-700">
                                                        {preview ? fmt(preview.ctc) : "—"}
                                                    </td>
                                                    <td className="px-3 py-2 text-center">
                                                        <div className="flex items-center justify-center gap-1">
                                                            {emp.payrollId && emp.payrollStatus !== "PAID" && (
                                                                <button onClick={() => markPaid(emp.payrollId!)}
                                                                    title="Mark as PAID"
                                                                    className="p-1 rounded hover:bg-green-50 text-green-600">
                                                                    <BadgeCheck size={15} />
                                                                </button>
                                                            )}
                                                            {emp.payrollStatus === "PAID" && (
                                                                <span className="text-[10px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded">PAID</span>
                                                            )}
                                                            {preview && (
                                                                <button onClick={() => setSlipEmployee({ emp, att, preview })}
                                                                    title="Salary Slip"
                                                                    className="p-1 rounded hover:bg-blue-50 text-blue-500">
                                                                    <Printer size={15} />
                                                                </button>
                                                            )}
                                                            <button onClick={() => setExpandedId(isExpanded ? null : emp.id)}
                                                                className="p-1 text-[var(--text3)] hover:text-[var(--accent)]">
                                                                {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {/* Expanded detail row */}
                                                {isExpanded && preview && (
                                                    <tr key={`${emp.id}-detail`}>
                                                        <td colSpan={12} className="bg-[var(--surface)] px-6 py-4">
                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[12px]">
                                                                {/* Earnings */}
                                                                <div>
                                                                    <div className="font-semibold text-[var(--text)] mb-2">Full Month Earnings</div>
                                                                    {[
                                                                        ["BASIC", preview.basicFull],["DA", preview.daFull],
                                                                        ["HRA (5%)", preview.hraFull],["Washing", preview.washingFull],
                                                                        ["Conveyance", preview.conveyanceFull],["Bonus (₹7000/12)", preview.bonusFull],
                                                                    ].map(([k, v]) => (
                                                                        <div key={k as string} className="flex justify-between py-0.5">
                                                                            <span className="text-[var(--text3)]">{k}</span>
                                                                            <span>₹{Math.round(v as number).toLocaleString()}</span>
                                                                        </div>
                                                                    ))}
                                                                    <div className="flex justify-between border-t border-[var(--border)] pt-1 mt-1 font-semibold">
                                                                        <span>GROSS Full</span><span>₹{Math.round(preview.grossFullMonth).toLocaleString()}</span>
                                                                    </div>
                                                                </div>
                                                                {/* Earned */}
                                                                <div>
                                                                    <div className="font-semibold text-[var(--text)] mb-2">Earned ({att.workedDays}/{att.monthDays} days)</div>
                                                                    {[
                                                                        ["BASIC", preview.basicSalary],["DA", preview.da],
                                                                        ["HRA", preview.hra],["Washing", preview.washing],
                                                                        ["Bonus", preview.bonus],["OT Pay", preview.overtimePay],
                                                                    ].map(([k, v]) => (
                                                                        <div key={k as string} className="flex justify-between py-0.5">
                                                                            <span className="text-[var(--text3)]">{k}</span>
                                                                            <span>₹{Math.round(v as number).toLocaleString()}</span>
                                                                        </div>
                                                                    ))}
                                                                    <div className="flex justify-between border-t border-[var(--border)] pt-1 mt-1 font-semibold text-[var(--accent)]">
                                                                        <span>GROSS Earned</span><span>₹{preview.grossSalary.toLocaleString()}</span>
                                                                    </div>
                                                                </div>
                                                                {/* Deductions + Net */}
                                                                <div>
                                                                    <div className="font-semibold text-[var(--text)] mb-2">Deductions & Net</div>
                                                                    {[
                                                                        ["PF (Employee)", preview.pfEmployee],
                                                                        ["ESIC (0.75%)", preview.esiEmployee],
                                                                        ["PT", preview.pt],
                                                                        ["Canteen", preview.canteen],
                                                                        ...(preview.penalty > 0 ? [["Penalty", preview.penalty]] : []),
                                                                        ...(preview.otherDeductions > 0 ? [["Other Deductions", preview.otherDeductions]] : []),
                                                                        ...(preview.lwf > 0 ? [["LWF", preview.lwf]] : []),
                                                                    ].map(([k, v]) => (
                                                                        <div key={k as string} className="flex justify-between py-0.5">
                                                                            <span className="text-[var(--text3)]">{k}</span>
                                                                            <span className="text-red-600">-₹{Math.round(v as number).toLocaleString()}</span>
                                                                        </div>
                                                                    ))}
                                                                    {preview.advance > 0 && (
                                                                        <div className="flex justify-between py-0.5 bg-orange-50 rounded px-1">
                                                                            <span className="text-orange-700 font-medium">Advance Salary</span>
                                                                            <span className="text-orange-700 font-medium">-₹{Math.round(preview.advance).toLocaleString()}</span>
                                                                        </div>
                                                                    )}
                                                                    {att.workedDays < att.monthDays && (
                                                                        <div className="flex justify-between py-0.5 bg-yellow-50 rounded px-1">
                                                                            <span className="text-yellow-700 font-medium">Leave Cut ({att.monthDays - att.workedDays} days)</span>
                                                                            <span className="text-yellow-700 font-medium">-₹{Math.round((preview.basicSalary / att.workedDays || 0) * (att.monthDays - att.workedDays)).toLocaleString()}</span>
                                                                        </div>
                                                                    )}
                                                                    <div className="flex justify-between border-t border-[var(--border)] pt-1 mt-1 font-bold text-green-700">
                                                                        <span>NET SALARY</span><span>₹{preview.netSalary.toLocaleString()}</span>
                                                                    </div>
                                                                    <div className="flex justify-between mt-1 text-[var(--text3)]">
                                                                        <span>Employer PF</span><span>₹{preview.pfEmployer.toLocaleString()}</span>
                                                                    </div>
                                                                    <div className="flex justify-between text-[var(--text3)]">
                                                                        <span>Employer ESIC</span><span>₹{preview.esiEmployer.toLocaleString()}</span>
                                                                    </div>
                                                                    <div className="flex justify-between border-t border-[var(--border)] pt-1 mt-1 font-semibold text-purple-700">
                                                                        <span>CTC</span><span>₹{Math.round(preview.ctc).toLocaleString()}</span>
                                                                    </div>
                                                                    {/* Extra deductions inputs */}
                                                                    <div className="mt-3 space-y-1.5">
                                                                        {(["penalty","advance","otherDeductions","lwf","productionIncentive"] as (keyof AttInput)[]).map(f => (
                                                                            <div key={f} className="flex items-center justify-between gap-2">
                                                                                <span className="text-[var(--text3)] capitalize">{f === "productionIncentive" ? "Prod. Incentive (+)" : f}</span>
                                                                                <input type="number" value={att[f] as number}
                                                                                    onChange={e => setAtt(emp.id, f, +e.target.value)}
                                                                                    className="w-20 border border-[var(--border)] rounded px-2 py-0.5 text-right text-[12px] outline-none focus:border-[var(--accent)]" />
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ── TAB: SALARY SETUP ── */}
            {tab === "setup" && (
                <div className="bg-white border border-[var(--border)] rounded-xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
                        <div>
                            <h2 className="text-[14px] font-semibold">Salary Structure Setup</h2>
                            <p className="text-[12px] text-[var(--text3)]">Set BASIC, DA, allowances per employee. HRA & Bonus auto-calculated.</p>
                        </div>
                        <div className="flex items-center gap-2 text-[12px] text-[var(--text3)]">
                            <CheckCircle2 size={14} className="text-green-500" />{withSalary.length} set
                            <Users size={14} className="text-amber-500 ml-2" />{noSalary.length} pending
                        </div>
                    </div>
                    <table className="w-full text-[12px]">
                        <thead>
                            <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
                                <th className="px-4 py-3 text-left text-[var(--text3)] font-semibold">Employee</th>
                                <th className="px-4 py-3 text-right text-[var(--text3)] font-semibold">BASIC</th>
                                <th className="px-4 py-3 text-right text-[var(--text3)] font-semibold">DA</th>
                                <th className="px-4 py-3 text-right text-[var(--text3)] font-semibold">HRA (auto)</th>
                                <th className="px-4 py-3 text-right text-[var(--text3)] font-semibold">Washing</th>
                                <th className="px-4 py-3 text-right text-[var(--text3)] font-semibold">Full Gross</th>
                                <th className="px-4 py-3 text-right text-[var(--text3)] font-semibold">CTC/Month</th>
                                <th className="px-4 py-3 text-center text-[var(--text3)] font-semibold">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                            {employees.map(emp => {
                                const s = emp.salary
                                const hra   = s ? (s.basic + s.da) * 0.05 : 0
                                const gross = s ? s.basic + s.da + hra + s.washing + s.conveyance + s.leaveWithWages + (7000/12) + s.otherAllowance : 0
                                const ctc   = s ? gross + 1950 + Math.ceil((gross - s.washing - 7000/12) * 0.0325) : 0
                                return (
                                    <tr key={emp.id} className="hover:bg-[var(--surface)]">
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-[var(--text)]">{emp.name}</div>
                                            <div className="text-[10px] text-[var(--text3)]">{emp.employeeId} · {emp.branch}</div>
                                        </td>
                                        <td className="px-4 py-3 text-right">{s ? fmt(s.basic) : <span className="text-[var(--text3)]">—</span>}</td>
                                        <td className="px-4 py-3 text-right">{s ? fmt(s.da) : "—"}</td>
                                        <td className="px-4 py-3 text-right text-[var(--text3)]">{s ? fmt(hra) : "—"}</td>
                                        <td className="px-4 py-3 text-right">{s ? fmt(s.washing) : "—"}</td>
                                        <td className="px-4 py-3 text-right font-medium">{s ? fmt(gross) : "—"}</td>
                                        <td className="px-4 py-3 text-right font-semibold text-purple-700">{s ? fmt(ctc) : "—"}</td>
                                        <td className="px-4 py-3 text-center">
                                            <button onClick={() => setSalaryModal(emp)}
                                                className="inline-flex items-center gap-1.5 text-[var(--accent)] hover:underline font-medium">
                                                <Edit2 size={12} /> {s ? "Edit" : "Setup"}
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Salary Setup Modal */}
            {salaryModal && (
                <SalaryModal
                    emp={salaryModal}
                    onClose={() => setSalaryModal(null)}
                    onSaved={(sal) => {
                        setEmployees(prev => prev.map(e => e.id === salaryModal.id ? { ...e, salary: sal } : e))
                        setSalaryModal(null)
                    }}
                />
            )}

            {/* Salary Slip Modal */}
            {slipEmployee && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        {/* Print header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b print:hidden">
                            <h2 className="text-[15px] font-bold">Salary Slip</h2>
                            <div className="flex gap-2">
                                <button onClick={() => window.print()}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] text-white rounded-lg text-[13px] font-medium">
                                    <Printer size={13} /> Print
                                </button>
                                <button onClick={() => setSlipEmployee(null)} className="p-1.5 rounded hover:bg-[var(--surface2)]"><X size={15} /></button>
                            </div>
                        </div>
                        {/* Slip content */}
                        <div id="salary-slip" className="px-6 py-5 text-[12px]">
                            {/* Company & Employee Info */}
                            <div className="text-center mb-4">
                                <div className="text-[16px] font-bold text-[var(--accent)]">Falcon Plus</div>
                                <div className="text-[11px] text-[var(--text3)]">Salary Slip — {MONTHS[month-1]} {year}</div>
                            </div>
                            <div className="grid grid-cols-2 gap-1 mb-4 p-3 bg-[var(--surface)] rounded-lg text-[11px]">
                                <div><span className="text-[var(--text3)]">Name: </span><span className="font-semibold">{slipEmployee.emp.name}</span></div>
                                <div><span className="text-[var(--text3)]">ID: </span><span className="font-semibold">{slipEmployee.emp.employeeId}</span></div>
                                <div><span className="text-[var(--text3)]">Designation: </span><span>{slipEmployee.emp.designation}</span></div>
                                <div><span className="text-[var(--text3)]">Month: </span><span>{MONTHS[month-1]} {year}</span></div>
                                <div><span className="text-[var(--text3)]">Total Days: </span><span>{slipEmployee.att.monthDays}</span></div>
                                <div><span className="text-[var(--text3)]">Present Days: </span><span className="font-semibold text-green-700">{slipEmployee.att.workedDays}</span></div>
                                <div><span className="text-[var(--text3)]">Absent Days: </span><span className="font-semibold text-red-600">{slipEmployee.att.monthDays - slipEmployee.att.workedDays}</span></div>
                                <div><span className="text-[var(--text3)]">OT Days: </span><span>{slipEmployee.att.otDays}</span></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                {/* Earnings */}
                                <div>
                                    <div className="font-bold text-[var(--text)] mb-2 border-b border-[var(--border)] pb-1">EARNINGS</div>
                                    {[
                                        ["Basic", slipEmployee.preview.basicSalary],
                                        ["DA", slipEmployee.preview.da],
                                        ["HRA", slipEmployee.preview.hra],
                                        ["Washing", slipEmployee.preview.washing],
                                        ["Conveyance", slipEmployee.preview.conveyance],
                                        ["Leave With Wages", slipEmployee.preview.lwwEarned],
                                        ["Bonus", slipEmployee.preview.bonus],
                                        ["OT Pay", slipEmployee.preview.overtimePay],
                                        ["Prod. Incentive", slipEmployee.preview.productionIncentive],
                                    ].filter(([,v]) => (v as number) > 0).map(([k, v]) => (
                                        <div key={k as string} className="flex justify-between py-0.5">
                                            <span className="text-[var(--text3)]">{k}</span>
                                            <span>{fmt(v as number)}</span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between border-t border-[var(--border)] pt-1 mt-1 font-bold text-[var(--accent)]">
                                        <span>Gross Earned</span><span>{fmt(slipEmployee.preview.grossSalary)}</span>
                                    </div>
                                </div>
                                {/* Deductions */}
                                <div>
                                    <div className="font-bold text-[var(--text)] mb-2 border-b border-[var(--border)] pb-1">DEDUCTIONS</div>
                                    {[
                                        ["PF (Employee)", slipEmployee.preview.pfEmployee],
                                        ["ESIC (0.75%)", slipEmployee.preview.esiEmployee],
                                        ["PT", slipEmployee.preview.pt],
                                        ["Canteen", slipEmployee.preview.canteen],
                                        ["Penalty", slipEmployee.preview.penalty],
                                        ["Other Deductions", slipEmployee.preview.otherDeductions],
                                        ["LWF", slipEmployee.preview.lwf],
                                    ].filter(([,v]) => (v as number) > 0).map(([k, v]) => (
                                        <div key={k as string} className="flex justify-between py-0.5">
                                            <span className="text-[var(--text3)]">{k}</span>
                                            <span className="text-red-600">-{fmt(v as number)}</span>
                                        </div>
                                    ))}
                                    {slipEmployee.preview.advance > 0 && (
                                        <div className="flex justify-between py-0.5 bg-orange-50 rounded px-1">
                                            <span className="text-orange-700 font-medium">Advance Salary</span>
                                            <span className="text-orange-700 font-medium">-{fmt(slipEmployee.preview.advance)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between border-t border-[var(--border)] pt-1 mt-1 font-bold text-red-700">
                                        <span>Total Deductions</span><span>-{fmt(slipEmployee.preview.totalDeductions)}</span>
                                    </div>
                                </div>
                            </div>
                            {/* Net */}
                            <div className="mt-4 p-3 bg-green-50 rounded-lg flex justify-between items-center border border-green-200">
                                <span className="font-bold text-[14px] text-green-800">NET SALARY PAYABLE</span>
                                <span className="font-bold text-[18px] text-green-700">{fmt(slipEmployee.preview.netSalary)}</span>
                            </div>
                            {slipEmployee.emp.payrollStatus === "PAID" && (
                                <div className="mt-2 text-center text-[11px] font-bold text-green-700 bg-green-100 rounded py-1">✓ PAID & CONFIRMED</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
