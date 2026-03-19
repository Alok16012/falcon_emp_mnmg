
"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    ChevronLeft,
    Save,
    Send,
    Loader2,
    AlertCircle,
    CheckCircle2,
    FileText,
    Image as ImageIcon,
    Upload,
    ExternalLink,
    Camera,
    Pencil,
    ChevronRight,
    ClipboardCheck
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import CameraCapture from "@/components/CameraCapture"

export default function InspectionFormPage() {
    const { data: session, status: authStatus } = useSession()
    const router = useRouter()
    const { assignmentId } = useParams()

    const [assignment, setAssignment] = useState<any>(null)
    const [templates, setTemplates] = useState<any[]>([])
    const [inspection, setInspection] = useState<any>(null)
    const [responses, setResponses] = useState<Record<string, string>>({})
    const [errors, setErrors] = useState<Record<string, string>>({})

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [lastSaved, setLastSaved] = useState<Date | null>(null)
    const [isDirty, setIsDirty] = useState(false)
    const [cameraFieldId, setCameraFieldId] = useState<string | null>(null)
    const [currentStep, setCurrentStep] = useState(0)

    // Redirect if not inspector
    useEffect(() => {
        if (authStatus === "unauthenticated") {
            router.push("/login")
        } else if (authStatus === "authenticated" && session?.user?.role !== "INSPECTION_BOY") {
            router.push("/")
        }
    }, [authStatus, session, router])

    const fetchPageData = useCallback(async () => {
        setLoading(true)
        try {
            // 1. Fetch specific assignment details
            const assRes = await fetch(`/api/assignments/${assignmentId}`)
            if (!assRes.ok) {
                console.error("Assignment fetch failed")
                router.push("/inspection")
                return
            }
            const currentAss = await assRes.json()
            setAssignment(currentAss)

            // 2. Fetch form templates and existing inspection in parallel
            const targetProjectId = currentAss.projectId || currentAss.project?.id
            const [tempRes, inspRes] = await Promise.all([
                fetch(`/api/form-templates?projectId=${targetProjectId}`),
                fetch(`/api/inspections?assignmentId=${assignmentId}`)
            ])

            const tempData = await tempRes.json()
            setTemplates(Array.isArray(tempData) ? tempData.sort((a: any, b: any) => a.displayOrder - b.displayOrder) : [])

            let inspData = await inspRes.json()

            // 3. If no inspection, create one
            if (!inspData || inspData.error || (Array.isArray(inspData) && inspData.length === 0)) {
                const createRes = await fetch("/api/inspections", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ assignmentId })
                })
                inspData = await createRes.json()
            }

            setInspection(inspData)

            // Initialize responses and auto-date
            const initialResponses: Record<string, string> = {}
            if (inspData.responses) {
                inspData.responses.forEach((r: any) => {
                    initialResponses[r.fieldId] = r.value || ""
                })
            }
            if (inspData.paperFormPhoto) {
                initialResponses["paperFormPhoto"] = inspData.paperFormPhoto;
            }

            // Auto date
            const todayStr = new Date().toISOString().split('T')[0]
            tempData.forEach((t: any) => {
                if (t.fieldType === "date" && !initialResponses[t.id]) {
                    initialResponses[t.id] = todayStr
                }
            })

            setResponses(initialResponses)
            if (inspData.submittedAt) {
                const d = new Date(inspData.submittedAt)
                if (!isNaN(d.getTime())) setLastSaved(d)
            } else if (inspData.status === "draft") {
                setLastSaved(new Date())
            }

        } catch (error) {
            console.error("Failed to fetch page data", error)
        } finally {
            setLoading(false)
        }
    }, [assignmentId, router])

    useEffect(() => {
        if (authStatus === "authenticated") {
            fetchPageData()
        }
    }, [authStatus, fetchPageData])

    // Auto-save logic
    useEffect(() => {
        const timer = setInterval(() => {
            if (isDirty && inspection?.status === "draft") {
                saveForm("draft", true)
            }
        }, 30000)
        return () => clearInterval(timer)
    }, [isDirty, inspection, responses])

    // Specialized Auto-Calculation logic
    useEffect(() => {
        if (inspection?.status !== "draft" || templates.length === 0) return

        const fieldMap: Record<string, string> = {}
        const defectIds: string[] = []

        templates.forEach(t => {
            const label = t.fieldLabel.toUpperCase().trim()
            fieldMap[label] = t.id
            if (t.category === "DEFECT") defectIds.push(t.id)
        })

        const getVal = (label: string) => parseFloat(responses[fieldMap[label]] || "0") || 0

        // 1. Total Defects = Sum of all defect columns
        const totalDefects = defectIds.reduce((sum, id) => sum + (parseFloat(responses[id] || "0") || 0), 0)

        // 2. Form Values
        const inspectedQty = getVal("INSPECTED QTY")
        const reworkQty = getVal("REWORK QTY")

        // 3. Rejected Qty = Total Defects - Rework Qty
        const rejectedQty = Math.max(0, totalDefects - reworkQty)

        // 4. Accepted Qty = Inspected Qty - Rework Qty - Rejected Qty
        const acceptedQty = Math.max(0, inspectedQty - reworkQty - rejectedQty)

        // 5. Percentages & PPM
        let reworkPct = 0, rejectedPct = 0, reworkPpm = 0, rejectionPpm = 0
        if (inspectedQty > 0) {
            reworkPct = (reworkQty / inspectedQty) * 100
            rejectedPct = (rejectedQty / inspectedQty) * 100
            reworkPpm = (reworkQty / inspectedQty) * 1000000
            rejectionPpm = (rejectedQty / inspectedQty) * 1000000
        }

        // 6. Difference = Total Defects - Rework Qty - Rejected Qty (Should be 0)
        const difference = totalDefects - reworkQty - rejectedQty

        let updates: Record<string, string> = {}
        const setIfChanged = (label: string, value: string | number) => {
            const id = fieldMap[label]
            const valStr = value.toString()
            if (id && responses[id] !== valStr) updates[id] = valStr
        }

        setIfChanged("TOTAL DEFECTS", totalDefects)
        setIfChanged("REJECTED QTY", rejectedQty)
        setIfChanged("ACCEPTED QTY", acceptedQty)
        setIfChanged("REWORK %", reworkPct.toFixed(2))
        setIfChanged("REJECTED %", rejectedPct.toFixed(2))
        setIfChanged("REWORK PPM", Math.round(reworkPpm))
        setIfChanged("REJECTION PPM", Math.round(rejectionPpm))
        setIfChanged("DIFFERENCE", difference)

        // Auto-fill Inspector Name
        if (fieldMap["INSPECTOR NAME"] && !responses[fieldMap["INSPECTOR NAME"]] && session?.user?.name) {
            updates[fieldMap["INSPECTOR NAME"]] = session.user.name
        }

        if (Object.keys(updates).length > 0) {
            setResponses(prev => ({ ...prev, ...updates }))
            setIsDirty(true)
        }
    }, [responses, templates, inspection?.status, session])

    const handleFieldChange = (fieldId: string, value: string) => {
        if (inspection?.status !== "draft") return
        setResponses(prev => ({ ...prev, [fieldId]: value }))
        setIsDirty(true)

        // Clear error if any
        if (errors[fieldId]) {
            setErrors(prev => {
                const newErrors = { ...prev }
                delete newErrors[fieldId]
                return newErrors
            })
        }
    }

    const validateForm = () => {
        const newErrors: Record<string, string> = {}
        templates.forEach(t => {
            if (t.isRequired && !responses[t.id]) {
                newErrors[t.id] = "This field is required"
            }
        })
        setErrors(newErrors)

        if (Object.keys(newErrors).length > 0) {
            const firstErrorId = Object.keys(newErrors)[0]
            const element = document.getElementById(`field-${firstErrorId}`)
            element?.scrollIntoView({ behavior: "smooth", block: "center" })
            return false
        }
        return true
    }

    const fixedFields = templates.filter(t => t.category === "FIXED")
    const defectFields = templates.filter(t => t.category === "DEFECT")
    const autoFields = templates.filter(t => t.category === "AUTO")

    const totalSteps = 4 // 1: Fixed, 2: Defects, 3: Paper Form, 4: Review

    const validateCurrentStep = () => {
        let currentFields: any[] = []
        if (currentStep === 0) currentFields = fixedFields
        if (currentStep === 1) currentFields = defectFields

        let hasError = false
        const newErrors: Record<string, string> = {}
        currentFields.forEach(t => {
            if (t.isRequired && !responses[t.id]) {
                newErrors[t.id] = "This field is required"
                hasError = true
            }
        })
        if (hasError) {
            setErrors(prev => ({ ...prev, ...newErrors }))
            const firstErrorId = currentFields.find(t => t.isRequired && !responses[t.id])?.id
            if (firstErrorId) {
                const el = document.getElementById(`field-${firstErrorId}`)
                el?.scrollIntoView({ behavior: "smooth", block: "center" })
            }
            return false
        }
        return true
    }

    const handleNextStep = () => {
        if (validateCurrentStep()) {
            setCurrentStep(prev => Math.min(prev + 1, totalSteps - 1))
            window.scrollTo({ top: 0, behavior: "smooth" })
            saveForm("draft", true)
        }
    }

    const handlePrevStep = () => {
        setCurrentStep(prev => Math.max(prev - 1, 0))
        window.scrollTo({ top: 0, behavior: "smooth" })
        saveForm("draft", true)
    }

    const saveForm = async (status: string = "draft", holdsSilent = false) => {
        if (!inspection || inspection.status !== "draft") return

        if (!holdsSilent) setSaving(true)

        try {
            const resData = Object.entries(responses).map(([fieldId, value]) => ({
                fieldId,
                value
            }))

            const res = await fetch(`/api/inspections/${inspection.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    responses: resData,
                    status
                })
            })

            if (res.ok) {
                const updated = await res.json()
                setInspection(updated)
                setIsDirty(false)
                setLastSaved(new Date())
                if (status === "pending") {
                    router.push("/inspection")
                }
            } else {
                const errorData = await res.json().catch(() => ({}))
                const errorMsg = errorData.details || errorData.error || "Failed to save inspection"
                if (!holdsSilent) alert(`Save Failed: ${errorMsg}`)
            }
        } catch (error: any) {
            console.error("Save error", error)
            if (!holdsSilent) alert(`An error occurred while saving: ${error.message || error}`)
        } finally {
            if (!holdsSilent) setSaving(false)
        }
    }

    const handleSubmit = () => {
        if (validateForm()) {
            saveForm("pending")
        }
    }

    const handleFileUpload = async (fieldId: string, file: File) => {
        if (inspection?.status !== "draft") return

        const formData = new FormData()
        formData.append("file", file)

        try {
            setSaving(true)
            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData
            })
            const data = await res.json()
            if (data.url) {
                handleFieldChange(fieldId, data.url)
            } else {
                alert("Upload failed")
            }
        } catch (error) {
            alert("Upload failed")
        } finally {
            setSaving(false)
        }
    }

    const renderBasicField = (template: any) => {
        const value = responses[template.id] || ""
        const error = errors[template.id]
        const readOnly = inspection?.status !== "draft"

        let pillClass = ""
        let pillText = template.fieldType.toUpperCase()
        if (template.fieldType === "date") pillClass = "bg-[#eff6ff] text-[#3b82f6]"
        else if (template.fieldType === "dropdown") pillClass = "bg-[#f5f3ff] text-[#7c3aed]"
        else if (template.fieldType === "number") pillClass = "bg-[#fef3c7] text-[#d97706]"
        else pillClass = "bg-[#f9f8f5] text-[#9e9b95] border border-[#e8e6e1]"

        const dropdownBg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239e9b95' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`

        return (
            <div key={template.id} id={`field-${template.id}`} className={`bg-white border ${error ? 'border-[#dc2626]' : 'border-[#e8e6e1]'} rounded-[12px] overflow-hidden transition-colors focus-within:border-[#1a9e6e] mb-[10px]`}>
                <div className="flex justify-between items-center px-[14px] pt-[10px]">
                    <div className="text-[11px] font-[600] text-[#6b6860] uppercase tracking-[0.5px]">
                        {template.fieldLabel}
                        {template.isRequired && <span className="text-[#dc2626] ml-1">*</span>}
                    </div>
                    <div className={`text-[10px] font-medium px-[8px] py-[2px] rounded-full ${pillClass}`}>
                        {pillText}
                    </div>
                </div>
                <div className="px-[12px] pb-[12px] pt-[6px]">
                    {template.fieldType === "dropdown" ? (
                        <select
                            value={value}
                            onChange={(e) => handleFieldChange(template.id, e.target.value)}
                            disabled={readOnly}
                            className="w-full px-[10px] py-[8px] bg-transparent border-none outline-none text-[15px] font-medium text-[#1a1a18] appearance-none"
                            style={{ backgroundImage: dropdownBg, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
                        >
                            <option value="" disabled className="text-[#9e9b95]">Select option...</option>
                            {template.options?.split(",").map((opt: string) => (
                                <option key={opt.trim()} value={opt.trim()}>{opt.trim()}</option>
                            ))}
                        </select>
                    ) : template.fieldType === "textarea" ? (
                        <textarea
                            value={value}
                            onChange={(e) => handleFieldChange(template.id, e.target.value)}
                            disabled={readOnly}
                            rows={3}
                            placeholder={`Enter ${template.fieldLabel.toLowerCase()}...`}
                            className="w-full px-[10px] py-[8px] bg-transparent border-none outline-none text-[15px] font-medium text-[#1a1a18] placeholder:text-[#9e9b95] resize-y"
                        />
                    ) : (
                        <input
                            type={template.fieldType}
                            value={value}
                            onChange={(e) => handleFieldChange(template.id, e.target.value)}
                            disabled={readOnly}
                            placeholder={template.fieldType === 'number' ? '0' : `Enter ${template.fieldLabel.toLowerCase()}...`}
                            className="w-full px-[10px] py-[8px] bg-transparent border-none outline-none text-[15px] font-medium text-[#1a1a18] placeholder:text-[#9e9b95]"
                            style={{ fontFamily: template.fieldType === "date" ? "Inter" : "inherit" }}
                        />
                    )}
                    {error && <p className="text-[11px] font-medium text-[#dc2626] px-[10px] mt-1">{error}</p>}
                </div>
            </div>
        )
    }

    if (loading || authStatus === "loading") {
        return (
            <div className="flex flex-col items-center justify-center min-h-[100vh] bg-[#f5f4f0] space-y-4">
                <Loader2 className="h-10 w-10 animate-spin text-[#9e9b95]" />
            </div>
        )
    }

    const isSubmitted = inspection?.status !== "draft"

    const getAutoColor = (label: string, value: number) => {
        if (label === "ACCEPTED QTY") return "text-[#1a9e6e]"
        if (label === "TOTAL DEFECTS") return "text-[#1a1a18]"
        if (label === "REJECTED QTY" || label === "REJECTED %" || label === "REJECTION PPM") return "text-[#dc2626]"
        if (label === "REWORK %" || label === "REWORK PPM") return "text-[#d97706]"
        if (label === "DIFFERENCE") return value === 0 ? "text-[#1a9e6e]" : "text-[#dc2626]"
        return "text-[#1a1a18]"
    }

    const renderAutoSection = () => {
        const inspectorField = autoFields.find(t => t.fieldLabel.toUpperCase() === "INSPECTOR NAME")
        const otherAutoFields = autoFields.filter(t => t.fieldLabel.toUpperCase() !== "INSPECTOR NAME")

        return (
            <>
                <div className="text-[11px] font-[600] text-[#9e9b95] tracking-[1.2px] uppercase pb-[10px] border-b-[2px] border-[#e8e6e1] mb-[14px] mt-[28px] flex justify-between items-center">
                    <span>Calculated (Auto)</span>
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-[#1a9e6e]"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                </div>
                <div className="grid grid-cols-2 gap-[8px]">
                    {otherAutoFields.map(t => {
                        const valNum = parseFloat(responses[t.id] || "0")
                        return (
                            <div key={t.id} className="bg-[#fafaf9] border-[1.5px] border-dashed border-[#d4d1ca] rounded-[10px] p-[12px_14px] cursor-not-allowed">
                                <div className="text-[10px] font-[600] text-[#9e9b95] uppercase tracking-[0.5px] mb-[4px]">{t.fieldLabel}</div>
                                <div className={`text-[22px] font-[700] font-mono tracking-[-0.5px] ${getAutoColor(t.fieldLabel.toUpperCase(), valNum)}`}>
                                    {responses[t.id] || "0"}
                                </div>
                                {t.fieldLabel.toUpperCase().includes('%') && <div className="text-[10px] text-[#b8b5af] mt-[2px]">Percentage</div>}
                                {t.fieldLabel.toUpperCase().includes('PPM') && <div className="text-[10px] text-[#b8b5af] mt-[2px]">Parts Per Million</div>}
                            </div>
                        )
                    })}
                    {inspectorField && (
                        <div className="col-span-2 bg-[#f0fdf4] border border-[rgba(26,158,110,0.25)] rounded-[10px] p-[12px_14px] flex items-center gap-[10px] mt-[4px]">
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-[#1a9e6e]"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                            <div>
                                <span className="text-[10px] font-[600] text-[#9e9b95] uppercase block mb-[2px]">Inspector Name</span>
                                <span className="text-[14px] font-[600] text-[#0d6b4a]">{responses[inspectorField.id] || session?.user?.name || "Pending Inspector"}</span>
                            </div>
                        </div>
                    )}
                </div>
            </>
        )
    }

    return (
        <div className="flex flex-col min-h-[100vh] bg-[#f5f4f0] p-0 font-[Inter]">

            <div className="bg-white border-b border-[#e8e6e1] px-[24px] py-[14px] flex items-center justify-between sticky top-0 z-40">
                <div className="flex items-center">
                    <button
                        onClick={() => router.push("/inspection")}
                        className="w-[30px] h-[30px] border border-[#e8e6e1] rounded-[8px] flex items-center justify-center text-[#6b6860] hover:bg-[#f9f8f5] transition-colors"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <span className="text-[15px] font-[600] text-[#1a1a18] ml-[12px]">{assignment?.project?.name}</span>
                    <span className="text-[12.5px] text-[#9e9b95] ml-[8px]">
                        • {assignment?.project?.company?.name}
                    </span>
                </div>

                {!isSubmitted && (
                    <div className="flex items-center gap-[8px]">
                        {saving ? (
                            <>
                                <span className="relative flex h-[8px] w-[8px]">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#3b82f6] opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-[8px] w-[8px] bg-[#3b82f6]"></span>
                                </span>
                                <span className="text-[12.5px] text-[#6b6860] hidden sm:inline">Saving...</span>
                            </>
                        ) : isDirty ? (
                            <>
                                <div className="h-[8px] w-[8px] rounded-full bg-[#d97706]"></div>
                                <span className="text-[12.5px] text-[#d97706] hidden sm:inline">Unsaved changes</span>
                            </>
                        ) : (
                            <>
                                <div className="h-[8px] w-[8px] rounded-full bg-[#1a9e6e]"></div>
                                <span className="text-[12.5px] text-[#6b6860] hidden sm:inline">
                                    {lastSaved && !isNaN(lastSaved.getTime()) ? `Saved ${lastSaved.toLocaleTimeString([], { hour12: false })}` : 'Saved'}
                                </span>
                            </>
                        )}
                    </div>
                )}
            </div>

            <div className="w-full max-w-[680px] mx-auto px-[20px] pt-[24px] pb-[120px]">

                {isSubmitted && (
                    <div className="bg-[#f0fdf4] border border-[rgba(26,158,110,0.25)] rounded-[12px] p-[14px_18px] flex items-center gap-[12px] mb-[24px]">
                        <CheckCircle2 className="h-[20px] w-[20px] text-[#1a9e6e] shrink-0" />
                        <span className="text-[13px] font-[500] text-[#0d6b4a] flex-1">
                            This form has been submitted and is pending approval.
                        </span>
                    </div>
                )}

                <div className="text-[11px] font-[600] text-[#9e9b95] tracking-[1.2px] uppercase pb-[10px] border-b-[2px] border-[#e8e6e1] mb-[14px] mt-0">
                    Basic Info
                </div>
                {fixedFields.map(t => renderBasicField(t))}

                {defectFields.length > 0 && (
                    <>
                        <div className="text-[11px] font-[600] text-[#9e9b95] tracking-[1.2px] uppercase pb-[10px] border-b-[2px] border-[#e8e6e1] mb-[14px] mt-[28px] flex justify-between items-center">
                            <span>Defect Entry</span>
                            <div className="bg-[#fef3c7] text-[#d97706] text-[10px] font-bold px-[8px] py-[2px] rounded-full">
                                {defectFields.filter(t => responses[t.id] && responses[t.id] !== "0").length} FILED
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-[8px]">
                            {defectFields.map(t => (
                                <div key={t.id} id={`field-${t.id}`} className="bg-white border border-[#e8e6e1] rounded-[10px] p-[10px_10px_8px] focus-within:border-[#d97706] focus-within:shadow-[0_0_0_3px_rgba(217,119,6,0.06)] transition-all">
                                    <div className="text-[10px] font-[600] text-[#6b6860] uppercase tracking-[0.3px] leading-[1.3] mb-[6px] truncate" title={t.fieldLabel}>
                                        {t.fieldLabel}
                                    </div>
                                    <input
                                        type="number"
                                        min="0"
                                        value={responses[t.id] || ""}
                                        onChange={(e) => handleFieldChange(t.id, e.target.value)}
                                        disabled={inspection?.status !== "draft"}
                                        placeholder="0"
                                        className="w-full px-[8px] py-[6px] bg-[#f9f8f5] border border-[#e8e6e1] rounded-[6px] text-[16px] font-[700] text-[#1a1a18] text-center font-mono focus:border-[#d97706] focus:bg-white outline-none transition-colors"
                                    />
                                    {errors[t.id] && <div className="text-[10px] text-[#dc2626] text-center mt-1">Required</div>}
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {autoFields.length > 0 && renderAutoSection()}

                <div className="text-[11px] font-[600] text-[#9e9b95] tracking-[1.2px] uppercase pb-[10px] border-b-[2px] border-[#e8e6e1] mb-[14px] mt-[28px]">
                    Attachments & Paper Form
                </div>
                <div className="bg-white border border-[#e8e6e1] rounded-[12px] p-[16px]">
                    {responses["paperFormPhoto"] ? (
                        <div className="flex flex-col sm:flex-row items-center gap-[14px]">
                            <div className="relative h-[120px] w-full sm:w-[120px] rounded-[8px] border border-[#e8e6e1] overflow-hidden bg-[#f9f8f5]">
                                <img src={responses["paperFormPhoto"]} alt="Paper form" className="h-[120px] w-full sm:w-[120px] object-cover" />
                            </div>
                            <div className="flex-1 text-center sm:text-left">
                                <p className="text-[13px] font-[600] text-[#1a1a18] mb-[4px]">Paper form uploaded</p>
                                <div className="flex gap-[8px] justify-center sm:justify-start mt-[10px]">
                                    <a href={responses["paperFormPhoto"]} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center bg-white border border-[#e8e6e1] text-[#6b6860] rounded-[6px] text-[11px] font-medium px-[12px] py-[6px] hover:bg-[#f9f8f5]">
                                        <ExternalLink size={12} className="mr-[6px]" /> View Image
                                    </a>
                                    {!isSubmitted && (
                                        <button type="button" onClick={() => handleFieldChange("paperFormPhoto", "")} className="inline-flex items-center justify-center bg-white border border-[#e8e6e1] text-[#dc2626] rounded-[6px] text-[11px] font-medium px-[12px] py-[6px] hover:bg-[#fef2f2]">
                                            Remove
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : !isSubmitted ? (
                        <div className="space-y-[12px]">
                            <label className="flex flex-col items-center justify-center w-full h-[100px] border-[1.5px] border-dashed border-[#d4d1ca] rounded-[8px] cursor-pointer bg-[#fafaf9] hover:bg-[#f5f4f0] transition-colors">
                                <div className="flex flex-col items-center justify-center">
                                    <Upload className="w-[20px] h-[20px] mb-[8px] text-[#9e9b95]" />
                                    <p className="text-[12px] font-[500] text-[#6b6860]">Click or drag to upload photo</p>
                                </div>
                                <input
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0]
                                        if (file) handleFileUpload("paperFormPhoto", file)
                                    }}
                                />
                            </label>
                            <button
                                type="button"
                                className="w-full inline-flex items-center justify-center bg-white border border-[#e8e6e1] text-[#6b6860] rounded-[8px] text-[12px] font-medium px-[16px] py-[10px] hover:bg-[#f9f8f5]"
                                onClick={() => setCameraFieldId("paperFormPhoto")}
                            >
                                <Camera className="h-[14px] w-[14px] mr-[8px]" />
                                Use Camera Instead
                            </button>
                        </div>
                    ) : (
                        <div className="h-[80px] flex items-center justify-center text-[12px] text-[#9e9b95] italic bg-[#fafaf9] rounded-[8px] border border-dashed border-[#e8e6e1]">
                            No paper form attached
                        </div>
                    )}
                </div>

            </div>

            {!isSubmitted && (
                <div className="fixed bottom-0 md:left-[230px] left-0 right-0 bg-white border-t border-[#e8e6e1] px-[24px] py-[14px] flex justify-between items-center z-50 shadow-[0_-2px_12px_rgba(0,0,0,0.04)]">
                    <div className="flex items-center gap-[8px] flex-shrink-0">
                        {saving ? (
                            <>
                                <span className="relative flex h-[8px] w-[8px]">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#3b82f6] opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-[8px] w-[8px] bg-[#3b82f6]"></span>
                                </span>
                                <span className="text-[13px] text-[#6b6860] hidden sm:inline">Saving...</span>
                            </>
                        ) : isDirty ? (
                            <>
                                <div className="h-[8px] w-[8px] rounded-full bg-[#d97706]"></div>
                                <span className="text-[13px] text-[#6b6860] hidden sm:inline">Unsaved changes</span>
                            </>
                        ) : (
                            <>
                                <div className="h-[8px] w-[8px] rounded-full bg-[#1a9e6e]"></div>
                                <span className="text-[13px] text-[#6b6860] hidden sm:inline">Saved</span>
                            </>
                        )}
                    </div>

                    <div className="flex items-center gap-[10px]">
                        <button
                            type="button"
                            onClick={() => saveForm("draft")}
                            disabled={saving || !isDirty}
                            className="bg-white border border-[#e8e6e1] text-[#6b6860] rounded-[9px] text-[13px] font-[500] px-[16px] sm:px-[18px] py-[9px] hover:bg-[#f9f8f5] disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                        >
                            <Save size={14} className="sm:mr-[6px] mr-0" />
                            <span className="hidden sm:inline">Force Save</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={saving}
                            className="bg-[#1a9e6e] text-white border-none rounded-[9px] text-[13px] font-[500] px-[16px] sm:px-[20px] py-[9px] hover:bg-[#158a5e] disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors shadow-sm"
                        >
                            <Send size={14} className="sm:mr-[6px] mr-0" />
                            <span className="hidden sm:inline">Submit for Approval</span>
                            <span className="sm:hidden inline">Submit</span>
                        </button>
                    </div>
                </div>
            )}

            {cameraFieldId && (
                <CameraCapture
                    onCapture={(file) => {
                        if (cameraFieldId) {
                            handleFileUpload(cameraFieldId, file)
                        }
                        setCameraFieldId(null)
                    }}
                    onClose={() => setCameraFieldId(null)}
                />
            )}
        </div>
    )
}
