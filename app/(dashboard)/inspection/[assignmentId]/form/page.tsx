
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
            // 1. Fetch assignment details
            const assRes = await fetch(`/api/assignments`)
            const assignments = await assRes.json()
            const currentAss = Array.isArray(assignments) ? assignments.find(a => a.id === assignmentId) : null

            if (!currentAss) {
                router.push("/inspection")
                return
            }
            setAssignment(currentAss)

            // 2. Fetch form templates for this project
            const tempRes = await fetch(`/api/form-templates?projectId=${currentAss.projectId}`)
            const tempData = await tempRes.json()
            setTemplates(Array.isArray(tempData) ? tempData.sort((a, b) => a.displayOrder - b.displayOrder) : [])

            // 3. Fetch existing inspection
            const inspRes = await fetch(`/api/inspections?assignmentId=${assignmentId}`)
            let inspData = await inspRes.json()

            // 4. If no inspection, create one
            if (!inspData || inspData.error) {
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

    const renderField = (template: any) => {
        const value = responses[template.id] || ""
        const isAuto = template.category === "AUTO"
        const isInspectorName = template.fieldLabel.toUpperCase() === "INSPECTOR NAME"
        const readOnly = inspection?.status !== "draft" || isAuto || isInspectorName
        const error = errors[template.id]

        return (
            <div key={template.id} id={`field-${template.id}`} className={cn(
                "space-y-2 p-3 rounded-lg border transition-colors shadow-sm",
                isAuto ? "bg-gray-50 border-dashed border-gray-300" : "bg-card hover:border-primary/50",
                error && "border-destructive ring-1 ring-destructive"
            )}>
                <div className="flex justify-between items-start">
                    <Label className={cn("text-sm font-semibold", isAuto && "text-gray-500")}>
                        {template.fieldLabel}
                        {template.isRequired && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    <Badge variant="outline" className={cn(
                        "text-[10px] uppercase font-bold tracking-wider opacity-70",
                        isAuto && "bg-green-50 text-green-700 border-green-200"
                    )}>
                        {isAuto ? "Auto" : template.fieldType}
                    </Badge>
                </div>

                {template.fieldType === "text" && (
                    <Input
                        value={value}
                        onChange={(e) => handleFieldChange(template.id, e.target.value)}
                        disabled={readOnly}
                        placeholder={`Enter ${template.fieldLabel}...`}
                    />
                )}

                {template.fieldType === "number" && (
                    <Input
                        type="number"
                        value={value}
                        onChange={(e) => handleFieldChange(template.id, e.target.value)}
                        disabled={readOnly}
                        placeholder="0"
                    />
                )}

                {template.fieldType === "date" && (
                    <Input
                        type="date"
                        value={value}
                        onChange={(e) => handleFieldChange(template.id, e.target.value)}
                        disabled={readOnly}
                    />
                )}

                {template.fieldType === "textarea" && (
                    <Textarea
                        value={value}
                        onChange={(e) => handleFieldChange(template.id, e.target.value)}
                        disabled={readOnly}
                        rows={4}
                        placeholder={`Provide details for ${template.fieldLabel}...`}
                    />
                )}

                {template.fieldType === "dropdown" && (
                    <Select
                        value={value}
                        onValueChange={(val) => handleFieldChange(template.id, val)}
                        disabled={readOnly}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select an option" />
                        </SelectTrigger>
                        <SelectContent>
                            {template.options?.split(",").map((opt: string) => (
                                <SelectItem key={opt.trim()} value={opt.trim()}>
                                    {opt.trim()}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}

                {template.fieldType === "checkbox" && (
                    <div className="flex items-center space-x-2">
                        <Switch
                            checked={value === "true"}
                            onCheckedChange={(checked) => handleFieldChange(template.id, checked ? "true" : "false")}
                            disabled={readOnly}
                        />
                        <span className="text-sm text-muted-foreground">
                            {value === "true" ? "Yes" : "No"}
                        </span>
                    </div>
                )}

                {template.fieldType === "file" && (
                    <div className="space-y-4">
                        {value ? (
                            <div className="flex items-center gap-4 p-3 rounded-md bg-muted/50 border">
                                {value.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                                    <div className="relative h-20 w-20 rounded border overflow-hidden bg-white">
                                        <img src={value} alt="upload" className="h-full w-full object-cover" />
                                    </div>
                                ) : (
                                    <div className="h-20 w-20 flex items-center justify-center rounded border bg-white">
                                        <FileText className="h-10 w-10 text-muted-foreground" />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{value.split("-").pop()}</p>
                                    <div className="flex gap-2 mt-2">
                                        <Button size="sm" variant="outline" asChild>
                                            <a href={value} target="_blank" rel="noopener noreferrer">
                                                <ExternalLink className="h-3 w-3 mr-1" /> View
                                            </a>
                                        </Button>
                                        {!readOnly && (
                                            <Button size="sm" variant="ghost" onClick={() => handleFieldChange(template.id, "")}>
                                                Replace File
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            !readOnly && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-center w-full">
                                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted/5 hover:bg-muted/10 transition-colors">
                                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                <Upload className="w-8 h-8 mb-3 text-muted-foreground" />
                                                <p className="mb-2 text-sm text-muted-foreground">
                                                    <span className="font-semibold">Click to upload</span> or drag and drop
                                                </p>
                                            </div>
                                            <input
                                                type="file"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0]
                                                    if (file) handleFileUpload(template.id, file)
                                                }}
                                            />
                                        </label>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="w-full"
                                        onClick={() => setCameraFieldId(template.id)}
                                    >
                                        <Camera className="h-4 w-4 mr-2" />
                                        Use Camera
                                    </Button>
                                </div>
                            )
                        )}
                        {!value && readOnly && <p className="text-sm text-muted-foreground italic">No file uploaded</p>}
                    </div>
                )}

                {error && <p className="text-xs font-medium text-destructive mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {error}</p>}
            </div>
        )
    }

    if (loading || authStatus === "loading") {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-muted-foreground font-medium">Initialising inspection form...</p>
            </div>
        )
    }

    const isSubmitted = inspection?.status !== "draft"

    return (
        <div className="flex flex-col min-h-[100dvh] pb-16">
            {/* Top Bar */}
            <div className="sticky top-0 z-10 w-full bg-background/80 backdrop-blur-md border-b">
                <div className="container max-w-3xl py-3 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" asChild>
                            <Link href="/inspection">
                                <ChevronLeft className="h-6 w-6" />
                            </Link>
                        </Button>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span>{assignment?.project?.company?.name}</span>
                                <span>/</span>
                                <span className="font-medium text-foreground">{assignment?.project?.name}</span>
                            </div>
                            <h1 className="text-xl font-bold">Inspection Form</h1>
                        </div>
                    </div>
                    <Badge
                        className={cn(
                            "px-4 py-1 text-sm capitalize",
                            inspection?.status === "draft" && "bg-blue-100 text-blue-800 hover:bg-blue-100",
                            inspection?.status === "pending" && "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
                            inspection?.status === "approved" && "bg-green-100 text-green-800 hover:bg-green-100",
                            inspection?.status === "rejected" && "bg-red-100 text-red-800 hover:bg-red-100"
                        )}
                    >
                        {inspection?.status}
                    </Badge>
                </div>
            </div>

            {/* Banner for submitted forms */}
            {isSubmitted && (
                <div className="container max-w-3xl mt-4">
                    <div className="bg-muted p-3 rounded-lg flex items-center gap-3 border shadow-inner">
                        <AlertCircle className="h-5 w-5 text-muted-foreground" />
                        <p className="text-sm font-medium text-muted-foreground flex-1">
                            This form has been submitted and is pending approval.
                        </p>
                        {inspection?.status === "pending" && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={async () => {
                                    try {
                                        const res = await fetch(`/api/inspections/${inspection.id}`, {
                                            method: "PATCH",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ status: "draft" })
                                        })
                                        if (res.ok) {
                                            window.location.reload()
                                        } else {
                                            alert("Failed to request edit")
                                        }
                                    } catch (error) {
                                        alert("Failed to request edit")
                                    }
                                }}
                            >
                                <Pencil className="h-3 w-3 mr-1" />
                                Request Edit
                            </Button>
                        )}
                    </div>
                </div>
            )}

            {/* Form Area - Wizard Step View */}
            <main className="container max-w-3xl flex-1 flex flex-col py-4 space-y-4">
                {templates.length === 0 ? (
                    <Card>
                        <CardHeader className="text-center py-12">
                            <FileText className="h-12 w-12 mx-auto text-muted-foreground opacity-20" />
                            <CardTitle className="mt-4">No fields defined</CardTitle>
                            <CardDescription>
                                This project doesn't have any form fields configured yet.
                            </CardDescription>
                        </CardHeader>
                    </Card>
                ) : (
                    <>
                        {/* Progress Bar */}
                        <div className="space-y-2 mb-6">
                            <div className="flex justify-between items-center text-sm font-medium">
                                <span className="text-muted-foreground uppercase tracking-wider text-[11px] font-bold">
                                    Step {currentStep + 1} of {totalSteps}
                                </span>
                                <span className={cn(
                                    "font-bold",
                                    currentStep === 3 ? "text-primary" : "text-muted-foreground"
                                )}>
                                    {currentStep === 0 && "Basic Info"}
                                    {currentStep === 1 && "Defects & Summary"}
                                    {currentStep === 2 && "Attachments"}
                                    {currentStep === 3 && "Review & Submit"}
                                </span>
                            </div>
                            <Progress value={((currentStep + 1) / totalSteps) * 100} className="h-2" />
                        </div>

                        {/* Current Step Content */}
                        <div className="bg-card border rounded-xl shadow-sm overflow-hidden mb-6">
                            {currentStep === 0 && (
                                <div className="p-4 space-y-4">
                                    <div className="pb-2 border-b">
                                        <h3 className="text-xs font-bold text-muted-foreground uppercase">Basic Info</h3>
                                    </div>
                                    {fixedFields.map((t) => renderField(t))}
                                </div>
                            )}

                            {currentStep === 1 && (
                                <div className="p-4 space-y-6">
                                    <div className="space-y-4">
                                        <div className="pb-2 border-b">
                                            <h3 className="text-xs font-bold text-muted-foreground uppercase">Defect Entry (3-Col Grid)</h3>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            {defectFields.map((t) => (
                                                <div key={t.id} id={`field-${t.id}`} className={cn(
                                                    "p-2 border rounded-md bg-muted/20 transition-all",
                                                    errors[t.id] ? "border-destructive ring-1 ring-destructive" : "hover:border-primary/30"
                                                )}>
                                                    <Label className="text-[10px] font-bold text-muted-foreground truncate block mb-1" title={t.fieldLabel}>
                                                        {t.fieldLabel}
                                                    </Label>
                                                    <Input
                                                        type="number"
                                                        value={responses[t.id] || ""}
                                                        onChange={(e) => handleFieldChange(t.id, e.target.value)}
                                                        disabled={inspection?.status !== "draft"}
                                                        placeholder="0"
                                                        className="h-8 text-xs bg-white text-center font-bold"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-4 pt-4 border-t">
                                        <div className="pb-2 border-b">
                                            <h3 className="text-xs font-bold text-muted-foreground uppercase">Live Summary</h3>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {autoFields.map((t) => renderField(t))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {currentStep === 2 && (
                                <div className="p-5 space-y-5">
                                    <div className="text-center mb-6">
                                        <div className="mx-auto w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
                                            <FileText className="h-6 w-6" />
                                        </div>
                                        <h2 className="text-2xl font-bold">Paper Form Photo</h2>
                                        <p className="text-muted-foreground mt-2">If you have an offline paper form, attach its photo here</p>
                                    </div>
                                    <div className="max-w-xl mx-auto">
                                        {responses["paperFormPhoto"] ? (
                                            <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl bg-muted/30 border">
                                                <div className="relative h-40 w-full sm:w-40 rounded-lg border overflow-hidden bg-white shadow-sm">
                                                    <img src={responses["paperFormPhoto"]} alt="Paper form" className="h-full w-full object-cover" />
                                                </div>
                                                <div className="flex-1 text-center sm:text-left">
                                                    <p className="font-semibold text-lg mb-1">Paper form uploaded</p>
                                                    <p className="text-sm text-muted-foreground mb-4">Image successfully attached to this inspection</p>
                                                    <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                                                        <Button size="sm" variant="outline" asChild>
                                                            <a href={responses["paperFormPhoto"]} target="_blank" rel="noopener noreferrer">
                                                                <ExternalLink className="h-4 w-4 mr-2" /> View Full Image
                                                            </a>
                                                        </Button>
                                                        {!isSubmitted && (
                                                            <Button size="sm" variant="secondary" onClick={() => handleFieldChange("paperFormPhoto", "")}>
                                                                Replace Image
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : !isSubmitted ? (
                                            <div className="space-y-4">
                                                <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-xl cursor-pointer bg-card hover:bg-muted/30 transition-colors group">
                                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                        <div className="p-3 bg-muted rounded-full mb-4 group-hover:scale-110 transition-transform">
                                                            <Upload className="w-6 h-6 text-foreground" />
                                                        </div>
                                                        <p className="text-lg font-semibold mb-1">Upload Photo</p>
                                                        <p className="text-sm text-muted-foreground">
                                                            Click to browse or drag and drop
                                                        </p>
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
                                                <div className="relative flex items-center py-2">
                                                    <div className="flex-grow border-t"></div>
                                                    <span className="flex-shrink-0 mx-4 text-muted-foreground text-sm font-medium">OR</span>
                                                    <div className="flex-grow border-t"></div>
                                                </div>
                                                <Button
                                                    type="button"
                                                    size="lg"
                                                    variant="outline"
                                                    className="w-full border-primary/20 hover:bg-primary/5 text-primary hover:text-primary"
                                                    onClick={() => setCameraFieldId("paperFormPhoto")}
                                                >
                                                    <Camera className="h-5 w-5 mr-3" />
                                                    Use Camera
                                                </Button>
                                            </div>
                                        ) : (
                                            <Card className="border-dashed h-[200px] flex flex-col items-center justify-center text-center p-8 bg-muted/5">
                                                <div className="p-3 rounded-full bg-muted mb-4 opacity-50">
                                                    <FileText className="h-8 w-8 text-muted-foreground" />
                                                </div>
                                                <h3 className="font-medium text-muted-foreground">No paper form attached</h3>
                                            </Card>
                                        )}
                                    </div>
                                </div>
                            )}

                            {currentStep === 3 && (
                                <div className="p-5 space-y-6">
                                    <div className="text-center border-b pb-4">
                                        <div className="mx-auto w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-3">
                                            <ClipboardCheck className="h-6 w-6" />
                                        </div>
                                        <h2 className="text-2xl font-bold tracking-tight">Review Inspection</h2>
                                        <p className="text-muted-foreground mt-1 text-sm max-w-md mx-auto">Please review all the information below. Once submitted, you cannot edit this form without requesting permission.</p>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                                        <div className="md:col-span-2 pb-2 border-b">
                                            <h3 className="text-xs font-bold text-muted-foreground uppercase">Basic Info</h3>
                                        </div>
                                        {fixedFields.map(t => (
                                            <div key={t.id} className="space-y-1">
                                                <p className="text-sm font-medium text-muted-foreground tracking-wide uppercase text-[10px]">{t.fieldLabel}</p>
                                                <p className="text-lg font-semibold border-b pb-1 min-h-[32px]">{responses[t.id] || <span className="text-muted-foreground opacity-50 italic font-normal text-sm">Not provided</span>}</p>
                                            </div>
                                        ))}

                                        <div className="md:col-span-2 pb-2 border-b mt-4">
                                            <h3 className="text-xs font-bold text-muted-foreground uppercase">Defects</h3>
                                        </div>
                                        {defectFields.filter(t => responses[t.id] && responses[t.id] !== "0").map(t => (
                                            <div key={t.id} className="space-y-1">
                                                <p className="text-sm font-medium text-muted-foreground tracking-wide uppercase text-[10px]">{t.fieldLabel}</p>
                                                <p className="text-lg font-semibold border-b pb-1 min-h-[32px]">{responses[t.id]}</p>
                                            </div>
                                        ))}
                                        {defectFields.filter(t => responses[t.id] && responses[t.id] !== "0").length === 0 && (
                                            <p className="text-sm text-muted-foreground italic md:col-span-2">No defects reported</p>
                                        )}

                                        <div className="md:col-span-2 pb-2 border-b mt-4">
                                            <h3 className="text-xs font-bold text-muted-foreground uppercase">Summary</h3>
                                        </div>
                                        {autoFields.map(t => (
                                            <div key={t.id} className="space-y-1">
                                                <p className="text-sm font-medium text-muted-foreground tracking-wide uppercase text-[10px]">{t.fieldLabel}</p>
                                                <p className="text-lg font-semibold border-b pb-1 min-h-[32px]">{responses[t.id]}</p>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="space-y-1 md:col-span-2 mt-4 pt-4 border-t">
                                        <p className="text-sm font-medium text-muted-foreground tracking-wide uppercase text-[10px]">Paper Form Photo</p>
                                        {responses["paperFormPhoto"] ? (
                                            <div className="mt-2 h-32 w-48 border rounded-lg overflow-hidden shadow-sm">
                                                <img src={responses["paperFormPhoto"]} alt="Paper form" className="h-full w-full object-cover" />
                                            </div>
                                        ) : (
                                            <p className="text-muted-foreground opacity-50 italic">None attached</p>
                                        )}
                                    </div>

                                    {!isSubmitted && (
                                        <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 text-center max-w-2xl mx-auto mt-8">
                                            <h3 className="font-bold text-lg mb-2">Ready to submit?</h3>
                                            <p className="text-muted-foreground text-sm mb-6">Ensure all fields are accurate. This inspection will be sent to the manager for review.</p>
                                            <Button
                                                size="lg"
                                                onClick={handleSubmit}
                                                disabled={saving}
                                                className="w-full sm:w-auto font-bold shadow-md hover:shadow-lg transition-all"
                                            >
                                                {saving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Send className="h-5 w-5 mr-2" />}
                                                Confirm and Submit Inspection
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Wizard Navigation Actions (Inside the Card) */}
                        <div className="bg-muted/20 border-t p-4 flex items-center justify-between">
                            <Button
                                variant="outline"
                                onClick={handlePrevStep}
                                disabled={currentStep === 0 || saving}
                            >
                                <ChevronLeft className="h-4 w-4 mr-2" /> Previous
                            </Button>

                            {currentStep < totalSteps - 1 ? (
                                <Button
                                    onClick={handleNextStep}
                                    disabled={saving}
                                >
                                    Next <ChevronRight className="h-4 w-4 ml-2" />
                                </Button>
                            ) : (
                                <div className="text-sm text-muted-foreground hidden sm:block italic">
                                    Review completed
                                </div>
                            )}
                        </div>
                    </>
                )}
            </main>

            {/* Bottom Action Bar */}
            {
                !isSubmitted && (
                    <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
                        <div className="container max-w-3xl flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                {lastSaved && (
                                    <>
                                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                                        <span>Last saved: {lastSaved instanceof Date && !isNaN(lastSaved.getTime()) ? lastSaved.toLocaleTimeString() : "—"}</span>
                                        {isDirty && <span className="italic ml-2">(Unsaved changes)</span>}
                                    </>
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => saveForm("draft")}
                                    disabled={saving || !isDirty}
                                    className="hidden sm:flex"
                                >
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                    Force Save
                                </Button>
                                {currentStep === totalSteps - 1 && (
                                    <Button
                                        onClick={handleSubmit}
                                        disabled={saving}
                                        className="bg-primary hover:bg-primary/90 shadow-md"
                                    >
                                        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                                        Submit
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Camera Capture Modal */}
            {
                cameraFieldId && (
                    <CameraCapture
                        onCapture={(file) => {
                            if (cameraFieldId) {
                                handleFileUpload(cameraFieldId, file)
                            }
                            setCameraFieldId(null)
                        }}
                        onClose={() => setCameraFieldId(null)}
                    />
                )
            }
        </div >
    )
}
