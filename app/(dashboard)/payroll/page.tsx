"use client"
import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
    ChevronLeft, ChevronRight, Loader2, X, Plus,
    Download, CheckCircle, MoreVertical, Trash2,
    Wallet, TrendingUp, Users, IndianRupee
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type PayrollRecord = {
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
    pfEmployer: number
    esiEmployee: number
    esiEmployer: number
    tds: number
    otherDeductions: number
    totalDeductions: number
    netSalary: number
    workingDays: number
    presentDays: number
    leaveDays: number
    lwpDays: number
    overtimeHrs: number
    overtimeRate: number
    status: "DRAFT" | "PROCESSED" | "PAID"
    processedAt?: string
    processedBy?: string
    paidAt?: string
    paidBy?: string
    remarks?: string
    createdAt: string
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

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
    DRAFT: { label: "Draft", color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb" },
    PROCESSED: { label: "Processed", color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe" },
    PAID: { label: "Paid", color: "#1a9e6e", bg: "#e8f7f1", border: "#6ee7b7" },
}

const STATUS_TABS = ["ALL", "DRAFT", "PROCESSED", "PAID"]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtINR(n: number) {
    return `₹${Math.round(n).toLocaleString("en-IN")}`
}

const AVATAR_COLORS = ["#1a9e6e", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#f97316"]
function getAvatarColor(first: string, last: string) {
    return AVATAR_COLORS[(first.charCodeAt(0) + (last.charCodeAt(0) || 0)) % AVATAR_COLORS.length]
}

// ─── Components ───────────────────────────────────────────────────────────────

function Avatar({ firstName, lastName, photo, size = 36 }: { firstName: string; lastName: string; photo?: string; size?: number }) {
    const initials = `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase()
    const bg = getAvatarColor(firstName, lastName)
    if (photo) return <img src={photo} alt="" style={{ width: size, height: size }} className="rounded-full object-cover shrink-0" />
    return (
        <div style={{ width: size, height: size, background: bg, fontSize: size * 0.33 }}
            className="rounded-full flex items-center justify-center text-white font-semibold shrink-0 select-none">
            {initials}
        </div>
    )
}

// ─── Generate Payroll Modal ───────────────────────────────────────────────────

function GenerateModal({
    open, onClose, onGenerated,
}: {
    open: boolean
    onClose: () => void
    onGenerated: () => void
}) {
    const now = new Date()
    const [selMonth, setSelMonth] = useState(now.getMonth() + 1)
    const [selYear, setSelYear] = useState(now.getFullYear())
    const [loading, setLoading] = useState(false)

    if (!open) return null

    const handleGenerate = async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/payroll/bulk", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ month: selMonth, year: selYear }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.message || "Failed")
            toast.success(`Generated payroll for ${data.generated} of ${data.total} active employees`)
            onGenerated()
            onClose()
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to generate payroll")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-[var(--surface)] rounded-[16px] border border-[var(--border)] w-full max-w-md shadow-xl">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
                    <div>
                        <h2 className="text-[15px] font-semibold text-[var(--text)]">Generate Payroll</h2>
                        <p className="text-[12px] text-[var(--text3)]">Bulk generate for all active employees</p>
                    </div>
                    <button onClick={onClose} className="p-1 text-[var(--text3)] hover:text-[var(--text)] rounded-md hover:bg-[var(--surface2)] transition-colors">
                        <X size={18} />
                    </button>
                </div>
                <div className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.4px] mb-1.5">Month</label>
                            <select value={selMonth} onChange={e => setSelMonth(parseInt(e.target.value))}
                                className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors">
                                {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.4px] mb-1.5">Year</label>
                            <select value={selYear} onChange={e => setSelYear(parseInt(e.target.value))}
                                className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors">
                                {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="rounded-[10px] bg-[var(--accent-light)] border border-[#6ee7b7]/40 p-3">
                        <p className="text-[12px] text-[var(--text2)]">
                            This will auto-calculate payroll for all <strong>ACTIVE</strong> employees for <strong>{MONTHS[selMonth - 1]} {selYear}</strong> based on attendance data. Existing records will be updated (if still DRAFT).
                        </p>
                    </div>
                </div>
                <div className="px-5 py-4 border-t border-[var(--border)] flex items-center justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-[13px] font-medium text-[var(--text2)] hover:text-[var(--text)] rounded-[8px] hover:bg-[var(--surface2)] transition-colors">
                        Cancel
                    </button>
                    <button onClick={handleGenerate} disabled={loading}
                        className="inline-flex items-center gap-2 px-5 py-2 bg-[var(--accent)] text-white rounded-[8px] text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                        {loading && <Loader2 size={14} className="animate-spin" />}
                        Generate for All Employees
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Payroll Detail Drawer ────────────────────────────────────────────────────

function PayrollDrawer({
    payroll,
    onClose,
    onUpdated,
    role,
}: {
    payroll: PayrollRecord | null
    onClose: () => void
    onUpdated: (updated: PayrollRecord) => void
    role?: string
}) {
    const [allowances, setAllowances] = useState("")
    const [otherDeductions, setOtherDeductions] = useState("")
    const [tds, setTds] = useState("")
    const [overtimePay, setOvertimePay] = useState("")
    const [remarks, setRemarks] = useState("")
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (payroll) {
            setAllowances(String(payroll.allowances || ""))
            setOtherDeductions(String(payroll.otherDeductions || ""))
            setTds(String(payroll.tds || ""))
            setOvertimePay(String(payroll.overtimePay || ""))
            setRemarks(payroll.remarks || "")
        }
    }, [payroll])

    if (!payroll) return null

    const canEdit = role === "ADMIN" || role === "MANAGER"
    const s = STATUS_CONFIG[payroll.status]
    const monthName = MONTHS[payroll.month - 1]

    const handleSave = async () => {
        setSaving(true)
        try {
            const res = await fetch(`/api/payroll/${payroll.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    allowances: parseFloat(allowances) || 0,
                    otherDeductions: parseFloat(otherDeductions) || 0,
                    tds: parseFloat(tds) || 0,
                    overtimePay: parseFloat(overtimePay) || 0,
                    remarks,
                }),
            })
            if (!res.ok) throw new Error(await res.text())
            const updated = await res.json()
            onUpdated(updated)
            toast.success("Payroll updated and recalculated")
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to save")
        } finally {
            setSaving(false)
        }
    }

    const handleStatus = async (newStatus: string) => {
        setSaving(true)
        try {
            const res = await fetch(`/api/payroll/${payroll.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            })
            if (!res.ok) throw new Error(await res.text())
            const updated = await res.json()
            onUpdated(updated)
            toast.success(`Marked as ${newStatus.toLowerCase()}`)
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed")
        } finally {
            setSaving(false)
        }
    }

    const emp = payroll.employee

    return (
        <div className="fixed inset-0 z-40 flex">
            <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />
            <div className="w-full max-w-[480px] bg-[var(--surface)] border-l border-[var(--border)] flex flex-col overflow-hidden shadow-2xl">
                {/* Drawer Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] shrink-0">
                    <div className="flex items-center gap-3">
                        <Avatar firstName={emp.firstName} lastName={emp.lastName} photo={emp.photo} size={40} />
                        <div>
                            <h2 className="text-[15px] font-semibold text-[var(--text)]">{emp.firstName} {emp.lastName}</h2>
                            <p className="text-[11px] text-[var(--text3)]">{emp.employeeId} · {emp.designation || "—"}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span style={{ color: s.color, background: s.bg, borderColor: s.border }}
                            className="px-2 py-0.5 rounded-full text-[11px] font-semibold border">
                            {s.label}
                        </span>
                        <button onClick={onClose} className="p-1 text-[var(--text3)] hover:text-[var(--text)] rounded-md hover:bg-[var(--surface2)] transition-colors">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto">
                    <div className="p-5 space-y-5">
                        {/* Payslip Preview */}
                        <div className="rounded-[12px] bg-[var(--surface2)] border border-[var(--border)] p-4 font-mono text-[12px]">
                            <div className="font-bold text-[var(--text)] mb-1">PAYSLIP — {monthName} {payroll.year}</div>
                            <div className="text-[var(--text3)] mb-2">Employee: {emp.firstName} {emp.lastName} ({emp.employeeId})</div>
                            <div className="border-t border-[var(--border)] pt-2 grid grid-cols-2 gap-x-4 gap-y-0.5">
                                <div className="font-semibold text-[var(--text3)] uppercase text-[10px] tracking-wide">EARNINGS</div>
                                <div className="font-semibold text-[var(--text3)] uppercase text-[10px] tracking-wide">DEDUCTIONS</div>
                                <div className="text-[var(--text2)]">Basic: {fmtINR(payroll.basicSalary)}</div>
                                <div className="text-[var(--text2)]">PF: {fmtINR(payroll.pfEmployee)}</div>
                                <div className="text-[var(--text2)]">HRA: {fmtINR(payroll.hra)}</div>
                                <div className="text-[var(--text2)]">ESI: {fmtINR(payroll.esiEmployee)}</div>
                                <div className="text-[var(--text2)]">Allow: {fmtINR(payroll.allowances)}</div>
                                <div className="text-[var(--text2)]">TDS: {fmtINR(payroll.tds)}</div>
                                <div className="text-[var(--text2)]">OT: {fmtINR(payroll.overtimePay)}</div>
                                <div className="text-[var(--text2)]">Other: {fmtINR(payroll.otherDeductions)}</div>
                            </div>
                            <div className="border-t border-[var(--border)] mt-2 pt-2 flex justify-between font-bold">
                                <span className="text-[var(--text)]">GROSS: {fmtINR(payroll.grossSalary)}</span>
                                <span style={{ color: "#1a9e6e" }}>NET: {fmtINR(payroll.netSalary)}</span>
                            </div>
                        </div>

                        {/* Earnings Section */}
                        <div>
                            <h3 className="text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px] mb-2">Earnings</h3>
                            <div className="bg-white border border-[var(--border)] rounded-[10px] overflow-hidden">
                                {[
                                    ["Basic Salary", payroll.basicSalary],
                                    ["HRA", payroll.hra],
                                    ["Allowances", payroll.allowances],
                                    ["Overtime Pay", payroll.overtimePay],
                                ].map(([label, val]) => (
                                    <div key={String(label)} className="flex justify-between items-center px-4 py-2.5 border-b border-[var(--border)] last:border-b-0">
                                        <span className="text-[13px] text-[var(--text2)]">{label}</span>
                                        <span className="text-[13px] font-medium text-[var(--text)]">{fmtINR(Number(val))}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between items-center px-4 py-2.5 bg-[var(--surface2)] border-t border-[var(--border)]">
                                    <span className="text-[13px] font-semibold text-[var(--text)]">Gross Total</span>
                                    <span className="text-[13px] font-bold text-[var(--text)]">{fmtINR(payroll.grossSalary)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Deductions Section */}
                        <div>
                            <h3 className="text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px] mb-2">Deductions</h3>
                            <div className="bg-white border border-[var(--border)] rounded-[10px] overflow-hidden">
                                {[
                                    ["PF (Employee 12%)", payroll.pfEmployee],
                                    ["ESI (Employee 0.75%)", payroll.esiEmployee],
                                    ["TDS", payroll.tds],
                                    ["Other Deductions", payroll.otherDeductions],
                                ].map(([label, val]) => (
                                    <div key={String(label)} className="flex justify-between items-center px-4 py-2.5 border-b border-[var(--border)] last:border-b-0">
                                        <span className="text-[13px] text-[var(--text2)]">{label}</span>
                                        <span className="text-[13px] font-medium text-[#dc2626]">-{fmtINR(Number(val))}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between items-center px-4 py-2.5 bg-[var(--surface2)] border-t border-[var(--border)]">
                                    <span className="text-[13px] font-semibold text-[var(--text)]">Total Deductions</span>
                                    <span className="text-[13px] font-bold text-[#dc2626]">-{fmtINR(payroll.pfEmployee + payroll.esiEmployee + payroll.tds + payroll.otherDeductions)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Net Salary */}
                        <div className="rounded-[12px] border border-[#6ee7b7] bg-[#e8f7f1] px-5 py-4 flex justify-between items-center">
                            <div>
                                <p className="text-[12px] font-semibold text-[#1a9e6e] uppercase tracking-[0.4px]">Net Salary</p>
                                <p className="text-[10.5px] text-[#1a9e6e]/70">After all deductions</p>
                            </div>
                            <p className="text-[24px] font-bold text-[#1a9e6e]">{fmtINR(payroll.netSalary)}</p>
                        </div>

                        {/* Company Liability */}
                        <div>
                            <h3 className="text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px] mb-2">Company Liability</h3>
                            <div className="bg-white border border-[var(--border)] rounded-[10px] overflow-hidden">
                                {[
                                    ["Employer PF (12%)", payroll.pfEmployer],
                                    ["Employer ESI (3.25%)", payroll.esiEmployer],
                                ].map(([label, val]) => (
                                    <div key={String(label)} className="flex justify-between items-center px-4 py-2.5 border-b border-[var(--border)] last:border-b-0">
                                        <span className="text-[13px] text-[var(--text2)]">{label}</span>
                                        <span className="text-[13px] font-medium text-[#f59e0b]">{fmtINR(Number(val))}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Attendance */}
                        <div>
                            <h3 className="text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px] mb-2">Attendance Summary</h3>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { label: "Present", value: `${payroll.presentDays}/${payroll.workingDays}` },
                                    { label: "Leave (LWP)", value: payroll.lwpDays },
                                    { label: "OT Hours", value: payroll.overtimeHrs },
                                ].map(item => (
                                    <div key={item.label} className="bg-[var(--surface2)] border border-[var(--border)] rounded-[10px] p-3 text-center">
                                        <p className="text-[18px] font-bold text-[var(--text)]">{item.value}</p>
                                        <p className="text-[10.5px] text-[var(--text3)]">{item.label}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Editable Fields */}
                        {canEdit && payroll.status !== "PAID" && (
                            <div>
                                <h3 className="text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px] mb-2">Adjustments</h3>
                                <div className="space-y-3">
                                    {[
                                        { label: "Allowances (₹)", state: allowances, set: setAllowances },
                                        { label: "Overtime Pay (₹)", state: overtimePay, set: setOvertimePay },
                                        { label: "TDS (₹)", state: tds, set: setTds },
                                        { label: "Other Deductions (₹)", state: otherDeductions, set: setOtherDeductions },
                                    ].map(f => (
                                        <div key={f.label}>
                                            <label className="block text-[11px] font-semibold text-[var(--text3)] mb-1">{f.label}</label>
                                            <input type="number" value={f.state} onChange={e => f.set(e.target.value)} min={0}
                                                className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors" />
                                        </div>
                                    ))}
                                    <div>
                                        <label className="block text-[11px] font-semibold text-[var(--text3)] mb-1">Remarks</label>
                                        <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={2}
                                            className="w-full rounded-[8px] border border-[var(--border)] bg-white px-3 py-2 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors resize-none" />
                                    </div>
                                    <button onClick={handleSave} disabled={saving}
                                        className="w-full inline-flex items-center justify-center gap-2 h-9 bg-[var(--accent)] text-white rounded-[8px] text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                                        {saving && <Loader2 size={14} className="animate-spin" />}
                                        Save & Recalculate
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Status Actions */}
                        {canEdit && (
                            <div className="flex gap-2">
                                {payroll.status === "DRAFT" && (
                                    <button onClick={() => handleStatus("PROCESSED")} disabled={saving}
                                        className="flex-1 h-9 rounded-[8px] border border-[#bfdbfe] bg-[#eff6ff] text-[#3b82f6] text-[12px] font-semibold hover:bg-[#dbeafe] transition-colors disabled:opacity-50">
                                        Mark Processed
                                    </button>
                                )}
                                {payroll.status === "PROCESSED" && (
                                    <button onClick={() => handleStatus("PAID")} disabled={saving}
                                        className="flex-1 h-9 rounded-[8px] border border-[#6ee7b7] bg-[#e8f7f1] text-[#1a9e6e] text-[12px] font-semibold hover:bg-[#d1f5e6] transition-colors disabled:opacity-50">
                                        Mark Paid
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─── Row Actions Menu ─────────────────────────────────────────────────────────

function RowActions({
    payroll,
    onView,
    onStatusChange,
    onDelete,
    role,
}: {
    payroll: PayrollRecord
    onView: () => void
    onStatusChange: (id: string, status: string) => void
    onDelete: (id: string) => void
    role?: string
}) {
    const [open, setOpen] = useState(false)
    return (
        <div className="relative">
            <button onClick={() => setOpen(o => !o)}
                className="p-1.5 rounded-md hover:bg-[var(--surface2)] text-[var(--text3)] hover:text-[var(--text)] transition-colors">
                <MoreVertical size={15} />
            </button>
            {open && (
                <>
                    <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
                    <div className="absolute right-0 top-8 z-40 w-44 rounded-[10px] bg-[var(--surface)] border border-[var(--border)] shadow-lg overflow-hidden py-1">
                        <button onClick={() => { setOpen(false); onView() }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-[var(--text2)] hover:bg-[var(--surface2)] hover:text-[var(--text)] transition-colors text-left">
                            View / Edit
                        </button>
                        {payroll.status === "DRAFT" && (
                            <button onClick={() => { setOpen(false); onStatusChange(payroll.id, "PROCESSED") }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-[var(--text2)] hover:bg-[var(--surface2)] hover:text-[var(--text)] transition-colors text-left">
                                Mark as Processed
                            </button>
                        )}
                        {payroll.status === "PROCESSED" && (
                            <button onClick={() => { setOpen(false); onStatusChange(payroll.id, "PAID") }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-[var(--text2)] hover:bg-[var(--surface2)] hover:text-[var(--text)] transition-colors text-left">
                                Mark as Paid
                            </button>
                        )}
                        {role === "ADMIN" && payroll.status === "DRAFT" && (
                            <button onClick={() => { setOpen(false); onDelete(payroll.id) }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-[#dc2626] hover:bg-[#fef2f2] transition-colors text-left">
                                <Trash2 size={13} /> Delete
                            </button>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PayrollPage() {
    const { data: session, status } = useSession()
    const router = useRouter()

    const now = new Date()
    const [month, setMonth] = useState(now.getMonth() + 1)
    const [year, setYear] = useState(now.getFullYear())
    const [payrolls, setPayrolls] = useState<PayrollRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [statusTab, setStatusTab] = useState("ALL")
    const [search, setSearch] = useState("")
    const [showGenerate, setShowGenerate] = useState(false)
    const [selectedPayroll, setSelectedPayroll] = useState<PayrollRecord | null>(null)

    const role = session?.user?.role

    useEffect(() => {
        if (status !== "unauthenticated") return
        router.push("/login")
    }, [status, router])

    const fetchPayrolls = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({ month: String(month), year: String(year) })
            if (search) params.set("search", search)
            if (statusTab !== "ALL") params.set("status", statusTab)
            const res = await fetch(`/api/payroll?${params}`)
            const data = await res.json()
            setPayrolls(Array.isArray(data) ? data : [])
        } catch {
            toast.error("Failed to load payroll data")
        } finally {
            setLoading(false)
        }
    }, [month, year, search, statusTab])

    useEffect(() => {
        if (status === "authenticated") fetchPayrolls()
    }, [status, fetchPayrolls])

    const handleStatusChange = async (id: string, newStatus: string) => {
        try {
            const res = await fetch(`/api/payroll/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            })
            if (!res.ok) throw new Error(await res.text())
            const updated = await res.json()
            setPayrolls(prev => prev.map(p => p.id === id ? updated : p))
            if (selectedPayroll?.id === id) setSelectedPayroll(updated)
            toast.success(`Marked as ${newStatus.toLowerCase()}`)
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to update status")
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this payroll record? This action cannot be undone.")) return
        try {
            const res = await fetch(`/api/payroll/${id}`, { method: "DELETE" })
            if (!res.ok) throw new Error(await res.text())
            setPayrolls(prev => prev.filter(p => p.id !== id))
            if (selectedPayroll?.id === id) setSelectedPayroll(null)
            toast.success("Payroll record deleted")
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to delete")
        }
    }

    const handleExportCSV = () => {
        const headers = ["Employee", "ID", "Designation", "Basic", "HRA", "Allowances", "OT Pay", "Gross", "PF", "ESI", "TDS", "Other Deductions", "Net Salary", "Present Days", "Working Days", "Status"]
        const rows = payrolls.map(p => [
            `${p.employee.firstName} ${p.employee.lastName}`,
            p.employee.employeeId,
            p.employee.designation || "",
            p.basicSalary,
            p.hra,
            p.allowances,
            p.overtimePay,
            p.grossSalary,
            p.pfEmployee,
            p.esiEmployee,
            p.tds,
            p.otherDeductions,
            p.netSalary,
            p.presentDays,
            p.workingDays,
            p.status,
        ])
        const csv = [headers, ...rows].map(r => r.join(",")).join("\n")
        const blob = new Blob([csv], { type: "text/csv" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `payroll-${MONTHS[month - 1]}-${year}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    const prevMonth = () => {
        if (month === 1) { setMonth(12); setYear(y => y - 1) }
        else setMonth(m => m - 1)
    }
    const nextMonth = () => {
        if (month === 12) { setMonth(1); setYear(y => y + 1) }
        else setMonth(m => m + 1)
    }

    // Stats
    const totalGross = payrolls.reduce((s, p) => s + p.grossSalary, 0)
    const totalNet = payrolls.reduce((s, p) => s + p.netSalary, 0)
    const totalPFLiability = payrolls.reduce((s, p) => s + p.pfEmployer, 0)
    const processed = payrolls.filter(p => p.status === "PROCESSED" || p.status === "PAID").length

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-[24px] font-semibold tracking-[-0.4px] text-[var(--text)]">Payroll</h1>
                    <p className="text-[13px] text-[var(--text3)] mt-0.5">Process and manage employee salaries</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleExportCSV}
                        className="inline-flex items-center gap-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--text2)] rounded-[10px] text-[13px] font-medium px-4 py-2 hover:bg-[var(--surface2)] transition-colors">
                        <Download size={15} /> Export CSV
                    </button>
                    <button onClick={() => setShowGenerate(true)}
                        className="inline-flex items-center gap-2 bg-[var(--accent)] text-white rounded-[10px] text-[13px] font-medium px-4 py-2 hover:opacity-90 transition-opacity">
                        <Plus size={15} /> Generate Payroll
                    </button>
                </div>
            </div>

            {/* Month Selector + Search */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 bg-[var(--surface)] border border-[var(--border)] rounded-[10px] px-3 py-2">
                    <button onClick={prevMonth} className="p-0.5 text-[var(--text3)] hover:text-[var(--text)] transition-colors"><ChevronLeft size={16} /></button>
                    <span className="text-[13px] font-semibold text-[var(--text)] min-w-[150px] text-center">{MONTHS[month - 1]} {year}</span>
                    <button onClick={nextMonth} className="p-0.5 text-[var(--text3)] hover:text-[var(--text)] transition-colors"><ChevronRight size={16} /></button>
                </div>
                <div className="relative flex-1 min-w-[200px] max-w-[320px]">
                    <input
                        type="text"
                        placeholder="Search employee..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] pl-3 pr-8 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors placeholder:text-[var(--text3)]"
                    />
                    {search && (
                        <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text3)] hover:text-[var(--text)]">
                            <X size={13} />
                        </button>
                    )}
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: "Total Payroll", value: fmtINR(totalGross), sub: "gross this month", icon: <TrendingUp size={18} />, color: "#3b82f6", bg: "#eff6ff" },
                    { label: "Net Payout", value: fmtINR(totalNet), sub: "employee take-home", icon: <IndianRupee size={18} />, color: "#1a9e6e", bg: "#e8f7f1" },
                    { label: "PF Liability", value: fmtINR(totalPFLiability), sub: "employer contribution", icon: <Wallet size={18} />, color: "#f59e0b", bg: "#fffbeb" },
                    { label: "Processed", value: `${processed}/${payrolls.length}`, sub: "employees processed", icon: <Users size={18} />, color: "#6b7280", bg: "#f9fafb" },
                ].map(s => (
                    <div key={s.label} className="bg-[var(--surface)] border border-[var(--border)] rounded-[12px] p-4 flex items-center gap-3">
                        <div style={{ background: s.bg, color: s.color }} className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0">{s.icon}</div>
                        <div className="min-w-0">
                            <p className="text-[18px] font-bold text-[var(--text)] leading-tight truncate">{s.value}</p>
                            <p className="text-[10.5px] text-[var(--text3)]">{s.sub}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Status Tabs */}
            <div className="flex gap-1 bg-[var(--surface2)] p-1 rounded-[10px] w-fit border border-[var(--border)]">
                {STATUS_TABS.map(tab => (
                    <button key={tab} onClick={() => setStatusTab(tab)}
                        className={`px-4 py-1.5 rounded-[7px] text-[12px] font-semibold transition-all ${statusTab === tab ? "bg-[var(--surface)] text-[var(--text)] shadow-sm" : "text-[var(--text3)] hover:text-[var(--text2)]"}`}>
                        {tab === "ALL" ? "All" : STATUS_CONFIG[tab]?.label || tab}
                    </button>
                ))}
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 size={28} className="animate-spin text-[var(--accent)]" />
                </div>
            ) : payrolls.length === 0 ? (
                <div className="flex min-h-[260px] flex-col items-center justify-center rounded-[14px] bg-[var(--surface)] border border-dashed border-[var(--border)]">
                    <Wallet size={40} className="text-[var(--text3)] mb-3" />
                    <p className="text-[14px] font-semibold text-[var(--text)]">No payroll records found</p>
                    <p className="text-[13px] text-[var(--text3)] mt-1">
                        {statusTab !== "ALL" ? `No ${statusTab.toLowerCase()} payrolls for this month` : "Click Generate Payroll to create records"}
                    </p>
                </div>
            ) : (
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[12px] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[900px]">
                            <thead>
                                <tr className="border-b border-[var(--border)] bg-[var(--surface2)]/40">
                                    {["Employee", "Basic", "HRA", "Allowances", "Overtime", "Gross", "PF", "ESI", "TDS", "Net Salary", "Days", "Status", ""].map(col => (
                                        <th key={col} className={`text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px] px-3 py-3 whitespace-nowrap ${col === "Employee" || col === "Status" || col === "" ? "text-left" : "text-right"}`}>
                                            {col}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {payrolls.map((p, i) => {
                                    const s = STATUS_CONFIG[p.status] || STATUS_CONFIG.DRAFT
                                    return (
                                        <tr key={p.id}
                                            className={`border-b border-[var(--border)] hover:bg-[var(--surface2)]/30 transition-colors cursor-pointer ${i === payrolls.length - 1 ? "border-b-0" : ""}`}
                                            onClick={() => setSelectedPayroll(p)}>
                                            <td className="px-3 py-3">
                                                <div className="flex items-center gap-2.5">
                                                    <Avatar firstName={p.employee.firstName} lastName={p.employee.lastName} photo={p.employee.photo} size={34} />
                                                    <div>
                                                        <p className="text-[13px] font-semibold text-[var(--text)] whitespace-nowrap">{p.employee.firstName} {p.employee.lastName}</p>
                                                        <p className="text-[10.5px] text-[var(--text3)]">{p.employee.employeeId}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-3 py-3 text-right text-[12px] text-[var(--text2)] whitespace-nowrap">{fmtINR(p.basicSalary)}</td>
                                            <td className="px-3 py-3 text-right text-[12px] text-[var(--text2)] whitespace-nowrap">{fmtINR(p.hra)}</td>
                                            <td className="px-3 py-3 text-right text-[12px] text-[var(--text2)] whitespace-nowrap">{fmtINR(p.allowances)}</td>
                                            <td className="px-3 py-3 text-right text-[12px] text-[var(--text2)] whitespace-nowrap">{fmtINR(p.overtimePay)}</td>
                                            <td className="px-3 py-3 text-right text-[12px] font-semibold text-[var(--text)] whitespace-nowrap">{fmtINR(p.grossSalary)}</td>
                                            <td className="px-3 py-3 text-right text-[12px] text-[#dc2626] whitespace-nowrap">{fmtINR(p.pfEmployee)}</td>
                                            <td className="px-3 py-3 text-right text-[12px] text-[#dc2626] whitespace-nowrap">{fmtINR(p.esiEmployee)}</td>
                                            <td className="px-3 py-3 text-right text-[12px] text-[#dc2626] whitespace-nowrap">{fmtINR(p.tds)}</td>
                                            <td className="px-3 py-3 text-right text-[13px] font-bold whitespace-nowrap" style={{ color: "#1a9e6e" }}>{fmtINR(p.netSalary)}</td>
                                            <td className="px-3 py-3 text-right text-[12px] text-[var(--text3)] whitespace-nowrap">{p.presentDays}/{p.workingDays}</td>
                                            <td className="px-3 py-3">
                                                <span style={{ color: s.color, background: s.bg, borderColor: s.border }}
                                                    className="px-2 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap">
                                                    {s.label}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                                                <RowActions
                                                    payroll={p}
                                                    onView={() => setSelectedPayroll(p)}
                                                    onStatusChange={handleStatusChange}
                                                    onDelete={handleDelete}
                                                    role={role}
                                                />
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modals & Drawer */}
            <GenerateModal
                open={showGenerate}
                onClose={() => setShowGenerate(false)}
                onGenerated={fetchPayrolls}
            />

            <PayrollDrawer
                payroll={selectedPayroll}
                onClose={() => setSelectedPayroll(null)}
                onUpdated={updated => {
                    setPayrolls(prev => prev.map(p => p.id === updated.id ? updated : p))
                    setSelectedPayroll(updated)
                }}
                role={role}
            />
        </div>
    )
}
