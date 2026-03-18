
"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { format } from "date-fns"

export default function ClientDashboard() {
    const { data: session } = useSession()
    const [reports, setReports] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchReports = async () => {
            try {
                const res = await fetch("/api/client/reports")
                const data = await res.json()
                setReports(Array.isArray(data) ? data : [])
            } catch (error) {
                console.error("Failed to fetch client reports", error)
            } finally {
                setLoading(false)
            }
        }
        fetchReports()
    }, [])

    const latestReport = reports.length > 0 ? reports[0] : null
    const companyName = reports.length > 0 ? reports[0].assignment.project.company.name : "Your Company"

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f5f4f0] p-6 lg:p-7 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-[#1a9e6e] border-t-transparent rounded-full animate-spin"></div>
            </div>
        )
    }

    if (reports && (reports as any).error) {
        const errorData = reports as any;
        return (
            <div className="min-h-screen bg-[#f5f4f0] p-6 lg:p-7 flex items-center justify-center">
                <div className="bg-white border border-[#e8e6e1] rounded-[14px] p-8 text-center">
                    <div className="w-12 h-12 rounded-full bg-[#fef2f2] flex items-center justify-center mx-auto mb-4">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="12" y1="18" x2="12" y2="12" />
                            <line x1="9" y1="15" x2="15" y2="15" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-[#1a1a18] mb-2">Failed to load reports</h3>
                    <p className="text-[13px] text-[#6b6860] mb-4">{errorData.error || "An unexpected error occurred"}</p>
                    <Button onClick={() => window.location.reload()} className="bg-[#1a9e6e] hover:bg-[#158a5e]">
                        Try Again
                    </Button>
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

            {/* STAT CARDS ROW */}
            <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-white border border-[#e8e6e1] rounded-[14px] p-6">
                    <p className="text-[13px] text-[#6b6860] mb-2">Total Reports</p>
                    <p className="text-[32px] font-bold text-[#1a1a18] tracking-[-1px] tabular-nums mb-1">{reports.length}</p>
                    <p className="text-[12px] text-[#9e9b95]">Approved inspections</p>
                </div>
                <div className="bg-white border border-[#e8e6e1] rounded-[14px] p-6">
                    <p className="text-[13px] text-[#6b6860] mb-2">Latest Report</p>
                    <p className="text-[32px] font-bold text-[#9e9b95] tracking-[-0.5px] tabular-nums mb-1">
                        {latestReport ? format(new Date(latestReport.approvedAt), "MMM d, yyyy") : "N/A"}
                    </p>
                    <p className="text-[12px] text-[#9e9b95]">Most recent approval</p>
                </div>
            </div>

            {/* AVAILABLE REPORTS SECTION */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b6860" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                        <polyline points="10 9 9 9 8 9" />
                    </svg>
                    <h2 className="text-[15px] font-semibold text-[#1a1a18]">Available Reports</h2>
                </div>

                {reports.length === 0 ? (
                    <div className="bg-white border border-[#e8e6e1] rounded-[14px] p-[60px_40px] text-center">
                        <div className="w-[52px] h-[52px] rounded-full bg-[#f9f8f5] border border-[#e8e6e1] flex items-center justify-center mx-auto mb-4">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9e9b95" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                                <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
                            </svg>
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
                                    <th className="px-[18px] py-3 text-left text-[11px] font-medium text-[#9e9b95] uppercase tracking-[0.5px]">SUBMITTED DATE</th>
                                    <th className="px-[18px] py-3 text-left text-[11px] font-medium text-[#9e9b95] uppercase tracking-[0.5px]">APPROVED DATE</th>
                                    <th className="px-[18px] py-3 text-left text-[11px] font-medium text-[#9e9b95] uppercase tracking-[0.5px]">STATUS</th>
                                    <th className="px-[18px] py-3 text-right text-[11px] font-medium text-[#9e9b95] uppercase tracking-[0.5px]">ACTION</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reports.map((report) => (
                                    <tr key={report.id} className="border-b border-[#e8e6e1] last:border-b-0 hover:bg-[#f9f8f5] transition-colors">
                                        <td className="px-[18px] py-[13px]">
                                            <p className="text-[13px] font-medium text-[#1a1a18]">{report.assignment.project.name}</p>
                                        </td>
                                        <td className="px-[18px] py-[13px]">
                                            <p className="text-[13px] text-[#6b6860]">{format(new Date(report.submittedAt), "MMM d, yyyy")}</p>
                                        </td>
                                        <td className="px-[18px] py-[13px]">
                                            <p className="text-[13px] text-[#6b6860]">{format(new Date(report.approvedAt), "MMM d, yyyy")}</p>
                                        </td>
                                        <td className="px-[18px] py-[13px]">
                                            <span className="bg-[#e8f7f1] text-[#0d6b4a] rounded-[20px] px-3 py-1 text-[11.5px] font-medium">Approved</span>
                                        </td>
                                        <td className="px-[18px] py-[13px] text-right">
                                            <Link
                                                href={`/client/reports/${report.id}`}
                                                className="inline-flex items-center gap-1.5 bg-[#1a9e6e] text-white rounded-[8px] py-1.5 px-[14px] text-[12px] font-medium hover:bg-[#158a5e] transition-colors"
                                            >
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                    <polyline points="7 10 12 15 17 10" />
                                                    <line x1="12" y1="15" x2="12" y2="3" />
                                                </svg>
                                                Download
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
