"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useSession } from "next-auth/react"
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns"
import {
    PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    ComposedChart, Line, LineChart, AreaChart, Area,
    ZAxis,
} from "recharts"
import {
    LayoutDashboard,
    BarChart3,
    PieChart as PieChartIcon,
    TrendingUp,
    TrendingDown,
    AlertCircle,
    CheckCircle2,
    ClipboardList,
    History,
    FileText,
    Search,
    ChevronRight,
    ArrowUpRight,
    ArrowDownRight,
    Minus,
    Printer,
    FileDown,
    Calendar,
    HardHat,
    FileSpreadsheet
} from "lucide-react"
import * as XLSX from "xlsx"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

// ─── Colors & Theme ───────────────────────────────────────────────────────────
const THEME = {
    primary: "#3b82f6",   // Modern Blue
    success: "#10b981",   // Emerald
    warning: "#f59e0b",   // Amber
    danger: "#ef4444",    // Red
    info: "#06b6d4",      // Cyan
    accent: "#8b5cf6",    // Violet
    background: "#fcfdfe", // Ultra-light clean background
    card: "#ffffff",
    border: "#f1f5f9",
    textMain: "#1e293b",
    textMuted: "#94a3b8"
}

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
]

// ─── Types ────────────────────────────────────────────────────────────────────
interface Summary {
    totalInspected: number
    totalAccepted: number
    totalRework: number
    totalRejected: number
    acceptanceRate: number
    reworkRate: number
    rejectionRate: number
    reworkPPM: number
    rejectionPPM: number
    overallPPM: number
    period: string
    companyName: string
    partModel: string
}

interface PartWise {
    partName: string
    totalInspected: number
    totalAccepted: number
    totalRework: number
    totalRejected: number
    reworkPercent: number
    rejectionPercent: number
    qualityRate: number
}

interface DayWise {
    date: string
    totalInspected: number
    totalAccepted: number
    totalRework: number
    totalRejected: number
    qualityRate: number
}

interface LocationWise {
    location: string
    totalInspected: number
    totalRework: number
    totalRejected: number
}

interface TopDefect {
    defectName: string
    count: number
    percentage: number
}

interface ReportRecord {
    id: string
    inspector: string
    date: string
    company: string
    project: string
    inspected: number
    accepted: number
    rework: number
    rejected: number
    partName: string
    location: string
}

interface ReportData {
    summary: Summary
    partWise: PartWise[]
    dayWise: DayWise[]
    locationWise: LocationWise[]
    topDefects: TopDefect[]
    records: ReportRecord[]
}

// ─── Animated Counter Hook ────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1000) {
    const [value, setValue] = useState(0)
    const ref = useRef<NodeJS.Timeout | null>(null)

    useEffect(() => {
        if (target === 0) { setValue(0); return }
        let start = 0
        const step = Math.ceil(target / (duration / 30))
        if (ref.current) clearInterval(ref.current)
        ref.current = setInterval(() => {
            start += step
            if (start >= target) {
                setValue(target)
                if (ref.current) clearInterval(ref.current)
            } else {
                setValue(start)
            }
        }, 30)
        return () => { if (ref.current) clearInterval(ref.current) }
    }, [target, duration])

    return value
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, color, icon: Icon, delay = 0, index }: {
    label: string; value: number | string; color: string; icon: any; delay?: number; index?: number
}) {
    const numericValue = typeof value === "number" ? value : 0
    const animated = useCountUp(numericValue)
    const displayValue = typeof value === "string" ? value : animated.toLocaleString()

    const bgColorMap: Record<string, string> = {
        "#6366f1": "#eef2ff",
        "#1a9e6e": "#e8f7f1",
        "#d97706": "#fef3c7",
        "#dc2626": "#fef2f2",
    }
    const bgColor = bgColorMap[color] || "#f9f8f5"

    return (
        <div
            className="bg-white border border-[#e8e6e1] rounded-[12px] p-4 relative overflow-hidden animate-fadeIn"
            style={{ animationDelay: `${delay}ms` }}
        >
            <div
                className="absolute right-[-8px] bottom-[-8px] text-[60px] font-extrabold text-black/[0.03] pointer-events-none select-none"
            >
                {index !== undefined ? index + 1 : ""}
            </div>
            <div className="w-8 h-8 rounded-full flex items-center justify-center mb-[10px]" style={{ backgroundColor: bgColor }}>
                <Icon className="h-4 w-4" style={{ color }} />
            </div>
            <p className="text-[10.5px] font-semibold text-[#9e9b95] uppercase tracking-[0.6px] mb-[6px]">{label}</p>
            <p className="text-[28px] font-bold text-[#1a1a18] tracking-[-1px] tabular-nums">{displayValue}</p>
        </div>
    )
}

// ─── Tab Button ──────────────────────────────────────────────────────────────
function TabButton({ name, active, onClick }: { name: string; active: boolean; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "px-[18px] py-2 rounded-[8px] text-[13px] font-medium transition-all duration-200 whitespace-nowrap",
                active
                    ? "bg-[#1a1a18] text-white"
                    : "text-[#6b6860] hover:text-[#1a1a18] hover:bg-[#f9f8f5]"
            )}
        >
            {name}
        </button>
    )
}

// ─── PPM Box ──────────────────────────────────────────────────────────────────
function PpmBox({ label, value, color }: { label: string; value: number; color: string }) {
    const animated = useCountUp(value)
    return (
        <div className="flex-1 bg-white/40 border border-white/60 backdrop-blur-md rounded-2xl p-6 text-center shadow-sm hover:shadow-md transition-all duration-300">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3 text-slate-400">{label}</p>
            <p className="text-5xl font-black tabular-nums tracking-tighter" style={{ color }}>{animated.toLocaleString()}</p>
            <p className="text-[10px] font-black mt-2 opacity-30 uppercase tracking-widest">parts per million</p>
        </div>
    )
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null
    return (
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl shadow-2xl p-4 text-sm text-white min-w-[180px]">
            {label && <p className="font-black mb-3 text-slate-400 uppercase tracking-widest text-[10px]">{label}</p>}
            <div className="space-y-2">
                {payload.map((p: any, i: number) => (
                    <div key={i} className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color || p.fill }} />
                            <span className="text-slate-300 font-bold">{p.name}:</span>
                        </div>
                        <span className="font-black tabular-nums">{typeof p.value === "number" ? p.value.toLocaleString() : p.value}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
function ProgressBar({ value, color }: { value: number; color: string }) {
    return (
        <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${Math.min(value, 100)}%`, backgroundColor: color }}
                />
            </div>
            <span className="text-[10px] font-black w-10 text-right opacity-70" style={{ color }}>{value.toFixed(1)}%</span>
        </div>
    )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ReportsPage() {
    const { data: session } = useSession()
    const role = session?.user?.role

    const now = new Date()
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
    const [selectedYear, setSelectedYear] = useState(now.getFullYear())
    const [selectedCompanyId, setSelectedCompanyId] = useState("all")
    const [selectedProjectId, setSelectedProjectId] = useState("all")
    const [selectedInspectorId, setSelectedInspectorId] = useState("all")
    const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])
    const [projects, setProjects] = useState<{ id: string; name: string }[]>([])
    const [inspectors, setInspectors] = useState<{ id: string; name: string }[]>([])
    const [data, setData] = useState<ReportData | null>(null)
    const [loading, setLoading] = useState(false)
    const [activeTab, setActiveTab] = useState("Dashboard")
    const [generated, setGenerated] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")

    // Fetch companies for admin/manager dropdown
    useEffect(() => {
        if (role === "ADMIN" || role === "MANAGER") {
            fetch("/api/companies")
                .then(r => r.json())
                .then(d => setCompanies(Array.isArray(d) ? d : []))
                .catch(() => { })

            fetch("/api/users?role=INSPECTION_BOY")
                .then(r => r.json())
                .then(d => setInspectors(Array.isArray(d) ? d : []))
                .catch(() => { })
        }
    }, [role])

    // Fetch projects when company changes
    useEffect(() => {
        if (selectedCompanyId === "all") {
            setProjects([])
            setSelectedProjectId("all")
            return
        }
        fetch(`/api/projects?companyId=${selectedCompanyId}`)
            .then(r => r.json())
            .then(d => setProjects(Array.isArray(d) ? d : []))
            .catch(() => { })
        setSelectedProjectId("all")
    }, [selectedCompanyId])

    const fetchReport = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({
                month: String(selectedMonth),
                year: String(selectedYear),
            })
            if (selectedCompanyId !== "all") params.set("companyId", selectedCompanyId)
            if (selectedProjectId !== "all") params.set("projectId", selectedProjectId)
            if (selectedInspectorId !== "all") params.set("inspectorId", selectedInspectorId)
            const res = await fetch(`/api/reports?${params.toString()}`)
            const d = await res.json()
            setData(d)
        } catch {
            // silent
        } finally {
            setLoading(false)
        }
    }, [selectedMonth, selectedYear, selectedCompanyId, selectedProjectId, selectedInspectorId])

    const handleExportExcel = () => {
        if (!data?.records) return

        const worksheet = XLSX.utils.json_to_sheet(data.records)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, "Inspections")

        // Customize headers
        XLSX.utils.sheet_add_aoa(worksheet, [
            ["ID", "Inspector", "Date", "Company", "Project", "Inspected", "Accepted", "Rework", "Rejected", "Part Name", "Location"]
        ], { origin: "A1" })

        XLSX.writeFile(workbook, `QC_Report_${selectedMonth}_${selectedYear}.xlsx`)
    }

    // Auto-fetch on mount
    useEffect(() => {
        fetchReport()
    }, [fetchReport])

    const handlePrint = () => window.print()

    const s = data?.summary

    // Filtering logic for the inspection report tab
    const filteredRecords = useMemo(() => {
        if (!data?.records) return []
        if (!searchTerm) return data.records
        const low = searchTerm.toLowerCase()
        return data.records.filter(r =>
            r.id.toLowerCase().includes(low) ||
            r.inspector.toLowerCase().includes(low) ||
            r.partName.toLowerCase().includes(low) ||
            r.location.toLowerCase().includes(low) ||
            r.project.toLowerCase().includes(low)
        )
    }, [data?.records, searchTerm])

    // Memoized chart data
    const pieData = useMemo(() => s ? [
        { name: "Accepted", value: s.totalAccepted, color: THEME.success },
        { name: "Rework", value: s.totalRework, color: THEME.warning },
        { name: "Rejected", value: s.totalRejected, color: THEME.danger },
    ] : [], [s])

    const areaData = useMemo(() => (data?.dayWise || []).map(d => ({
        ...d,
        label: (() => { try { return format(parseISO(d.date), "MMM dd") } catch { return d.date } })(),
    })), [data?.dayWise])

    const paretoData = useMemo(() => (data?.topDefects || []).map((d, i, arr) => {
        const cumSum = arr.slice(0, i + 1).reduce((a, b) => a + b.count, 0)
        const totalD = arr.reduce((a, b) => a + b.count, 0)
        return { ...d, cumulative: totalD > 0 ? parseFloat(((cumSum / totalD) * 100).toFixed(1)) : 0 }
    }), [data?.topDefects])

    return (
        <div className="min-h-screen bg-[#f5f4f0]">
            <style jsx global>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fadeIn { animation: fadeIn 0.4s ease-out both; }
                @media print {
                    .no-print { display: none !important; }
                    body { background: white !important; -webkit-print-color-adjust: exact; }
                    .print-card { border: 1px solid #eee !important; box-shadow: none !important; }
                }
            `}</style>

            {/* ── TOP HEADER BAR ─────────────────────────────────────── */}
            <header className="no-print bg-white border-b border-[#e8e6e1] px-6 py-[14px] flex items-center justify-between">
                <div className="flex items-center gap-[10px]">
                    <div className="w-8 h-8 bg-[#e8f7f1] rounded-[8px] flex items-center justify-center">
                        <ClipboardList className="h-4 w-4 text-[#1a9e6e]" />
                    </div>
                    <div>
                        <span className="font-bold text-[15px] text-[#1a1a18] tracking-[-0.3px] block leading-none">QC PRO</span>
                        <span className="text-[10px] font-medium text-[#9e9b95] tracking-[1px] uppercase block mt-[1px]">ANALYTICS DASHBOARD</span>
                    </div>
                </div>
                <div className="bg-[#f9f8f5] border border-[#e8e6e1] rounded-[6px] px-[10px] py-[4px] text-[11px] font-medium text-[#9e9b95]" style={{ fontFamily: "monospace" }}>
                    PLATFORM v1.4.0
                </div>
            </header>

            {/* ── TABS ROW ─────────────────────────────────────────── */}
            <div className="no-print bg-white border-b border-[#e8e6e1] px-6 flex items-center justify-between">
                <div className="flex items-center gap-1 py-[10px]">
                    {["Dashboard", "Graphical", "Pareto Chart", "Day Wise", "Part Wise", "Inspection Report"].map(tab => (
                        <TabButton
                            key={tab}
                            name={tab}
                            active={activeTab === tab}
                            onClick={() => setActiveTab(tab)}
                        />
                    ))}
                </div>
                <Button
                    className="bg-[#1a9e6e] text-white hover:bg-[#158a5e] rounded-[10px] text-[13px] font-semibold h-auto py-[10px] px-5 mr-0"
                    onClick={fetchReport}
                    disabled={loading}
                >
                    {loading ? "Syncing..." : "Update Dashboard"}
                    <ArrowUpRight className="ml-[6px] h-[14px] w-[14px]" />
                </Button>
            </div>

            {/* ── FILTER ROW ─────────────────────────────────────────── */}
            <div className="no-print bg-white border-b border-[#e8e6e1] px-6 py-3">
                <div className="grid grid-cols-5 gap-3">
                    {[
                        { label: "Company", value: selectedCompanyId, options: companies, setter: setSelectedCompanyId, allLabel: "Global View" },
                        { label: "Project", value: selectedProjectId, options: projects, setter: setSelectedProjectId, allLabel: "All Projects", disabled: selectedCompanyId === "all" },
                        { label: "Inspector", value: selectedInspectorId, options: inspectors, setter: setSelectedInspectorId, allLabel: "All Inspectors" },
                        { label: "Month", value: selectedMonth, options: MONTHS.map((m, i) => ({ id: i + 1, name: m })), setter: (v: string) => setSelectedMonth(Number(v)) },
                        { label: "Year", value: selectedYear, options: [2024, 2025, 2026].map(y => ({ id: y, name: y })), setter: (v: string) => setSelectedYear(Number(v)) }
                    ].map((filter, idx) => (
                        <div key={idx} className="flex flex-col gap-[5px]">
                            <span className="text-[10.5px] font-semibold text-[#9e9b95] uppercase tracking-[0.6px]">{filter.label}</span>
                            <div className={cn(
                                "relative bg-[#f9f8f5] border border-[#e8e6e1] rounded-[9px] px-[14px] py-[9px] transition-all",
                                filter.disabled && "opacity-50 cursor-not-allowed"
                            )}>
                                <select
                                    className="w-full bg-transparent text-[13px] font-medium focus:outline-none appearance-none cursor-pointer text-[#1a1a18]"
                                    value={filter.value}
                                    onChange={e => filter.setter(e.target.value)}
                                    disabled={filter.disabled}
                                >
                                    {filter.allLabel && <option value="all">{filter.allLabel}</option>}
                                    {filter.options.map((opt: any) => (
                                        <option key={opt.id} value={opt.id}>{opt.name}</option>
                                    ))}
                                </select>
                                <ChevronRight className="absolute right-[14px] top-1/2 -translate-y-1/2 h-4 w-4 text-[#9e9b95] pointer-events-none rotate-90" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── MAIN CONTENT ─────────────────────────────────────── */}
            <div className="px-6 pb-6">
                {loading ? (
                    <div className="grid grid-cols-6 gap-3 mt-5">
                        {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-[110px] rounded-[12px]" />)}
                    </div>
                ) : !data ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4 bg-white rounded-[14px] border border-[#e8e6e1] mt-5">
                        <div className="p-6 bg-[#f5f4f0] rounded-full"><AlertCircle className="h-12 w-12 text-[#d4d1ca]" /></div>
                        <h2 className="text-xl font-bold text-[#1a1a18]">No report data loaded</h2>
                        <Button onClick={fetchReport} variant="secondary" className="font-medium">Initialize Dashboard</Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* ── STAT CARDS ROW ────────────────────────────── */}
                        <div className="grid grid-cols-6 gap-3 mt-5">
                            <KpiCard label="Total Inspected" value={s?.totalInspected || 0} color="#6366f1" icon={History} delay={0} index={0} />
                            <KpiCard label="Total Accepted" value={s?.totalAccepted || 0} color="#1a9e6e" icon={CheckCircle2} delay={100} index={1} />
                            <KpiCard label="Total Rework" value={s?.totalRework || 0} color="#d97706" icon={TrendingDown} delay={200} index={2} />
                            <KpiCard label="Total Rejected" value={s?.totalRejected || 0} color="#dc2626" icon={AlertCircle} delay={300} index={3} />
                            <KpiCard label="Rework PPM" value={s?.reworkPPM || 0} color="#d97706" icon={TrendingUp} delay={400} index={4} />
                            <KpiCard label="Rejection PPM" value={s?.rejectionPPM || 0} color="#dc2626" icon={AlertCircle} delay={500} index={5} />
                        </div>

                        {/* ── TAB CONTENT ─────────────────────────────────── */}
                        <div className="animate-fadeIn">
                            {activeTab === "Dashboard" && (
                                <div className="grid grid-cols-2 gap-4">
                                    {/* Overall Status - Donut */}
                                    <div className="bg-white border border-[#e8e6e1] rounded-[14px] p-5 overflow-hidden">
                                        <div className="mb-[2px]">
                                            <h3 className="text-[14px] font-semibold text-[#1a1a18]">Overall Status</h3>
                                            <p className="text-[10.5px] font-semibold text-[#9e9b95] uppercase tracking-[0.5px] mt-[2px]">Acceptance vs Rejection</p>
                                        </div>
                                        <div className="flex flex-col justify-center items-center py-4">
                                            {(s?.totalInspected || 0) > 0 ? (
                                                <div className="w-full h-[300px] relative">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <PieChart>
                                                            <Pie
                                                                data={pieData}
                                                                innerRadius={80}
                                                                outerRadius={120}
                                                                paddingAngle={8}
                                                                dataKey="value"
                                                                stroke="none"
                                                            >
                                                                {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                                                            </Pie>
                                                            <Tooltip content={<CustomTooltip />} />
                                                        </PieChart>
                                                    </ResponsiveContainer>
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                                        <span className="text-5xl font-bold text-[#1a1a18] leading-none tracking-tight">{s?.acceptanceRate.toFixed(1)}%</span>
                                                        <span className="text-[10px] font-semibold text-[#9e9b95] uppercase tracking-[0.2em] mt-2">Quality Rate</span>
                                                    </div>
                                                </div>
                                            ) : <EmptyState />}
                                            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-4">
                                                {pieData.map(e => (
                                                    <div key={e.name} className="flex items-center gap-2">
                                                        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: e.color }} />
                                                        <span className="text-[11px] font-medium text-[#6b6860]">{e.name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Trend Analysis - Area Chart */}
                                    <div className="bg-white border border-[#e8e6e1] rounded-[14px] p-5 overflow-hidden">
                                        <div className="mb-[2px]">
                                            <h3 className="text-[14px] font-semibold text-[#1a1a18]">Performance Trend</h3>
                                            <p className="text-[10.5px] font-semibold text-[#9e9b95] uppercase tracking-[0.5px] mt-[2px]">Daily inspection performance volume</p>
                                        </div>
                                        <div className="pt-4">
                                            {areaData.length > 0 ? (
                                                <ResponsiveContainer width="100%" height={320}>
                                                    <AreaChart data={areaData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                        <defs>
                                                            <linearGradient id="colorAccepted" x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="5%" stopColor={THEME.success} stopOpacity={0.1} />
                                                                <stop offset="95%" stopColor={THEME.success} stopOpacity={0} />
                                                            </linearGradient>
                                                            <linearGradient id="colorInspected" x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="5%" stopColor={THEME.primary} stopOpacity={0.1} />
                                                                <stop offset="95%" stopColor={THEME.primary} stopOpacity={0} />
                                                            </linearGradient>
                                                        </defs>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                                        <XAxis
                                                            dataKey="label"
                                                            axisLine={false}
                                                            tickLine={false}
                                                            tick={{ fontSize: 10, fontWeight: 600, fill: "#94a3b8" }}
                                                            dy={10}
                                                        />
                                                        <YAxis
                                                            axisLine={false}
                                                            tickLine={false}
                                                            tick={{ fontSize: 10, fontWeight: 600, fill: "#94a3b8" }}
                                                        />
                                                        <Tooltip content={<CustomTooltip />} />
                                                        <Area
                                                            type="monotone"
                                                            dataKey="totalInspected"
                                                            name="Inspected"
                                                            stroke={THEME.primary}
                                                            strokeWidth={3}
                                                            fillOpacity={1}
                                                            fill="url(#colorInspected)"
                                                        />
                                                        <Area
                                                            type="monotone"
                                                            dataKey="totalAccepted"
                                                            name="Accepted"
                                                            stroke={THEME.success}
                                                            strokeWidth={3}
                                                            fillOpacity={1}
                                                            fill="url(#colorAccepted)"
                                                        />
                                                        <Line
                                                            type="monotone"
                                                            dataKey="totalRejected"
                                                            name="Rejected"
                                                            stroke={THEME.danger}
                                                            strokeWidth={3}
                                                            dot={{ r: 4, fill: THEME.danger, strokeWidth: 2, stroke: "white" }}
                                                        />
                                                    </AreaChart>
                                                </ResponsiveContainer>
                                            ) : <EmptyState />}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === "Graphical" && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white border border-[#e8e6e1] rounded-[14px] p-5 overflow-hidden">
                                        <div className="mb-5">
                                            <h3 className="text-[14px] font-semibold text-[#1a1a18]">Part-Wise Quality Split</h3>
                                        </div>
                                        {data.partWise.length > 0 ? (
                                            <ResponsiveContainer width="100%" height={400}>
                                                <BarChart data={data.partWise} layout="vertical" margin={{ left: 20 }}>
                                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600 }} />
                                                    <YAxis dataKey="partName" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600 }} width={120} />
                                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc" }} />
                                                    <Bar dataKey="totalAccepted" name="Accepted" stackId="a" fill={THEME.success} radius={[0, 0, 0, 0]} />
                                                    <Bar dataKey="totalRework" name="Rework" stackId="a" fill={THEME.warning} />
                                                    <Bar dataKey="totalRejected" name="Rejected" stackId="a" fill={THEME.danger} radius={[0, 4, 4, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        ) : <EmptyState />}
                                    </div>
                                    <div className="bg-white border border-[#e8e6e1] rounded-[14px] p-5 overflow-hidden">
                                        <div className="mb-5">
                                            <h3 className="text-[14px] font-semibold text-[#1a1a18]">Comparison by Location</h3>
                                        </div>
                                        {data.locationWise.length > 0 ? (
                                            <ResponsiveContainer width="100%" height={400}>
                                                <BarChart data={data.locationWise}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                    <XAxis dataKey="location" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600 }} />
                                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600 }} />
                                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc" }} />
                                                    <Bar dataKey="totalInspected" name="Inspected" fill={THEME.info} radius={[4, 4, 0, 0]} barSize={40} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        ) : <EmptyState />}
                                    </div>
                                </div>
                            )}

                            {activeTab === "Pareto Chart" && (
                                <div className="bg-white border border-[#e8e6e1] rounded-[14px] p-5 overflow-hidden">
                                    <div className="flex items-center justify-between mb-6">
                                        <div>
                                            <h3 className="text-[14px] font-semibold text-[#1a1a18]">Top Defect Analysis</h3>
                                            <p className="text-[10.5px] font-semibold text-[#9e9b95] uppercase tracking-[0.5px] mt-[2px]">Pareto Principle</p>
                                        </div>
                                        <Badge variant="secondary" className="bg-orange-50 text-orange-600 border-orange-100 font-semibold px-3 py-1 text-[11px]">
                                            Major Defects Only
                                        </Badge>
                                    </div>
                                    {data.topDefects.length > 0 ? (
                                        <ResponsiveContainer width="100%" height={450}>
                                            <ComposedChart data={paretoData} margin={{ top: 10, right: 30, left: 0, bottom: 40 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis dataKey="defectName" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600 }} angle={-45} textAnchor="end" height={80} dy={20} />
                                                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600 }} />
                                                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600 }} unit="%" />
                                                <Tooltip content={<CustomTooltip />} />
                                                <Bar yAxisId="left" dataKey="count" name="Frequency" fill={THEME.danger} radius={[4, 4, 0, 0]} barSize={60} />
                                                <Line yAxisId="right" type="monotone" dataKey="cumulative" name="Cumulative %" stroke={THEME.warning} strokeWidth={4} dot={{ r: 6, fill: THEME.warning, strokeWidth: 3, stroke: "white" }} />
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    ) : <EmptyState />}
                                </div>
                            )}

                            {activeTab === "Day Wise" && (
                                <div className="bg-white border border-[#e8e6e1] rounded-[14px] overflow-hidden">
                                    <div className="p-4 border-b border-[#e8e6e1] flex items-center justify-between">
                                        <h3 className="text-[14px] font-semibold text-[#1a1a18]">Daily Inspection Log</h3>
                                        <Button variant="outline" size="sm" className="font-medium h-8 rounded-[8px] text-[12px]" onClick={handlePrint}><Printer className="h-4 w-4 mr-2" />Print Log</Button>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-[#f9f8f5] border-b border-[#e8e6e1]">
                                                    {["Date", "Inspected", "Accepted", "Rework", "Rejected", "Quality Status"].map(h => (
                                                        <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.5px] text-[#9e9b95]">{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-[#e8e6e1]">
                                                {data.dayWise.map((d, i) => (
                                                    <tr key={d.date} className="hover:bg-[#f9f8f5]/50 transition-colors">
                                                        <td className="px-4 py-3 font-medium text-[#1a1a18]">{(() => { try { return format(parseISO(d.date), "dd MMM yyyy, EEE") } catch { return d.date || "—" } })()}</td>
                                                        <td className="px-4 py-3 font-bold text-[#1a1a18]">{d.totalInspected.toLocaleString()}</td>
                                                        <td className="px-4 py-3 font-bold text-green-600">{d.totalAccepted.toLocaleString()}</td>
                                                        <td className="px-4 py-3 font-bold text-orange-600">{d.totalRework.toLocaleString()}</td>
                                                        <td className="px-4 py-3 font-bold text-red-600">{d.totalRejected.toLocaleString()}</td>
                                                        <td className="px-4 py-3 w-40"><ProgressBar value={d.qualityRate} color={d.qualityRate >= 99 ? THEME.success : d.qualityRate >= 95 ? THEME.warning : THEME.danger} /></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {activeTab === "Part Wise" && (
                                <div className="bg-white border border-[#e8e6e1] rounded-[14px] overflow-hidden">
                                    <div className="p-4 border-b border-[#e8e6e1]">
                                        <h3 className="text-[14px] font-semibold text-[#1a1a18]">Performance by Component</h3>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-[#f9f8f5] border-b border-[#e8e6e1]">
                                                    {["Component", "Inspected", "Accepted", "Rework", "Rejected", "Quality Rate"].map(h => (
                                                        <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.5px] text-[#9e9b95]">{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-[#e8e6e1]">
                                                {data.partWise.map((p, i) => (
                                                    <tr key={p.partName} className="hover:bg-[#f9f8f5]/50 transition-colors">
                                                        <td className="px-4 py-3 font-semibold text-[#1a1a18]">{p.partName}</td>
                                                        <td className="px-4 py-3 font-bold text-blue-600">{p.totalInspected.toLocaleString()}</td>
                                                        <td className="px-4 py-3 font-bold text-green-600">{p.totalAccepted.toLocaleString()}</td>
                                                        <td className="px-4 py-3 font-bold text-orange-600">{p.totalRework.toLocaleString()}</td>
                                                        <td className="px-4 py-3 font-bold text-red-600">{p.totalRejected.toLocaleString()}</td>
                                                        <td className="px-4 py-3 w-40"><ProgressBar value={p.qualityRate} color={p.qualityRate >= 99 ? THEME.success : p.qualityRate >= 95 ? THEME.warning : THEME.danger} /></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Inspector Wise removed as per request */}

                            {activeTab === "Inspection Report" && (
                                <div className="bg-white border border-[#e8e6e1] rounded-[14px] overflow-hidden">
                                    <div className="p-4 border-b border-[#e8e6e1] flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div>
                                            <h3 className="text-[14px] font-semibold text-[#1a1a18]">Inspection Record Explorer</h3>
                                            <p className="text-[10.5px] font-semibold text-[#9e9b95] uppercase tracking-[0.5px] mt-[2px]">Live data feed</p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-3">
                                            <div className="relative group">
                                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9e9b95] group-focus-within:text-[#1a9e6e] transition-colors" />
                                                <Input
                                                    className="pl-11 h-10 w-full md:w-[260px] rounded-[9px] border border-[#e8e6e1] bg-[#f9f8f5] font-medium text-[13px] focus:bg-white focus:ring-[3px] focus:ring-[rgba(26,158,110,0.08)] focus:border-[#1a9e6e] transition-all"
                                                    placeholder="Search records..."
                                                    value={searchTerm}
                                                    onChange={e => setSearchTerm(e.target.value)}
                                                />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="outline"
                                                    className="h-10 rounded-[8px] font-medium text-[12px] border-[#e8e6e1] text-[#1a9e6e] hover:bg-[#e8f7f1] px-4"
                                                    onClick={handleExportExcel}
                                                >
                                                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                                                    EXCEL
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    className="h-10 rounded-[8px] font-medium text-[12px] border-[#e8e6e1] text-[#6b6860] hover:bg-[#f9f8f5] px-4"
                                                    onClick={handlePrint}
                                                >
                                                    <FileDown className="h-4 w-4 mr-2" />
                                                    PDF
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="bg-[#f9f8f5] border-b border-[#e8e6e1]">
                                                    {["Date", "Inspector", "Company", "Project", "Part", "Location", "Inspected", "Accepted", "Rework", "Rejected"].map(h => (
                                                        <th key={h} className="px-6 py-3 text-left font-semibold uppercase tracking-[0.5px] text-[#9e9b95] text-[11px]">{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-[#e8e6e1]">
                                                {filteredRecords.map(r => (
                                                    <tr key={r.id} className="hover:bg-[#f9f8f5]/50 transition-all group">
                                                        <td className="px-6 py-4 font-medium text-[#6b6860] whitespace-nowrap">{(() => { try { const d = new Date(r.date); return isNaN(d.getTime()) ? "—" : format(d, "dd MMM, HH:mm") } catch { return "—" } })()}</td>
                                                        <td className="px-6 py-4 font-semibold text-[#1a1a18] group-hover:text-[#1a9e6e] transition-colors">{r.inspector}</td>
                                                        <td className="px-6 py-4 font-medium text-[#6b6860]">{r.company}</td>
                                                        <td className="px-6 py-4 font-medium text-[#9e9b95]">{r.project}</td>
                                                        <td className="px-6 py-4"><Badge variant="outline" className="bg-white border-[#e8e6e1] text-[#1a1a18] font-semibold px-2 py-0.5 rounded-[6px] text-[10px]">{r.partName}</Badge></td>
                                                        <td className="px-6 py-4 font-medium text-[#6b6860]">{r.location}</td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-[#1a1a18] text-[13px]">{r.inspected.toLocaleString()}</span>
                                                                <span className="text-[8px] font-semibold text-[#d4d1ca] uppercase tracking-widest mt-[2px]">Total</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-green-600 text-[13px]">{r.accepted.toLocaleString()}</span>
                                                                <span className="text-[8px] font-semibold text-green-200 uppercase tracking-widest mt-[2px]">OK</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-orange-500 text-[13px]">{r.rework.toLocaleString()}</span>
                                                                <span className="text-[8px] font-semibold text-orange-200 uppercase tracking-widest mt-[2px]">RW</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-red-500 text-[13px]">{r.rejected.toLocaleString()}</span>
                                                                <span className="text-[8px] font-semibold text-red-200 uppercase tracking-widest mt-[2px]">RJ</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {filteredRecords.length === 0 && (
                                            <div className="py-20 flex flex-col items-center gap-2 text-[#9e9b95]">
                                                <Search className="h-8 w-8 opacity-20" />
                                                <p className="font-medium">No records matching your search</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center py-10 text-center h-full min-h-[350px]">
            <ClipboardList className="h-8 w-8 text-[#d4d1ca] mb-3" />
            <p className="text-[13px] text-[#9e9b95]">No data available</p>
        </div>
    )
}
