
"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
    ChevronLeft,
    CheckCircle2,
    XCircle,
    Loader2,
    AlertCircle,
    Calendar,
    User as UserIcon,
    Building2,
    FileText,
    ExternalLink,
    Check,
    X,
    Clock,
    ClipboardCheck,
    Inbox
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

export default function ReviewInspectionPage() {
    const { data: session, status: authStatus } = useSession()
    const router = useRouter()
    const { id: inspectionId } = useParams()

    const [inspection, setInspection] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState(false)
    const [reviewerNotes, setReviewerNotes] = useState("")

    useEffect(() => {
        if (authStatus === "unauthenticated") {
            router.push("/login")
        } else if (authStatus === "authenticated" && session?.user?.role === "INSPECTION_BOY") {
            router.push("/")
        }
    }, [authStatus, session, router])

    const fetchInspection = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/approvals/${inspectionId}`)
            if (res.ok) {
                const data = await res.json()
                setInspection(data)
                setReviewerNotes(data.reviewerNotes || "")
            } else {
                router.push("/approvals")
            }
        } catch (error) {
            console.error("Failed to fetch inspection details", error)
        } finally {
            setLoading(false)
        }
    }, [inspectionId, router])

    useEffect(() => {
        if (authStatus === "authenticated") {
            fetchInspection()
        }
    }, [authStatus, fetchInspection])

    const handleAction = async (action: "approve" | "reject") => {
        if (action === "reject" && !reviewerNotes.trim()) {
            alert("Please provide a reason for rejection in the notes.")
            return
        }

        const confirmMsg = action === "approve"
            ? "Approve this inspection? The client will be able to view this report."
            : "Are you sure you want to reject this inspection?"

        if (!confirm(confirmMsg)) return

        setActionLoading(true)
        try {
            const res = await fetch(`/api/approvals/${inspectionId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, reviewerNotes })
            })

            if (res.ok) {
                alert(`Inspection ${action === "approve" ? "approved" : "rejected"} successfully!`)
                setTimeout(() => {
                    router.push("/approvals")
                }, 1500)
            } else {
                const err = await res.json()
                alert(err.error || "Action failed")
            }
        } catch (error) {
            alert("An error occurred")
        } finally {
            setActionLoading(false)
        }
    }

    if (loading || authStatus === "loading") {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-muted-foreground font-medium">Loading report content...</p>
            </div>
        )
    }

    if (!inspection) return null

    const renderResponse = (resp: any) => {
        const { field, value } = resp

        return (
            <Card key={resp.id} className="overflow-hidden border-muted/60">
                <CardHeader className="bg-muted/30 py-3 px-4">
                    <CardTitle className="text-sm font-semibold flex items-center justify-between">
                        {field.fieldLabel}
                        <Badge variant="outline" className="text-[10px] uppercase opacity-60">
                            {field.fieldType}
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                    {!value && <span className="text-muted-foreground italic text-sm">— Not filled —</span>}

                    {value && field.fieldType !== "file" && field.fieldType !== "checkbox" && (
                        <p className="text-sm whitespace-pre-wrap">{value}</p>
                    )}

                    {value && field.fieldType === "date" && (
                        <p className="text-sm font-medium">
                            {new Date(value).toLocaleDateString('en-GB', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric'
                            })}
                        </p>
                    )}

                    {value && field.fieldType === "checkbox" && (
                        <Badge variant="secondary" className={cn(
                            "rounded-sm px-3",
                            value === "true" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                        )}>
                            {value === "true" ? <Check className="h-3 w-3 mr-1" /> : <X className="h-3 w-3 mr-1" />}
                            {value === "true" ? "Yes" : "No"}
                        </Badge>
                    )}

                    {value && field.fieldType === "dropdown" && (
                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                            {value}
                        </Badge>
                    )}

                    {value && field.fieldType === "file" && (
                        <div className="flex items-center gap-4">
                            {value.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                                <div className="relative h-24 w-24 rounded border overflow-hidden shadow-sm bg-white">
                                    <img src={value} alt="evidence" className="h-full w-full object-cover" />
                                </div>
                            ) : (
                                <div className="h-24 w-24 flex items-center justify-center rounded border bg-white shadow-sm">
                                    <FileText className="h-10 w-10 text-muted-foreground/40" />
                                </div>
                            )}
                            <div className="space-y-1">
                                <p className="text-xs font-mono text-muted-foreground truncate max-w-[200px]">
                                    {value.split("-").pop()}
                                </p>
                                <Button size="sm" variant="outline" className="h-8" asChild>
                                    <a href={value} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="h-3 w-3 mr-1.5" /> View Full File
                                    </a>
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="container max-w-7xl py-10 space-y-8">
            {/* Header / Breadcrumbs */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-2">
                    <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground">
                        <Link href="/approvals">
                            <ChevronLeft className="h-4 w-4 mr-1" /> Back to Approvals
                        </Link>
                    </Button>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{inspection.assignment?.project?.company?.name}</span>
                        <span>/</span>
                        <span>{inspection.assignment?.project?.name}</span>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight">Review Inspection</h1>
                </div>
                <Badge
                    className={cn(
                        "px-4 py-1 text-sm rounded-full",
                        inspection.status === "pending" && "bg-yellow-100 text-yellow-800 border-yellow-200",
                        inspection.status === "approved" && "bg-green-100 text-green-800 border-green-200",
                        inspection.status === "rejected" && "bg-red-100 text-red-800 border-red-200"
                    )}
                >
                    {inspection.status === "pending" ? "Awaiting Review" : inspection.status}
                </Badge>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column - Responses */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center gap-2 pb-2 border-b">
                        <ClipboardCheck className="h-5 w-5 text-primary" />
                        <h2 className="text-xl font-semibold">Inspection Responses</h2>
                    </div>

                    {inspection.responses.length === 0 ? (
                        <div className="bg-muted/30 border-2 border-dashed rounded-xl py-20 text-center">
                            <Inbox className="h-10 w-10 mx-auto text-muted-foreground opacity-20 mb-3" />
                            <p className="text-muted-foreground font-medium">No form responses found</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {inspection.responses.sort((a: any, b: any) => a.field.displayOrder - b.field.displayOrder).map(renderResponse)}
                        </div>
                    )}
                </div>

                {/* Right Column - Info & Action */}
                <div className="space-y-6">
                    <div className="lg:sticky lg:top-24 space-y-6">
                        {/* Info Card */}
                        <Card className="shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-lg">Inspection Details</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <UserIcon className="h-4 w-4 text-muted-foreground mt-1" />
                                    <div>
                                        <p className="text-xs text-muted-foreground uppercase font-semibold">Inspector</p>
                                        <p className="text-sm font-medium">{inspection.submitter?.name}</p>
                                        <p className="text-xs text-muted-foreground">{inspection.submitter?.email}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <Building2 className="h-4 w-4 text-muted-foreground mt-1" />
                                    <div>
                                        <p className="text-xs text-muted-foreground uppercase font-semibold">Client / Project</p>
                                        <p className="text-sm font-medium">{inspection.assignment?.project?.company?.name}</p>
                                        <p className="text-xs text-muted-foreground">{inspection.assignment?.project?.name}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <Calendar className="h-4 w-4 text-muted-foreground mt-1" />
                                    <div>
                                        <p className="text-xs text-muted-foreground uppercase font-semibold">Submitted Date</p>
                                        <p className="text-sm font-medium">
                                            {inspection.submittedAt ? new Date(inspection.submittedAt).toLocaleString() : "N/A"}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Decision Panel */}
                        <Card className={cn(
                            "shadow-md border-2",
                            inspection.status === "pending" && "border-primary/20 bg-primary/[0.02]",
                            inspection.status === "approved" && "border-green-200 bg-green-50/30",
                            inspection.status === "rejected" && "border-red-200 bg-red-50/30"
                        )}>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    {inspection.status === "pending" ? (
                                        <>Review Decision</>
                                    ) : (
                                        <>Final Status</>
                                    )}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {inspection.status === "pending" ? (
                                    <>
                                        <div className="space-y-2">
                                            <p className="text-sm font-medium">Reviewer Notes (Optional)</p>
                                            <Textarea
                                                placeholder="Add your review feedback here..."
                                                className="bg-background min-h-[120px]"
                                                value={reviewerNotes}
                                                onChange={(e) => setReviewerNotes(e.target.value)}
                                            />
                                            <p className="text-[11px] text-muted-foreground italic">
                                                * Required for rejection. Client will see these notes.
                                            </p>
                                        </div>

                                        <div className="flex flex-col gap-3">
                                            <Button
                                                className="w-full bg-green-600 hover:bg-green-700 h-12 text-base shadow-sm"
                                                onClick={() => handleAction("approve")}
                                                disabled={actionLoading}
                                            >
                                                {actionLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5 mr-2" />}
                                                Approve Inspection
                                            </Button>
                                            <Button
                                                variant="outline"
                                                className="w-full border-red-200 text-red-600 hover:bg-red-50 h-12 text-base"
                                                onClick={() => handleAction("reject")}
                                                disabled={actionLoading}
                                            >
                                                {actionLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <XCircle className="h-5 w-5 mr-2" />}
                                                Reject Report
                                            </Button>
                                            {session?.user?.role === "ADMIN" && (
                                                <Button asChild variant="outline" className="w-full border-blue-200 text-blue-700 hover:bg-blue-50">
                                                    <Link href={`/inspection/${inspection.assignment?.id}/form`}>
                                                        <ExternalLink className="h-4 w-4 mr-2" />
                                                        Edit Inspection (Admin)
                                                    </Link>
                                                </Button>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div className="space-y-4">
                                        <div className={cn(
                                            "flex items-center gap-3 p-4 rounded-lg",
                                            inspection.status === "approved" ? "bg-green-100 text-green-900" : "bg-red-100 text-red-900"
                                        )}>
                                            {inspection.status === "approved" ? (
                                                <CheckCircle2 className="h-6 w-6" />
                                            ) : (
                                                <XCircle className="h-6 w-6" />
                                            )}
                                            <div>
                                                <p className="font-bold">Inspection {inspection.status}</p>
                                                <p className="text-xs opacity-80">
                                                    Actioned on {new Date(inspection.approvedAt || inspection.createdAt).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>

                                        {inspection.reviewerNotes && (
                                            <div className="bg-background/80 p-4 rounded-lg border border-muted-foreground/10 space-y-2">
                                                <p className="text-xs font-semibold text-muted-foreground uppercase">Reviewer Comments</p>
                                                <p className="text-sm italic">"{inspection.reviewerNotes}"</p>
                                            </div>
                                        )}

                                        {session?.user?.role === "ADMIN" && (
                                            <Button
                                                asChild
                                                variant="outline"
                                                className="w-full border-blue-200 text-blue-700 hover:bg-blue-50"
                                            >
                                                <Link href={`/inspection/${inspection.assignment?.id}/form`}>
                                                    <ExternalLink className="h-4 w-4 mr-2" />
                                                    Edit Inspection (Admin)
                                                </Link>
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                            {inspection.status === "pending" && (
                                <CardFooter className="bg-muted/50 p-4 border-t flex items-center gap-2 text-[11px] text-muted-foreground">
                                    <AlertCircle className="h-3.5 w-3.5" />
                                    <span>Approving will mark the assignment as complete.</span>
                                </CardFooter>
                            )}
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    )
}
