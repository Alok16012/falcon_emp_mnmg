"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    ClipboardCheck,
    HardHat,
    CheckCircle2,
    ArrowRight,
    Clock,
    Building2,
    Calendar,
    Loader2,
    UserCircle2,
    ClipboardList
} from "lucide-react"
import Link from "next/link"
import { format, formatDistanceToNow } from "date-fns"

function safeFormat(val: any, fmt: string): string {
    try { if (!val) return "—"; const d = new Date(val); if (isNaN(d.getTime())) return "—"; return format(d, fmt) } catch { return "—" }
}
function safeDistance(val: any): string {
    try { if (!val) return "—"; const d = new Date(val); if (isNaN(d.getTime())) return "—"; return formatDistanceToNow(d) } catch { return "—" }
}
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import BulkImportInspectors from "@/components/BulkImportInspectors"

export default function ManagerDashboard() {
    const { data: session } = useSession()
    const [stats, setStats] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch("/api/manager/stats")
                const data = await res.json()
                setStats(data)
            } catch (error) {
                console.error("Failed to fetch manager stats", error)
            } finally {
                setLoading(false)
            }
        }
        fetchStats()
    }, [])

    if (loading) {
        return (
            <div className="space-y-8 animate-pulse">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-32 w-full rounded-xl" />
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <Skeleton className="h-[500px] w-full rounded-xl" />
                    <Skeleton className="h-[500px] w-full rounded-xl" />
                </div>
            </div>
        )
    }

    if (!stats || stats.error) {
        return (
            <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed shadow-sm">
                <div className="flex flex-col items-center gap-2 text-center">
                    <div className="h-10 w-10 text-destructive bg-destructive/10 rounded-full flex items-center justify-center mb-2">
                        <ClipboardList className="h-6 w-6" />
                    </div>
                    <h3 className="text-xl font-bold tracking-tight">
                        Failed to load dashboard data
                    </h3>
                    <p className="text-sm text-muted-foreground flex flex-col gap-1 max-w-md">
                        <span>{stats?.error || "An unexpected error occurred while fetching manager statistics."}</span>
                        {stats?.details && (
                            <span className="text-[10px] bg-muted p-2 rounded border mt-2 overflow-auto font-mono text-left">
                                {stats.details}
                            </span>
                        )}
                    </p>
                    <Button onClick={() => window.location.reload()} className="mt-4">
                        Try Again
                    </Button>
                </div>
            </div>
        )
    }

    const kpiCards = [
        {
            title: "Pending Approvals",
            value: stats.pendingApprovals,
            icon: ClipboardCheck,
            color: "text-amber-600",
            bg: "bg-amber-50",
            link: "/approvals",
            badge: stats.pendingApprovals > 0
        },
        {
            title: "Active Assignments",
            value: stats.activeAssignments,
            icon: HardHat,
            color: "text-blue-600",
            bg: "bg-blue-50",
            link: "/assignments"
        },
        {
            title: "Completed This Month",
            value: stats.completedThisMonth,
            icon: CheckCircle2,
            color: "text-emerald-600",
            bg: "bg-emerald-50",
            link: "/approvals"
        }
    ]

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Manager Dashboard</h1>
                        <p className="text-muted-foreground font-medium text-sm">Monitor operations and review pending inspections</p>
                    </div>
                    <BulkImportInspectors />
                </div>
            </div>

            {/* Top Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {kpiCards.map((card) => (
                    <Link key={card.title} href={card.link}>
                        <Card className="hover:shadow-lg transition-all border-none shadow-sm group">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div className={`${card.bg} ${card.color} p-2.5 rounded-xl group-hover:scale-110 transition-transform`}>
                                        <card.icon className="h-5 w-5" />
                                    </div>
                                    {card.badge && (
                                        <div className="flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-amber-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                                    <p className="text-2xl font-bold tracking-tight">{card.value}</p>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>

            {/* Main Content Areas */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left - Pending Approvals List */}
                <Card className="border-none shadow-sm bg-white overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                            <Clock className="h-5 w-5 text-amber-500" />
                            Pending Approvals
                        </CardTitle>
                        <Button variant="ghost" size="sm" asChild>
                            <Link href="/approvals" className="text-xs font-bold text-primary">View All Pending →</Link>
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y">
                            {stats.recentPending.map((i: any) => (
                                <div key={i.id} className="p-5 hover:bg-muted/30 transition-colors flex items-center justify-between group">
                                    <div className="space-y-1.5 min-w-0 pr-4">
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-bold text-sm truncate">{i.projectName}</h4>
                                            <Badge variant="outline" className="text-[9px] py-0 border-primary/20 text-primary">{i.companyName}</Badge>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium">
                                            <span className="flex items-center gap-1"><UserCircle2 className="h-3 w-3" /> {i.inspectorName}</span>
                                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {safeDistance(i.submittedAt)} ago</span>
                                        </div>
                                    </div>
                                    <Button size="sm" asChild className="shrink-0 h-8 text-xs font-bold">
                                        <Link href={`/approvals/${i.id}`}>Review →</Link>
                                    </Button>
                                </div>
                            ))}
                            {stats.recentPending.length === 0 && (
                                <div className="p-20 text-center space-y-2">
                                    <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto opacity-20" />
                                    <p className="text-sm text-muted-foreground font-medium">All caught up! No pending approvals.</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Right - Recent Assignments */}
                <Card className="border-none shadow-sm bg-white overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                            <ClipboardList className="h-5 w-5 text-blue-500" />
                            Recent Assignments
                        </CardTitle>
                        <Button variant="ghost" size="sm" asChild>
                            <Link href="/assignments" className="text-xs font-bold text-primary">View All →</Link>
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y">
                            {stats.recentAssignments.map((a: any) => (
                                <div key={a.id} className="p-5 hover:bg-muted/30 transition-colors flex items-center justify-between">
                                    <div className="space-y-1.5">
                                        <h4 className="font-bold text-sm">{a.projectName}</h4>
                                        <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium">
                                            <span className="flex items-center gap-1 font-bold text-blue-600/80"><HardHat className="h-3 w-3" /> {a.inspectorName}</span>
                                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {safeFormat(a.createdAt, "MMM d, yyyy")}</span>
                                        </div>
                                    </div>
                                    <Badge className={cn(
                                        "capitalize border-none font-bold text-[10px]",
                                        a.status === "active" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
                                    )}>
                                        {a.status}
                                    </Badge>
                                </div>
                            ))}
                            {stats.recentAssignments.length === 0 && (
                                <div className="p-20 text-center space-y-2">
                                    <ClipboardList className="h-10 w-10 text-blue-500 mx-auto opacity-20" />
                                    <p className="text-sm text-muted-foreground font-medium">No recent assignments found.</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
