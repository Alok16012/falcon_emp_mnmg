
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
    Pencil
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

            // Initialize responses
            const initialResponses: Record<string, string> = {}
            if (inspData.responses) {
                inspData.responses.forEach((r: any) => {
                    initialResponses[r.fieldId] = r.value || ""
                })
            }
            setResponses(initialResponses)
            if (inspData.submittedAt) {
                setLastSaved(new Date(inspData.submittedAt))
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
            // Scroll to first error
            const firstErrorId = Object.keys(newErrors)[0]
            const element = document.getElementById(`field-${firstErrorId}`)
            element?.scrollIntoView({ behavior: "smooth", block: "center" })
            return false
        }
        return true
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
                if (!holdsSilent) alert("Failed to save inspection")
            }
        } catch (error) {
            console.error("Save error", error)
            if (!holdsSilent) alert("An error occurred while saving")
        } finally {
            if (!holdsSilent) setSaving(false)
        }
    }

    const handleSubmit = () => {
        if (validateForm()) {
            if (confirm("Once submitted you cannot edit this form. Are you sure?")) {
                saveForm("pending")
            }
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
        const readOnly = inspection?.status !== "draft"
        const error = errors[template.id]

        return (
            <div key={template.id} id={`field-${template.id}`} className="space-y-3 p-4 rounded-lg border bg-card transition-colors hover:border-primary/50">
                <div className="flex justify-between items-start">
                    <Label className="text-base font-semibold">
                        {template.fieldLabel}
                        {template.isRequired && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider opacity-70">
                        {template.fieldType}
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
                    <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={value}
                        onChange={(e) => handleFieldChange(template.id, e.target.value)}
                        disabled={readOnly}
                    >
                        <option value="">Select an option</option>
                        {template.options?.split(",").map((opt: string) => (
                            <option key={opt.trim()} value={opt.trim()}>{opt.trim()}</option>
                        ))}
                    </select>
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
        <div className="flex flex-col min-h-screen pb-24">
            {/* Top Bar */}
            <div className="sticky top-0 z-10 w-full bg-background/80 backdrop-blur-md border-b">
                <div className="container max-w-5xl py-4 flex items-center justify-between">
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
                <div className="container max-w-5xl mt-6">
                    <div className="bg-muted p-4 rounded-lg flex items-center gap-3 border shadow-inner">
                        <AlertCircle className="h-5 w-5 text-muted-foreground" />
                        <p className="text-sm font-medium text-muted-foreground flex-1">
                            This form has been submitted and is pending approval.
                        </p>
                        {inspection?.status === "pending" && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={async () => {
                                    if (confirm("Request to edit this form? It will be reverted to draft mode.")) {
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

            {/* Form Area */}
            <main className="container max-w-5xl mt-8 space-y-6">
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
                    templates.map(renderField)
                )}

                {/* Paper Form Photo Section */}
                <Card className="border-primary/20">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <FileText className="h-5 w-5 text-primary" />
                            Paper Form Photo
                        </CardTitle>
                        <CardDescription>
                            If you have an offline paper form, attach its photo here
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {responses["paperFormPhoto"] ? (
                                <div className="flex items-center gap-4 p-3 rounded-md bg-muted/50 border">
                                    <div className="relative h-24 w-24 rounded border overflow-hidden bg-white">
                                        <img src={responses["paperFormPhoto"]} alt="Paper form" className="h-full w-full object-cover" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">Paper form uploaded</p>
                                        <div className="flex gap-2 mt-2">
                                            <Button size="sm" variant="outline" asChild>
                                                <a href={responses["paperFormPhoto"]} target="_blank" rel="noopener noreferrer">
                                                    <ExternalLink className="h-3 w-3 mr-1" /> View
                                                </a>
                                            </Button>
                                            {!isSubmitted && (
                                                <Button size="sm" variant="ghost" onClick={() => handleFieldChange("paperFormPhoto", "")}>
                                                    Replace
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : !isSubmitted ? (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-center w-full">
                                        <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-lg cursor-pointer bg-muted/5 hover:bg-muted/10 transition-colors">
                                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                <Upload className="w-6 h-6 mb-2 text-muted-foreground" />
                                                <p className="text-sm text-muted-foreground">
                                                    <span className="font-semibold">Click to upload</span>
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
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="w-full"
                                        onClick={() => setCameraFieldId("paperFormPhoto")}
                                    >
                                        <Camera className="h-4 w-4 mr-2" />
                                        Use Camera
                                    </Button>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground italic">No paper form attached</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </main>

            {/* Bottom Action Bar */}
            {!isSubmitted && (
                <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 shadow-2xl z-20">
                    <div className="container max-w-5xl flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {lastSaved && (
                                <>
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    <span>Last saved: {lastSaved.toLocaleTimeString()}</span>
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
                                Save Draft
                            </Button>
                            <Button
                                onClick={handleSubmit}
                                disabled={saving}
                                className="bg-primary hover:bg-primary/90 shadow-md"
                            >
                                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                                Submit for Approval
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Camera Capture Modal */}
            {cameraFieldId && (
                <CameraCapture
                    onCapture={(file) => {
                        handleFileUpload(cameraFieldId, file)
                        setCameraFieldId(null)
                    }}
                    onClose={() => setCameraFieldId(null)}
                />
            )}
        </div>
    )
}
