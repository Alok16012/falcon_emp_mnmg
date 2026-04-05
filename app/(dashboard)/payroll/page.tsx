"use client"
import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
    ChevronLeft, ChevronRight, Loader2, X, Plus,
    Download, CheckCircle, Clock, DollarSign, Users,
    Building2, Printer, TrendingUp
} from "lucide-react"

type Payroll = {
    id: string
    employeeId: string
    month: number
    year: number
    basicSalary: number
    hra: number
    allowances: number
    overtimePay: number
    grossSalary: number
    pfEmployee: number
    esiEmployee: number
    tds: number
    otherDeductions: number
    netSalary: number
    workingDays: number
    presentDays: number
    status: string
    processedAt?: string
    employee: {
        id: string
        firstName: string
        lastName: string
        employeeId: string
        designation?: string
        photo?: string
        branch: { name: string }
        department?: { name: string }
    }
}

type Employee = {
    id: string
    firstName: string
    lastName: string
    employeeId: string
    basicSalary: number
    designation?: string
    photo?: string
    branch: { name: string }
    department?: { name: string }
}

type Branch = { id: string; name: string }

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
    DRAFT: { label: "Draft", color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb" },
    PROCESSED: { label: "Processed", color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe" },
    PAID: { label: "Paid", color: "#1a9e6e", bg: "#e8f7f1", border: "#6ee7b7" },
}

function Avatar({ firstName, lastName, photo, size = 36 }: { firstName: string; lastName: string; photo?: string; size?: number }) {
    const initials = `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase()
    const colors = ["#1a9e6e", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444"]
    const bg = colors[(firstName.charCodeAt(0) + lastName.charCodeAt(0)) % colors.length]
    if (photo) return <img src={photo} alt="" style={{ width: size, height: size }} className="rounded-full object-cover" />
    return <div style={{ width: size, height: size, background: bg }} className="rounded-full flex items-center justify-center text-white font-semibold text-[12px]">{initials}</div>
}

function ProcessPayrollModal({
    open, onClose, onSaved, month, year, existingEmployeeIds
}: {
    open: boolean
    onClose: () => void
    onSaved: () => void
    month: number
    year: number
    existingEmployeeIds: string[]
}) {
    const [loading, setLoading] = useState(false)
    const [employees, setEmployees] = useState<Employee[]>([])
    const [selected, setSelected] = useState<string[]>([])
    const [overrides, setOverrides] = useState<Record<string, { hra?: string; allowances?: string; overtimePay?: string; presentDays?: string; tds?: string; otherDeductions?: string }>>({})

    useEffect(() => {
        if (open) {
            fetch("/api/employees?status=ACTIVE")
                .then(r => r.json())
                .then(data => {
                    const emps = Array.isArray(data) ? data : []
                    setEmployees(emps.filter((e: Employee) => !existingEmployeeIds.includes(e.id)))
                })
                .catch(() => {})
        }
    }, [open, existingEmployeeIds])

    const handleProcess = async () => {
        if (selected.length === 0) return toast.error("Select at least one employee")
        setLoading(true)
        let success = 0
        let failed = 0
        for (const empId of selected) {
            const emp = employees.find(e => e.id === empId)
            if (!emp) continue
            const o = overrides[empId] || {}
            try {
                const res = await fetch("/api/payroll", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        employeeId: empId,
                        month,
                        year,
                        hra: o.hra || undefined,
                        allowances: o.allowances || undefined,
                        overtimePay: o.overtimePay || undefined,
                        presentDays: o.presentDays || undefined,
                        tds: o.tds || undefined,
                        otherDeductions: o.otherDeductions || undefined,
                    }),
                })
                if (res.ok) success++
                else failed++
            } catch {
                failed++
            }
        }
        setLoading(false)
        if (success > 0) toast.success(`Processed payroll for ${success} employee${success > 1 ? "s" : ""}`)
        if (failed > 0) toast.error(`Failed for ${failed} employee${failed > 1 ? "s" : ""}`)
        onSaved()
        onClose()
        setSelected([])
    }

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-[16px] border border-[var(--border)] w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-xl">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
                    <div>
                        <h2 className="text-[15px] font-semibold text-[var(--text)]">Process Payroll</h2>
                        <p className="text-[12px] text-[var(--text3)]">{MONTHS[month - 1]} {year}</p>
                    </div>
                    <button onClick={onClose} className="p-1 text-[var(--text3)] hover:text-[var(--text)] rounded-md hover:bg-[var(--surface2)] transition-colors"><X size={18} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                    {employees.length === 0 ? (
                        <p className="text-center text-[13px] text-[var(--text3)] py-8">All active employees already have payroll for this month</p>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 mb-4">
                                <input type="checkbox" id="selectAll"
                                    checked={selected.length === employees.length && employees.length > 0}
                                    onChange={e => setSelected(e.target.checked ? employees.map(e => e.id) : [])}
                                    className="rounded" />
                                <label htmlFor="selectAll" className="text-[13px] font-medium text-[var(--text)]">Select All ({employees.length})</label>
                            </div>
                            {employees.map(emp => {
                                const isSelected = selected.includes(emp.id)
                                const o = overrides[emp.id] || {}
                                const basic = emp.basicSalary
                                const hra = parseFloat(o.hra || "") || basic * 0.4
                                const allowances = parseFloat(o.allowances || "") || 0
                                const overtime = parseFloat(o.overtimePay || "") || 0
                                const gross = basic + hra + allowances + overtime
                                const pf = basic * 0.12
                                const esi = gross < 21000 ? gross * 0.0075 : 0
                                const net = gross - pf - esi - (parseFloat(o.tds || "") || 0) - (parseFloat(o.otherDeductions || "") || 0)

                                return (
                                    <div key={emp.id} className={`border rounded-[12px] transition-colors ${isSelected ? "border-[var(--accent)] bg-[var(--accent-light)]" : "border-[var(--border)]"}`}>
                                        <div className="flex items-center gap-3 p-3">
                                            <input type="checkbox" checked={isSelected}
                                                onChange={e => setSelected(prev => e.target.checked ? [...prev, emp.id] : prev.filter(id => id !== emp.id))}
                                                className="rounded shrink-0" />
                                            <Avatar firstName={emp.firstName} lastName={emp.lastName} photo={emp.photo} size={32} />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[13px] font-medium text-[var(--text)]">{emp.firstName} {emp.lastName}</p>
                                                <p className="text-[11px] text-[var(--text3)]">{emp.employeeId} · Basic: ₹{basic.toLocaleString()}</p>
                                            </div>
                                            {isSelected && (
                                                <div className="text-right">
                                                    <p className="text-[13px] font-semibold text-[var(--accent-text)]">₹{Math.round(net).toLocaleString()}</p>
                                                    <p className="text-[10.5px] text-[var(--text3)]">Net Pay</p>
                                                </div>
                                            )}
                                        </div>
                                        {isSelected && (
                                            <div className="border-t border-[var(--border)] p-3 grid grid-cols-3 gap-2">
                                                {[
                                                    { key: "hra", label: `HRA (${Math.round(hra).toLocaleString()})`, placeholder: "Override HRA" },
                                                    { key: "allowances", label: "Allowances", placeholder: "0" },
                                                    { key: "overtimePay", label: "OT Pay", placeholder: "0" },
                                                    { key: "presentDays", label: "Present Days", placeholder: "26" },
                                                    { key: "tds", label: "TDS", placeholder: "0" },
                                                    { key: "otherDeductions", label: "Other Deductions", placeholder: "0" },
                                                ].map(f => (
                                                    <div key={f.key}>
                                                        <label className="block text-[10.5px] text-[var(--text3)] mb-1">{f.label}</label>
                                                        <input type="number" placeholder={f.placeholder}
                                                            value={(o as Record<string, string>)[f.key] || ""}
                                                            onChange={e => setOverrides(prev => ({ ...prev, [emp.id]: { ...prev[emp.id], [f.key]: e.target.value } }))}
                                                            className="w-full h-7 rounded-[6px] border border-[var(--border)] bg-white px-2 text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors" />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                <div className="px-5 py-4 border-t border-[var(--border)] flex items-center justify-between">
                    <p className="text-[12px] text-[var(--text3)]">{selected.length} selected · PF: 12% basic · ESI: 0.75% gross (if &lt;₹21k)</p>
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] font-medium text-[var(--text2)] hover:text-[var(--text)] rounded-[8px] hover:bg-[var(--surface2)] transition-colors">Cancel</button>
                        <button onClick={handleProcess} disabled={loading || selected.length === 0}
                            className="inline-flex items-center gap-2 px-5 py-2 bg-[var(--accent)] text-white rounded-[8px] text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                            {loading && <Loader2 size={14} className="animate-spin" />}
                            Process {selected.length > 0 ? `(${selected.length})` : ""}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

function PayslipPrint({ payroll }: { payroll: Payroll }) {
    const handlePrint = () => {
        const w = window.open("", "_blank")
        if (!w) return
        const monthName = MONTHS[payroll.month - 1]
        w.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Payslip - ${payroll.employee.firstName} ${payroll.employee.lastName} - ${monthName} ${payroll.year}</title>
                <style>
                    body { font-family: Arial, sans-serif; max-width: 700px; margin: 40px auto; color: #1a1a1a; }
                    .header { border-bottom: 2px solid #1a9e6e; padding-bottom: 16px; margin-bottom: 20px; }
                    .company { font-size: 20px; font-weight: bold; color: #1a9e6e; }
                    .payslip-title { font-size: 14px; color: #666; margin-top: 4px; }
                    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 16px 0; }
                    .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f0f0f0; font-size: 13px; }
                    .label { color: #666; }
                    .value { font-weight: 600; }
                    .section-title { font-size: 12px; font-weight: bold; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin: 16px 0 8px; }
                    .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-weight: bold; font-size: 15px; border-top: 2px solid #1a9e6e; margin-top: 8px; color: #1a9e6e; }
                    @media print { body { margin: 20px; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="company">Growus Auto HRMS</div>
                    <div class="payslip-title">Payslip for ${monthName} ${payroll.year}</div>
                </div>
                <div class="grid">
                    <div>
                        <div class="row"><span class="label">Employee Name</span><span class="value">${payroll.employee.firstName} ${payroll.employee.lastName}</span></div>
                        <div class="row"><span class="label">Employee ID</span><span class="value">${payroll.employee.employeeId}</span></div>
                        <div class="row"><span class="label">Designation</span><span class="value">${payroll.employee.designation || "—"}</span></div>
                    </div>
                    <div>
                        <div class="row"><span class="label">Branch</span><span class="value">${payroll.employee.branch.name}</span></div>
                        <div class="row"><span class="label">Department</span><span class="value">${payroll.employee.department?.name || "—"}</span></div>
                        <div class="row"><span class="label">Present Days</span><span class="value">${payroll.presentDays} / ${payroll.workingDays}</span></div>
                    </div>
                </div>
                <div class="section-title">Earnings</div>
                <div class="row"><span class="label">Basic Salary</span><span class="value">₹${payroll.basicSalary.toLocaleString()}</span></div>
                <div class="row"><span class="label">HRA</span><span class="value">₹${payroll.hra.toLocaleString()}</span></div>
                <div class="row"><span class="label">Allowances</span><span class="value">₹${payroll.allowances.toLocaleString()}</span></div>
                <div class="row"><span class="label">Overtime Pay</span><span class="value">₹${payroll.overtimePay.toLocaleString()}</span></div>
                <div class="row" style="font-weight:bold"><span class="label">Gross Salary</span><span class="value">₹${payroll.grossSalary.toLocaleString()}</span></div>
                <div class="section-title">Deductions</div>
                <div class="row"><span class="label">PF (Employee - 12%)</span><span class="value">₹${payroll.pfEmployee.toLocaleString()}</span></div>
                <div class="row"><span class="label">ESI (Employee - 0.75%)</span><span class="value">₹${payroll.esiEmployee.toLocaleString()}</span></div>
                <div class="row"><span class="label">TDS</span><span class="value">₹${payroll.tds.toLocaleString()}</span></div>
                <div class="row"><span class="label">Other Deductions</span><span class="value">₹${payroll.otherDeductions.toLocaleString()}</span></div>
                <div class="total-row"><span>Net Pay</span><span>₹${payroll.netSalary.toLocaleString()}</span></div>
                <p style="font-size:11px; color:#999; margin-top:24px; text-align:center">This is a computer-generated payslip and does not require a signature.</p>
            </body>
            </html>
        `)
        w.document.close()
        w.print()
    }
    return (
        <button onClick={handlePrint}
            className="p-1.5 rounded-md hover:bg-[var(--surface2)] text-[var(--text3)] hover:text-[var(--text)] transition-colors" title="Print Payslip">
            <Printer size={14} />
        </button>
    )
}

export default function PayrollPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const now = new Date()
    const [month, setMonth] = useState(now.getMonth() + 1)
    const [year, setYear] = useState(now.getFullYear())
    const [payrolls, setPayrolls] = useState<Payroll[]>([])
    const [branches, setBranches] = useState<Branch[]>([])
    const [branchFilter, setBranchFilter] = useState("")
    const [loading, setLoading] = useState(true)
    const [showProcess, setShowProcess] = useState(false)
    const [updatingId, setUpdatingId] = useState<string | null>(null)

    useEffect(() => {
        if (status === "unauthenticated") router.push("/login")
    }, [status, router])

    useEffect(() => {
        fetch("/api/branches").then(r => r.json()).then(d => setBranches(Array.isArray(d) ? d : [])).catch(() => {})
    }, [])

    const fetchPayrolls = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({ month: String(month), year: String(year) })
            if (branchFilter) params.set("branchId", branchFilter)
            const res = await fetch(`/api/payroll?${params}`)
            const data = await res.json()
            setPayrolls(Array.isArray(data) ? data : [])
        } catch {
            toast.error("Failed to load payroll")
        } finally {
            setLoading(false)
        }
    }, [month, year, branchFilter])

    useEffect(() => {
        if (status === "authenticated") fetchPayrolls()
    }, [status, fetchPayrolls])

    const handleMarkPaid = async (payrollId: string) => {
        setUpdatingId(payrollId)
        try {
            const res = await fetch(`/api/payroll/${payrollId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "PAID" }),
            })
            if (!res.ok) throw new Error(await res.text())
            toast.success("Marked as paid!")
            fetchPayrolls()
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to update")
        } finally {
            setUpdatingId(null)
        }
    }

    const prevMonth = () => {
        if (month === 1) { setMonth(12); setYear(y => y - 1) }
        else setMonth(m => m - 1)
    }
    const nextMonth = () => {
        if (month === 12) { setMonth(1); setYear(y => y + 1) }
        else setMonth(m => m + 1)
    }

    // Summary
    const totalGross = payrolls.reduce((s, p) => s + p.grossSalary, 0)
    const totalNet = payrolls.reduce((s, p) => s + p.netSalary, 0)
    const totalPF = payrolls.reduce((s, p) => s + p.pfEmployee, 0)
    const paid = payrolls.filter(p => p.status === "PAID").length

    const existingEmployeeIds = payrolls.map(p => p.employeeId)

    if (status === "loading") {
        return <div className="flex items-center justify-center min-h-screen"><Loader2 size={28} className="animate-spin text-[var(--accent)]" /></div>
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-[24px] font-semibold tracking-[-0.4px] text-[var(--text)]">Payroll</h1>
                    <p className="text-[13px] text-[var(--text3)] mt-0.5">Process and manage employee salaries</p>
                </div>
                <button onClick={() => setShowProcess(true)}
                    className="inline-flex items-center gap-2 bg-[var(--accent)] text-white rounded-[10px] text-[13px] font-medium px-4 py-2 hover:opacity-90 transition-opacity">
                    <Plus size={16} /> Process Payroll
                </button>
            </div>

            {/* Month Selector */}
            <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 bg-white border border-[var(--border)] rounded-[10px] px-3 py-2">
                    <button onClick={prevMonth} className="p-0.5 text-[var(--text3)] hover:text-[var(--text)] transition-colors"><ChevronLeft size={16} /></button>
                    <span className="text-[13px] font-semibold text-[var(--text)] min-w-[140px] text-center">{MONTHS[month - 1]} {year}</span>
                    <button onClick={nextMonth} className="p-0.5 text-[var(--text3)] hover:text-[var(--text)] transition-colors"><ChevronRight size={16} /></button>
                </div>
                <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)}
                    className="h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors">
                    <option value="">All Branches</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: "Total Employees", value: payrolls.length, sub: "with payroll", icon: <Users size={18} />, color: "#3b82f6", bg: "#eff6ff" },
                    { label: "Gross Payout", value: `₹${Math.round(totalGross).toLocaleString()}`, sub: "total gross", icon: <TrendingUp size={18} />, color: "#8b5cf6", bg: "#f5f3ff" },
                    { label: "Net Payout", value: `₹${Math.round(totalNet).toLocaleString()}`, sub: "total net", icon: <DollarSign size={18} />, color: "#1a9e6e", bg: "#e8f7f1" },
                    { label: "Paid", value: paid, sub: `of ${payrolls.length} processed`, icon: <CheckCircle size={18} />, color: "#f59e0b", bg: "#fffbeb" },
                ].map(s => (
                    <div key={s.label} className="bg-white border border-[var(--border)] rounded-[12px] p-4 flex items-center gap-3">
                        <div style={{ background: s.bg, color: s.color }} className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0">{s.icon}</div>
                        <div className="min-w-0">
                            <p className="text-[18px] font-bold text-[var(--text)] leading-tight truncate">{s.value}</p>
                            <p className="text-[11px] text-[var(--text3)]">{s.sub}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Payroll Table */}
            {loading ? (
                <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin text-[var(--accent)]" /></div>
            ) : payrolls.length === 0 ? (
                <div className="flex min-h-[250px] flex-col items-center justify-center rounded-[14px] bg-white border border-dashed border-[var(--border)]">
                    <DollarSign size={36} className="text-[var(--text3)] mb-2" />
                    <p className="text-[14px] font-semibold text-[var(--text)]">No payroll for {MONTHS[month - 1]} {year}</p>
                    <p className="text-[13px] text-[var(--text3)] mt-1">Click "Process Payroll" to generate payroll</p>
                </div>
            ) : (
                <div className="bg-white border border-[var(--border)] rounded-[12px] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-[var(--border)] bg-[var(--surface2)]/40">
                                    <th className="text-left text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px] px-5 py-3">Employee</th>
                                    <th className="text-right text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px] px-4 py-3">Basic</th>
                                    <th className="text-right text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px] px-4 py-3">Gross</th>
                                    <th className="text-right text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px] px-4 py-3">Deductions</th>
                                    <th className="text-right text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px] px-4 py-3">Net Pay</th>
                                    <th className="text-left text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px] px-4 py-3">Status</th>
                                    <th className="text-right text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px] px-5 py-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payrolls.map((p, i) => {
                                    const s = STATUS_CONFIG[p.status] || STATUS_CONFIG.DRAFT
                                    const deductions = p.pfEmployee + p.esiEmployee + p.tds + p.otherDeductions
                                    return (
                                        <tr key={p.id} className={`border-b border-[var(--border)] hover:bg-[var(--surface2)]/30 transition-colors ${i === payrolls.length - 1 ? "border-b-0" : ""}`}>
                                            <td className="px-5 py-3">
                                                <div className="flex items-center gap-3">
                                                    <Avatar firstName={p.employee.firstName} lastName={p.employee.lastName} photo={p.employee.photo} size={36} />
                                                    <div>
                                                        <p className="text-[13px] font-semibold text-[var(--text)]">{p.employee.firstName} {p.employee.lastName}</p>
                                                        <p className="text-[11px] text-[var(--text3)]">{p.employee.employeeId} · {p.employee.branch.name}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right text-[13px] text-[var(--text2)]">₹{p.basicSalary.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-right text-[13px] text-[var(--text2)]">₹{p.grossSalary.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-right text-[13px] text-[#dc2626]">-₹{Math.round(deductions).toLocaleString()}</td>
                                            <td className="px-4 py-3 text-right text-[13px] font-semibold text-[var(--accent-text)]">₹{Math.round(p.netSalary).toLocaleString()}</td>
                                            <td className="px-4 py-3">
                                                <span style={{ color: s.color, background: s.bg, borderColor: s.border }}
                                                    className="px-2 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap">
                                                    {s.label}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <PayslipPrint payroll={p} />
                                                    {p.status !== "PAID" && (
                                                        <button onClick={() => handleMarkPaid(p.id)}
                                                            disabled={updatingId === p.id}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] border border-[#6ee7b7] bg-[#e8f7f1] text-[#1a9e6e] text-[12px] font-medium hover:bg-[#d1f5e6] transition-colors disabled:opacity-50">
                                                            {updatingId === p.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                                                            Mark Paid
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                            <tfoot>
                                <tr className="border-t-2 border-[var(--border)] bg-[var(--surface2)]/40">
                                    <td className="px-5 py-3 text-[12px] font-semibold text-[var(--text3)]">TOTAL ({payrolls.length})</td>
                                    <td className="px-4 py-3 text-right text-[12px] font-semibold text-[var(--text)]">₹{payrolls.reduce((s, p) => s + p.basicSalary, 0).toLocaleString()}</td>
                                    <td className="px-4 py-3 text-right text-[12px] font-semibold text-[var(--text)]">₹{Math.round(totalGross).toLocaleString()}</td>
                                    <td className="px-4 py-3 text-right text-[12px] font-semibold text-[#dc2626]">-₹{Math.round(payrolls.reduce((s, p) => s + p.pfEmployee + p.esiEmployee + p.tds + p.otherDeductions, 0)).toLocaleString()}</td>
                                    <td className="px-4 py-3 text-right text-[12px] font-semibold text-[var(--accent-text)]">₹{Math.round(totalNet).toLocaleString()}</td>
                                    <td colSpan={2} />
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}

            <ProcessPayrollModal
                open={showProcess}
                onClose={() => setShowProcess(false)}
                onSaved={fetchPayrolls}
                month={month}
                year={year}
                existingEmployeeIds={existingEmployeeIds}
            />
        </div>
    )
}
