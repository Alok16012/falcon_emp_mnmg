"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, Legend
} from "recharts"
import {
    Trophy, Medal, TrendingUp, TrendingDown, Users,
    CheckCircle2, XCircle, Clock, CornerUpLeft, Activity
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

export default function AnalyticsPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (status === "unauthenticated") router.push("/login")
        if (status === "authenticated" && session?.user?.role === "INSPECTION_BOY") router.push("/")
    }, [status, session, router])

    useEffect(() => {
        fetch("/api/manager/analytics")
            .then(r => r.json())
            .then(d => setData(d))
            .finally(() => setLoading(false))
    }, [])

    if (loading) return (
        <div className="min-h-screen bg-[#f5f4f0] p-4 lg:p-7 space-y-5">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-[160px] rounded-[14px]" />)}
        </div>
    )

    const inspectors: any[] = data?.inspectors || []
    const monthlyTrend: any[] = data?.monthlyTrend || []

    const rankIcon = (i: number) => {
        if (i === 0) return <Trophy className="h-5 w-5 text-yellow-500" />
        if (i === 1) return <Medal className="h-5 w-5 text-gray-400" />
        if (i === 2) return <Medal className="h-5 w-5 text-amber-600" />
        return <span className="text-[13px] font-bold text-[#9e9b95] w-5 text-center">#{i + 1}</span>
    }

    return (
        <div className="min-h-screen bg-[#f5f4f0] p-4 lg:p-7 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-[22px] font-semibold text-[#1a1a18] tracking-[-0.4px]">Performance Analytics</h1>
                    <p className="text-[13px] text-[#6b6860] mt-0.5">Inspector rankings, trends and approval performance</p>
                </div>
                <div className="flex items-center gap-2 bg-white border border-[#e8e6e1] rounded-[10px] px-3 py-2">
                    <Activity className="h-4 w-4 text-[#1a9e6e]" />
                    <span className="text-[13px] font-medium text-[#1a1a18]">{inspectors.length} Inspectors</span>
                </div>
            </div>

            {/* Monthly Trend Chart */}
            {monthlyTrend.length > 0 && (
                <div className="bg-white border border-[#e8e6e1] rounded-[14px] p-5">
                    <h2 className="text-[14px] font-semibold text-[#1a1a18] mb-4 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-[#1a9e6e]" /> Monthly Inspection Trend
                    </h2>
                    <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={monthlyTrend}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip
                                contentStyle={{ borderRadius: 8, border: "1px solid #e8e6e1", fontSize: 12 }}
                                formatter={(val: any, name: any) => [val, name === "rate" ? "Approval Rate %" : name]}
                            />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <Line type="monotone" dataKey="submitted" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="Submitted" />
                            <Line type="monotone" dataKey="approved" stroke="#1a9e6e" strokeWidth={2} dot={{ r: 3 }} name="Approved" />
                            <Line type="monotone" dataKey="rate" stroke="#d97706" strokeWidth={2} dot={{ r: 3 }} name="Rate %" strokeDasharray="4 2" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Inspector Rankings */}
            <div className="bg-white border border-[#e8e6e1] rounded-[14px] overflow-hidden">
                <div className="p-4 border-b border-[#e8e6e1] flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-yellow-500" />
                    <span className="text-[14px] font-semibold text-[#1a1a18]">Inspector Rankings</span>
                    <span className="text-[11px] text-[#9e9b95] ml-auto">Sorted by acceptance rate</span>
                </div>

                {inspectors.length === 0 ? (
                    <div className="p-12 text-center">
                        <Users className="h-8 w-8 text-[#d4d1ca] mx-auto mb-2" />
                        <p className="text-[13px] text-[#9e9b95]">No inspector data yet</p>
                    </div>
                ) : (
                    <div className="divide-y divide-[#f0f0f0]">
                        {inspectors.map((inspector, idx) => (
                            <div key={inspector.id} className={cn(
                                "p-4 hover:bg-[#f9f8f5] transition-colors",
                                idx === 0 && "bg-yellow-50/40"
                            )}>
                                <div className="flex items-start gap-4">
                                    <div className="flex items-center justify-center w-8 shrink-0 pt-0.5">
                                        {rankIcon(idx)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                            <div>
                                                <p className="text-[14px] font-semibold text-[#1a1a18]">{inspector.name}</p>
                                                <p className="text-[11px] text-[#9e9b95]">{inspector.email}</p>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <div className={cn(
                                                    "px-3 py-1 rounded-full text-[12px] font-bold",
                                                    inspector.acceptanceRate >= 80 ? "bg-green-100 text-green-700" :
                                                    inspector.acceptanceRate >= 50 ? "bg-yellow-100 text-yellow-700" :
                                                    "bg-red-100 text-red-700"
                                                )}>
                                                    {inspector.acceptanceRate}%
                                                </div>
                                                <span className="text-[11px] text-[#9e9b95]">acceptance</span>
                                            </div>
                                        </div>

                                        {/* Progress bar */}
                                        <div className="h-1.5 bg-[#f0f0f0] rounded-full mb-3">
                                            <div
                                                className={cn(
                                                    "h-1.5 rounded-full transition-all",
                                                    inspector.acceptanceRate >= 80 ? "bg-[#1a9e6e]" :
                                                    inspector.acceptanceRate >= 50 ? "bg-[#d97706]" : "bg-[#dc2626]"
                                                )}
                                                style={{ width: `${inspector.acceptanceRate}%` }}
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                            <div className="bg-[#f9f8f5] rounded-[8px] p-2.5">
                                                <p className="text-[10px] text-[#9e9b95] uppercase tracking-wide mb-0.5">Total</p>
                                                <p className="text-[16px] font-bold text-[#1a1a18]">{inspector.total}</p>
                                            </div>
                                            <div className="bg-green-50 rounded-[8px] p-2.5">
                                                <p className="text-[10px] text-[#9e9b95] uppercase tracking-wide mb-0.5 flex items-center gap-1">
                                                    <CheckCircle2 className="h-2.5 w-2.5 text-green-600" /> Approved
                                                </p>
                                                <p className="text-[16px] font-bold text-green-700">{inspector.approved}</p>
                                            </div>
                                            <div className="bg-red-50 rounded-[8px] p-2.5">
                                                <p className="text-[10px] text-[#9e9b95] uppercase tracking-wide mb-0.5 flex items-center gap-1">
                                                    <XCircle className="h-2.5 w-2.5 text-red-500" /> Rejected
                                                </p>
                                                <p className="text-[16px] font-bold text-red-600">{inspector.rejected}</p>
                                            </div>
                                            <div className="bg-orange-50 rounded-[8px] p-2.5">
                                                <p className="text-[10px] text-[#9e9b95] uppercase tracking-wide mb-0.5 flex items-center gap-1">
                                                    <CornerUpLeft className="h-2.5 w-2.5 text-orange-500" /> Sent Back
                                                </p>
                                                <p className="text-[16px] font-bold text-orange-600">{inspector.avgSentBack.toFixed(1)}<span className="text-[10px] font-normal"> avg</span></p>
                                            </div>
                                        </div>

                                        {inspector.avgTurnaroundHours > 0 && (
                                            <div className="mt-2 flex items-center gap-1 text-[11px] text-[#9e9b95]">
                                                <Clock className="h-3 w-3" />
                                                <span>Avg turnaround: <strong className="text-[#1a1a18]">{inspector.avgTurnaroundHours}h</strong></span>
                                            </div>
                                        )}

                                        {inspector.recentInspections.length > 0 && (
                                            <div className="mt-2 flex gap-2 flex-wrap">
                                                {inspector.recentInspections.map((r: any, i: number) => (
                                                    <span key={i} className={cn(
                                                        "text-[10px] px-2 py-0.5 rounded-full border font-medium",
                                                        r.status === "approved" ? "bg-green-50 text-green-700 border-green-200" :
                                                        r.status === "rejected" ? "bg-red-50 text-red-600 border-red-200" :
                                                        r.status === "pending" ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                                                        "bg-gray-100 text-gray-600 border-gray-200"
                                                    )}>
                                                        {r.project} • {r.status}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Bar chart: submissions per inspector */}
            {inspectors.length > 0 && (
                <div className="bg-white border border-[#e8e6e1] rounded-[14px] p-5">
                    <h2 className="text-[14px] font-semibold text-[#1a1a18] mb-4 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-[#1a9e6e]" /> Inspection Volume by Inspector
                    </h2>
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={inspectors.slice(0, 10).map(i => ({ name: i.name.split(" ")[0], approved: i.approved, rejected: i.rejected, pending: i.pending }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e8e6e1", fontSize: 12 }} />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <Bar dataKey="approved" stackId="a" fill="#1a9e6e" name="Approved" radius={[0, 0, 0, 0]} />
                            <Bar dataKey="rejected" stackId="a" fill="#dc2626" name="Rejected" />
                            <Bar dataKey="pending" stackId="a" fill="#d97706" name="Pending" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    )
}
