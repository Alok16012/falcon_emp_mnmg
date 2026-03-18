"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    ClipboardCheck,
    HardHat,
    CheckCircle2,
    Clock,
    Building2,
    Calendar,
    Loader2,
    UserCircle2,
    ClipboardList,
    Users,
    ThumbsUp,
    ThumbsDown
} from "lucide-react"
import Link from "next/link"
import { format, formatDistanceToNow, isValid } from "date-fns"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import BulkImportInspectors from "@/components/BulkImportInspectors"

function safeFormat(val: any, fmt: string): string {
    try { if (!val) return "—"; const d = new Date(val); if (!isValid(d)) return "—"; return format(d, fmt) } catch { return "—" }
}
function safeDistance(val: any): string {
    try { if (!val) return "—"; const d = new Date(val); if (!isValid(d)) return "—"; return formatDistanceToNow(d) } catch { return "—" }
}

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
            <div className="min-h-screen bg-[#f5f4f0] p-7 space-y-5">
                <div className="grid grid-cols-3 gap-3">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-[120px] rounded-[14px]" />
                    ))}
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <Skeleton className="h-[400px] rounded-[14px]" />
                    <Skeleton className="h-[400px] rounded-[14px]" />
                </div>
            </div>
        )
    }

    if (!stats || stats.error) {
        return (
            <div className="min-h-screen bg-[#f5f4f0] p-7 flex items-center justify-center">
                <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed shadow-sm bg-white max-w-md">
                    <div className="flex flex-col items-center gap-2 text-center p-8">
                        <div className="h-10 w-10 text-[#dc2626] bg-[#fef2f2] rounded-full flex items-center justify-center mb-2">
                            <ClipboardList className="h-6 w-6" />
                        </div>
                        <h3 className="text-xl font-bold tracking-tight text-[#1a1a18]">
                            Failed to load dashboard data
                        </h3>
                        <p className="text-[13px] text-[#6b6860] flex flex-col gap-1 max-w-md">
                            <span>{stats?.error || "An unexpected error occurred while fetching manager statistics."}</span>
                        </p>
                        <Button onClick={() => window.location.reload()} className="mt-4 bg-[#1a9e6e] hover:bg-[#158a5e]">
                            Try Again
                        </Button>
                    </div>
                </div>
            </div>
        )
    }

    const kpiCards = [
        {
            title: "Pending Approvals",
            value: stats.pendingApprovals,
            icon: ClipboardCheck,
            color: "#d97706",
            bg: "#fef3c7",
            link: "/approvals"
        },
        {
            title: "Active Assignments",
            value: stats.activeAssignments,
            icon: Users,
            color: "#1a9e6e",
            bg: "#e8f7f1",
            link: "/assignments"
        },
        {
            title: "Completed This Month",
            value: stats.completedThisMonth,
            icon: CheckCircle2,
            color: "#3b82f6",
            bg: "#eff6ff",
            link: "/approvals"
        }
    ]

    return (
        <div className="min-h-screen bg-[#f5f4f0] p-6 lg:p-7">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-[22px] font-semibold text-[#1a1a18] tracking-[-0.4px]">Manager Dashboard</h1>
                    <p className="text-[13px] text-[#6b6860] mt-[3px]">Monitor operations and review pending inspections</p>
                </div>
                <BulkImportInspectors />
            </div>

            <div className="grid grid-cols-3 gap-3 mb-5">
                {kpiCards.map((card) => (
                    <Link key={card.title} href={card.link}>
                        <div className="bg-white border border-[#e8e6e1] rounded-[14px] p-5 hover:shadow-md transition-shadow">
                            <div className="w-9 h-9 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: card.bg }}>
                                <card.icon className="h-5 w-5" style={{ color: card.color }} />
                            </div>
                            <p className="text-[13px] text-[#6b6860] mb-1.5">{card.title}</p>
                            <p className="text-[32px] font-bold text-[#1a1a18] tracking-[-1px] tabular-nums">{card.value}</p>
                        </div>
                    </Link>
                ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white border border-[#e8e6e1] rounded-[14px] overflow-hidden">
                    <div className="p-4 border-b border-[#e8e6e1] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-[#d97706]" />
                            <span className="text-[13.5px] font-semibold text-[#1a1a18]">Pending Approvals</span>
                        </div>
                        <Link href="/approvals" className="text-[12.5px] font-medium text-[#1a9e6e] hover:underline">
                            View All Pending →
                        </Link>
                    </div>
                    <div className="p-5">
                        {stats.recentPending.length === 0 ? (
                            <div className="text-center py-10 px-5">
                                <CheckCircle2 className="h-8 w-8 text-[#d4d1ca] mx-auto mb-3" />
                                <p className="text-[13px] text-[#9e9b95]">All caught up! No pending approvals.</p>
                            </div>
                        ) : (
                            stats.recentPending.map((i: any) => (
                                <div key={i.id} className="flex items-center justify-between py-3 border-b border-[#e8e6e1] last:border-b-0">
                                    <div className="min-w-0 pr-4">
                                        <p className="text-[13px] font-medium text-[#1a1a18] truncate">{i.projectName}</p>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="flex items-center gap-1 text-[12px] text-[#6b6860]">
                                                <UserCircle2 className="h-3 w-3 text-[#9e9b95]" />
                                                {i.inspectorName}
                                            </span>
                                            <span className="flex items-center gap-1 text-[12px] text-[#9e9b95]">
                                                <Calendar className="h-3 w-3" />
                                                {safeDistance(i.submittedAt)} ago
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button className="w-8 h-8 rounded-[8px] flex items-center justify-center bg-[#e8f7f1] text-[#0d6b4a] hover:bg-[#1a9e6e] hover:text-white transition-colors" title="Approve">
                                            <ThumbsUp className="h-4 w-4" />
                                        </button>
                                        <button className="w-8 h-8 rounded-[8px] flex items-center justify-center bg-[#fef2f2] text-[#dc2626] hover:bg-[#dc2626] hover:text-white transition-colors" title="Reject">
                                            <ThumbsDown className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="bg-white border border-[#e8e6e1] rounded-[14px] overflow-hidden">
                    <div className="p-4 border-b border-[#e8e6e1] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <ClipboardList className="h-4 w-4 text-[#6b6860]" />
                            <span className="text-[13.5px] font-semibold text-[#1a1a18]">Recent Assignments</span>
                        </div>
                        <Link href="/assignments" className="text-[12.5px] font-medium text-[#1a9e6e] hover:underline">
                            View All →
                        </Link>
                    </div>
                    <div>
                        {stats.recentAssignments.length === 0 ? (
                            <div className="text-center py-10 px-5">
                                <ClipboardList className="h-8 w-8 text-[#d4d1ca] mx-auto mb-3" />
                                <p className="text-[13px] text-[#9e9b95]">No recent assignments found.</p>
                            </div>
                        ) : (
                            stats.recentAssignments.map((a: any) => (
                                <div key={a.id} className="p-5 border-b border-[#e8e6e1] last:border-b-0 hover:bg-[#f9f8f5] transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-[13.5px] font-semibold text-[#1a1a18] mb-1.5">{a.projectName}</p>
                                            <div className="flex items-center gap-3">
                                                <span className="flex items-center gap-1 text-[12.5px] text-[#6b6860]">
                                                    <Users className="h-3 w-3 text-[#9e9b95]" />
                                                    {a.inspectorName}
                                                </span>
                                                <span className="flex items-center gap-1 text-[12.5px] text-[#9e9b95]">
                                                    <Calendar className="h-3 w-3" />
                                                    {safeFormat(a.createdAt, "MMM d, yyyy")}
                                                </span>
                                            </div>
                                        </div>
                                        <span className={cn(
                                            "rounded-[20px] px-3 py-1 text-[11.5px] font-medium",
                                            a.status === "active" ? "bg-[#e8f7f1] text-[#0d6b4a]" :
                                            a.status === "pending" ? "bg-[#fef3c7] text-[#d97706]" :
                                            a.status === "completed" ? "bg-[#eff6ff] text-[#1d4ed8]" : "bg-[#f9f8f5] text-[#6b6860]"
                                        )}>
                                            {a.status}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
