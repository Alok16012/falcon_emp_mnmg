"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { format } from "date-fns"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { TrendingUp, Download, FileText, CheckCircle2, Calendar, BarChart2 } from "lucide-react"

export default function ClientDashboard() {
    const { data: session } = useSession()
    const [reports, setReports] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetch("/api/client/reports")
            .then(r => r.json())
            .then(d => setReports(Array.isArray(d) ? d : []))
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [])

    const latestReport = reports.length > 0 ? reports[0] : null
    const companyName = reports.length > 0 ? reports[0].assignment?.project?.company?.name : "Your Company"

    // Build monthly trend
    const monthlyMap: Record<string, number> = {}
    reports.forEach(r => {
        if (!r.approvedAt) return
        const key = format(new Date(r.approvedAt), "MMM yy")
        monthlyMap[key] = (monthlyMap[key] || 0) + 1
    })
    const trendData = Object.entries(monthlyMap)
        .sort((a, b) => {
            const parse = (s: string) => { try { return new Date("01 " + s).getTime() } catch { return 0 } }
            return parse(a[0]) - parse(b[0])
        })
        .slice(-6)
        .map(([month, count]) => ({ month, count }))

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f5f4f0] p-6 lg:p-7 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-[#1a9e6e] border-t-transparent rounded-full animate-spin"></div>
            </div>
        )
    }

    if (reports && (reports as any).error) {
        return (
            <div className="min-h-screen bg-[#f5f4f0] p-6 lg:p-7 flex items-center justify-center">
                <div className="bg-white border border-[#e8e6e1] rounded-[14px] p-8 text-center">
                    <h3 className="text-xl font-semibold text-[#1a1a18] mb-2">Failed to load reports</h3>
                    <Button onClick={() => window.location.reload()} className="bg-[#1a9e6e] hover:bg-[#158a5e]">Try Again</Button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#f5f4f0] p-6 lg:p-7">
            {/* PAGE HEADER */}
            <div className="mb-6">
                <div className="flex items-center gap-3 mb-1.5">
                    <h1 className="text-[22px] font-semibold text-[#1a1a18] tracking-[-0.4px]">Welcome, {session?.user?.name}</h1>
                    <span className="bg-[#e8f7f1] text-[#0d6b4a] rounded-[6px] px-[10px] py-[3px] text-[11px] font-semibold tracking-[0.5px] uppercase">{companyName}</span>
                </div>
                <p className="text-[13px] text-[#6b6860]">View and download your company's approved inspection reports.</p>
            </div>

            {/* STAT CARDS */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="bg-white border border-[#e8e6e1] rounded-[14px] p-5">
                    <div className="w-9 h-9 rounded-full bg-[#e8f7f1] flex items-center justify-center mb-3">
                        <FileText className="h-4 w-4 text-[#1a9e6e]" />
                    </div>
                    <p className="text-[12px] text-[#6b6860] mb-1">Total Reports</p>
                    <p className="text-[28px] font-bold text-[#1a1a18] tracking-[-1px] tabular-nums">{reports.length}</p>
                    <p className="text-[11px] text-[#9e9b95]">All approved</p>
                </div>
                <div className="bg-white border border-[#e8e6e1] rounded-[14px] p-5">
                    <div className="w-9 h-9 rounded-full bg-[#eff6ff] flex items-center justify-center mb-3">
                        <Calendar className="h-4 w-4 text-[#3b82f6]" />
                    </div>
                    <p className="text-[12px] text-[#6b6860] mb-1">Latest Report</p>
                    <p className="text-[18px] font-bold text-[#1a1a18] tracking-[-0.5px] tabular-nums mt-1">
                        {latestReport ? format(new Date(latestReport.approvedAt), "MMM d") : "N/A"}
                    </p>
                    <p className="text-[11px] text-[#9e9b95]">Most recent</p>
                </div>
                <div className="bg-white border border-[#e8e6e1] rounded-[14px] p-5">
                    <div className="w-9 h-9 rounded-full bg-[#fef3c7] flex items-center justify-center mb-3">
                        <TrendingUp className="h-4 w-4 text-[#d97706]" />
                    </div>
                    <p className="text-[12px] text-[#6b6860] mb-1">This Month</p>
                    <p className="text-[28px] font-bold text-[#1a1a18] tracking-[-1px] tabular-nums">
                        {reports.filter(r => {
                            if (!r.approvedAt) return false
                            const d = new Date(r.approvedAt)
                            const now = new Date()
                            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
                        }).length}
                    </p>
                    <p className="text-[11px] text-[#9e9b95]">Reports approved</p>
                </div>
                <div className="bg-white border border-[#e8e6e1] rounded-[14px] p-5">
                    <div className="w-9 h-9 rounded-full bg-[#f3e8ff] flex items-center justify-center mb-3">
                        <BarChart2 className="h-4 w-4 text-[#7c3aed]" />
                    </div>
                    <p className="text-[12px] text-[#6b6860] mb-1">Projects</p>
                    <p className="text-[28px] font-bold text-[#1a1a18] tracking-[-1px] tabular-nums">
                        {new Set(reports.map(r => r.assignment?.project?.id)).size}
                    </p>
                    <p className="text-[11px] text-[#9e9b95]">Unique projects</p>
                </div>
            </div>

            {/* TREND CHART */}
            {trendData.length > 1 && (
                <div className="bg-white border border-[#e8e6e1] rounded-[14px] p-5 mb-6">
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingUp className="h-4 w-4 text-[#1a9e6e]" />
                        <h2 className="text-[14px] font-semibold text-[#1a1a18]">Report Trend (Last 6 Months)</h2>
                    </div>
                    <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={trendData} barSize={28}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9e9b95" }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: "#9e9b95" }} axisLine={false} tickLine={false} allowDecimals={false} />
                            <Tooltip
                                contentStyle={{ borderRadius: 8, border: "1px solid #e8e6e1", fontSize: 12 }}
                                cursor={{ fill: "#f9f8f5" }}
                                formatter={(val: any) => [val, "Reports"]}
                            />
                            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                {trendData.map((_, i) => (
                                    <Cell key={i} fill={i === trendData.length - 1 ? "#1a9e6e" : "#bfe8d9"} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* REPORTS TABLE */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <CheckCircle2 className="h-4 w-4 text-[#1a9e6e]" />
                    <h2 className="text-[15px] font-semibold text-[#1a1a18]">Available Reports</h2>
                    {reports.length > 0 && (
                        <span className="ml-auto text-[12px] text-[#9e9b95]">{reports.length} total</span>
                    )}
                </div>

                {reports.length === 0 ? (
                    <div className="bg-white border border-[#e8e6e1] rounded-[14px] p-[60px_40px] text-center">
                        <div className="w-[52px] h-[52px] rounded-full bg-[#f9f8f5] border border-[#e8e6e1] flex items-center justify-center mx-auto mb-4">
                            <FileText className="h-6 w-6 text-[#9e9b95]" />
                        </div>
                        <p className="text-[15px] font-semibold text-[#1a1a18] mb-2">No approved reports yet</p>
                        <p className="text-[13px] text-[#9e9b95] leading-relaxed max-w-[320px] mx-auto">
                            Reports will appear here once your inspections are approved by the management team.
                        </p>
                    </div>
                ) : (
                    <div className="bg-white border border-[#e8e6e1] rounded-[14px] overflow-hidden">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-[#f9f8f5] border-b border-[#e8e6e1]">
                                    <th className="px-[18px] py-3 text-left text-[11px] font-medium text-[#9e9b95] uppercase tracking-[0.5px]">PROJECT</th>
                                    <th className="hidden sm:table-cell px-[18px] py-3 text-left text-[11px] font-medium text-[#9e9b95] uppercase tracking-[0.5px]">SUBMITTED</th>
                                    <th className="hidden sm:table-cell px-[18px] py-3 text-left text-[11px] font-medium text-[#9e9b95] uppercase tracking-[0.5px]">APPROVED</th>
                                    <th className="px-[18px] py-3 text-left text-[11px] font-medium text-[#9e9b95] uppercase tracking-[0.5px]">STATUS</th>
                                    <th className="px-[18px] py-3 text-right text-[11px] font-medium text-[#9e9b95] uppercase tracking-[0.5px]">ACTION</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reports.map((report) => (
                                    <tr key={report.id} className="border-b border-[#e8e6e1] last:border-b-0 hover:bg-[#f9f8f5] transition-colors">
                                        <td className="px-[18px] py-[13px]">
                                            <p className="text-[13px] font-medium text-[#1a1a18]">{report.assignment?.project?.name}</p>
                                            <p className="text-[11px] text-[#9e9b95]">INS-{report.id.substring(0, 8).toUpperCase()}</p>
                                        </td>
                                        <td className="hidden sm:table-cell px-[18px] py-[13px]">
                                            <p className="text-[13px] text-[#6b6860]">{format(new Date(report.submittedAt), "MMM d, yyyy")}</p>
                                        </td>
                                        <td className="hidden sm:table-cell px-[18px] py-[13px]">
                                            <p className="text-[13px] text-[#6b6860]">{format(new Date(report.approvedAt), "MMM d, yyyy")}</p>
                                        </td>
                                        <td className="px-[18px] py-[13px]">
                                            <span className="bg-[#e8f7f1] text-[#0d6b4a] rounded-[20px] px-3 py-1 text-[11.5px] font-medium">Approved</span>
                                        </td>
                                        <td className="px-[18px] py-[13px] text-right">
                                            <Link href={`/client/reports/${report.id}`} className="inline-flex items-center gap-1.5 bg-[#1a9e6e] text-white rounded-[8px] py-1.5 px-[14px] text-[12px] font-medium hover:bg-[#158a5e] transition-colors">
                                                <Download className="h-3.5 w-3.5" /> Download
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
