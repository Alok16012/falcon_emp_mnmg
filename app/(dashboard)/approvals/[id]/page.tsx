"use client"

import { useState, useEffect, useCallback, useRef } from "react"
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
    Inbox,
    CornerUpLeft,
    Share2,
    Copy,
    PenTool,
    Trash2
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export default function ReviewInspectionPage() {
    const { data: session, status: authStatus } = useSession()
    const router = useRouter()
    const { id: inspectionId } = useParams()
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const isDrawingRef = useRef(false)

    const [inspection, setInspection] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState(false)
    const [reviewerNotes, setReviewerNotes] = useState("")
    const [shareToken, setShareToken] = useState<string | null>(null)
    const [sharing, setSharing] = useState(false)
    const [showSignature, setShowSignature] = useState(false)
    const [hasSig, setHasSig] = useState(false)

    useEffect(() => {
        if (authStatus === "unauthenticated") router.push("/login")
        else if (authStatus === "authenticated" && session?.user?.role === "INSPECTION_BOY") router.push("/")
    }, [authStatus, session, router])

    const fetchInspection = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/approvals/${inspectionId}`)
            if (res.ok) {
                const data = await res.json()
                setInspection(data)
                setReviewerNotes(data.reviewerNotes || "")
                if (data.shareableLink) setShareToken(data.shareableLink.token)
            } else {
                router.push("/approvals")
            }
        } catch {
            console.error("Failed to fetch")
        } finally {
            setLoading(false)
        }
    }, [inspectionId, router])

    useEffect(() => {
        if (authStatus === "authenticated") fetchInspection()
    }, [authStatus, fetchInspection])

    const handleAction = async (action: "approve" | "reject" | "send_back") => {
        if ((action === "reject" || action === "send_back") && !reviewerNotes.trim()) {
            toast.error("Please provide a reason in the notes field.")
            return
        }

        const msgs = {
            approve: "Approve this inspection?",
            reject: "Reject this inspection?",
            send_back: "Send back to inspector for corrections?"
        }
        if (!confirm(msgs[action])) return

        setActionLoading(true)
        try {
            const res = await fetch(`/api/approvals/${inspectionId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, reviewerNotes })
            })

            if (res.ok) {
                const labels = { approve: "approved", reject: "rejected", send_back: "sent back" }
                toast.success(`Inspection ${labels[action]} successfully!`)
                setTimeout(() => router.push("/approvals"), 1200)
            } else {
                const err = await res.json()
                toast.error(err.error || "Action failed")
            }
        } catch {
            toast.error("An error occurred")
        } finally {
            setActionLoading(false)
        }
    }

    const handleShare = async () => {
        setSharing(true)
        try {
            if (shareToken) {
                const url = `${window.location.origin}/share/${shareToken}`
                await navigator.clipboard.writeText(url)
                toast.success("Share link copied to clipboard!")
            } else {
                const res = await fetch(`/api/inspections/${inspectionId}/share`, { method: "POST" })
                if (res.ok) {
                    const { token } = await res.json()
                    setShareToken(token)
                    const url = `${window.location.origin}/share/${token}`
                    await navigator.clipboard.writeText(url)
                    toast.success("Share link created and copied!")
                }
            }
        } catch {
            toast.error("Failed to create share link")
        } finally {
            setSharing(false)
        }
    }

    // Signature pad
    const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        isDrawingRef.current = true
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext("2d")
        if (!ctx) return
        const rect = canvas.getBoundingClientRect()
        const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left
        const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top
        ctx.beginPath()
        ctx.moveTo(x, y)
    }

    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawingRef.current) return
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext("2d")
        if (!ctx) return
        const rect = canvas.getBoundingClientRect()
        const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left
        const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top
        ctx.lineTo(x, y)
        ctx.strokeStyle = "#1a9e6e"
        ctx.lineWidth = 2
        ctx.lineCap = "round"
        ctx.stroke()
        setHasSig(true)
    }

    const stopDraw = () => { isDrawingRef.current = false }

    const clearSig = () => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext("2d")
        ctx?.clearRect(0, 0, canvas.width, canvas.height)
        setHasSig(false)
    }

    const submitSignature = async () => {
        const canvas = canvasRef.current
        if (!canvas || !hasSig) return
        const sig = canvas.toDataURL("image/png")

        await fetch(`/api/inspections/${inspectionId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ signature: sig })
        })
        toast.success("Signature saved!")
        setShowSignature(false)
        fetchInspection()
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
                        <Badge variant="outline" className="text-[10px] uppercase opacity-60">{field.fieldType}</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                    {!value && <span className="text-muted-foreground italic text-sm">— Not filled —</span>}
                    {value && field.fieldType !== "file" && field.fieldType !== "checkbox" && (
                        <p className="text-sm whitespace-pre-wrap">{value}</p>
                    )}
                    {value && field.fieldType === "checkbox" && (
                        <Badge variant="secondary" className={cn("rounded-sm px-3", value === "true" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800")}>
                            {value === "true" ? <Check className="h-3 w-3 mr-1" /> : <X className="h-3 w-3 mr-1" />}
                            {value === "true" ? "Yes" : "No"}
                        </Badge>
                    )}
                    {value && field.fieldType === "dropdown" && (
                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">{value}</Badge>
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
                            <Button size="sm" variant="outline" className="h-8" asChild>
                                <a href={value} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-3 w-3 mr-1.5" /> View Full File
                                </a>
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="container max-w-7xl py-10 space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-2">
                    <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground">
                        <Link href="/approvals"><ChevronLeft className="h-4 w-4 mr-1" /> Back to Approvals</Link>
                    </Button>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{inspection.assignment?.project?.company?.name}</span>
                        <span>/</span>
                        <span>{inspection.assignment?.project?.name}</span>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight">Review Inspection</h1>
                </div>
                <div className="flex items-center gap-2">
                    {inspection.status === "approved" && (
                        <>
                            <Button variant="outline" size="sm" onClick={handleShare} disabled={sharing} className="border-blue-200 text-blue-700 hover:bg-blue-50">
                                {sharing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Share2 className="h-4 w-4 mr-1" />}
                                {shareToken ? "Copy Share Link" : "Share Report"}
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setShowSignature(true)} className="border-purple-200 text-purple-700 hover:bg-purple-50">
                                <PenTool className="h-4 w-4 mr-1" />
                                {inspection.signature ? "View Signature" : "Add Signature"}
                            </Button>
                        </>
                    )}
                    <Badge className={cn(
                        "px-4 py-1 text-sm rounded-full",
                        inspection.status === "pending" && "bg-yellow-100 text-yellow-800 border-yellow-200",
                        inspection.status === "approved" && "bg-green-100 text-green-800 border-green-200",
                        inspection.status === "rejected" && "bg-red-100 text-red-800 border-red-200",
                        inspection.status === "draft" && "bg-gray-100 text-gray-800 border-gray-200",
                    )}>
                        {inspection.status === "pending" ? "Awaiting Review" : inspection.status === "draft" ? "Sent Back / Draft" : inspection.status}
                    </Badge>
                </div>
            </div>

            {/* Signature Modal */}
            {showSignature && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold">Digital Signature</h3>
                            <button onClick={() => setShowSignature(false)}><X className="h-5 w-5" /></button>
                        </div>
                        {inspection.signature ? (
                            <div className="space-y-3">
                                <p className="text-sm text-muted-foreground">Existing signature on this report:</p>
                                <img src={inspection.signature} alt="signature" className="border rounded w-full" />
                                <Button variant="outline" size="sm" className="text-red-600 border-red-200" onClick={async () => {
                                    await fetch(`/api/inspections/${inspectionId}`, {
                                        method: "PATCH",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ signature: null })
                                    })
                                    toast.success("Signature removed")
                                    setShowSignature(false)
                                    fetchInspection()
                                }}>
                                    <Trash2 className="h-4 w-4 mr-1" /> Remove Signature
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <p className="text-sm text-muted-foreground">Draw your signature below:</p>
                                <canvas
                                    ref={canvasRef}
                                    width={400} height={150}
                                    className="border rounded w-full touch-none bg-gray-50 cursor-crosshair"
                                    onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
                                    onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
                                />
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={clearSig}><Trash2 className="h-4 w-4 mr-1" /> Clear</Button>
                                    <Button size="sm" onClick={submitSignature} disabled={!hasSig} className="bg-[#1a9e6e] hover:bg-[#158a5e] text-white">
                                        Save Signature
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column - Responses */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center gap-2 pb-2 border-b">
                        <ClipboardCheck className="h-5 w-5 text-primary" />
                        <h2 className="text-xl font-semibold">Inspection Responses</h2>
                        {inspection.sentBackCount > 0 && (
                            <Badge variant="outline" className="ml-auto text-orange-700 border-orange-200 bg-orange-50">
                                Sent back {inspection.sentBackCount}x
                            </Badge>
                        )}
                    </div>

                    {inspection.gpsLocation && (() => {
                        try {
                            const gps = JSON.parse(inspection.gpsLocation)
                            return (
                                <div className="flex items-center gap-2 text-sm bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
                                    <span className="text-blue-600 font-semibold">📍 GPS:</span>
                                    <span className="text-blue-800">{gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}</span>
                                    <a href={`https://maps.google.com?q=${gps.lat},${gps.lng}`} target="_blank" rel="noopener noreferrer" className="ml-auto text-blue-600 hover:underline text-xs">
                                        View on Maps →
                                    </a>
                                </div>
                            )
                        } catch { return null }
                    })()}

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
                        <Card className="shadow-sm">
                            <CardHeader><CardTitle className="text-lg">Inspection Details</CardTitle></CardHeader>
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
                                {inspection.startedAt && (
                                    <div className="flex items-start gap-3">
                                        <Clock className="h-4 w-4 text-muted-foreground mt-1" />
                                        <div>
                                            <p className="text-xs text-muted-foreground uppercase font-semibold">Fill Duration</p>
                                            <p className="text-sm font-medium">
                                                {inspection.submittedAt
                                                    ? `${Math.round((new Date(inspection.submittedAt).getTime() - new Date(inspection.startedAt).getTime()) / 60000)} min`
                                                    : "In progress"}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Share link info */}
                        {shareToken && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                                <p className="font-semibold text-blue-800 mb-1 flex items-center gap-1"><Share2 className="h-3.5 w-3.5" /> Share Link Active</p>
                                <p className="text-blue-600 text-xs break-all">{window.location.origin}/share/{shareToken}</p>
                                <button className="mt-2 text-xs text-blue-700 hover:underline flex items-center gap-1" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/share/${shareToken}`).then(() => toast.success("Copied!"))}>
                                    <Copy className="h-3 w-3" /> Copy link
                                </button>
                            </div>
                        )}

                        {/* Decision Panel */}
                        <Card className={cn(
                            "shadow-md border-2",
                            inspection.status === "pending" && "border-primary/20 bg-primary/[0.02]",
                            inspection.status === "approved" && "border-green-200 bg-green-50/30",
                            inspection.status === "rejected" && "border-red-200 bg-red-50/30",
                            inspection.status === "draft" && "border-orange-200 bg-orange-50/30",
                        )}>
                            <CardHeader>
                                <CardTitle className="text-lg">
                                    {inspection.status === "pending" ? "Review Decision" : "Final Status"}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {inspection.status === "pending" ? (
                                    <>
                                        <div className="space-y-2">
                                            <p className="text-sm font-medium">Reviewer Notes</p>
                                            <Textarea
                                                placeholder="Add feedback, corrections, or approval notes..."
                                                className="bg-background min-h-[100px]"
                                                value={reviewerNotes}
                                                onChange={(e) => setReviewerNotes(e.target.value)}
                                            />
                                            <p className="text-[11px] text-muted-foreground italic">* Required for rejection and send-back.</p>
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            <Button className="w-full bg-green-600 hover:bg-green-700 h-11 text-base shadow-sm" onClick={() => handleAction("approve")} disabled={actionLoading}>
                                                {actionLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5 mr-2" />}
                                                Approve
                                            </Button>
                                            <Button variant="outline" className="w-full border-orange-200 text-orange-700 hover:bg-orange-50 h-11 text-base" onClick={() => handleAction("send_back")} disabled={actionLoading}>
                                                {actionLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <CornerUpLeft className="h-5 w-5 mr-2" />}
                                                Send Back (Corrections)
                                            </Button>
                                            <Button variant="outline" className="w-full border-red-200 text-red-600 hover:bg-red-50 h-11 text-base" onClick={() => handleAction("reject")} disabled={actionLoading}>
                                                {actionLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <XCircle className="h-5 w-5 mr-2" />}
                                                Reject
                                            </Button>
                                            {session?.user?.role === "ADMIN" && (
                                                <Button asChild variant="outline" className="w-full border-blue-200 text-blue-700 hover:bg-blue-50">
                                                    <Link href={`/inspection/${inspection.assignment?.id}/form`}>
                                                        <ExternalLink className="h-4 w-4 mr-2" /> Edit (Admin)
                                                    </Link>
                                                </Button>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div className="space-y-4">
                                        <div className={cn(
                                            "flex items-center gap-3 p-4 rounded-lg",
                                            inspection.status === "approved" ? "bg-green-100 text-green-900" : inspection.status === "rejected" ? "bg-red-100 text-red-900" : "bg-orange-100 text-orange-900"
                                        )}>
                                            {inspection.status === "approved" ? <CheckCircle2 className="h-6 w-6" /> : inspection.status === "rejected" ? <XCircle className="h-6 w-6" /> : <CornerUpLeft className="h-6 w-6" />}
                                            <div>
                                                <p className="font-bold">Inspection {inspection.status === "draft" ? "Sent Back" : inspection.status}</p>
                                                <p className="text-xs opacity-80">
                                                    {new Date(inspection.approvedAt || inspection.sentBackAt || inspection.createdAt).toLocaleDateString()}
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
                                            <Button asChild variant="outline" className="w-full border-blue-200 text-blue-700 hover:bg-blue-50">
                                                <Link href={`/inspection/${inspection.assignment?.id}/form`}>
                                                    <ExternalLink className="h-4 w-4 mr-2" /> Edit (Admin)
                                                </Link>
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                            {inspection.status === "pending" && (
                                <CardFooter className="bg-muted/50 p-4 border-t flex items-center gap-2 text-[11px] text-muted-foreground">
                                    <AlertCircle className="h-3.5 w-3.5" />
                                    <span>Send Back returns to inspector for corrections without rejecting.</span>
                                </CardFooter>
                            )}
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    )
}
