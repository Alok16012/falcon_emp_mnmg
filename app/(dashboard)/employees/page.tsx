"use client"
import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
    Plus, Search, Filter, UserCheck, Phone, Mail, MapPin,
    Building2, Briefcase, X, Loader2, ChevronDown, Users,
    Calendar, TrendingUp, Edit2, Trash2, Eye, CheckCircle,
    AlertCircle, Clock, UserX, FileText, DollarSign
} from "lucide-react"
import { format } from "date-fns"

// ─── Types ────────────────────────────────────────────────────────────────────

type Employee = {
    id: string
    employeeId: string
    firstName: string
    lastName: string
    email?: string
    phone: string
    designation?: string
    branchId: string
    departmentId?: string
    status: string
    employmentType: string
    basicSalary: number
    dateOfJoining?: string
    photo?: string
    createdAt: string
    branch: { id: string; name: string }
    department?: { id: string; name: string }
    _count: { attendances: number; leaves: number }
}

type Branch = { id: string; name: string; companyId?: string }
type Department = { id: string; name: string; branchId: string }

// ─── Status Config ─────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
    ACTIVE: { label: "Active", color: "#1a9e6e", bg: "#e8f7f1", border: "#6ee7b7" },
    INACTIVE: { label: "Inactive", color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb" },
    ON_LEAVE: { label: "On Leave", color: "#f59e0b", bg: "#fffbeb", border: "#fde68a" },
    TERMINATED: { label: "Terminated", color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
    RESIGNED: { label: "Resigned", color: "#8b5cf6", bg: "#f5f3ff", border: "#ddd6fe" },
}

// ─── Initials Avatar ──────────────────────────────────────────────────────────

function Avatar({ firstName, lastName, photo, size = 40 }: { firstName: string; lastName: string; photo?: string; size?: number }) {
    const initials = `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase()
    const colors = ["#1a9e6e", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4"]
    const colorIndex = (firstName.charCodeAt(0) + lastName.charCodeAt(0)) % colors.length
    const bg = colors[colorIndex]

    if (photo) {
        return <img src={photo} alt={`${firstName} ${lastName}`} style={{ width: size, height: size }} className="rounded-full object-cover" />
    }
    return (
        <div style={{ width: size, height: size, background: bg }} className="rounded-full flex items-center justify-center text-white font-semibold text-[13px]">
            {initials}
        </div>
    )
}

// ─── Add/Edit Modal ───────────────────────────────────────────────────────────

function EmployeeModal({
    open,
    onClose,
    onSaved,
    branches,
    employee,
}: {
    open: boolean
    onClose: () => void
    onSaved: () => void
    branches: Branch[]
    employee?: Employee | null
}) {
    const [loading, setLoading] = useState(false)
    const [departments, setDepartments] = useState<Department[]>([])
    const [form, setForm] = useState({
        employeeId: "",
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        alternatePhone: "",
        dateOfBirth: "",
        gender: "",
        address: "",
        city: "",
        state: "",
        pincode: "",
        aadharNumber: "",
        panNumber: "",
        bankAccountNumber: "",
        bankIFSC: "",
        bankName: "",
        designation: "",
        departmentId: "",
        branchId: "",
        dateOfJoining: "",
        status: "ACTIVE",
        employmentType: "Full-time",
        basicSalary: "",
    })

    useEffect(() => {
        if (employee) {
            setForm({
                employeeId: employee.employeeId,
                firstName: employee.firstName,
                lastName: employee.lastName,
                email: employee.email || "",
                phone: employee.phone,
                alternatePhone: "",
                dateOfBirth: "",
                gender: "",
                address: "",
                city: "",
                state: "",
                pincode: "",
                aadharNumber: "",
                panNumber: "",
                bankAccountNumber: "",
                bankIFSC: "",
                bankName: "",
                designation: employee.designation || "",
                departmentId: employee.departmentId || "",
                branchId: employee.branchId,
                dateOfJoining: employee.dateOfJoining ? employee.dateOfJoining.split("T")[0] : "",
                status: employee.status,
                employmentType: employee.employmentType,
                basicSalary: employee.basicSalary.toString(),
            })
        } else {
            setForm(f => ({ ...f, employeeId: "", firstName: "", lastName: "", email: "", phone: "", designation: "", branchId: "", basicSalary: "" }))
        }
    }, [employee, open])

    useEffect(() => {
        if (form.branchId) {
            fetch(`/api/departments?branchId=${form.branchId}`)
                .then(r => r.json())
                .then(setDepartments)
                .catch(() => setDepartments([]))
        }
    }, [form.branchId])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            const url = employee ? `/api/employees/${employee.id}` : "/api/employees"
            const method = employee ? "PUT" : "POST"
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            })
            if (!res.ok) {
                const msg = await res.text()
                throw new Error(msg)
            }
            toast.success(employee ? "Employee updated!" : "Employee added!")
            onSaved()
            onClose()
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to save")
        } finally {
            setLoading(false)
        }
    }

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-[16px] border border-[var(--border)] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl">
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
                    <h2 className="text-[16px] font-semibold text-[var(--text)]">{employee ? "Edit Employee" : "Add New Employee"}</h2>
                    <button onClick={onClose} className="text-[var(--text3)] hover:text-[var(--text)] p-1 rounded-md hover:bg-[var(--surface2)] transition-colors">
                        <X size={18} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
                    {/* Basic Info */}
                    <div>
                        <p className="text-[11px] font-semibold text-[var(--text3)] tracking-[0.5px] uppercase mb-3">Basic Information</p>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[12px] text-[var(--text2)] mb-1">Employee ID *</label>
                                <input value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))}
                                    className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors"
                                    placeholder="EMP001" required disabled={!!employee} />
                            </div>
                            <div>
                                <label className="block text-[12px] text-[var(--text2)] mb-1">Branch *</label>
                                <select value={form.branchId} onChange={e => setForm(f => ({ ...f, branchId: e.target.value, departmentId: "" }))}
                                    className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors" required>
                                    <option value="">Select Branch</option>
                                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[12px] text-[var(--text2)] mb-1">First Name *</label>
                                <input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                                    className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors"
                                    placeholder="First name" required />
                            </div>
                            <div>
                                <label className="block text-[12px] text-[var(--text2)] mb-1">Last Name *</label>
                                <input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                                    className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors"
                                    placeholder="Last name" required />
                            </div>
                            <div>
                                <label className="block text-[12px] text-[var(--text2)] mb-1">Phone *</label>
                                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                                    className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors"
                                    placeholder="Phone number" required />
                            </div>
                            <div>
                                <label className="block text-[12px] text-[var(--text2)] mb-1">Email</label>
                                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                    className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors"
                                    placeholder="Email address" />
                            </div>
                        </div>
                    </div>

                    {/* Employment Details */}
                    <div>
                        <p className="text-[11px] font-semibold text-[var(--text3)] tracking-[0.5px] uppercase mb-3">Employment Details</p>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[12px] text-[var(--text2)] mb-1">Designation</label>
                                <input value={form.designation} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))}
                                    className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors"
                                    placeholder="e.g. Security Guard" />
                            </div>
                            <div>
                                <label className="block text-[12px] text-[var(--text2)] mb-1">Department</label>
                                <select value={form.departmentId} onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))}
                                    className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors">
                                    <option value="">No Department</option>
                                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[12px] text-[var(--text2)] mb-1">Date of Joining</label>
                                <input type="date" value={form.dateOfJoining} onChange={e => setForm(f => ({ ...f, dateOfJoining: e.target.value }))}
                                    className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors" />
                            </div>
                            <div>
                                <label className="block text-[12px] text-[var(--text2)] mb-1">Employment Type</label>
                                <select value={form.employmentType} onChange={e => setForm(f => ({ ...f, employmentType: e.target.value }))}
                                    className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors">
                                    <option value="Full-time">Full-time</option>
                                    <option value="Part-time">Part-time</option>
                                    <option value="Contract">Contract</option>
                                    <option value="Temporary">Temporary</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[12px] text-[var(--text2)] mb-1">Basic Salary (₹)</label>
                                <input type="number" value={form.basicSalary} onChange={e => setForm(f => ({ ...f, basicSalary: e.target.value }))}
                                    className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors"
                                    placeholder="0" />
                            </div>
                            <div>
                                <label className="block text-[12px] text-[var(--text2)] mb-1">Status</label>
                                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                                    className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors">
                                    <option value="ACTIVE">Active</option>
                                    <option value="INACTIVE">Inactive</option>
                                    <option value="ON_LEAVE">On Leave</option>
                                    <option value="TERMINATED">Terminated</option>
                                    <option value="RESIGNED">Resigned</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Address */}
                    <div>
                        <p className="text-[11px] font-semibold text-[var(--text3)] tracking-[0.5px] uppercase mb-3">Personal Details</p>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[12px] text-[var(--text2)] mb-1">Gender</label>
                                <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                                    className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors">
                                    <option value="">Select</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[12px] text-[var(--text2)] mb-1">Date of Birth</label>
                                <input type="date" value={form.dateOfBirth} onChange={e => setForm(f => ({ ...f, dateOfBirth: e.target.value }))}
                                    className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors" />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-[12px] text-[var(--text2)] mb-1">Address</label>
                                <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                                    className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors"
                                    placeholder="Street address" />
                            </div>
                            <div>
                                <label className="block text-[12px] text-[var(--text2)] mb-1">City</label>
                                <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                                    className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors"
                                    placeholder="City" />
                            </div>
                            <div>
                                <label className="block text-[12px] text-[var(--text2)] mb-1">State</label>
                                <input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                                    className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors"
                                    placeholder="State" />
                            </div>
                        </div>
                    </div>

                    {/* Bank & Documents */}
                    <div>
                        <p className="text-[11px] font-semibold text-[var(--text3)] tracking-[0.5px] uppercase mb-3">Bank & Documents</p>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[12px] text-[var(--text2)] mb-1">Aadhar Number</label>
                                <input value={form.aadharNumber} onChange={e => setForm(f => ({ ...f, aadharNumber: e.target.value }))}
                                    className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors"
                                    placeholder="XXXX XXXX XXXX" />
                            </div>
                            <div>
                                <label className="block text-[12px] text-[var(--text2)] mb-1">PAN Number</label>
                                <input value={form.panNumber} onChange={e => setForm(f => ({ ...f, panNumber: e.target.value }))}
                                    className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors"
                                    placeholder="XXXXX0000X" />
                            </div>
                            <div>
                                <label className="block text-[12px] text-[var(--text2)] mb-1">Bank Name</label>
                                <input value={form.bankName} onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))}
                                    className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors"
                                    placeholder="Bank name" />
                            </div>
                            <div>
                                <label className="block text-[12px] text-[var(--text2)] mb-1">IFSC Code</label>
                                <input value={form.bankIFSC} onChange={e => setForm(f => ({ ...f, bankIFSC: e.target.value }))}
                                    className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors"
                                    placeholder="IFSC code" />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-[12px] text-[var(--text2)] mb-1">Account Number</label>
                                <input value={form.bankAccountNumber} onChange={e => setForm(f => ({ ...f, bankAccountNumber: e.target.value }))}
                                    className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors"
                                    placeholder="Account number" />
                            </div>
                        </div>
                    </div>
                </form>
                <div className="px-6 py-4 border-t border-[var(--border)] flex items-center justify-end gap-2">
                    <button onClick={onClose} type="button" className="px-4 py-2 text-[13px] font-medium text-[var(--text2)] hover:text-[var(--text)] rounded-[8px] hover:bg-[var(--surface2)] transition-colors">
                        Cancel
                    </button>
                    <button onClick={handleSubmit as unknown as React.MouseEventHandler<HTMLButtonElement>} disabled={loading}
                        className="inline-flex items-center gap-2 px-5 py-2 bg-[var(--accent)] text-white rounded-[8px] text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                        {loading && <Loader2 size={14} className="animate-spin" />}
                        {employee ? "Save Changes" : "Add Employee"}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Detail Drawer ─────────────────────────────────────────────────────────────

function EmployeeDrawer({ employee, onClose, onEdit }: { employee: Employee | null; onClose: () => void; onEdit: (e: Employee) => void }) {
    const [activeTab, setActiveTab] = useState("profile")
    const [detail, setDetail] = useState<Record<string, unknown> | null>(null)
    const [loadingDetail, setLoadingDetail] = useState(false)

    useEffect(() => {
        if (employee) {
            setLoadingDetail(true)
            setActiveTab("profile")
            fetch(`/api/employees/${employee.id}`)
                .then(r => r.json())
                .then(setDetail)
                .catch(() => setDetail(null))
                .finally(() => setLoadingDetail(false))
        }
    }, [employee])

    if (!employee) return null

    const status = STATUS_CONFIG[employee.status] || STATUS_CONFIG.ACTIVE
    const tabs = ["profile", "attendance", "leaves", "payroll"]

    return (
        <div className="fixed inset-0 z-50 flex">
            <div className="flex-1 bg-black/40" onClick={onClose} />
            <div className="w-full max-w-[480px] bg-white h-full overflow-hidden flex flex-col shadow-2xl">
                {/* Header */}
                <div className="px-5 py-4 border-b border-[var(--border)] flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <Avatar firstName={employee.firstName} lastName={employee.lastName} photo={employee.photo} size={44} />
                        <div>
                            <h3 className="text-[15px] font-semibold text-[var(--text)]">{employee.firstName} {employee.lastName}</h3>
                            <p className="text-[12px] text-[var(--text3)]">{employee.employeeId} · {employee.designation || "No Designation"}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span style={{ color: status.color, background: status.bg, borderColor: status.border }}
                            className="px-2 py-0.5 rounded-full text-[11px] font-semibold border">
                            {status.label}
                        </span>
                        <button onClick={() => onEdit(employee)} className="p-1.5 rounded-md hover:bg-[var(--surface2)] text-[var(--text3)] transition-colors">
                            <Edit2 size={15} />
                        </button>
                        <button onClick={onClose} className="p-1.5 rounded-md hover:bg-[var(--surface2)] text-[var(--text3)] transition-colors">
                            <X size={15} />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-[var(--border)] px-5">
                    {tabs.map(t => (
                        <button key={t} onClick={() => setActiveTab(t)}
                            className={`px-3 py-3 text-[12px] font-medium capitalize border-b-2 -mb-px transition-colors ${activeTab === t ? "border-[var(--accent)] text-[var(--accent-text)]" : "border-transparent text-[var(--text3)] hover:text-[var(--text)]"}`}>
                            {t}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5">
                    {loadingDetail ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 size={24} className="animate-spin text-[var(--accent)]" />
                        </div>
                    ) : activeTab === "profile" ? (
                        <div className="space-y-5">
                            <div className="grid grid-cols-2 gap-3">
                                <InfoItem label="Branch" value={employee.branch.name} icon={<Building2 size={13} />} />
                                <InfoItem label="Department" value={employee.department?.name || "—"} icon={<Briefcase size={13} />} />
                                <InfoItem label="Phone" value={employee.phone} icon={<Phone size={13} />} />
                                <InfoItem label="Email" value={employee.email || "—"} icon={<Mail size={13} />} />
                                <InfoItem label="Employment" value={employee.employmentType} icon={<FileText size={13} />} />
                                <InfoItem label="Basic Salary" value={`₹${employee.basicSalary.toLocaleString()}`} icon={<DollarSign size={13} />} />
                                {employee.dateOfJoining && (
                                    <InfoItem label="Date of Joining" value={format(new Date(employee.dateOfJoining), "dd MMM yyyy")} icon={<Calendar size={13} />} />
                                )}
                            </div>
                            {detail && (
                                <div className="space-y-3 mt-4">
                                    {(detail.aadharNumber as string) && <InfoItem label="Aadhar" value={detail.aadharNumber as string} icon={<FileText size={13} />} />}
                                    {(detail.panNumber as string) && <InfoItem label="PAN" value={detail.panNumber as string} icon={<FileText size={13} />} />}
                                    {(detail.bankName as string) && <InfoItem label="Bank" value={`${detail.bankName as string} — ${detail.bankIFSC as string || ""}`} icon={<DollarSign size={13} />} />}
                                </div>
                            )}
                        </div>
                    ) : activeTab === "attendance" ? (
                        <div className="space-y-2">
                            {(detail?.attendances as Array<Record<string, unknown>> | undefined)?.length === 0 && <p className="text-[13px] text-[var(--text3)] text-center py-8">No attendance records</p>}
                            {(detail?.attendances as Array<Record<string, unknown>> | undefined)?.map((a: Record<string, unknown>) => (
                                <div key={a.id as string} className="flex items-center justify-between p-3 rounded-[10px] border border-[var(--border)] bg-[var(--surface2)]/30">
                                    <div>
                                        <p className="text-[13px] font-medium text-[var(--text)]">{format(new Date(a.date as string), "dd MMM yyyy")}</p>
                                        <p className="text-[11px] text-[var(--text3)]">
                                            {a.checkIn ? format(new Date(a.checkIn as string), "HH:mm") : "--"} — {a.checkOut ? format(new Date(a.checkOut as string), "HH:mm") : "--"}
                                        </p>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${a.status === "PRESENT" ? "bg-[#e8f7f1] text-[#1a9e6e]" : a.status === "ABSENT" ? "bg-[#fef2f2] text-[#dc2626]" : "bg-[#fffbeb] text-[#f59e0b]"}`}>
                                        {a.status as string}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : activeTab === "leaves" ? (
                        <div className="space-y-2">
                            {(detail?.leaves as Array<Record<string, unknown>> | undefined)?.length === 0 && <p className="text-[13px] text-[var(--text3)] text-center py-8">No leave records</p>}
                            {(detail?.leaves as Array<Record<string, unknown>> | undefined)?.map((l: Record<string, unknown>) => (
                                <div key={l.id as string} className="p-3 rounded-[10px] border border-[var(--border)] bg-[var(--surface2)]/30">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[13px] font-medium text-[var(--text)]">{l.type as string}</span>
                                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${l.status === "APPROVED" ? "bg-[#e8f7f1] text-[#1a9e6e]" : l.status === "REJECTED" ? "bg-[#fef2f2] text-[#dc2626]" : "bg-[#fffbeb] text-[#f59e0b]"}`}>
                                            {l.status as string}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-[var(--text3)]">{format(new Date(l.startDate as string), "dd MMM")} — {format(new Date(l.endDate as string), "dd MMM yyyy")} · {l.days as number} day{(l.days as number) > 1 ? "s" : ""}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {(detail?.payrolls as Array<Record<string, unknown>> | undefined)?.length === 0 && <p className="text-[13px] text-[var(--text3)] text-center py-8">No payroll records</p>}
                            {(detail?.payrolls as Array<Record<string, unknown>> | undefined)?.map((p: Record<string, unknown>) => (
                                <div key={p.id as string} className="p-3 rounded-[10px] border border-[var(--border)] bg-[var(--surface2)]/30">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[13px] font-medium text-[var(--text)]">{getMonthName(p.month as number)} {p.year as number}</span>
                                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${p.status === "PAID" ? "bg-[#e8f7f1] text-[#1a9e6e]" : p.status === "PROCESSED" ? "bg-[#eff6ff] text-[#3b82f6]" : "bg-[#f9fafb] text-[#6b7280]"}`}>
                                            {p.status as string}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-[var(--text3)]">Net: ₹{(p.netSalary as number).toLocaleString()} · Gross: ₹{(p.grossSalary as number).toLocaleString()}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

function InfoItem({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
    return (
        <div className="flex items-start gap-2 p-3 rounded-[10px] bg-[var(--surface2)]/40 border border-[var(--border)]">
            <span className="text-[var(--text3)] mt-0.5">{icon}</span>
            <div className="min-w-0">
                <p className="text-[10.5px] text-[var(--text3)] font-medium uppercase tracking-[0.4px]">{label}</p>
                <p className="text-[13px] text-[var(--text)] font-medium truncate">{value}</p>
            </div>
        </div>
    )
}

function getMonthName(month: number) {
    return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][month - 1]
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EmployeesPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [employees, setEmployees] = useState<Employee[]>([])
    const [branches, setBranches] = useState<Branch[]>([])
    const [departments, setDepartments] = useState<Department[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [branchFilter, setBranchFilter] = useState("")
    const [deptFilter, setDeptFilter] = useState("")
    const [statusFilter, setStatusFilter] = useState("")
    const [showModal, setShowModal] = useState(false)
    const [editEmployee, setEditEmployee] = useState<Employee | null>(null)
    const [drawerEmployee, setDrawerEmployee] = useState<Employee | null>(null)

    useEffect(() => {
        if (status === "unauthenticated") router.push("/login")
        if (status === "authenticated" && session?.user?.role !== "ADMIN" && session?.user?.role !== "MANAGER") {
            router.push("/")
        }
    }, [status, session, router])

    const fetchEmployees = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (branchFilter) params.set("branchId", branchFilter)
            if (deptFilter) params.set("departmentId", deptFilter)
            if (statusFilter) params.set("status", statusFilter)
            if (search) params.set("search", search)
            const res = await fetch(`/api/employees?${params}`)
            const data = await res.json()
            setEmployees(Array.isArray(data) ? data : [])
        } catch {
            toast.error("Failed to load employees")
        } finally {
            setLoading(false)
        }
    }, [branchFilter, deptFilter, statusFilter, search])

    useEffect(() => {
        if (status === "authenticated") {
            fetchEmployees()
        }
    }, [status, fetchEmployees])

    useEffect(() => {
        fetch("/api/branches").then(r => r.json()).then(data => setBranches(Array.isArray(data) ? data : [])).catch(() => {})
    }, [])

    useEffect(() => {
        if (branchFilter) {
            fetch(`/api/departments?branchId=${branchFilter}`).then(r => r.json()).then(data => setDepartments(Array.isArray(data) ? data : [])).catch(() => {})
        } else {
            setDepartments([])
            setDeptFilter("")
        }
    }, [branchFilter])

    // Stats
    const total = employees.length
    const active = employees.filter(e => e.status === "ACTIVE").length
    const onLeave = employees.filter(e => e.status === "ON_LEAVE").length
    const thisMonth = employees.filter(e => {
        const created = new Date(e.createdAt)
        const now = new Date()
        return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear()
    }).length

    if (status === "loading") {
        return <div className="flex items-center justify-center min-h-screen"><Loader2 size={28} className="animate-spin text-[var(--accent)]" /></div>
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-[24px] font-semibold tracking-[-0.4px] text-[var(--text)]">Employees</h1>
                    <p className="text-[13px] text-[var(--text3)] mt-0.5">Manage your workforce</p>
                </div>
                <button onClick={() => { setEditEmployee(null); setShowModal(true) }}
                    className="inline-flex items-center gap-2 bg-[var(--accent)] text-white rounded-[10px] text-[13px] font-medium px-4 py-2 hover:opacity-90 transition-opacity">
                    <Plus size={16} /> Add Employee
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: "Total Employees", value: total, icon: <Users size={18} />, color: "#3b82f6", bg: "#eff6ff" },
                    { label: "Active", value: active, icon: <CheckCircle size={18} />, color: "#1a9e6e", bg: "#e8f7f1" },
                    { label: "On Leave", value: onLeave, icon: <Clock size={18} />, color: "#f59e0b", bg: "#fffbeb" },
                    { label: "New This Month", value: thisMonth, icon: <TrendingUp size={18} />, color: "#8b5cf6", bg: "#f5f3ff" },
                ].map(stat => (
                    <div key={stat.label} className="bg-white border border-[var(--border)] rounded-[12px] p-4 flex items-center gap-3">
                        <div style={{ background: stat.bg, color: stat.color }} className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0">
                            {stat.icon}
                        </div>
                        <div>
                            <p className="text-[22px] font-bold text-[var(--text)] leading-tight">{stat.value}</p>
                            <p className="text-[11.5px] text-[var(--text3)]">{stat.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="bg-white border border-[var(--border)] rounded-[12px] p-4 flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text3)]" />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search by name, ID, phone..."
                        className="w-full h-9 rounded-[8px] border border-[var(--border)] bg-[var(--surface2)]/30 pl-8 pr-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors" />
                </div>
                <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)}
                    className="h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors">
                    <option value="">All Branches</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                {departments.length > 0 && (
                    <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
                        className="h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors">
                        <option value="">All Departments</option>
                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                )}
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                    className="h-9 rounded-[8px] border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors">
                    <option value="">All Status</option>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <button onClick={fetchEmployees} className="h-9 px-4 rounded-[8px] border border-[var(--border)] bg-white text-[13px] text-[var(--text2)] hover:text-[var(--text)] hover:bg-[var(--surface2)] transition-colors flex items-center gap-2">
                    <Filter size={14} /> Apply
                </button>
            </div>

            {/* Employee List */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 size={28} className="animate-spin text-[var(--accent)]" />
                </div>
            ) : employees.length === 0 ? (
                <div className="flex min-h-[300px] flex-col items-center justify-center rounded-[14px] bg-white border border-dashed border-[var(--border)] shadow-sm">
                    <UserCheck size={36} className="text-[var(--text3)] mb-2" />
                    <h3 className="text-[15px] font-semibold text-[var(--text)]">No employees found</h3>
                    <p className="text-[13px] text-[var(--text3)] mt-1">Add your first employee to get started.</p>
                </div>
            ) : (
                <div className="bg-white border border-[var(--border)] rounded-[12px] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-[var(--border)] bg-[var(--surface2)]/40">
                                    <th className="text-left text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px] px-5 py-3">Employee</th>
                                    <th className="text-left text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px] px-4 py-3">Designation</th>
                                    <th className="text-left text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px] px-4 py-3">Branch</th>
                                    <th className="text-left text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px] px-4 py-3">Phone</th>
                                    <th className="text-left text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px] px-4 py-3">Status</th>
                                    <th className="text-right text-[11px] font-semibold text-[var(--text3)] uppercase tracking-[0.5px] px-5 py-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {employees.map((emp, i) => {
                                    const s = STATUS_CONFIG[emp.status] || STATUS_CONFIG.ACTIVE
                                    return (
                                        <tr key={emp.id} className={`border-b border-[var(--border)] hover:bg-[var(--surface2)]/30 transition-colors ${i === employees.length - 1 ? "border-b-0" : ""}`}>
                                            <td className="px-5 py-3">
                                                <div className="flex items-center gap-3">
                                                    <Avatar firstName={emp.firstName} lastName={emp.lastName} photo={emp.photo} size={36} />
                                                    <div>
                                                        <p className="text-[13px] font-semibold text-[var(--text)]">{emp.firstName} {emp.lastName}</p>
                                                        <p className="text-[11px] text-[var(--text3)]">{emp.employeeId}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-[13px] text-[var(--text2)]">{emp.designation || "—"}</td>
                                            <td className="px-4 py-3 text-[13px] text-[var(--text2)]">{emp.branch.name}</td>
                                            <td className="px-4 py-3 text-[13px] text-[var(--text2)]">{emp.phone}</td>
                                            <td className="px-4 py-3">
                                                <span style={{ color: s.color, background: s.bg, borderColor: s.border }}
                                                    className="px-2 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap">
                                                    {s.label}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button onClick={() => setDrawerEmployee(emp)}
                                                        className="p-1.5 rounded-md hover:bg-[var(--surface2)] text-[var(--text3)] transition-colors" title="View">
                                                        <Eye size={14} />
                                                    </button>
                                                    <button onClick={() => { setEditEmployee(emp); setShowModal(true) }}
                                                        className="p-1.5 rounded-md hover:bg-[var(--surface2)] text-[var(--text3)] transition-colors" title="Edit">
                                                        <Edit2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modals */}
            <EmployeeModal
                open={showModal}
                onClose={() => { setShowModal(false); setEditEmployee(null) }}
                onSaved={fetchEmployees}
                branches={branches}
                employee={editEmployee}
            />
            <EmployeeDrawer
                employee={drawerEmployee}
                onClose={() => setDrawerEmployee(null)}
                onEdit={(e) => { setDrawerEmployee(null); setEditEmployee(e); setShowModal(true) }}
            />
        </div>
    )
}
