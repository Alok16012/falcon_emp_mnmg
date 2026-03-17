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
function KpiCard({ label, value, color, icon: Icon, delay = 0 }: {
    label: string; value: number | string; color: string; icon: any; delay?: number
}) {
    const numericValue = typeof value === "number" ? value : 0
    const animated = useCountUp(numericValue)
    const displayValue = typeof value === "string" ? value : animated.toLocaleString()

    return (
        <Card
            className="group relative overflow-hidden border-none bg-white/50 backdrop-blur-md shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)] transition-all duration-300 animate-fadeIn rounded-[24px]"
            style={{ animationDelay: `${delay}ms` }}
        >
            <div className="absolute top-0 right-0 p-3 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
                <Icon className="h-20 w-20" />
            </div>
            <CardContent className="p-6">
                <div className="flex flex-col gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}10`, color }}>
                        <Icon className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                        <div className="flex items-baseline gap-1">
                            <p className="text-3xl font-black text-slate-800 tracking-tight">{displayValue}</p>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

// ─── Tab Button ──────────────────────────────────────────────────────────────
function TabButton({ name, active, onClick }: { name: string; active: boolean; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "px-6 py-2 rounded-xl text-sm font-bold transition-all duration-300 whitespace-nowrap",
                active
                    ? "bg-slate-900 text-white shadow-lg shadow-slate-200"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
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
        <div className="min-h-screen pb-20 space-y-6" style={{ background: THEME.background }}>
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

            {/* ── TOP NAV BAR ─────────────────────────────────────── */}
            <header className="no-print bg-white/40 backdrop-blur-xl sticky top-0 z-50 border-b border-slate-100/50 px-8 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-slate-900 p-2 rounded-xl text-white shadow-xl shadow-slate-200">
                        <ClipboardList className="h-5 w-5" />
                    </div>
                    <div>
                        <span className="font-black text-xl tracking-tight text-slate-900 block leading-none">QC PRO</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 block">Analytics Dashboard</span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="h-8 w-[1px] bg-slate-100 hidden sm:block" />
                    <Badge variant="outline" className="hidden sm:flex text-[10px] font-black py-0 h-6 px-3 border-slate-200 text-slate-400 rounded-full bg-slate-50/50">PLATFORM v1.4.0</Badge>
                </div>
            </header>

            <div className="max-w-[1600px] mx-auto px-4 lg:px-8 space-y-6">
                {/* ── FILTER & TAB BAR ────────────────────────────────── */}
                <div className="no-print flex flex-col gap-8 py-4">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        <div className="flex items-center gap-2 p-1.5 bg-slate-100/50 backdrop-blur-md rounded-[20px] border border-slate-200/50 w-fit">
                            {["Dashboard", "Graphical", "Pareto Chart", "Day Wise", "Part Wise", "Inspection Report"].map(tab => (
                                <TabButton
                                    key={tab}
                                    name={tab}
                                    active={activeTab === tab}
                                    onClick={() => setActiveTab(tab)}
                                />
                            ))}
                        </div>

                        <div className="flex items-center gap-3 self-end">
                            <Button
                                className="rounded-2xl font-black px-8 py-6 h-auto shadow-2xl shadow-blue-200/50 bg-blue-600 hover:bg-blue-700 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                                onClick={fetchReport}
                                disabled={loading}
                            >
                                {loading ? "Syncing..." : "Update Dashboard"}
                                <ArrowUpRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        {[
                            { label: "Company", value: selectedCompanyId, options: companies, setter: setSelectedCompanyId, allLabel: "Global View" },
                            { label: "Project", value: selectedProjectId, options: projects, setter: setSelectedProjectId, allLabel: "All Projects", disabled: selectedCompanyId === "all" },
                            { label: "Inspector", value: selectedInspectorId, options: inspectors, setter: setSelectedInspectorId, allLabel: "All Inspectors" },
                            { label: "Month", value: selectedMonth, options: MONTHS.map((m, i) => ({ id: i + 1, name: m })), setter: (v: string) => setSelectedMonth(Number(v)) },
                            { label: "Year", value: selectedYear, options: [2024, 2025, 2026].map(y => ({ id: y, name: y })), setter: (v: string) => setSelectedYear(Number(v)) }
                        ].map((filter, idx) => (
                            <div key={idx} className="group flex flex-col gap-1.5">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{filter.label}</span>
                                <div className={cn(
                                    "relative bg-white border border-slate-100 rounded-2xl px-4 py-2.5 shadow-sm group-hover:border-blue-200 transition-colors",
                                    filter.disabled && "opacity-50 cursor-not-allowed"
                                )}>
                                    <select
                                        className="w-full bg-transparent text-sm font-bold focus:outline-none appearance-none cursor-pointer"
                                        value={filter.value}
                                        onChange={e => filter.setter(e.target.value)}
                                        disabled={filter.disabled}
                                    >
                                        {filter.allLabel && <option value="all">{filter.allLabel}</option>}
                                        {filter.options.map((opt: any) => (
                                            <option key={opt.id} value={opt.id}>{opt.name}</option>
                                        ))}
                                    </select>
                                    <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 pointer-events-none rotate-90" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                        {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
                    </div>
                ) : !data ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4 bg-white rounded-3xl border border-dashed border-slate-300">
                        <div className="p-6 bg-slate-50 rounded-full"><AlertCircle className="h-12 w-12 text-slate-200" /></div>
                        <h2 className="text-xl font-black text-slate-900">No report data loaded</h2>
                        <Button onClick={fetchReport} variant="secondary" className="font-bold">Initialize Dashboard</Button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* ── KPI SECTION ─────────────────────────────────── */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 print-avoid">
                            <KpiCard label="Total Inspected" value={s?.totalInspected || 0} color={THEME.info} icon={History} delay={0} />
                            <KpiCard label="Total Accepted" value={s?.totalAccepted || 0} color={THEME.success} icon={CheckCircle2} delay={100} />
                            <KpiCard label="Total Rework" value={s?.totalRework || 0} color={THEME.warning} icon={TrendingDown} delay={200} />
                            <KpiCard label="Total Rejected" value={s?.totalRejected || 0} color={THEME.danger} icon={AlertCircle} delay={300} />
                            <KpiCard label="Rework PPM" value={s?.reworkPPM || 0} color={THEME.accent} icon={TrendingUp} delay={400} />
                            <KpiCard label="Rejection PPM" value={s?.rejectionPPM || 0} color={THEME.danger} icon={AlertCircle} delay={500} />
                        </div>

                        {/* ── TAB CONTENT ─────────────────────────────────── */}
                        <div className="animate-fadeIn">
                            {activeTab === "Dashboard" && (
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                                    {/* Overall Status - Donut */}
                                    <Card className="lg:col-span-4 border-none bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] rounded-[32px] overflow-hidden flex flex-col">
                                        <CardHeader className="p-8 pb-0">
                                            <CardTitle className="text-xl font-black text-slate-800 tracking-tight">Overall Status</CardTitle>
                                            <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Acceptance vs Rejection</CardDescription>
                                        </CardHeader>
                                        <CardContent className="flex-1 flex flex-col justify-center items-center py-8">
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
                                                        <span className="text-5xl font-black text-slate-900 leading-none tracking-tighter">{s?.acceptanceRate.toFixed(1)}%</span>
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Quality Rate</span>
                                                    </div>
                                                </div>
                                            ) : <EmptyState />}
                                            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-4">
                                                {pieData.map(e => (
                                                    <div key={e.name} className="flex items-center gap-2">
                                                        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: e.color }} />
                                                        <span className="text-[11px] font-bold text-slate-600">{e.name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Trend Analysis - Area Chart */}
                                    <Card className="lg:col-span-8 border-none bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] rounded-[32px] flex flex-col">
                                        <CardHeader className="p-8 pb-0 flex flex-row items-center justify-between">
                                            <div>
                                                <CardTitle className="text-xl font-black text-slate-800 tracking-tight">Perfromance Trend</CardTitle>
                                                <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Daily inspection performance volume</CardDescription>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="flex-1 p-8 pt-6">
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
                                                            tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }}
                                                            dy={10}
                                                        />
                                                        <YAxis
                                                            axisLine={false}
                                                            tickLine={false}
                                                            tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }}
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
                                        </CardContent>
                                    </Card>
                                </div>
                            )}

                            {activeTab === "Graphical" && (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <Card className="border-none shadow-sm p-6">
                                        <CardTitle className="text-lg font-black mb-6">Part-Wise Quality Split</CardTitle>
                                        {data.partWise.length > 0 ? (
                                            <ResponsiveContainer width="100%" height={400}>
                                                <BarChart data={data.partWise} layout="vertical" margin={{ left: 20 }}>
                                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
                                                    <YAxis dataKey="partName" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} width={120} />
                                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc" }} />
                                                    <Bar dataKey="totalAccepted" name="Accepted" stackId="a" fill={THEME.success} radius={[0, 0, 0, 0]} />
                                                    <Bar dataKey="totalRework" name="Rework" stackId="a" fill={THEME.warning} />
                                                    <Bar dataKey="totalRejected" name="Rejected" stackId="a" fill={THEME.danger} radius={[0, 4, 4, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        ) : <EmptyState />}
                                    </Card>
                                    <Card className="border-none shadow-sm p-6">
                                        <CardTitle className="text-lg font-black mb-6">Comparison by Location</CardTitle>
                                        {data.locationWise.length > 0 ? (
                                            <ResponsiveContainer width="100%" height={400}>
                                                <BarChart data={data.locationWise}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                    <XAxis dataKey="location" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
                                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
                                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc" }} />
                                                    <Bar dataKey="totalInspected" name="Inspected" fill={THEME.info} radius={[4, 4, 0, 0]} barSize={40} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        ) : <EmptyState />}
                                    </Card>
                                </div>
                            )}

                            {activeTab === "Pareto Chart" && (
                                <Card className="border-none shadow-sm p-8">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                                        <div>
                                            <CardTitle className="text-2xl font-black text-slate-900">Top Defect Analysis</CardTitle>
                                            <CardDescription className="font-bold text-slate-400">Identify 80% of quality issues from 20% of defect types (Pareto Principle)</CardDescription>
                                        </div>
                                        <Badge variant="secondary" className="bg-orange-50 text-orange-600 border-orange-100 font-black px-4 py-1 self-start md:self-center">
                                            Major Defects Only
                                        </Badge>
                                    </div>
                                    {data.topDefects.length > 0 ? (
                                        <ResponsiveContainer width="100%" height={450}>
                                            <ComposedChart data={paretoData} margin={{ top: 10, right: 30, left: 0, bottom: 40 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis dataKey="defectName" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} angle={-45} textAnchor="end" height={80} dy={20} />
                                                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
                                                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} unit="%" />
                                                <Tooltip content={<CustomTooltip />} />
                                                <Bar yAxisId="left" dataKey="count" name="Frequency" fill={THEME.danger} radius={[4, 4, 0, 0]} barSize={60} />
                                                <Line yAxisId="right" type="monotone" dataKey="cumulative" name="Cumulative %" stroke={THEME.warning} strokeWidth={4} dot={{ r: 6, fill: THEME.warning, strokeWidth: 3, stroke: "white" }} />
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    ) : <EmptyState />}
                                </Card>
                            )}

                            {activeTab === "Day Wise" && (
                                <Card className="border-none shadow-sm overflow-hidden">
                                    <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                                        <CardTitle className="text-lg font-black">Daily Inspection Log</CardTitle>
                                        <Button variant="outline" size="sm" className="font-bold h-8 rounded-lg" onClick={handlePrint}><Printer className="h-4 w-4 mr-2" />Print Log</Button>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-100">
                                                    {["Date", "Inspected", "Accepted", "Rework", "Rejected", "Quality Status"].map(h => (
                                                        <th key={h} className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-wider text-slate-400">{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {data.dayWise.map((d, i) => (
                                                    <tr key={d.date} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="px-6 py-4 font-bold text-slate-700">{(() => { try { return format(parseISO(d.date), "dd MMM yyyy, EEE") } catch { return d.date || "—" } })()}</td>
                                                        <td className="px-6 py-4 font-black text-slate-900">{d.totalInspected.toLocaleString()}</td>
                                                        <td className="px-6 py-4 font-bold text-green-600 bg-green-50/30">{d.totalAccepted.toLocaleString()}</td>
                                                        <td className="px-6 py-4 font-bold text-orange-600">{d.totalRework.toLocaleString()}</td>
                                                        <td className="px-6 py-4 font-bold text-red-600">{d.totalRejected.toLocaleString()}</td>
                                                        <td className="px-6 py-4 w-48"><ProgressBar value={d.qualityRate} color={d.qualityRate >= 99 ? THEME.success : d.qualityRate >= 95 ? THEME.warning : THEME.danger} /></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </Card>
                            )}

                            {activeTab === "Part Wise" && (
                                <Card className="border-none shadow-sm overflow-hidden">
                                    <div className="p-6 border-b border-slate-100">
                                        <CardTitle className="text-lg font-black">Performance by Component</CardTitle>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-100">
                                                    {["Component", "Inspected", "Accepted", "Rework", "Rejected", "Quality Rate"].map(h => (
                                                        <th key={h} className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-wider text-slate-400">{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {data.partWise.map((p, i) => (
                                                    <tr key={p.partName} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="px-6 py-4 font-black text-slate-800">{p.partName}</td>
                                                        <td className="px-6 py-4 font-bold text-blue-600">{p.totalInspected.toLocaleString()}</td>
                                                        <td className="px-6 py-4 font-bold text-green-600">{p.totalAccepted.toLocaleString()}</td>
                                                        <td className="px-6 py-4 font-bold text-orange-600">{p.totalRework.toLocaleString()}</td>
                                                        <td className="px-6 py-4 font-bold text-red-600">{p.totalRejected.toLocaleString()}</td>
                                                        <td className="px-6 py-4 w-48"><ProgressBar value={p.qualityRate} color={p.qualityRate >= 99 ? THEME.success : p.qualityRate >= 95 ? THEME.warning : THEME.danger} /></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </Card>
                            )}

                            {/* Inspector Wise removed as per request */}

                            {activeTab === "Inspection Report" && (
                                <Card className="border-none bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] rounded-[32px] overflow-hidden">
                                    <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-6">
                                        <div>
                                            <CardTitle className="text-xl font-black text-slate-800 tracking-tight">Inspection Record Explorer</CardTitle>
                                            <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Live data feed with advanced search</CardDescription>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-3">
                                            <div className="relative group">
                                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
                                                <Input
                                                    className="pl-11 h-11 w-full md:w-[300px] rounded-2xl border-slate-100 bg-slate-50/50 font-bold text-sm focus:bg-white focus:ring-4 focus:ring-blue-50/50 transition-all border-none"
                                                    placeholder="Search records..."
                                                    value={searchTerm}
                                                    onChange={e => setSearchTerm(e.target.value)}
                                                />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="outline"
                                                    className="h-11 rounded-2xl font-black text-xs border-slate-100 text-green-600 hover:text-green-700 hover:bg-green-50 px-6 transition-all active:scale-95"
                                                    onClick={handleExportExcel}
                                                >
                                                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                                                    EXCEL
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    className="h-11 rounded-2xl font-black text-xs border-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-50 px-6 transition-all active:scale-95"
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
                                                <tr className="bg-slate-50/50 border-b border-slate-50">
                                                    {["Date", "Inspector", "Company", "Project", "Part", "Location", "Inspected", "Accepted", "Rework", "Rejected"].map(h => (
                                                        <th key={h} className="px-8 py-5 text-left font-black uppercase tracking-widest text-slate-400 text-[9px]">{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {filteredRecords.map(r => (
                                                    <tr key={r.id} className="hover:bg-slate-50/30 transition-all group">
                                                        <td className="px-8 py-5 font-bold text-slate-400 whitespace-nowrap">{(() => { try { const d = new Date(r.date); return isNaN(d.getTime()) ? "—" : format(d, "dd MMM, HH:mm") } catch { return "—" } })()}</td>
                                                        <td className="px-8 py-5 font-black text-slate-700 group-hover:text-blue-600 transition-colors">{r.inspector}</td>
                                                        <td className="px-8 py-5 font-bold text-slate-500">{r.company}</td>
                                                        <td className="px-8 py-5 font-bold text-slate-400">{r.project}</td>
                                                        <td className="px-8 py-5"><Badge variant="outline" className="bg-white border-slate-100 text-slate-900 font-black px-3 py-0.5 rounded-lg text-[10px]">{r.partName}</Badge></td>
                                                        <td className="px-8 py-5 font-bold text-slate-500">{r.location}</td>
                                                        <td className="px-8 py-5">
                                                            <div className="flex flex-col">
                                                                <span className="font-black text-slate-900 text-sm">{r.inspected.toLocaleString()}</span>
                                                                <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest mt-0.5">Total</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-5">
                                                            <div className="flex flex-col">
                                                                <span className="font-black text-green-600 text-sm">{r.accepted.toLocaleString()}</span>
                                                                <span className="text-[8px] font-black text-green-200 uppercase tracking-widest mt-0.5">OK</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-5">
                                                            <div className="flex flex-col">
                                                                <span className="font-black text-orange-500 text-sm">{r.rework.toLocaleString()}</span>
                                                                <span className="text-[8px] font-black text-orange-200 uppercase tracking-widest mt-0.5">RW</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-5">
                                                            <div className="flex flex-col">
                                                                <span className="font-black text-red-500 text-sm">{r.rejected.toLocaleString()}</span>
                                                                <span className="text-[8px] font-black text-red-200 uppercase tracking-widest mt-0.5">RJ</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {filteredRecords.length === 0 && (
                                            <div className="py-20 flex flex-col items-center gap-2 text-slate-400">
                                                <Search className="h-8 w-8 opacity-20" />
                                                <p className="font-bold">No records matching your search</p>
                                            </div>
                                        )}
                                    </div>
                                </Card>
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
        <div className="flex flex-col items-center justify-center p-12 text-center h-full min-h-[350px]">
            <div className="relative mb-6">
                <div className="absolute inset-0 bg-slate-100 rounded-full scale-[2] opacity-50 blur-2xl" />
                <div className="relative p-6 bg-white rounded-3xl shadow-xl shadow-slate-100 ring-1 ring-slate-100">
                    <ClipboardList className="h-8 w-8 text-slate-300" />
                </div>
            </div>
            <h3 className="font-black text-slate-900 text-lg">No data matches your criteria</h3>
            <p className="text-sm text-slate-400 max-w-[240px] mt-2 font-bold leading-relaxed">Try adjusting your filters or selecting a different reporting period.</p>
        </div>
    )
}
