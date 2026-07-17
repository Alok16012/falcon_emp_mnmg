"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
    Cpu, Plus, Trash2, RefreshCw, CheckCircle2, XCircle,
    Wifi, WifiOff, Link2, Link2Off, ChevronDown, ChevronUp,
    Clock, AlertCircle, User, UserPlus, Search, Save, Play, Timer, FileText
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// ─── Types ────────────────────────────────────────────────────────────────────

interface HardwareDevice {
    id: string
    name: string
    ip: string
    port: number
    username: string
    password: string
    enabled: boolean
    lastSyncAt: string | null
    lastSyncRec: string | null
    createdAt: string
}

interface SyncLog {
    id: string
    deviceId: string
    deviceName: string
    recordCount: number
    newPunches: number
    errors: string | null
    syncedAt: string
}

interface EmployeeMapping {
    id: string
    employeeId: string
    firstName: string
    lastName: string
    designation: string | null
    hardwareUserId: string | null
    department: { name: string } | null
    branch: { name: string } | null
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HardwarePage() {
    const [tab, setTab] = useState<"devices" | "deviceUsers" | "mapping" | "logs">("devices")
    const [devices, setDevices] = useState<HardwareDevice[]>([])
    const [syncLogs, setSyncLogs] = useState<SyncLog[]>([])
    const [mappings, setMappings] = useState<EmployeeMapping[]>([])
    const [loading, setLoading] = useState(true)
    const [syncing, setSyncing] = useState<string | null>(null)

    // New device form
    const [showAddDevice, setShowAddDevice] = useState(false)
    const [newDevice, setNewDevice] = useState({ name: "", ip: "", port: "80", username: "admin", password: "" })
    const [saving, setSaving] = useState(false)

    // Mapping search
    const [mapSearch, setMapSearch] = useState("")
    const [testingConn, setTestingConn] = useState<string | null>(null)
    const [connResults, setConnResults] = useState<Record<string, boolean | null>>({})
    const [configuring, setConfiguring] = useState<string | null>(null)
    const [enrolling, setEnrolling] = useState<string | null>(null)
    const [configResults, setConfigResults] = useState<Record<string, { ok: boolean; steps: { step: string; ok: boolean; response?: string }[] } | null>>({})

    // Auto-Reg TCP sessions
    const [tcpSessions, setTcpSessions] = useState<{ deviceId: string; ip: string; connected: boolean }[]>([])
    // Live users read from the physical device
    const [deviceUsers, setDeviceUsers] = useState<{ userId: string; name: string; cardNo: string; valid: boolean; userType: string }[]>([])
    const [duLoading, setDuLoading] = useState(false)
    const [duConnected, setDuConnected] = useState(false)
    const [duError, setDuError] = useState<string | null>(null)

    // Auto-sync countdown
    const [nextSyncIn, setNextSyncIn] = useState<number>(30 * 60)
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const fetchDevices = useCallback(async () => {
        const res = await fetch("/api/hardware/devices")
        if (res.ok) setDevices(await res.json())
    }, [])

    const fetchLogs = useCallback(async () => {
        const res = await fetch("/api/hardware/sync")
        if (res.ok) setSyncLogs(await res.json())
    }, [])

    const fetchMappings = useCallback(async () => {
        const res = await fetch("/api/hardware/mapping")
        if (res.ok) setMappings(await res.json())
    }, [])

    const fetchSessions = useCallback(async () => {
        const res = await fetch("/api/hardware/sessions")
        if (res.ok) {
            const data = await res.json()
            setTcpSessions(data.devices || [])
        }
    }, [])

    const [importing, setImporting] = useState(false)
    const handleImportDeviceUsers = async () => {
        setImporting(true)
        try {
            const res = await fetch("/api/hardware/import-device-users", { method: "POST" })
            const data = await res.json()
            if (res.ok && data.ok) {
                toast.success(data.message || "Imported from device")
                fetchMappings()
            } else {
                toast.error(data.error || "Import failed")
            }
        } catch {
            toast.error("Network error")
        } finally {
            setImporting(false)
        }
    }

    const fetchDeviceUsers = useCallback(async () => {
        setDuLoading(true)
        try {
            const res = await fetch("/api/hardware/device-users")
            const data = await res.json()
            setDeviceUsers(data.users || [])
            setDuConnected(!!data.connected)
            setDuError(data.error || null)
        } catch {
            setDuError("Failed to reach server")
        } finally {
            setDuLoading(false)
        }
    }, [])

    useEffect(() => {
        Promise.all([fetchDevices(), fetchLogs(), fetchMappings(), fetchSessions()]).finally(() => setLoading(false))
    }, [fetchDevices, fetchLogs, fetchMappings, fetchSessions])

    // Load live device users whenever the Device Users tab is opened
    useEffect(() => {
        if (tab === "deviceUsers") fetchDeviceUsers()
    }, [tab, fetchDeviceUsers])

    // Countdown timer display (purely visual — real sync happens server-side)
    useEffect(() => {
        countdownRef.current = setInterval(() => {
            setNextSyncIn(prev => {
                if (prev <= 1) {
                    // Reset and refresh logs
                    fetchLogs()
                    fetchDevices()
                    return 30 * 60
                }
                return prev - 1
            })
        }, 1000)
        return () => { if (countdownRef.current) clearInterval(countdownRef.current) }
    }, [fetchLogs, fetchDevices])

    const fmtCountdown = (secs: number) => {
        const m = Math.floor(secs / 60).toString().padStart(2, "0")
        const s = (secs % 60).toString().padStart(2, "0")
        return `${m}:${s}`
    }

    // ── Add Device ──────────────────────────────────────────────────────────

    const handleAddDevice = async () => {
        if (!newDevice.name || !newDevice.ip || !newDevice.password) return
        setSaving(true)
        const res = await fetch("/api/hardware/devices", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...newDevice, port: parseInt(newDevice.port) }),
        })
        if (res.ok) {
            const d = await res.json()
            setDevices(prev => [...prev, d])
            setNewDevice({ name: "", ip: "", port: "80", username: "admin", password: "" })
            setShowAddDevice(false)
        }
        setSaving(false)
    }

    // ── Delete Device ────────────────────────────────────────────────────────

    const handleDeleteDevice = async (id: string) => {
        if (!confirm("Delete this device?")) return
        await fetch(`/api/hardware/devices?id=${id}`, { method: "DELETE" })
        setDevices(prev => prev.filter(d => d.id !== id))
    }

    // ── Toggle Device Enabled ────────────────────────────────────────────────

    const handleToggleDevice = async (id: string, enabled: boolean) => {
        const res = await fetch("/api/hardware/devices", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, enabled }),
        })
        if (res.ok) setDevices(prev => prev.map(d => d.id === id ? { ...d, enabled } : d))
    }

    // ── Test Connection ──────────────────────────────────────────────────────

    const handleTestConn = async (id: string) => {
        setTestingConn(id)
        setConnResults(prev => ({ ...prev, [id]: null }))
        const res = await fetch("/api/hardware/devices", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, testConn: true }),
        })
        if (res.ok) {
            const { ok } = await res.json()
            setConnResults(prev => ({ ...prev, [id]: ok }))
        } else {
            setConnResults(prev => ({ ...prev, [id]: false }))
        }
        setTestingConn(null)
    }

    // ── Configure Device Auto-Push ───────────────────────────────────────────

    const handleConfigureDevice = async (id: string) => {
        setConfiguring(id)
        setConfigResults(prev => ({ ...prev, [id]: null }))
        try {
            const res = await fetch("/api/hardware/configure", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ deviceId: id }),
            })
            const data = await res.json()
            setConfigResults(prev => ({ ...prev, [id]: { ok: data.ok, steps: data.results || [] } }))
        } catch {
            setConfigResults(prev => ({ ...prev, [id]: { ok: false, steps: [{ step: "Network error", ok: false }] } }))
        }
        setConfiguring(null)
    }

    // ── Push Employees to Device ─────────────────────────────────────────────

    const handleEnroll = async (id: string) => {
        setEnrolling(id)
        try {
            const res = await fetch("/api/hardware/enroll", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ deviceId: id }),
            })
            const data = await res.json()
            if (res.ok) {
                toast.success(data.message || `Pushed ${data.pushed} employees`)
                if (data.failed > 0) toast.error(`${data.failed} failed — check device connection`)
            } else {
                toast.error(data.error || "Failed to push employees")
            }
        } catch {
            toast.error("Network error while pushing employees")
        }
        setEnrolling(null)
    }

    // ── Sync Device ──────────────────────────────────────────────────────────

    const handleSync = async (deviceId?: string) => {
        setSyncing(deviceId || "all")
        try {
            // Channel-based sync (works through the Railway TCP proxy)
            const res = await fetch("/api/hardware/sync-punches", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ deviceId }),
            })
            const data = await res.json()
            if (res.ok && data.ok) {
                toast.success(data.message || "Synced")
            } else {
                toast.error(data.error || "Sync failed — device connected?")
            }
            await Promise.all([fetchDevices(), fetchLogs()])
        } catch {
            toast.error("Network error during sync")
        }
        setSyncing(null)
    }

    // ── Update Employee Mapping ──────────────────────────────────────────────

    const handleMappingUpdate = async (employeeId: string, hardwareUserId: string) => {
        const res = await fetch("/api/hardware/mapping", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ employeeId, hardwareUserId }),
        })
        if (res.ok) {
            const updated = await res.json()
            setMappings(prev => prev.map(m => m.id === employeeId ? { ...m, hardwareUserId: updated.hardwareUserId } : m))
        } else {
            const err = await res.json()
            alert(err.error || "Failed to update mapping")
        }
    }

    const filteredMappings = mappings.filter(m => {
        if (!mapSearch) return true
        const q = mapSearch.toLowerCase()
        return (
            m.firstName.toLowerCase().includes(q) ||
            m.lastName.toLowerCase().includes(q) ||
            m.employeeId.toLowerCase().includes(q) ||
            (m.hardwareUserId?.toLowerCase().includes(q) ?? false)
        )
    })

    const mappedCount = mappings.filter(m => m.hardwareUserId).length

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="animate-spin text-[var(--text3)]" size={24} />
            </div>
        )
    }

    return (
        <div className="w-full p-4 md:p-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                <div>
                    <h1 className="text-[24px] md:text-[26px] font-bold text-[var(--text)] leading-tight">Hardware Integration</h1>
                    <p className="text-[13px] text-[var(--text3)] mt-0.5">Manage attendance devices and sync employee data</p>
                </div>
                <button
                    onClick={() => handleSync()}
                    disabled={syncing !== null || devices.filter(d => d.enabled).length === 0}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[var(--accent)] text-white text-[13px] font-semibold rounded-[12px] hover:bg-[#4a4ac8] disabled:opacity-50 transition-colors shadow-sm"
                >
                    <RefreshCw size={14} className={cn(syncing ? "animate-spin" : "")} />
                    {syncing === "all" ? "Syncing…" : "Sync All Devices"}
                </button>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
                <div className="bg-white border border-[var(--border)] rounded-[16px] p-3.5 md:p-4 shadow-[0_2px_10px_rgba(80,80,170,0.05)] min-w-0 overflow-hidden">
                    <div className="flex items-start gap-2.5">
                        <div className="w-9 h-9 rounded-[11px] bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center shrink-0"><Cpu size={17} /></div>
                        <div className="min-w-0">
                            <p className="text-[12px] text-[var(--text2)] font-medium">Devices</p>
                            <p className="text-[22px] font-bold text-[var(--text)] leading-tight">{devices.length}</p>
                        </div>
                    </div>
                    <p className="text-[11.5px] text-[var(--text3)] mt-1.5">{devices.filter(d => d.enabled).length} enabled</p>
                </div>
                <div className="bg-white border border-[var(--border)] rounded-[16px] p-3.5 md:p-4 shadow-[0_2px_10px_rgba(80,80,170,0.05)] min-w-0 overflow-hidden">
                    <div className="flex items-start gap-2.5">
                        <div className="w-9 h-9 rounded-[11px] bg-[#dcfce7] text-[#16a34a] flex items-center justify-center shrink-0"><UserPlus size={17} /></div>
                        <div className="min-w-0">
                            <p className="text-[12px] text-[var(--text2)] font-medium">Employees Mapped</p>
                            <p className="text-[22px] font-bold text-[var(--text)] leading-tight">{mappedCount}</p>
                        </div>
                    </div>
                    <p className="text-[11.5px] text-[var(--text3)] mt-1.5">of {mappings.length} active</p>
                </div>
                <div className="bg-white border border-[var(--border)] rounded-[16px] p-3.5 md:p-4 shadow-[0_2px_10px_rgba(80,80,170,0.05)] min-w-0 overflow-hidden">
                    <div className="flex items-start gap-2.5">
                        <div className="w-9 h-9 rounded-[11px] bg-[#dbeafe] text-[#2563eb] flex items-center justify-center shrink-0"><Timer size={17} /></div>
                        <div className="min-w-0">
                            <p className="text-[12px] text-[var(--text2)] font-medium">Last Sync</p>
                            <p className="text-[12.5px] md:text-[14px] font-bold text-[var(--text)] leading-tight truncate mt-0.5">
                                {syncLogs[0] ? new Date(syncLogs[0].syncedAt).toLocaleString("en-IN", { hour12: false }) : "Never"}
                            </p>
                        </div>
                    </div>
                    <p className="text-[11.5px] text-[var(--text3)] mt-1.5">
                        {syncLogs[0] ? `${syncLogs[0].newPunches} new punches` : "—"}
                    </p>
                </div>
                <div className="bg-white border border-[var(--border)] rounded-[16px] p-3.5 md:p-4 shadow-[0_2px_10px_rgba(80,80,170,0.05)] min-w-0 overflow-hidden">
                    <div className="flex items-start gap-2.5">
                        <div className={cn("w-9 h-9 rounded-[11px] flex items-center justify-center shrink-0",
                            tcpSessions.filter(s => s.connected).length > 0 ? "bg-[#dcfce7] text-[#16a34a]" : "bg-[var(--accent-light)] text-[var(--accent)]")}>
                            <Link2 size={17} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[12px] text-[var(--text2)] font-medium">TCP Connected</p>
                            <p className="text-[22px] font-bold text-[var(--text)] leading-tight">{tcpSessions.filter(s => s.connected).length}</p>
                        </div>
                    </div>
                    <p className="text-[11.5px] text-[var(--text3)] mt-1.5">Auto-Reg devices live</p>
                </div>
                <div className="bg-white border border-[var(--border)] rounded-[16px] p-3.5 md:p-4 shadow-[0_2px_10px_rgba(80,80,170,0.05)] min-w-0 overflow-hidden">
                    <div className="flex items-start gap-2.5">
                        <div className="w-9 h-9 rounded-[11px] bg-[#dcfce7] text-[#16a34a] flex items-center justify-center shrink-0"><Timer size={17} /></div>
                        <div className="min-w-0">
                            <p className="text-[12px] text-[var(--text2)] font-medium">Auto-Sync</p>
                            <p className="text-[22px] font-bold text-emerald-600 leading-tight font-mono">{fmtCountdown(nextSyncIn)}</p>
                        </div>
                    </div>
                    <p className="text-[11.5px] text-emerald-600 mt-1.5">● Running · every 30 min</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-5 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0">
                {(["devices", "deviceUsers", "mapping", "logs"] as const).map(t => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={cn(
                            "px-4 py-2 text-[12.5px] font-semibold rounded-[12px] border whitespace-nowrap transition-colors shrink-0",
                            tab === t
                                ? "bg-[var(--accent-light)] text-[var(--accent-text)] border-[var(--accent)]/40"
                                : "bg-white text-[var(--text2)] border-[var(--border)] hover:bg-[var(--surface2)]"
                        )}
                    >
                        {t === "deviceUsers" ? "Device Users" : t === "mapping" ? "Employee Mapping" : t === "logs" ? "Sync Logs" : "Devices"}
                    </button>
                ))}
            </div>

            {/* ── DEVICES TAB ─────────────────────────────────────────────── */}
            {tab === "devices" && (
                <div className="space-y-3">
                    {devices.map(device => (
                        <div key={device.id}>
                            <DeviceCard
                                device={device}
                                syncing={syncing === device.id}
                                testingConn={testingConn === device.id}
                                connResult={connResults[device.id]}
                                configuring={configuring === device.id}
                                enrolling={enrolling === device.id}
                                tcpConnected={tcpSessions.some(s => s.connected && (s.deviceId === device.name || s.ip === device.ip))}
                                onSync={() => handleSync(device.id)}
                                onTest={() => handleTestConn(device.id)}
                                onConfigure={() => handleConfigureDevice(device.id)}
                                onEnroll={() => handleEnroll(device.id)}
                                onToggle={(enabled) => handleToggleDevice(device.id, enabled)}
                                onDelete={() => handleDeleteDevice(device.id)}
                            />
                            {/* Configure result */}
                            {configResults[device.id] && (
                                <div className={cn(
                                    "mt-2 rounded-[10px] p-4 border text-[12px]",
                                    configResults[device.id]?.ok
                                        ? "bg-emerald-50 border-emerald-200"
                                        : "bg-red-50 border-red-200"
                                )}>
                                    <p className={cn("font-semibold mb-2", configResults[device.id]?.ok ? "text-emerald-700" : "text-red-700")}>
                                        {configResults[device.id]?.ok ? "✅ Device configured! Auto-push active." : "⚠️ Some steps failed — check below"}
                                    </p>
                                    <div className="space-y-1">
                                        {configResults[device.id]?.steps.map((s, i) => (
                                            <div key={i} className="flex items-center gap-2">
                                                <span>{s.ok ? "✓" : "✗"}</span>
                                                <span className={s.ok ? "text-emerald-700" : "text-red-600"}>{s.step}</span>
                                                {s.response && <span className="text-[var(--text3)] ml-1">— {s.response}</span>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Add Device */}
                    {showAddDevice ? (
                        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[12px] p-5">
                            <h3 className="text-[14px] font-semibold text-[var(--text)] mb-4">Add Device</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] text-[var(--text3)] mb-1 block">Device Name *</label>
                                    <input
                                        className="w-full border border-[var(--border)] rounded-[7px] px-3 py-2 text-[13px] bg-[var(--surface)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                                        placeholder="e.g. Main Gate"
                                        value={newDevice.name}
                                        onChange={e => setNewDevice(p => ({ ...p, name: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] text-[var(--text3)] mb-1 block">IP Address *</label>
                                    <input
                                        className="w-full border border-[var(--border)] rounded-[7px] px-3 py-2 text-[13px] bg-[var(--surface)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)] font-mono"
                                        placeholder="192.168.1.100"
                                        value={newDevice.ip}
                                        onChange={e => setNewDevice(p => ({ ...p, ip: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] text-[var(--text3)] mb-1 block">Port</label>
                                    <input
                                        className="w-full border border-[var(--border)] rounded-[7px] px-3 py-2 text-[13px] bg-[var(--surface)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)] font-mono"
                                        placeholder="80"
                                        value={newDevice.port}
                                        onChange={e => setNewDevice(p => ({ ...p, port: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] text-[var(--text3)] mb-1 block">Username</label>
                                    <input
                                        className="w-full border border-[var(--border)] rounded-[7px] px-3 py-2 text-[13px] bg-[var(--surface)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                                        placeholder="admin"
                                        value={newDevice.username}
                                        onChange={e => setNewDevice(p => ({ ...p, username: e.target.value }))}
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-[11px] text-[var(--text3)] mb-1 block">Password *</label>
                                    <input
                                        type="password"
                                        className="w-full border border-[var(--border)] rounded-[7px] px-3 py-2 text-[13px] bg-[var(--surface)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                                        placeholder="Device password"
                                        value={newDevice.password}
                                        onChange={e => setNewDevice(p => ({ ...p, password: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 mt-4">
                                <button
                                    onClick={() => setShowAddDevice(false)}
                                    className="px-4 py-2 text-[13px] text-[var(--text2)] hover:text-[var(--text)] transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddDevice}
                                    disabled={saving}
                                    className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white text-[13px] font-medium rounded-[8px] hover:opacity-90 disabled:opacity-50"
                                >
                                    <Save size={13} />
                                    {saving ? "Saving…" : "Save Device"}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowAddDevice(true)}
                            className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-[var(--accent)]/30 rounded-[16px] text-[14px] font-semibold text-[var(--accent-text)] hover:border-[var(--accent)] hover:bg-[var(--accent-light)]/40 transition-colors"
                        >
                            <Plus size={17} />
                            Add Device
                        </button>
                    )}

                    {/* Setup Guide */}
                    <div className="mt-5 bg-white border border-[var(--border)] rounded-[16px] p-4 shadow-[0_2px_10px_rgba(80,80,170,0.05)]">
                        <div className="flex items-center gap-2.5 mb-3.5">
                            <div className="w-9 h-9 rounded-[11px] bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center">
                                <FileText size={16} />
                            </div>
                            <h4 className="text-[15px] font-bold text-[var(--text)]">Setup Guide</h4>
                        </div>
                        <ol className="space-y-2.5">
                            {[
                                <>Add Dahua ASI device LAN IP and credentials</>,
                                <>Test connection</>,
                                <>Map employees to hardware user IDs</>,
                                <>Sync all devices to import punch data</>,
                                <>Enable auto registration with server IP and port <code className="bg-[var(--surface2)] px-1 rounded">8099</code></>,
                                <>HTTP push can send punch events in real time</>,
                            ].map((step, i) => (
                                <li key={i} className="flex items-start gap-2.5">
                                    <span className="w-6 h-6 rounded-full bg-[var(--accent-light)] text-[var(--accent-text)] text-[11.5px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                                    <span className="text-[12.5px] text-[var(--text2)] leading-relaxed pt-0.5">{step}</span>
                                </li>
                            ))}
                        </ol>
                    </div>
                </div>
            )}

            {/* ── DEVICE USERS TAB ─────────────────────────────────────────── */}
            {tab === "deviceUsers" && (
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <span className={cn(
                                "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold",
                                duConnected ? "bg-emerald-100 text-emerald-700" : "bg-[var(--surface2)] text-[var(--text3)]"
                            )}>
                                <span className={cn("w-2 h-2 rounded-full", duConnected ? "bg-emerald-500 animate-pulse" : "bg-[var(--text3)]")} />
                                {duConnected ? `${deviceUsers.length} users on device` : "Device not connected"}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={fetchDeviceUsers}
                                disabled={duLoading}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] border border-[var(--border)] text-[var(--text2)] rounded-[7px] hover:bg-[var(--surface2)] disabled:opacity-50"
                            >
                                <RefreshCw size={12} className={duLoading ? "animate-spin" : ""} />
                                {duLoading ? "Reading…" : "Refresh"}
                            </button>
                            <button
                                onClick={handleImportDeviceUsers}
                                disabled={importing || !duConnected || deviceUsers.length === 0}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] bg-[var(--accent)] text-white rounded-[7px] hover:opacity-90 disabled:opacity-50"
                                title="Create/link employees in the web app for every user on the device (auto-sets Hardware ID)"
                            >
                                {importing ? <RefreshCw size={12} className="animate-spin" /> : <UserPlus size={12} />}
                                {importing ? "Importing…" : "Import to Web App"}
                            </button>
                        </div>
                    </div>

                    {duError && (
                        <div className="mb-3 flex items-center gap-2 text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-[8px] px-3 py-2">
                            <AlertCircle size={13} /> {duError}
                        </div>
                    )}

                    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[12px] overflow-hidden overflow-x-auto">
                        <table className="w-full min-w-[640px] text-[12.5px]">
                            <thead>
                                <tr className="border-b border-[var(--border)] bg-[var(--surface2)]">
                                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wide w-[120px]">User ID</th>
                                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wide">Name</th>
                                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wide">Card No.</th>
                                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wide">Type</th>
                                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wide">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {duLoading ? (
                                    <tr><td colSpan={5} className="text-center py-10 text-[var(--text3)] text-[12px]">Reading users from device…</td></tr>
                                ) : deviceUsers.length === 0 ? (
                                    <tr><td colSpan={5} className="text-center py-10 text-[var(--text3)] text-[12px]">
                                        {duConnected ? "No users enrolled on device yet." : "Device offline — connect it to read users."}
                                    </td></tr>
                                ) : deviceUsers.map((u) => (
                                    <tr key={u.userId} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface2)]">
                                        <td className="px-4 py-3 font-mono font-semibold text-[var(--text)]">{u.userId}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className="h-7 w-7 rounded-full bg-[var(--surface2)] flex items-center justify-center shrink-0">
                                                    <User size={13} className="text-[var(--text3)]" />
                                                </div>
                                                <span className="text-[var(--text)] font-medium">{u.name || "—"}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-[var(--text2)] font-mono text-[11.5px]">{u.cardNo || "—"}</td>
                                        <td className="px-4 py-3 text-[var(--text2)]">{u.userType === "1" ? "Admin" : "User"}</td>
                                        <td className="px-4 py-3">
                                            <span className={cn(
                                                "px-2 py-0.5 rounded-[5px] text-[11px] font-semibold",
                                                u.valid ? "bg-emerald-50 text-emerald-700" : "bg-[var(--surface2)] text-[var(--text3)]"
                                            )}>
                                                {u.valid ? "Active" : "Inactive"}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <p className="mt-3 text-[11px] text-[var(--text3)]">
                        💡 Yeh list seedhe device se live aati hai. Inke <strong>User ID</strong> ko Employee Mapping me match karein taaki attendance sahi employee se jude.
                    </p>
                </div>
            )}

            {/* ── EMPLOYEE MAPPING TAB ─────────────────────────────────────── */}
            {tab === "mapping" && (
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="relative flex-1">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text3)]" />
                            <input
                                className="w-full pl-9 pr-4 py-2 border border-[var(--border)] rounded-[8px] text-[13px] bg-[var(--surface)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                                placeholder="Search by name or employee ID…"
                                value={mapSearch}
                                onChange={e => setMapSearch(e.target.value)}
                            />
                        </div>
                        <span className="text-[12px] text-[var(--text3)] shrink-0">{mappedCount}/{mappings.length} mapped</span>
                    </div>

                    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[12px] overflow-hidden overflow-x-auto">
                        <table className="w-full min-w-[640px] text-[12.5px]">
                            <thead>
                                <tr className="border-b border-[var(--border)] bg-[var(--surface2)]">
                                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wide">Employee</th>
                                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wide">EMP ID</th>
                                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wide">Designation</th>
                                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wide w-[180px]">Hardware User ID</th>
                                    <th className="px-4 py-3 w-10"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredMappings.map((emp) => (
                                    <MappingRow
                                        key={emp.id}
                                        employee={emp}
                                        onSave={(hwId) => handleMappingUpdate(emp.id, hwId)}
                                    />
                                ))}
                                {filteredMappings.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="text-center py-8 text-[var(--text3)] text-[12px]">
                                            No employees found
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <p className="mt-3 text-[11px] text-[var(--text3)]">
                        💡 The Hardware User ID must match the UserID enrolled on the Dahua device. You can find it in the device&apos;s user management interface.
                    </p>
                </div>
            )}

            {/* ── SYNC LOGS TAB ────────────────────────────────────────────── */}
            {tab === "logs" && (
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[12px] overflow-hidden overflow-x-auto">
                    <table className="w-full min-w-[640px] text-[12.5px]">
                        <thead>
                            <tr className="border-b border-[var(--border)] bg-[var(--surface2)]">
                                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wide">Time</th>
                                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wide">Device</th>
                                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wide">Records</th>
                                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wide">New Punches</th>
                                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wide">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {syncLogs.map(log => (
                                <tr key={log.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface2)]">
                                    <td className="px-4 py-3 text-[var(--text2)] font-mono text-[11.5px]">
                                        {new Date(log.syncedAt).toLocaleString("en-IN", { hour12: false })}
                                    </td>
                                    <td className="px-4 py-3 text-[var(--text)] font-medium">{log.deviceName}</td>
                                    <td className="px-4 py-3 text-[var(--text2)]">{log.recordCount}</td>
                                    <td className="px-4 py-3">
                                        <span className={cn(
                                            "font-semibold",
                                            log.newPunches > 0 ? "text-emerald-600" : "text-[var(--text3)]"
                                        )}>
                                            +{log.newPunches}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        {log.errors ? (
                                            <span className="flex items-center gap-1 text-red-500 text-[11.5px]">
                                                <AlertCircle size={12} />
                                                {log.errors.slice(0, 50)}
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-emerald-600 text-[11.5px]">
                                                <CheckCircle2 size={12} />
                                                OK
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {syncLogs.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="text-center py-10 text-[var(--text3)] text-[12px]">
                                        No sync logs yet. Click &quot;Sync All Devices&quot; to start.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

// ─── Device Card Component ────────────────────────────────────────────────────

function DeviceCard({
    device,
    syncing,
    testingConn,
    connResult,
    configuring,
    enrolling,
    tcpConnected,
    onSync,
    onTest,
    onConfigure,
    onEnroll,
    onToggle,
    onDelete,
}: {
    device: HardwareDevice
    syncing: boolean
    testingConn: boolean
    connResult?: boolean | null
    configuring: boolean
    enrolling: boolean
    tcpConnected: boolean
    onSync: () => void
    onTest: () => void
    onConfigure: () => void
    onEnroll: () => void
    onToggle: (enabled: boolean) => void
    onDelete: () => void
}) {
    const [expanded, setExpanded] = useState(false)

    return (
        <div className={cn(
            "bg-white border rounded-[16px] overflow-hidden transition-colors shadow-[0_2px_10px_rgba(80,80,170,0.05)]",
            device.enabled ? "border-[var(--border)]" : "border-[var(--border)] opacity-60"
        )}>
            <div className="p-4">
                {/* Top row: identity + status + small controls */}
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "h-11 w-11 rounded-[13px] flex items-center justify-center shrink-0",
                        device.enabled ? "bg-[var(--accent-light)] text-[var(--accent)]" : "bg-[var(--surface2)] text-[var(--text3)]"
                    )}>
                        <Cpu size={19} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-bold text-[var(--text)] truncate">{device.name}</p>
                        <p className="text-[12px] text-[var(--text3)] font-mono">{device.ip}:{device.port}</p>
                    </div>
                    {tcpConnected ? (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-600 text-[11.5px] font-semibold rounded-full shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                            Online
                        </span>
                    ) : connResult === true ? (
                        <span className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-600 text-[11.5px] font-semibold rounded-full shrink-0">
                            <CheckCircle2 size={12} /> OK
                        </span>
                    ) : connResult === false ? (
                        <span className="flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-600 text-[11.5px] font-semibold rounded-full shrink-0">
                            <XCircle size={12} /> Failed
                        </span>
                    ) : null}
                    <div className="flex items-center shrink-0">
                        <button
                            onClick={() => onToggle(!device.enabled)}
                            title={device.enabled ? "Disable device" : "Enable device"}
                            className={cn(
                                "p-1.5 rounded-[8px] transition-colors",
                                device.enabled ? "text-[var(--text3)] hover:bg-[var(--surface2)]" : "text-emerald-600 hover:bg-emerald-50"
                            )}
                        >
                            {device.enabled ? <WifiOff size={14} /> : <Wifi size={14} />}
                        </button>
                        <button
                            onClick={onDelete}
                            className="p-1.5 rounded-[8px] text-[var(--text3)] hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                            <Trash2 size={14} />
                        </button>
                        <button
                            onClick={() => setExpanded(v => !v)}
                            className="p-1.5 rounded-[8px] text-[var(--text3)] hover:text-[var(--text)] hover:bg-[var(--surface2)] transition-colors"
                        >
                            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </button>
                    </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2 mt-3.5">
                    <button
                        onClick={onTest}
                        disabled={testingConn}
                        className="flex items-center gap-1.5 px-3.5 py-2 text-[12.5px] font-semibold border border-[var(--border)] rounded-[11px] text-[var(--text2)] bg-white hover:bg-[var(--surface2)] disabled:opacity-50"
                        title="Test connection"
                    >
                        {testingConn ? <RefreshCw size={13} className="animate-spin" /> : <Wifi size={13} />}
                        Test
                    </button>

                    <button
                        onClick={onConfigure}
                        disabled={configuring || !device.enabled}
                        className="flex items-center gap-1.5 px-3.5 py-2 text-[12.5px] font-semibold bg-emerald-500 text-white rounded-[11px] hover:bg-emerald-600 disabled:opacity-50"
                        title="Auto-configure device to push attendance to this server"
                    >
                        {configuring ? <RefreshCw size={13} className="animate-spin" /> : <Link2 size={13} />}
                        {configuring ? "Connecting…" : "Connect"}
                    </button>

                    <button
                        onClick={onEnroll}
                        disabled={enrolling || !device.enabled}
                        className="flex items-center gap-1.5 px-3.5 py-2 text-[12.5px] font-semibold bg-[#6d5be8] text-white rounded-[11px] hover:bg-[#5d4bd8] disabled:opacity-50"
                        title="Push mapped employees (name + ID) to this device so their name appears when enrolling fingerprints"
                    >
                        {enrolling ? <RefreshCw size={13} className="animate-spin" /> : <UserPlus size={13} />}
                        {enrolling ? "Pushing…" : "Push Staff"}
                    </button>

                    <button
                        onClick={onSync}
                        disabled={syncing || !device.enabled}
                        className="flex items-center gap-1.5 px-3.5 py-2 text-[12.5px] font-semibold bg-[#2e3a8c] text-white rounded-[11px] hover:opacity-90 disabled:opacity-50"
                    >
                        {syncing ? <RefreshCw size={13} className="animate-spin" /> : <Play size={13} />}
                        Sync
                    </button>
                </div>
            </div>

            {expanded && (
                <div className="border-t border-[var(--border)] px-4 py-3 bg-[var(--surface2)] grid grid-cols-1 sm:grid-cols-3 gap-3 text-[12px]">
                    <div>
                        <p className="text-[var(--text3)] mb-0.5">Username</p>
                        <p className="text-[var(--text)] font-mono">{device.username}</p>
                    </div>
                    <div>
                        <p className="text-[var(--text3)] mb-0.5">Last Sync</p>
                        <p className="text-[var(--text)]">
                            {device.lastSyncAt
                                ? new Date(device.lastSyncAt).toLocaleString("en-IN", { hour12: false })
                                : "Never"}
                        </p>
                    </div>
                    <div>
                        <p className="text-[var(--text3)] mb-0.5">Status</p>
                        <p className={cn("font-medium", device.enabled ? "text-emerald-600" : "text-[var(--text3)]")}>
                            {device.enabled ? "Enabled" : "Disabled"}
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}

// ─── Mapping Row Component ────────────────────────────────────────────────────

function MappingRow({ employee, onSave }: { employee: EmployeeMapping; onSave: (hwId: string) => void }) {
    const [hwId, setHwId] = useState(employee.hardwareUserId || "")
    const [editing, setEditing] = useState(false)
    const [saving, setSaving] = useState(false)

    const isDirty = hwId !== (employee.hardwareUserId || "")

    const handleSave = async () => {
        setSaving(true)
        await onSave(hwId)
        setEditing(false)
        setSaving(false)
    }

    return (
        <tr className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface2)]">
            <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-[var(--surface2)] flex items-center justify-center shrink-0">
                        <User size={13} className="text-[var(--text3)]" />
                    </div>
                    <span className="text-[var(--text)] font-medium">{employee.firstName} {employee.lastName}</span>
                </div>
            </td>
            <td className="px-4 py-3 text-[var(--text3)] font-mono text-[11.5px]">{employee.employeeId}</td>
            <td className="px-4 py-3 text-[var(--text2)]">{employee.designation || "—"}</td>
            <td className="px-4 py-3">
                <input
                    className={cn(
                        "w-full border rounded-[6px] px-2.5 py-1.5 text-[12px] font-mono bg-[var(--surface)] text-[var(--text)] focus:outline-none transition-colors",
                        editing ? "border-[var(--accent)]" : "border-[var(--border)]"
                    )}
                    value={hwId}
                    placeholder="e.g. 0001"
                    onFocus={() => setEditing(true)}
                    onBlur={() => !isDirty && setEditing(false)}
                    onChange={e => setHwId(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && isDirty && handleSave()}
                />
            </td>
            <td className="px-4 py-3">
                {isDirty ? (
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-[6px] transition-colors"
                        title="Save"
                    >
                        {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                    </button>
                ) : employee.hardwareUserId ? (
                    <Link2 size={13} className="text-emerald-500 mx-auto" />
                ) : (
                    <Link2Off size={13} className="text-[var(--text3)] mx-auto" />
                )}
            </td>
        </tr>
    )
}
