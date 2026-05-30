"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
    Cpu, Plus, Trash2, RefreshCw, CheckCircle2, XCircle,
    Wifi, WifiOff, Link2, Link2Off, ChevronDown, ChevronUp,
    Clock, AlertCircle, User, Search, Save, Play, Timer
} from "lucide-react"
import { cn } from "@/lib/utils"

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
    const [tab, setTab] = useState<"devices" | "mapping" | "logs">("devices")
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

    useEffect(() => {
        Promise.all([fetchDevices(), fetchLogs(), fetchMappings()]).finally(() => setLoading(false))
    }, [fetchDevices, fetchLogs, fetchMappings])

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

    // ── Sync Device ──────────────────────────────────────────────────────────

    const handleSync = async (deviceId?: string) => {
        setSyncing(deviceId || "all")
        const res = await fetch("/api/hardware/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ deviceId, hours: 24 }),
        })
        if (res.ok) {
            const data = await res.json()
            console.log("Sync result:", data)
            await Promise.all([fetchDevices(), fetchLogs()])
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
        <div className="p-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-[10px] bg-[var(--accent-light)] flex items-center justify-center">
                        <Cpu size={20} className="text-[var(--accent-text)]" />
                    </div>
                    <div>
                        <h1 className="text-[17px] font-semibold text-[var(--text)]">Hardware Integration</h1>
                        <p className="text-[12px] text-[var(--text3)]">Dahua Access Control · Face Recognition Attendance</p>
                    </div>
                </div>
                <button
                    onClick={() => handleSync()}
                    disabled={syncing !== null || devices.filter(d => d.enabled).length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white text-[13px] font-medium rounded-[8px] hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                    <RefreshCw size={14} className={cn(syncing ? "animate-spin" : "")} />
                    {syncing === "all" ? "Syncing…" : "Sync All Devices"}
                </button>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-4 gap-3 mb-6">
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4">
                    <p className="text-[11px] text-[var(--text3)] mb-1">Devices</p>
                    <p className="text-[22px] font-bold text-[var(--text)]">{devices.length}</p>
                    <p className="text-[11px] text-[var(--text3)]">{devices.filter(d => d.enabled).length} enabled</p>
                </div>
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4">
                    <p className="text-[11px] text-[var(--text3)] mb-1">Employees Mapped</p>
                    <p className="text-[22px] font-bold text-[var(--text)]">{mappedCount}</p>
                    <p className="text-[11px] text-[var(--text3)]">of {mappings.length} active</p>
                </div>
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4">
                    <p className="text-[11px] text-[var(--text3)] mb-1">Last Sync</p>
                    <p className="text-[13px] font-semibold text-[var(--text)] truncate">
                        {syncLogs[0] ? new Date(syncLogs[0].syncedAt).toLocaleString("en-IN", { hour12: false }) : "Never"}
                    </p>
                    <p className="text-[11px] text-[var(--text3)]">
                        {syncLogs[0] ? `${syncLogs[0].newPunches} new punches` : "—"}
                    </p>
                </div>
                <div className="bg-[var(--surface)] border border-emerald-200 rounded-[10px] p-4">
                    <div className="flex items-center gap-1.5 mb-1">
                        <Timer size={11} className="text-emerald-500" />
                        <p className="text-[11px] text-[var(--text3)]">Auto-Sync</p>
                    </div>
                    <p className="text-[22px] font-bold text-emerald-600 font-mono">{fmtCountdown(nextSyncIn)}</p>
                    <p className="text-[11px] text-emerald-600">● Running · every 30 min</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-[var(--border)] mb-5">
                {(["devices", "mapping", "logs"] as const).map(t => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={cn(
                            "px-4 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors capitalize",
                            tab === t
                                ? "border-[var(--accent)] text-[var(--accent-text)]"
                                : "border-transparent text-[var(--text2)] hover:text-[var(--text)]"
                        )}
                    >
                        {t === "mapping" ? "Employee Mapping" : t === "logs" ? "Sync Logs" : "Devices"}
                    </button>
                ))}
            </div>

            {/* ── DEVICES TAB ─────────────────────────────────────────────── */}
            {tab === "devices" && (
                <div className="space-y-3">
                    {devices.map(device => (
                        <DeviceCard
                            key={device.id}
                            device={device}
                            syncing={syncing === device.id}
                            testingConn={testingConn === device.id}
                            connResult={connResults[device.id]}
                            onSync={() => handleSync(device.id)}
                            onTest={() => handleTestConn(device.id)}
                            onToggle={(enabled) => handleToggleDevice(device.id, enabled)}
                            onDelete={() => handleDeleteDevice(device.id)}
                        />
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
                            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-[var(--border)] rounded-[12px] text-[13px] text-[var(--text3)] hover:border-[var(--accent)] hover:text-[var(--accent-text)] transition-colors"
                        >
                            <Plus size={16} />
                            Add Device
                        </button>
                    )}

                    {/* Setup Guide */}
                    <div className="mt-6 bg-[var(--surface2)] border border-[var(--border)] rounded-[12px] p-4">
                        <h4 className="text-[12px] font-semibold text-[var(--text)] mb-2">Setup Guide</h4>
                        <ol className="text-[11.5px] text-[var(--text2)] space-y-1.5 list-decimal list-inside">
                            <li>Add your Dahua ASI device with its LAN IP address</li>
                            <li>Make sure device and server are on the same network (or use port forwarding)</li>
                            <li>Test connection to verify credentials</li>
                            <li>Go to <strong>Employee Mapping</strong> tab — assign a Hardware User ID to each employee</li>
                            <li>Click <strong>Sync All Devices</strong> to import today's punch records</li>
                            <li><strong>Auto Push (optional):</strong> On the device web interface, set Event Upload URL to: <code className="bg-[var(--surface)] px-1 rounded">https://yourdomain.com/api/hardware/event</code></li>
                        </ol>
                    </div>
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

                    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[12px] overflow-hidden">
                        <table className="w-full text-[12.5px]">
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
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[12px] overflow-hidden">
                    <table className="w-full text-[12.5px]">
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
    onSync,
    onTest,
    onToggle,
    onDelete,
}: {
    device: HardwareDevice
    syncing: boolean
    testingConn: boolean
    connResult?: boolean | null
    onSync: () => void
    onTest: () => void
    onToggle: (enabled: boolean) => void
    onDelete: () => void
}) {
    const [expanded, setExpanded] = useState(false)

    return (
        <div className={cn(
            "bg-[var(--surface)] border rounded-[12px] overflow-hidden transition-colors",
            device.enabled ? "border-[var(--border)]" : "border-[var(--border)] opacity-60"
        )}>
            <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "h-9 w-9 rounded-[8px] flex items-center justify-center",
                        device.enabled ? "bg-blue-50 text-blue-600" : "bg-[var(--surface2)] text-[var(--text3)]"
                    )}>
                        <Cpu size={16} />
                    </div>
                    <div>
                        <p className="text-[14px] font-semibold text-[var(--text)]">{device.name}</p>
                        <p className="text-[11.5px] text-[var(--text3)] font-mono">{device.ip}:{device.port}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Connection test result */}
                    {connResult === true && <CheckCircle2 size={15} className="text-emerald-500" />}
                    {connResult === false && <XCircle size={15} className="text-red-500" />}

                    <button
                        onClick={onTest}
                        disabled={testingConn}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] border border-[var(--border)] rounded-[6px] text-[var(--text2)] hover:bg-[var(--surface2)] disabled:opacity-50"
                        title="Test connection"
                    >
                        {testingConn ? <RefreshCw size={12} className="animate-spin" /> : <Wifi size={12} />}
                        Test
                    </button>

                    <button
                        onClick={onSync}
                        disabled={syncing || !device.enabled}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] bg-[var(--accent)] text-white rounded-[6px] hover:opacity-90 disabled:opacity-50"
                    >
                        {syncing ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
                        Sync
                    </button>

                    {/* Enable/disable toggle */}
                    <button
                        onClick={() => onToggle(!device.enabled)}
                        className={cn(
                            "px-3 py-1.5 text-[12px] border rounded-[6px] transition-colors",
                            device.enabled
                                ? "border-[var(--border)] text-[var(--text2)] hover:bg-[var(--surface2)]"
                                : "border-emerald-300 text-emerald-600 hover:bg-emerald-50"
                        )}
                    >
                        {device.enabled ? <WifiOff size={12} /> : <Wifi size={12} />}
                    </button>

                    <button
                        onClick={() => setExpanded(v => !v)}
                        className="p-1.5 text-[var(--text3)] hover:text-[var(--text)] transition-colors"
                    >
                        {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>

                    <button
                        onClick={onDelete}
                        className="p-1.5 text-[var(--text3)] hover:text-red-500 transition-colors"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            {expanded && (
                <div className="border-t border-[var(--border)] px-4 py-3 bg-[var(--surface2)] grid grid-cols-3 gap-3 text-[12px]">
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
