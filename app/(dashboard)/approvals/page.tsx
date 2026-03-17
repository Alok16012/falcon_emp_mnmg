
"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    CheckCircle2,
    XCircle,
    Clock,
    ChevronRight,
    Loader2,
    Search,
    ClipboardCheck,
    Inbox
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { cn } from "@/lib/utils"

export default function ApprovalsPage() {
    const { data: session, status: authStatus } = useSession()
    const router = useRouter()

    const [inspections, setInspections] = useState<any[]>([])
    const [counts, setCounts] = useState<Record<string, number>>({
        pending: 0,
        approved: 0,
        rejected: 0,
        all: 0
    })
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [activeTab, setActiveTab] = useState("pending")

    useEffect(() => {
        if (authStatus === "unauthenticated") {
            router.push("/login")
        } else if (authStatus === "authenticated" && session?.user?.role === "INSPECTION_BOY") {
            router.push("/")
        }
    }, [authStatus, session, router])

    const fetchData = async (status: string) => {
        setLoading(true)
        try {
            const url = `/api/inspections/all?status=${status}&limit=100&withCounts=true`
            const res = await fetch(url)
            const data = await res.json()

            const items = data?.inspections ?? (Array.isArray(data) ? data : [])
            setInspections(items)

            if (data?.counts) {
                setCounts({
                    pending: data.counts.pending ?? 0,
                    approved: data.counts.approved ?? 0,
                    rejected: data.counts.rejected ?? 0,
                    all: data.counts.all ?? 0
                })
            }
        } catch (error) {
            console.error("Failed to fetch approvals", error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (authStatus === "authenticated") {
            fetchData(activeTab)
        }
    }, [authStatus, activeTab])

    const filteredInspections = inspections.filter(i =>
        i.assignment?.project?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.assignment?.project?.company?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.submitter?.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    if (authStatus === "loading" || !session) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="space-y-8 container max-w-7xl py-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Inspection Approvals</h1>
                    <p className="text-muted-foreground mt-1">
                        Review and approve submitted inspections to finalize reports.
                    </p>
                </div>
                {counts.pending > 0 && (
                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 px-4 py-1 self-start md:self-center">
                        <Clock className="h-3.5 w-3.5 mr-2" />
                        {counts.pending} Pending Reviews
                    </Badge>
                )}
            </div>

            <Tabs defaultValue="pending" className="w-full" onValueChange={setActiveTab}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
                    <TabsList className="grid grid-cols-4 w-full sm:w-[450px]">
                        <TabsTrigger value="pending" className="relative">
                            Pending
                            {counts.pending > 0 && (
                                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground shadow-sm">
                                    {counts.pending}
                                </span>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="approved">Approved</TabsTrigger>
                        <TabsTrigger value="rejected">Rejected</TabsTrigger>
                        <TabsTrigger value="all">All</TabsTrigger>
                    </TabsList>

                    <div className="relative w-full sm:w-[300px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by project, company..."
                            className="pl-9"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="mt-8">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 space-y-4">
                            <Loader2 className="h-10 w-10 animate-spin text-primary opacity-50" />
                            <p className="text-sm font-medium text-muted-foreground">Loading inspections...</p>
                        </div>
                    ) : filteredInspections.length === 0 ? (
                        <Card className="border-dashed">
                            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                                <div className="rounded-full bg-green-50 p-4 border border-green-100 mb-4">
                                    <ClipboardCheck className="h-8 w-8 text-green-500" />
                                </div>
                                <h3 className="text-lg font-semibold">All caught up!</h3>
                                <p className="text-muted-foreground max-w-[250px] mt-1">
                                    No {activeTab !== "all" ? activeTab : ""} inspections found matching your criteria.
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="rounded-md border bg-card overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/50 border-b">
                                        <tr className="text-left font-medium text-muted-foreground">
                                            <th className="px-4 py-3">Company Name</th>
                                            <th className="px-4 py-3">Project Name</th>
                                            <th className="px-4 py-3">Inspector Name</th>
                                            <th className="px-4 py-3">Submitted Date</th>
                                            <th className="px-4 py-3">Status</th>
                                            <th className="px-4 py-3 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {filteredInspections.map((inspection) => (
                                            <tr key={inspection.id} className="hover:bg-muted/30 transition-colors group">
                                                <td className="px-4 py-4 font-medium">
                                                    {inspection.assignment?.project?.company?.name}
                                                </td>
                                                <td className="px-4 py-4">
                                                    {inspection.assignment?.project?.name}
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                                                            {inspection.submitter?.name.charAt(0)}
                                                        </div>
                                                        {inspection.submitter?.name}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-muted-foreground">
                                                    {inspection.submittedAt ? new Date(inspection.submittedAt).toLocaleDateString('en-GB') : "—"}
                                                </td>
                                                <td className="px-4 py-4">
                                                    <Badge
                                                        className={cn(
                                                            "px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider rounded-md border shadow-none",
                                                            inspection.status === "pending" && "bg-yellow-50 text-yellow-700 border-yellow-200",
                                                            inspection.status === "approved" && "bg-green-50 text-green-700 border-green-200",
                                                            inspection.status === "rejected" && "bg-red-50 text-red-700 border-red-200",
                                                            inspection.status === "draft" && "bg-blue-50 text-blue-700 border-blue-200"
                                                        )}
                                                    >
                                                        {inspection.status === "pending" ? "Awaiting Review" : inspection.status}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-4 text-right">
                                                    <Button variant={inspection.status === "pending" ? "default" : "outline"} size="sm" asChild className="h-8 group-hover:shadow-sm">
                                                        <Link href={`/approvals/${inspection.id}`}>
                                                            {inspection.status === "pending" ? "Review" : "View"}
                                                            <ChevronRight className="ml-1.5 h-3.5 w-3.5" />
                                                        </Link>
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </Tabs>
        </div>
    )
}
