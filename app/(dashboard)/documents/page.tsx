"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import {
    FileText,
    Plus,
    CheckCircle2,
    Clock,
    XCircle,
    Download,
    Eye,
    Settings,
    Loader2,
    X,
    Save,
    Edit2,
    Trash2,
    FileCheck,
    FilePlus,
    Users,
    Search,
    Send,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Employee {
    id: string
    firstName: string
    lastName: string
    employeeId: string
    designation: string
    department?: { name: string }
    branch?: { name: string }
}

interface HRDocTemplate {
    id: string
    name: string
    type: string
    description?: string
    templateContent: string
    approvalRequired: boolean
    isActive: boolean
    createdAt: string
}

interface HRDocument {
    id: string
    docNumber: string
    title: string
    type: string
    status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "ISSUED"
    effectiveDate?: string
    issuedAt?: string
    approvedAt?: string
    rejectedAt?: string
    rejectionReason?: string
    acknowledgedAt?: string
    content: string
    createdAt: string
    createdBy: string
    employee: {
        id: string
        firstName: string
        lastName: string
        employeeId: string
        designation: string
    }
    template?: {
        id: string
        name: string
        type: string
        approvalRequired: boolean
    }
}

interface Stats {
    total: number
    pending: number
    draft: number
    issued: number
    approved: number
    rejected: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DOC_TYPES = [
    { value: "OFFER_LETTER", label: "Offer Letter" },
    { value: "APPOINTMENT", label: "Appointment Letter" },
    { value: "CONFIRMATION", label: "Confirmation Letter" },
    { value: "EXPERIENCE", label: "Experience Letter" },
    { value: "RELIEVING", label: "Relieving Letter" },
    { value: "SALARY_CERT", label: "Salary Certificate" },
    { value: "WARNING", label: "Warning Letter" },
    { value: "OTHER", label: "Other" },
]

const DEFAULT_TEMPLATE_CONTENTS: Record<string, string> = {
    APPOINTMENT: `<div style="font-family: Arial, sans-serif; padding: 40px; max-width: 700px; margin: 0 auto;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h2 style="color: #1e3799; font-size: 22px; font-weight: bold;">FALCON PLUS</h2>
    <p style="color: #666; font-size: 12px;">HR Department</p>
  </div>
  <h3 style="text-align: center; text-decoration: underline; color: #333;">APPOINTMENT LETTER</h3>
  <p style="margin-top: 20px;"><strong>Date:</strong> {{date}}</p>
  <p><strong>Ref No:</strong> {{doc_number}}</p>
  <br/>
  <p>Dear <strong>{{employee_name}}</strong>,</p>
  <p>We are pleased to appoint you as <strong>{{designation}}</strong> in our organization with effect from <strong>{{joining_date}}</strong>.</p>
  <p>Your appointment is subject to the following terms and conditions:</p>
  <ul>
    <li>Department: {{department}}</li>
    <li>Designation: {{designation}}</li>
    <li>Date of Joining: {{joining_date}}</li>
    <li>Basic Salary: ₹{{salary}} per month</li>
  </ul>
  <p>We look forward to your contribution and wish you a successful career with us.</p>
  <br/>
  <p>Yours sincerely,</p>
  <br/><br/>
  <p>_________________________</p>
  <p><strong>Authorized Signatory</strong><br/>{{company_name}}</p>
</div>`,
    EXPERIENCE: `<div style="font-family: Arial, sans-serif; padding: 40px; max-width: 700px; margin: 0 auto;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h2 style="color: #1e3799;">FALCON PLUS</h2>
  </div>
  <h3 style="text-align: center; text-decoration: underline;">EXPERIENCE LETTER</h3>
  <p><strong>Date:</strong> {{date}}</p>
  <p>To Whomsoever It May Concern,</p>
  <p>This is to certify that <strong>{{employee_name}}</strong> (Employee ID: {{employee_id}}) has worked with us as <strong>{{designation}}</strong> in the <strong>{{department}}</strong> department from <strong>{{joining_date}}</strong> to <strong>{{effective_date}}</strong>.</p>
  <p>During their tenure, they have shown dedication and professionalism. We wish them all the best for their future endeavors.</p>
  <br/>
  <p>Yours sincerely,</p>
  <br/><br/>
  <p>_________________________</p>
  <p><strong>HR Manager</strong><br/>{{company_name}}</p>
</div>`,
    SALARY_CERT: `<div style="font-family: Arial, sans-serif; padding: 40px; max-width: 700px; margin: 0 auto;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h2 style="color: #1e3799;">FALCON PLUS</h2>
  </div>
  <h3 style="text-align: center; text-decoration: underline;">SALARY CERTIFICATE</h3>
  <p><strong>Date:</strong> {{date}}</p>
  <p>To Whomsoever It May Concern,</p>
  <p>This is to certify that <strong>{{employee_name}}</strong>, employed as <strong>{{designation}}</strong> in our organization, is drawing a Basic Salary of <strong>₹{{salary}}</strong> per month.</p>
  <p>This certificate is issued on request for the purpose of personal use.</p>
  <br/>
  <p>Yours faithfully,</p>
  <br/><br/>
  <p>_________________________</p>
  <p><strong>Authorized Signatory</strong><br/>{{company_name}}</p>
</div>`,
    OFFER_LETTER: `<div style="font-family: Arial, sans-serif; padding: 40px; max-width: 700px; margin: 0 auto;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h2 style="color: #1e3799; font-size: 22px; font-weight: bold;">FALCON PLUS</h2>
    <p style="color: #666; font-size: 12px;">HR Department</p>
  </div>
  <h3 style="text-align: center; text-decoration: underline; color: #333;">OFFER LETTER</h3>
  <p style="margin-top: 20px;"><strong>Date:</strong> {{date}}</p>
  <br/>
  <p>Dear <strong>{{employee_name}}</strong>,</p>
  <p>We are pleased to offer you the position of <strong>{{designation}}</strong> at {{company_name}}.</p>
  <p><strong>Proposed Date of Joining:</strong> {{effective_date}}</p>
  <p><strong>Department:</strong> {{department}}</p>
  <p><strong>Basic Salary:</strong> ₹{{salary}} per month</p>
  <p>Please confirm your acceptance of this offer by signing and returning a copy of this letter.</p>
  <br/>
  <p>Yours sincerely,</p>
  <br/><br/>
  <p>_________________________</p>
  <p><strong>HR Manager</strong><br/>{{company_name}}</p>
</div>`,
    CONFIRMATION: `<div style="font-family: Arial, sans-serif; padding: 40px; max-width: 700px; margin: 0 auto;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h2 style="color: #1e3799; font-size: 22px;">FALCON PLUS</h2>
  </div>
  <h3 style="text-align: center; text-decoration: underline;">CONFIRMATION LETTER</h3>
  <p><strong>Date:</strong> {{date}}</p>
  <p>Dear <strong>{{employee_name}}</strong>,</p>
  <p>We are pleased to inform you that your services have been confirmed as <strong>{{designation}}</strong> in the <strong>{{department}}</strong> department with effect from <strong>{{effective_date}}</strong>.</p>
  <p>We appreciate your contributions and look forward to your continued association.</p>
  <br/>
  <p>Yours sincerely,</p>
  <br/><br/>
  <p>_________________________</p>
  <p><strong>HR Manager</strong><br/>{{company_name}}</p>
</div>`,
    RELIEVING: `<div style="font-family: Arial, sans-serif; padding: 40px; max-width: 700px; margin: 0 auto;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h2 style="color: #1e3799; font-size: 22px;">FALCON PLUS</h2>
  </div>
  <h3 style="text-align: center; text-decoration: underline;">RELIEVING LETTER</h3>
  <p><strong>Date:</strong> {{date}}</p>
  <p>To Whomsoever It May Concern,</p>
  <p>This is to certify that <strong>{{employee_name}}</strong> (Employee ID: {{employee_id}}) has been relieved from the position of <strong>{{designation}}</strong> in the <strong>{{department}}</strong> department with effect from <strong>{{effective_date}}</strong>.</p>
  <p>We wish them all the best in their future endeavors.</p>
  <br/>
  <p>Yours sincerely,</p>
  <br/><br/>
  <p>_________________________</p>
  <p><strong>HR Manager</strong><br/>{{company_name}}</p>
</div>`,
    WARNING: `<div style="font-family: Arial, sans-serif; padding: 40px; max-width: 700px; margin: 0 auto;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h2 style="color: #1e3799; font-size: 22px;">FALCON PLUS</h2>
  </div>
  <h3 style="text-align: center; text-decoration: underline;">WARNING LETTER</h3>
  <p><strong>Date:</strong> {{date}}</p>
  <p>Dear <strong>{{employee_name}}</strong>,</p>
  <p>This letter serves as a formal warning regarding your conduct/performance. This is being brought to your attention as it does not meet the standards expected of a <strong>{{designation}}</strong> in our organization.</p>
  <p>We expect immediate improvement and compliance with company policies. Please note that continued non-compliance may result in further disciplinary action.</p>
  <br/>
  <p>Yours sincerely,</p>
  <br/><br/>
  <p>_________________________</p>
  <p><strong>HR Manager</strong><br/>{{company_name}}</p>
</div>`,
    OTHER: `<div style="font-family: Arial, sans-serif; padding: 40px; max-width: 700px; margin: 0 auto;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h2 style="color: #1e3799; font-size: 22px;">FALCON PLUS</h2>
  </div>
  <h3 style="text-align: center; text-decoration: underline;">HR LETTER</h3>
  <p><strong>Date:</strong> {{date}}</p>
  <p>Dear <strong>{{employee_name}}</strong>,</p>
  <p><!-- Your content here --></p>
  <br/>
  <p>Yours sincerely,</p>
  <br/><br/>
  <p>_________________________</p>
  <p><strong>Authorized Signatory</strong><br/>{{company_name}}</p>
</div>`,
}

const AVAILABLE_VARIABLES = [
    "{{employee_name}}",
    "{{designation}}",
    "{{department}}",
    "{{joining_date}}",
    "{{salary}}",
    "{{company_name}}",
    "{{employee_id}}",
    "{{date}}",
    "{{effective_date}}",
    "{{doc_number}}",
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
    const map: Record<string, { bg: string; text: string; label: string }> = {
        DRAFT: { bg: "bg-gray-100", text: "text-gray-600", label: "Draft" },
        PENDING_APPROVAL: { bg: "bg-amber-100", text: "text-amber-700", label: "Pending Approval" },
        APPROVED: { bg: "bg-blue-100", text: "text-blue-700", label: "Approved" },
        REJECTED: { bg: "bg-red-100", text: "text-red-700", label: "Rejected" },
        ISSUED: { bg: "bg-green-100", text: "text-green-700", label: "Issued" },
    }
    const s = map[status] || map.DRAFT
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${s.bg} ${s.text}`}>
            {s.label}
        </span>
    )
}

function typeLabel(type: string) {
    return DOC_TYPES.find((t) => t.value === type)?.label || type
}

function formatDate(dateStr?: string | null) {
    if (!dateStr) return "—"
    return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DocumentsPage() {
    const { data: session } = useSession()
    const isManager = session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER"

    const [activeTab, setActiveTab] = useState<"dashboard" | "generate" | "templates" | "approvals">("dashboard")

    // Data
    const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, draft: 0, issued: 0, approved: 0, rejected: 0 })
    const [documents, setDocuments] = useState<HRDocument[]>([])
    const [templates, setTemplates] = useState<HRDocTemplate[]>([])
    const [employees, setEmployees] = useState<Employee[]>([])
    const [pendingDocs, setPendingDocs] = useState<HRDocument[]>([])

    // Loading
    const [loadingStats, setLoadingStats] = useState(true)
    const [loadingDocs, setLoadingDocs] = useState(true)
    const [loadingTemplates, setLoadingTemplates] = useState(true)
    const [loadingEmployees, setLoadingEmployees] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    // Generate form
    const [genEmployeeId, setGenEmployeeId] = useState("")
    const [genTemplateId, setGenTemplateId] = useState("")
    const [genEffectiveDate, setGenEffectiveDate] = useState("")
    const [genCustomTitle, setGenCustomTitle] = useState("")
    const [genEmployeeSearch, setGenEmployeeSearch] = useState("")
    const [showPreviewModal, setShowPreviewModal] = useState(false)
    const [previewContent, setPreviewContent] = useState("")

    // Template form
    const [showTemplateForm, setShowTemplateForm] = useState(false)
    const [editingTemplate, setEditingTemplate] = useState<HRDocTemplate | null>(null)
    const [tplName, setTplName] = useState("")
    const [tplType, setTplType] = useState("")
    const [tplDescription, setTplDescription] = useState("")
    const [tplApprovalRequired, setTplApprovalRequired] = useState(true)
    const [tplContent, setTplContent] = useState("")

    // Document detail modal
    const [viewingDoc, setViewingDoc] = useState<HRDocument | null>(null)
    const [showDocModal, setShowDocModal] = useState(false)
    const [rejectReason, setRejectReason] = useState("")
    const [showRejectInput, setShowRejectInput] = useState(false)
    const [actioningDocId, setActioningDocId] = useState<string | null>(null)

    // Filter
    const [filterStatus, setFilterStatus] = useState("")
    const [filterType, setFilterType] = useState("")
    const [docSearch, setDocSearch] = useState("")

    // ─── Fetchers ─────────────────────────────────────────────────────────────

    const fetchStats = useCallback(async () => {
        setLoadingStats(true)
        try {
            const res = await fetch("/api/hr-documents/stats")
            if (!res.ok) throw new Error()
            setStats(await res.json())
        } catch {
            toast.error("Failed to load stats")
        } finally {
            setLoadingStats(false)
        }
    }, [])

    const fetchDocuments = useCallback(async () => {
        setLoadingDocs(true)
        try {
            const params = new URLSearchParams()
            if (filterStatus) params.set("status", filterStatus)
            if (filterType) params.set("type", filterType)
            const res = await fetch(`/api/hr-documents?${params}`)
            if (!res.ok) throw new Error()
            const data: HRDocument[] = await res.json()
            setDocuments(data)
            setPendingDocs(data.filter((d) => d.status === "PENDING_APPROVAL"))
        } catch {
            toast.error("Failed to load documents")
        } finally {
            setLoadingDocs(false)
        }
    }, [filterStatus, filterType])

    const fetchTemplates = useCallback(async () => {
        setLoadingTemplates(true)
        try {
            const res = await fetch("/api/hr-documents/templates")
            if (!res.ok) throw new Error()
            setTemplates(await res.json())
        } catch {
            toast.error("Failed to load templates")
        } finally {
            setLoadingTemplates(false)
        }
    }, [])

    const fetchEmployees = useCallback(async () => {
        setLoadingEmployees(true)
        try {
            const res = await fetch("/api/employees?limit=1000")
            if (!res.ok) throw new Error()
            const data = await res.json()
            setEmployees(data.employees || data)
        } catch {
            toast.error("Failed to load employees")
        } finally {
            setLoadingEmployees(false)
        }
    }, [])

    useEffect(() => {
        fetchStats()
        fetchDocuments()
        fetchTemplates()
    }, [fetchStats, fetchDocuments, fetchTemplates])

    useEffect(() => {
        if (activeTab === "generate") fetchEmployees()
    }, [activeTab, fetchEmployees])

    useEffect(() => {
        fetchDocuments()
    }, [filterStatus, filterType, fetchDocuments])

    // ─── Generate handlers ────────────────────────────────────────────────────

    const selectedTemplate = templates.find((t) => t.id === genTemplateId)

    function handleGeneratePreview() {
        if (!genEmployeeId || !genTemplateId) {
            toast.error("Please select an employee and template")
            return
        }
        const emp = employees.find((e) => e.id === genEmployeeId)
        if (!emp || !selectedTemplate) return

        let content = selectedTemplate.templateContent
        const vars: Record<string, string> = {
            employee_name: `${emp.firstName} ${emp.lastName}`,
            designation: emp.designation || "",
            department: emp.department?.name || "",
            joining_date: "",
            salary: "",
            company_name: "Falcon Plus",
            employee_id: emp.employeeId || "",
            date: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }),
            effective_date: genEffectiveDate
                ? new Date(genEffectiveDate).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })
                : "",
            doc_number: "DOC-PREVIEW",
        }
        for (const [key, value] of Object.entries(vars)) {
            content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value)
        }
        setPreviewContent(content)
        setShowPreviewModal(true)
    }

    async function handleGenerateDocument(action: "draft" | "pending" | "issue") {
        if (!genEmployeeId || !genTemplateId) {
            toast.error("Please select an employee and template")
            return
        }
        setSubmitting(true)
        try {
            const statusOverride = action === "pending" ? "PENDING_APPROVAL" : undefined
            const res = await fetch("/api/hr-documents", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    templateId: genTemplateId,
                    employeeId: genEmployeeId,
                    effectiveDate: genEffectiveDate || undefined,
                    customTitle: genCustomTitle || undefined,
                    statusOverride,
                }),
            })
            if (!res.ok) {
                const text = await res.text()
                throw new Error(text)
            }
            const doc: HRDocument = await res.json()

            // If action is "issue" and doc is in DRAFT state and no approval required, issue it
            if (action === "issue" && doc.status === "DRAFT") {
                const issueRes = await fetch(`/api/hr-documents/${doc.id}/issue`, { method: "POST" })
                if (!issueRes.ok) throw new Error("Failed to issue document")
            }

            toast.success("Document generated successfully")
            setGenEmployeeId("")
            setGenTemplateId("")
            setGenEffectiveDate("")
            setGenCustomTitle("")
            fetchDocuments()
            fetchStats()
            setActiveTab("dashboard")
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to generate document")
        } finally {
            setSubmitting(false)
        }
    }

    // ─── Template CRUD ─────────────────────────────────────────────────────────

    function openNewTemplate() {
        setEditingTemplate(null)
        setTplName("")
        setTplType("")
        setTplDescription("")
        setTplApprovalRequired(true)
        setTplContent("")
        setShowTemplateForm(true)
    }

    function openEditTemplate(t: HRDocTemplate) {
        setEditingTemplate(t)
        setTplName(t.name)
        setTplType(t.type)
        setTplDescription(t.description || "")
        setTplApprovalRequired(t.approvalRequired)
        setTplContent(t.templateContent)
        setShowTemplateForm(true)
    }

    function handleTplTypeChange(type: string) {
        setTplType(type)
        if (!editingTemplate && DEFAULT_TEMPLATE_CONTENTS[type]) {
            setTplContent(DEFAULT_TEMPLATE_CONTENTS[type])
        }
    }

    async function handleSaveTemplate() {
        if (!tplName || !tplType || !tplContent) {
            toast.error("Name, type and content are required")
            return
        }
        setSubmitting(true)
        try {
            const url = editingTemplate
                ? `/api/hr-documents/templates/${editingTemplate.id}`
                : "/api/hr-documents/templates"
            const method = editingTemplate ? "PUT" : "POST"
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: tplName,
                    type: tplType,
                    description: tplDescription,
                    templateContent: tplContent,
                    approvalRequired: tplApprovalRequired,
                }),
            })
            if (!res.ok) throw new Error(await res.text())
            toast.success(editingTemplate ? "Template updated" : "Template created")
            setShowTemplateForm(false)
            fetchTemplates()
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to save template")
        } finally {
            setSubmitting(false)
        }
    }

    async function handleDeleteTemplate(id: string) {
        if (!confirm("Delete this template? This cannot be undone.")) return
        try {
            const res = await fetch(`/api/hr-documents/templates/${id}`, { method: "DELETE" })
            if (!res.ok) throw new Error()
            toast.success("Template deleted")
            fetchTemplates()
        } catch {
            toast.error("Failed to delete template")
        }
    }

    // ─── Approval handlers ────────────────────────────────────────────────────

    async function handleApprove(docId: string) {
        setActioningDocId(docId)
        try {
            const res = await fetch(`/api/hr-documents/${docId}/approve`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "APPROVE" }),
            })
            if (!res.ok) throw new Error(await res.text())
            toast.success("Document approved")
            fetchDocuments()
            fetchStats()
            setShowDocModal(false)
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to approve")
        } finally {
            setActioningDocId(null)
        }
    }

    async function handleReject(docId: string, reason: string) {
        if (!reason.trim()) {
            toast.error("Please provide a rejection reason")
            return
        }
        setActioningDocId(docId)
        try {
            const res = await fetch(`/api/hr-documents/${docId}/approve`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "REJECT", comments: reason }),
            })
            if (!res.ok) throw new Error(await res.text())
            toast.success("Document rejected")
            setShowRejectInput(false)
            setRejectReason("")
            fetchDocuments()
            fetchStats()
            setShowDocModal(false)
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to reject")
        } finally {
            setActioningDocId(null)
        }
    }

    async function handleIssue(docId: string) {
        setActioningDocId(docId)
        try {
            const res = await fetch(`/api/hr-documents/${docId}/issue`, { method: "POST" })
            if (!res.ok) throw new Error(await res.text())
            toast.success("Document issued")
            fetchDocuments()
            fetchStats()
            setShowDocModal(false)
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Failed to issue document")
        } finally {
            setActioningDocId(null)
        }
    }

    function handleDownload(doc: HRDocument) {
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${doc.title}</title></head><body>${doc.content}</body></html>`
        const blob = new Blob([html], { type: "text/html" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${doc.docNumber}.html`
        a.click()
        URL.revokeObjectURL(url)
    }

    function openDocModal(doc: HRDocument) {
        setViewingDoc(doc)
        setShowDocModal(true)
        setShowRejectInput(false)
        setRejectReason("")
    }

    // ─── Filtered docs ────────────────────────────────────────────────────────

    const filteredDocs = documents.filter((d) => {
        if (docSearch) {
            const q = docSearch.toLowerCase()
            const empName = `${d.employee.firstName} ${d.employee.lastName}`.toLowerCase()
            return empName.includes(q) || d.docNumber.toLowerCase().includes(q) || d.title.toLowerCase().includes(q)
        }
        return true
    })

    const filteredEmployees = employees.filter((e) => {
        if (!genEmployeeSearch) return true
        const q = genEmployeeSearch.toLowerCase()
        return (
            `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
            e.employeeId?.toLowerCase().includes(q) ||
            e.designation?.toLowerCase().includes(q)
        )
    })

    // ─── Tabs ─────────────────────────────────────────────────────────────────

    const tabs = [
        { id: "dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
        { id: "generate", label: "Generate", icon: FilePlus },
        { id: "templates", label: "Templates", icon: Settings },
        { id: "approvals", label: "Approvals", icon: FileCheck, badge: stats.pending },
    ] as const

    return (
        <div className="p-6 max-w-[1200px] mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-[22px] font-semibold text-[var(--text)]">HR Documents</h1>
                    <p className="text-[13px] text-[var(--text3)] mt-0.5">Manage employee letters, certificates and approvals</p>
                </div>
                {isManager && (
                    <button
                        onClick={() => setActiveTab("generate")}
                        className="flex items-center gap-2 bg-[var(--accent)] text-white rounded-xl px-4 py-2 text-[13px] font-medium hover:opacity-90 transition-opacity"
                    >
                        <Plus size={16} />
                        Generate Document
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-[var(--border)] mb-6">
                {tabs.map((tab) => {
                    const Icon = tab.icon
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors relative ${
                                activeTab === tab.id
                                    ? "border-[var(--accent)] text-[var(--accent)]"
                                    : "border-transparent text-[var(--text3)] hover:text-[var(--text)]"
                            }`}
                        >
                            <Icon size={15} />
                            {tab.label}
                            {"badge" in tab && tab.badge > 0 && (
                                <span className="ml-1 bg-amber-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    )
                })}
            </div>

            {/* ── Dashboard Tab ─────────────────────────────────────────────── */}
            {activeTab === "dashboard" && (
                <div className="space-y-6">
                    {/* Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {[
                            { label: "Total Issued", value: stats.issued, icon: FileCheck, color: "text-green-600", bg: "bg-green-50" },
                            { label: "Pending Approval", value: stats.pending, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
                            { label: "Draft", value: stats.draft, icon: FileText, color: "text-gray-600", bg: "bg-gray-50" },
                            { label: "Approved", value: stats.approved, icon: CheckCircle2, color: "text-blue-600", bg: "bg-blue-50" },
                            { label: "Rejected", value: stats.rejected, icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
                        ].map((s) => {
                            const Icon = s.icon
                            return (
                                <div key={s.label} className="border border-[var(--border)] rounded-xl p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-[12px] text-[var(--text3)]">{s.label}</p>
                                        <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center`}>
                                            <Icon size={16} className={s.color} />
                                        </div>
                                    </div>
                                    <p className="text-[24px] font-bold text-[var(--text)]">
                                        {loadingStats ? "—" : s.value}
                                    </p>
                                </div>
                            )
                        })}
                    </div>

                    {/* Filters */}
                    <div className="flex flex-wrap gap-3 items-center">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text3)]" />
                            <input
                                value={docSearch}
                                onChange={(e) => setDocSearch(e.target.value)}
                                placeholder="Search documents..."
                                className="w-full pl-8 pr-3 py-2 text-[13px] border border-[var(--border)] rounded-xl bg-[var(--surface)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                            />
                        </div>
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="px-3 py-2 text-[13px] border border-[var(--border)] rounded-xl bg-[var(--surface)] text-[var(--text)] outline-none"
                        >
                            <option value="">All Status</option>
                            <option value="DRAFT">Draft</option>
                            <option value="PENDING_APPROVAL">Pending Approval</option>
                            <option value="APPROVED">Approved</option>
                            <option value="REJECTED">Rejected</option>
                            <option value="ISSUED">Issued</option>
                        </select>
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="px-3 py-2 text-[13px] border border-[var(--border)] rounded-xl bg-[var(--surface)] text-[var(--text)] outline-none"
                        >
                            <option value="">All Types</option>
                            {DOC_TYPES.map((t) => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Documents table */}
                    <div className="border border-[var(--border)] rounded-xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-[13px]">
                                <thead>
                                    <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
                                        <th className="text-left px-4 py-3 text-[var(--text3)] font-medium">Employee</th>
                                        <th className="text-left px-4 py-3 text-[var(--text3)] font-medium">Type</th>
                                        <th className="text-left px-4 py-3 text-[var(--text3)] font-medium">Doc #</th>
                                        <th className="text-left px-4 py-3 text-[var(--text3)] font-medium">Status</th>
                                        <th className="text-left px-4 py-3 text-[var(--text3)] font-medium">Date</th>
                                        <th className="text-right px-4 py-3 text-[var(--text3)] font-medium">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loadingDocs ? (
                                        <tr>
                                            <td colSpan={6} className="text-center py-12 text-[var(--text3)]">
                                                <Loader2 size={20} className="animate-spin mx-auto mb-2" />
                                                Loading...
                                            </td>
                                        </tr>
                                    ) : filteredDocs.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="text-center py-12 text-[var(--text3)]">
                                                <FileText size={32} className="mx-auto mb-2 opacity-30" />
                                                No documents found
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredDocs.map((doc) => (
                                            <tr key={doc.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface)] transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="font-medium text-[var(--text)]">
                                                        {doc.employee.firstName} {doc.employee.lastName}
                                                    </div>
                                                    <div className="text-[11px] text-[var(--text3)]">{doc.employee.employeeId}</div>
                                                </td>
                                                <td className="px-4 py-3 text-[var(--text3)]">{typeLabel(doc.type)}</td>
                                                <td className="px-4 py-3 font-mono text-[12px] text-[var(--text)]">{doc.docNumber}</td>
                                                <td className="px-4 py-3">{statusBadge(doc.status)}</td>
                                                <td className="px-4 py-3 text-[var(--text3)]">{formatDate(doc.createdAt)}</td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => openDocModal(doc)}
                                                            className="p-1.5 hover:bg-[var(--accent-light)] text-[var(--text3)] hover:text-[var(--accent)] rounded-lg transition-colors"
                                                            title="View"
                                                        >
                                                            <Eye size={14} />
                                                        </button>
                                                        {isManager && doc.status === "APPROVED" && (
                                                            <button
                                                                onClick={() => handleIssue(doc.id)}
                                                                disabled={actioningDocId === doc.id}
                                                                className="p-1.5 hover:bg-green-50 text-[var(--text3)] hover:text-green-600 rounded-lg transition-colors"
                                                                title="Issue"
                                                            >
                                                                {actioningDocId === doc.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                                            </button>
                                                        )}
                                                        {isManager && doc.status === "PENDING_APPROVAL" && (
                                                            <button
                                                                onClick={() => handleApprove(doc.id)}
                                                                disabled={actioningDocId === doc.id}
                                                                className="p-1.5 hover:bg-blue-50 text-[var(--text3)] hover:text-blue-600 rounded-lg transition-colors"
                                                                title="Approve"
                                                            >
                                                                {actioningDocId === doc.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                                            </button>
                                                        )}
                                                        {doc.status === "ISSUED" && (
                                                            <button
                                                                onClick={() => handleDownload(doc)}
                                                                className="p-1.5 hover:bg-green-50 text-[var(--text3)] hover:text-green-600 rounded-lg transition-colors"
                                                                title="Download"
                                                            >
                                                                <Download size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Generate Tab ──────────────────────────────────────────────── */}
            {activeTab === "generate" && (
                <div className="max-w-[680px]">
                    <div className="border border-[var(--border)] rounded-xl p-6 space-y-5">
                        <h2 className="text-[16px] font-semibold text-[var(--text)]">Generate New Document</h2>

                        {/* Employee Search */}
                        <div>
                            <label className="block text-[13px] font-medium text-[var(--text)] mb-1.5">
                                Employee <span className="text-red-500">*</span>
                            </label>
                            <div className="relative mb-2">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text3)]" />
                                <input
                                    value={genEmployeeSearch}
                                    onChange={(e) => setGenEmployeeSearch(e.target.value)}
                                    placeholder="Search by name, ID, designation..."
                                    className="w-full pl-8 pr-3 py-2.5 text-[13px] border border-[var(--border)] rounded-xl bg-[var(--surface)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                                />
                            </div>
                            {loadingEmployees ? (
                                <div className="text-[13px] text-[var(--text3)] py-2 flex items-center gap-2">
                                    <Loader2 size={14} className="animate-spin" /> Loading employees...
                                </div>
                            ) : (
                                <select
                                    value={genEmployeeId}
                                    onChange={(e) => setGenEmployeeId(e.target.value)}
                                    className="w-full px-3 py-2.5 text-[13px] border border-[var(--border)] rounded-xl bg-[var(--surface)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                                    size={Math.min(filteredEmployees.length + 1, 8)}
                                >
                                    <option value="">-- Select Employee --</option>
                                    {filteredEmployees.map((e) => (
                                        <option key={e.id} value={e.id}>
                                            {e.firstName} {e.lastName} — {e.employeeId} — {e.designation}
                                        </option>
                                    ))}
                                </select>
                            )}
                            {genEmployeeId && (
                                <p className="text-[12px] text-green-600 mt-1 flex items-center gap-1">
                                    <CheckCircle2 size={12} />
                                    {(() => {
                                        const e = employees.find((x) => x.id === genEmployeeId)
                                        return e ? `${e.firstName} ${e.lastName} selected` : ""
                                    })()}
                                </p>
                            )}
                        </div>

                        {/* Template */}
                        <div>
                            <label className="block text-[13px] font-medium text-[var(--text)] mb-1.5">
                                Document Template <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={genTemplateId}
                                onChange={(e) => setGenTemplateId(e.target.value)}
                                className="w-full px-3 py-2.5 text-[13px] border border-[var(--border)] rounded-xl bg-[var(--surface)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                            >
                                <option value="">-- Select Template --</option>
                                {templates.filter((t) => t.isActive).map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {t.name} ({typeLabel(t.type)})
                                        {t.approvalRequired ? " — Requires Approval" : " — No Approval"}
                                    </option>
                                ))}
                            </select>
                            {selectedTemplate && (
                                <div className="mt-2 p-3 bg-[var(--accent-light)] rounded-xl text-[12px] text-[var(--text3)]">
                                    {selectedTemplate.description && <p className="mb-1">{selectedTemplate.description}</p>}
                                    <p>
                                        Approval required:{" "}
                                        <span className={selectedTemplate.approvalRequired ? "text-amber-600 font-medium" : "text-green-600 font-medium"}>
                                            {selectedTemplate.approvalRequired ? "Yes" : "No"}
                                        </span>
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Effective Date */}
                        <div>
                            <label className="block text-[13px] font-medium text-[var(--text)] mb-1.5">
                                Effective Date
                            </label>
                            <input
                                type="date"
                                value={genEffectiveDate}
                                onChange={(e) => setGenEffectiveDate(e.target.value)}
                                className="w-full px-3 py-2.5 text-[13px] border border-[var(--border)] rounded-xl bg-[var(--surface)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                            />
                        </div>

                        {/* Custom Title */}
                        <div>
                            <label className="block text-[13px] font-medium text-[var(--text)] mb-1.5">
                                Custom Title <span className="text-[var(--text3)] font-normal">(optional)</span>
                            </label>
                            <input
                                type="text"
                                value={genCustomTitle}
                                onChange={(e) => setGenCustomTitle(e.target.value)}
                                placeholder="Leave blank to use template name"
                                className="w-full px-3 py-2.5 text-[13px] border border-[var(--border)] rounded-xl bg-[var(--surface)] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap gap-3 pt-2">
                            <button
                                onClick={handleGeneratePreview}
                                className="flex items-center gap-2 px-4 py-2 text-[13px] border border-[var(--border)] rounded-xl text-[var(--text)] hover:bg-[var(--surface)] transition-colors"
                            >
                                <Eye size={14} />
                                Preview
                            </button>
                            <button
                                onClick={() => handleGenerateDocument("draft")}
                                disabled={submitting}
                                className="flex items-center gap-2 px-4 py-2 text-[13px] border border-[var(--border)] rounded-xl text-[var(--text)] hover:bg-[var(--surface)] transition-colors disabled:opacity-50"
                            >
                                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                Save Draft
                            </button>
                            {selectedTemplate?.approvalRequired ? (
                                <button
                                    onClick={() => handleGenerateDocument("pending")}
                                    disabled={submitting}
                                    className="flex items-center gap-2 bg-amber-500 text-white rounded-xl px-4 py-2 text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                                >
                                    {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                    Send for Approval
                                </button>
                            ) : (
                                <button
                                    onClick={() => handleGenerateDocument("issue")}
                                    disabled={submitting}
                                    className="flex items-center gap-2 bg-[var(--accent)] text-white rounded-xl px-4 py-2 text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                                >
                                    {submitting ? <Loader2 size={14} className="animate-spin" /> : <FileCheck size={14} />}
                                    Generate &amp; Issue
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Templates Tab ─────────────────────────────────────────────── */}
            {activeTab === "templates" && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="text-[13px] text-[var(--text3)]">{templates.length} templates</p>
                        {isManager && (
                            <button
                                onClick={openNewTemplate}
                                className="flex items-center gap-2 bg-[var(--accent)] text-white rounded-xl px-4 py-2 text-[13px] font-medium hover:opacity-90 transition-opacity"
                            >
                                <Plus size={14} />
                                New Template
                            </button>
                        )}
                    </div>

                    {/* Template form */}
                    {showTemplateForm && (
                        <div className="border border-[var(--accent)] rounded-xl p-6 space-y-4 bg-[var(--accent-light)]">
                            <div className="flex items-center justify-between">
                                <h3 className="text-[14px] font-semibold text-[var(--text)]">
                                    {editingTemplate ? "Edit Template" : "New Template"}
                                </h3>
                                <button
                                    onClick={() => setShowTemplateForm(false)}
                                    className="text-[var(--text3)] hover:text-[var(--text)]"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[12px] font-medium text-[var(--text)] mb-1">
                                        Template Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        value={tplName}
                                        onChange={(e) => setTplName(e.target.value)}
                                        placeholder="e.g. Appointment Letter"
                                        className="w-full px-3 py-2 text-[13px] border border-[var(--border)] rounded-xl bg-white text-[var(--text)] outline-none focus:border-[var(--accent)]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[12px] font-medium text-[var(--text)] mb-1">
                                        Type <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={tplType}
                                        onChange={(e) => handleTplTypeChange(e.target.value)}
                                        className="w-full px-3 py-2 text-[13px] border border-[var(--border)] rounded-xl bg-white text-[var(--text)] outline-none focus:border-[var(--accent)]"
                                    >
                                        <option value="">-- Select Type --</option>
                                        {DOC_TYPES.map((t) => (
                                            <option key={t.value} value={t.value}>{t.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[12px] font-medium text-[var(--text)] mb-1">Description</label>
                                <textarea
                                    value={tplDescription}
                                    onChange={(e) => setTplDescription(e.target.value)}
                                    rows={2}
                                    placeholder="Brief description of this template..."
                                    className="w-full px-3 py-2 text-[13px] border border-[var(--border)] rounded-xl bg-white text-[var(--text)] outline-none focus:border-[var(--accent)] resize-none"
                                />
                            </div>

                            <div className="flex items-center gap-3">
                                <label className="flex items-center gap-2 cursor-pointer text-[13px] text-[var(--text)]">
                                    <input
                                        type="checkbox"
                                        checked={tplApprovalRequired}
                                        onChange={(e) => setTplApprovalRequired(e.target.checked)}
                                        className="w-4 h-4 accent-[#1e3799]"
                                    />
                                    Requires Approval Before Issuing
                                </label>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="block text-[12px] font-medium text-[var(--text)]">
                                        Template Content (HTML) <span className="text-red-500">*</span>
                                    </label>
                                </div>
                                <div className="mb-2 flex flex-wrap gap-1">
                                    {AVAILABLE_VARIABLES.map((v) => (
                                        <span
                                            key={v}
                                            className="text-[10px] bg-white border border-[var(--border)] text-[var(--text3)] px-1.5 py-0.5 rounded font-mono cursor-pointer hover:bg-[var(--accent-light)] hover:text-[var(--accent)]"
                                            onClick={() => setTplContent((prev) => prev + v)}
                                            title="Click to insert"
                                        >
                                            {v}
                                        </span>
                                    ))}
                                </div>
                                <textarea
                                    value={tplContent}
                                    onChange={(e) => setTplContent(e.target.value)}
                                    rows={12}
                                    placeholder="Enter HTML content with {{variables}}..."
                                    className="w-full px-3 py-2 text-[12px] font-mono border border-[var(--border)] rounded-xl bg-white text-[var(--text)] outline-none focus:border-[var(--accent)] resize-y"
                                />
                            </div>

                            <div className="flex gap-3 justify-end">
                                <button
                                    onClick={() => setShowTemplateForm(false)}
                                    className="px-4 py-2 text-[13px] border border-[var(--border)] rounded-xl text-[var(--text)] hover:bg-white transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveTemplate}
                                    disabled={submitting}
                                    className="flex items-center gap-2 bg-[var(--accent)] text-white rounded-xl px-4 py-2 text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                                >
                                    {submitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                    {editingTemplate ? "Update Template" : "Create Template"}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Templates list */}
                    {loadingTemplates ? (
                        <div className="text-center py-12 text-[var(--text3)]">
                            <Loader2 size={20} className="animate-spin mx-auto mb-2" />
                            Loading templates...
                        </div>
                    ) : templates.length === 0 ? (
                        <div className="border border-[var(--border)] rounded-xl p-12 text-center text-[var(--text3)]">
                            <Settings size={32} className="mx-auto mb-2 opacity-30" />
                            <p className="text-[14px] font-medium mb-1">No templates yet</p>
                            <p className="text-[13px]">Create your first document template to get started</p>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {templates.map((t) => (
                                <div key={t.id} className="border border-[var(--border)] rounded-xl p-4 flex items-center justify-between gap-4">
                                    <div className="flex items-start gap-3">
                                        <div className="w-9 h-9 rounded-lg bg-[var(--accent-light)] flex items-center justify-center shrink-0">
                                            <FileText size={16} className="text-[var(--accent)]" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="text-[14px] font-medium text-[var(--text)]">{t.name}</p>
                                                <span className="text-[11px] bg-[var(--accent-light)] text-[var(--accent)] px-2 py-0.5 rounded-full font-medium">
                                                    {typeLabel(t.type)}
                                                </span>
                                                {!t.isActive && (
                                                    <span className="text-[11px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactive</span>
                                                )}
                                            </div>
                                            {t.description && (
                                                <p className="text-[12px] text-[var(--text3)] mt-0.5">{t.description}</p>
                                            )}
                                            <p className="text-[12px] text-[var(--text3)] mt-1">
                                                Approval: {t.approvalRequired ? (
                                                    <span className="text-amber-600">Required</span>
                                                ) : (
                                                    <span className="text-green-600">Not required</span>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    {isManager && (
                                        <div className="flex gap-2 shrink-0">
                                            <button
                                                onClick={() => openEditTemplate(t)}
                                                className="p-2 hover:bg-[var(--accent-light)] text-[var(--text3)] hover:text-[var(--accent)] rounded-lg transition-colors"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteTemplate(t.id)}
                                                className="p-2 hover:bg-red-50 text-[var(--text3)] hover:text-red-600 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Approvals Tab ─────────────────────────────────────────────── */}
            {activeTab === "approvals" && (
                <div className="space-y-4">
                    <p className="text-[13px] text-[var(--text3)]">{pendingDocs.length} documents pending approval</p>

                    {loadingDocs ? (
                        <div className="text-center py-12 text-[var(--text3)]">
                            <Loader2 size={20} className="animate-spin mx-auto mb-2" />
                            Loading...
                        </div>
                    ) : pendingDocs.length === 0 ? (
                        <div className="border border-[var(--border)] rounded-xl p-12 text-center text-[var(--text3)]">
                            <CheckCircle2 size={32} className="mx-auto mb-2 opacity-30 text-green-500" />
                            <p className="text-[14px] font-medium mb-1">All caught up!</p>
                            <p className="text-[13px]">No documents are pending approval</p>
                        </div>
                    ) : (
                        <div className="border border-[var(--border)] rounded-xl overflow-hidden">
                            <table className="w-full text-[13px]">
                                <thead>
                                    <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
                                        <th className="text-left px-4 py-3 text-[var(--text3)] font-medium">Employee</th>
                                        <th className="text-left px-4 py-3 text-[var(--text3)] font-medium">Document</th>
                                        <th className="text-left px-4 py-3 text-[var(--text3)] font-medium">Doc #</th>
                                        <th className="text-left px-4 py-3 text-[var(--text3)] font-medium">Requested</th>
                                        <th className="text-right px-4 py-3 text-[var(--text3)] font-medium">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pendingDocs.map((doc) => (
                                        <tr key={doc.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface)] transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-full bg-[var(--accent-light)] flex items-center justify-center">
                                                        <Users size={12} className="text-[var(--accent)]" />
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-[var(--text)]">
                                                            {doc.employee.firstName} {doc.employee.lastName}
                                                        </div>
                                                        <div className="text-[11px] text-[var(--text3)]">{doc.employee.designation}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-[var(--text)]">{doc.title}</div>
                                                <div className="text-[11px] text-[var(--text3)]">{typeLabel(doc.type)}</div>
                                            </td>
                                            <td className="px-4 py-3 font-mono text-[12px] text-[var(--text)]">{doc.docNumber}</td>
                                            <td className="px-4 py-3 text-[var(--text3)]">{formatDate(doc.createdAt)}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => openDocModal(doc)}
                                                        className="flex items-center gap-1 px-2.5 py-1.5 text-[12px] border border-[var(--border)] rounded-lg text-[var(--text3)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-colors"
                                                    >
                                                        <Eye size={12} />
                                                        View
                                                    </button>
                                                    {isManager && (
                                                        <>
                                                            <button
                                                                onClick={() => handleApprove(doc.id)}
                                                                disabled={actioningDocId === doc.id}
                                                                className="flex items-center gap-1 px-2.5 py-1.5 text-[12px] bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
                                                            >
                                                                {actioningDocId === doc.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                                                                Approve
                                                            </button>
                                                            <div className="flex flex-col gap-1">
                                                                {showRejectInput && actioningDocId !== doc.id ? null : null}
                                                                <button
                                                                    onClick={() => {
                                                                        setActioningDocId(doc.id)
                                                                        setShowRejectInput(true)
                                                                    }}
                                                                    className="flex items-center gap-1 px-2.5 py-1.5 text-[12px] bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                                                                >
                                                                    <XCircle size={12} />
                                                                    Reject
                                                                </button>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                                {isManager && showRejectInput && actioningDocId === doc.id && (
                                                    <div className="mt-2 flex gap-2">
                                                        <input
                                                            value={rejectReason}
                                                            onChange={(e) => setRejectReason(e.target.value)}
                                                            placeholder="Reason for rejection..."
                                                            className="flex-1 px-2 py-1 text-[12px] border border-[var(--border)] rounded-lg text-[var(--text)] outline-none focus:border-red-400"
                                                        />
                                                        <button
                                                            onClick={() => handleReject(doc.id, rejectReason)}
                                                            className="px-2.5 py-1 text-[12px] bg-red-500 text-white rounded-lg hover:bg-red-600"
                                                        >
                                                            Confirm
                                                        </button>
                                                        <button
                                                            onClick={() => { setShowRejectInput(false); setActioningDocId(null); setRejectReason("") }}
                                                            className="px-2.5 py-1 text-[12px] border border-[var(--border)] rounded-lg text-[var(--text3)]"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ── Document Detail Modal ─────────────────────────────────────── */}
            {showDocModal && viewingDoc && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <div className="bg-white dark:bg-[var(--surface)] rounded-2xl shadow-2xl w-full max-w-[760px] max-h-[90vh] flex flex-col border border-[var(--border)]">
                        {/* Modal header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
                            <div>
                                <h3 className="text-[15px] font-semibold text-[var(--text)]">{viewingDoc.title}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="font-mono text-[12px] text-[var(--text3)]">{viewingDoc.docNumber}</span>
                                    <span className="text-[var(--text3)]">·</span>
                                    {statusBadge(viewingDoc.status)}
                                </div>
                            </div>
                            <button
                                onClick={() => setShowDocModal(false)}
                                className="p-2 hover:bg-[var(--surface)] rounded-lg text-[var(--text3)] hover:text-[var(--text)]"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Metadata */}
                        <div className="px-6 py-3 border-b border-[var(--border)] shrink-0">
                            <div className="grid grid-cols-3 gap-4 text-[12px]">
                                <div>
                                    <span className="text-[var(--text3)]">Employee</span>
                                    <p className="font-medium text-[var(--text)] mt-0.5">
                                        {viewingDoc.employee.firstName} {viewingDoc.employee.lastName}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-[var(--text3)]">Type</span>
                                    <p className="font-medium text-[var(--text)] mt-0.5">{typeLabel(viewingDoc.type)}</p>
                                </div>
                                <div>
                                    <span className="text-[var(--text3)]">Effective Date</span>
                                    <p className="font-medium text-[var(--text)] mt-0.5">{formatDate(viewingDoc.effectiveDate)}</p>
                                </div>
                                {viewingDoc.approvedAt && (
                                    <div>
                                        <span className="text-[var(--text3)]">Approved</span>
                                        <p className="font-medium text-[var(--text)] mt-0.5">{formatDate(viewingDoc.approvedAt)}</p>
                                    </div>
                                )}
                                {viewingDoc.issuedAt && (
                                    <div>
                                        <span className="text-[var(--text3)]">Issued</span>
                                        <p className="font-medium text-[var(--text)] mt-0.5">{formatDate(viewingDoc.issuedAt)}</p>
                                    </div>
                                )}
                                {viewingDoc.rejectionReason && (
                                    <div className="col-span-3">
                                        <span className="text-[var(--text3)]">Rejection Reason</span>
                                        <p className="font-medium text-red-600 mt-0.5">{viewingDoc.rejectionReason}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Document content */}
                        <div className="flex-1 overflow-y-auto p-4">
                            <div
                                className="border border-[var(--border)] rounded-xl p-4 bg-white"
                                dangerouslySetInnerHTML={{ __html: viewingDoc.content }}
                            />
                        </div>

                        {/* Modal actions */}
                        <div className="px-6 py-4 border-t border-[var(--border)] shrink-0 flex flex-wrap gap-3 justify-end">
                            {viewingDoc.status === "ISSUED" && (
                                <button
                                    onClick={() => handleDownload(viewingDoc)}
                                    className="flex items-center gap-2 px-4 py-2 text-[13px] bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors"
                                >
                                    <Download size={14} />
                                    Download
                                </button>
                            )}
                            {isManager && viewingDoc.status === "APPROVED" && (
                                <button
                                    onClick={() => handleIssue(viewingDoc.id)}
                                    disabled={actioningDocId === viewingDoc.id}
                                    className="flex items-center gap-2 px-4 py-2 text-[13px] bg-[var(--accent)] text-white rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
                                >
                                    {actioningDocId === viewingDoc.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                    Issue Document
                                </button>
                            )}
                            {isManager && viewingDoc.status === "PENDING_APPROVAL" && (
                                <>
                                    <button
                                        onClick={() => handleApprove(viewingDoc.id)}
                                        disabled={actioningDocId === viewingDoc.id}
                                        className="flex items-center gap-2 px-4 py-2 text-[13px] bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors disabled:opacity-50"
                                    >
                                        {actioningDocId === viewingDoc.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                        Approve
                                    </button>
                                    {!showRejectInput ? (
                                        <button
                                            onClick={() => setShowRejectInput(true)}
                                            className="flex items-center gap-2 px-4 py-2 text-[13px] bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors"
                                        >
                                            <XCircle size={14} />
                                            Reject
                                        </button>
                                    ) : (
                                        <div className="flex gap-2 w-full">
                                            <input
                                                value={rejectReason}
                                                onChange={(e) => setRejectReason(e.target.value)}
                                                placeholder="Reason for rejection..."
                                                className="flex-1 px-3 py-2 text-[13px] border border-[var(--border)] rounded-xl text-[var(--text)] outline-none focus:border-red-400"
                                            />
                                            <button
                                                onClick={() => handleReject(viewingDoc.id, rejectReason)}
                                                disabled={actioningDocId === viewingDoc.id}
                                                className="px-4 py-2 text-[13px] bg-red-500 text-white rounded-xl hover:bg-red-600 disabled:opacity-50"
                                            >
                                                {actioningDocId === viewingDoc.id ? <Loader2 size={14} className="animate-spin" /> : "Confirm Reject"}
                                            </button>
                                            <button
                                                onClick={() => { setShowRejectInput(false); setRejectReason("") }}
                                                className="px-3 py-2 text-[13px] border border-[var(--border)] rounded-xl text-[var(--text3)]"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                            <button
                                onClick={() => setShowDocModal(false)}
                                className="px-4 py-2 text-[13px] border border-[var(--border)] rounded-xl text-[var(--text)] hover:bg-[var(--surface)] transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Preview Modal ─────────────────────────────────────────────── */}
            {showPreviewModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <div className="bg-white dark:bg-[var(--surface)] rounded-2xl shadow-2xl w-full max-w-[760px] max-h-[90vh] flex flex-col border border-[var(--border)]">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
                            <h3 className="text-[15px] font-semibold text-[var(--text)]">Document Preview</h3>
                            <button
                                onClick={() => setShowPreviewModal(false)}
                                className="p-2 hover:bg-[var(--surface)] rounded-lg text-[var(--text3)] hover:text-[var(--text)]"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6">
                            <div
                                className="border border-[var(--border)] rounded-xl p-4 bg-white"
                                dangerouslySetInnerHTML={{ __html: previewContent }}
                            />
                        </div>
                        <div className="px-6 py-4 border-t border-[var(--border)] shrink-0 flex justify-end">
                            <button
                                onClick={() => setShowPreviewModal(false)}
                                className="px-4 py-2 text-[13px] border border-[var(--border)] rounded-xl text-[var(--text)] hover:bg-[var(--surface)] transition-colors"
                            >
                                Close Preview
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// Inline icon to avoid importing LayoutDashboard (already available via lucide)
function LayoutDashboardIcon({ size }: { size: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
        </svg>
    )
}
