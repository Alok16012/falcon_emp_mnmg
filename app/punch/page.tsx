"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import { format } from "date-fns"

type Employee = {
    id: string
    employeeId: string
    firstName: string
    lastName: string
    designation?: string
    photo?: string
    department?: { name: string }
}

type PunchLog = {
    punchNumber: number
    punchType: "IN" | "OUT"
    punchTime: string
}

type KioskState = "idle" | "scanning" | "matched" | "success" | "error"

const RESET_DELAY = 5000

export default function PunchKioskPage() {
    const [employees, setEmployees] = useState<Employee[]>([])
    const [state, setState] = useState<KioskState>("idle")
    const [matched, setMatched] = useState<Employee | null>(null)
    const [punchResult, setPunchResult] = useState<{
        punchType: "IN" | "OUT"
        punchNumber: number
        time: string
        totalWorkingHrs: number
    } | null>(null)
    const [errorMsg, setErrorMsg] = useState("")
    const [currentTime, setCurrentTime] = useState(new Date())
    const [streamActive, setStreamActive] = useState(false)
    const [todayPunches, setTodayPunches] = useState<PunchLog[]>([])
    const [isLate, setIsLate] = useState(false)

    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        const t = setInterval(() => setCurrentTime(new Date()), 1000)
        return () => clearInterval(t)
    }, [])

    useEffect(() => {
        fetch("/api/punch")
            .then(async r => {
                const data = await r.json()
                if (!r.ok) { setErrorMsg(`Load failed: ${data?.error || r.status}`); setState("error"); return }
                setEmployees(Array.isArray(data) ? data : [])
            })
            .catch(e => { setErrorMsg(`Network error: ${e.message}`); setState("error") })
    }, [])

    const startCamera = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
                audio: false,
            })
            streamRef.current = stream
            if (videoRef.current) videoRef.current.srcObject = stream
            setStreamActive(true)
            setState("scanning")
        } catch {
            setErrorMsg("Camera access denied. Please allow camera permission.")
            setState("error")
        }
    }, [])

    const stopCamera = useCallback(() => {
        streamRef.current?.getTracks().forEach(t => t.stop())
        streamRef.current = null
        setStreamActive(false)
    }, [])

    const captureFrame = useCallback((): string | null => {
        if (!videoRef.current || !canvasRef.current) return null
        const v = videoRef.current
        const c = canvasRef.current
        c.width = v.videoWidth || 320
        c.height = v.videoHeight || 240
        c.getContext("2d")?.drawImage(v, 0, 0)
        return c.toDataURL("image/jpeg", 0.7)
    }, [])

    async function loadImageData(src: string, w: number, h: number): Promise<Uint8ClampedArray> {
        return new Promise((resolve, reject) => {
            const img = new Image()
            img.crossOrigin = "anonymous"
            img.onload = () => {
                const c = document.createElement("canvas")
                c.width = w; c.height = h
                const ctx = c.getContext("2d")!
                ctx.drawImage(img, 0, 0, w, h)
                resolve(ctx.getImageData(0, 0, w, h).data)
            }
            img.onerror = reject
            img.src = src
        })
    }

    function compareHistograms(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
        let diff = 0
        for (let i = 0; i < a.length; i += 4) {
            diff += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])
        }
        return diff / (a.length / 4)
    }

    const autoScan = useCallback(async () => {
        const captured = captureFrame()
        if (!captured) return
        const withPhotos = employees.filter(e => e.photo)
        if (withPhotos.length === 0) return

        try {
            const img1 = await loadImageData(captured, 32, 32)
            let bestMatch: Employee | null = null
            let bestScore = Infinity

            for (const emp of withPhotos) {
                try {
                    const img2 = await loadImageData(emp.photo!, 32, 32)
                    const score = compareHistograms(img1, img2)
                    if (score < bestScore) { bestScore = score; bestMatch = emp }
                } catch { /* skip */ }
            }

            if (bestMatch && bestScore < 8000) {
                stopCamera()
                setMatched(bestMatch)
                loadTodayPunches(bestMatch.id)
                setState("matched")
            }
        } catch { /* skip */ }
    }, [employees, captureFrame, stopCamera])

    useEffect(() => {
        if (!streamActive || state !== "scanning") return
        const interval = setInterval(autoScan, 800)
        return () => clearInterval(interval)
    }, [streamActive, state, autoScan])

    const loadTodayPunches = async (empId: string) => {
        try {
            const res = await fetch("/api/punch", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ employeeId: empId }),
            })
            const data = await res.json()
            setTodayPunches(data.punches ?? [])
        } catch { /* ignore */ }
    }

    const doPunch = async (emp: Employee) => {
        try {
            const res = await fetch("/api/punch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ employeeId: emp.id }),
            })
            const data = await res.json()
            if (!res.ok) {
                setErrorMsg(data.error || "Punch failed")
                setState("error")
            } else {
                setPunchResult({
                    punchType: data.punchType,
                    punchNumber: data.punchNumber,
                    time: format(new Date(data.time), "hh:mm:ss a"),
                    totalWorkingHrs: data.totalWorkingHrs,
                })
                setIsLate(data.isLate || false)
                setState("success")
            }
        } catch {
            setErrorMsg("Network error. Please try again.")
            setState("error")
        }
        scheduleReset()
    }

    const scheduleReset = () => {
        if (resetTimer.current) clearTimeout(resetTimer.current)
        resetTimer.current = setTimeout(resetKiosk, RESET_DELAY)
    }

    const resetKiosk = () => {
        if (resetTimer.current) clearTimeout(resetTimer.current)
        stopCamera()
        setState("idle")
        setMatched(null)
        setPunchResult(null)
        setErrorMsg("")
        setTodayPunches([])
    }

    const selectEmployee = (emp: Employee) => {
        stopCamera()
        setMatched(emp)
        loadTodayPunches(emp.id)
        setState("matched")
    }

    const nextPunchType = todayPunches.length % 2 === 0 ? "IN" : "OUT"

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex flex-col items-center justify-center p-4 select-none">
            {/* Header */}
            <div className="text-center mb-8">
                <p className="text-slate-400 text-sm font-medium tracking-widest uppercase">Attendance Kiosk</p>
                <p className="text-white text-4xl font-bold tabular-nums mt-1">
                    {format(currentTime, "hh:mm:ss a")}
                </p>
                <p className="text-slate-400 text-base mt-1">{format(currentTime, "EEEE, dd MMMM yyyy")}</p>
            </div>

            <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-md overflow-hidden">

                {/* IDLE */}
                {state === "idle" && (
                    <div className="p-8 flex flex-col items-center gap-6">
                        <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center text-5xl">👤</div>
                        <div className="text-center">
                            <p className="text-xl font-bold text-slate-800">Mark Attendance</p>
                            <p className="text-slate-500 text-sm mt-1">Scan your face or search by name</p>
                        </div>
                        <button onClick={startCamera}
                            className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white text-lg font-bold rounded-[14px] transition-all active:scale-95">
                            📷 Scan Face
                        </button>
                        <div className="w-full">
                            <p className="text-xs text-slate-400 text-center mb-3">Or search by name / ID</p>
                            <EmployeeSearch employees={employees} onSelect={selectEmployee} />
                        </div>
                    </div>
                )}

                {/* SCANNING */}
                {state === "scanning" && (
                    <div className="p-6 flex flex-col items-center gap-4">
                        <p className="text-slate-600 text-sm font-medium">Stand in front of the camera...</p>
                        <div className="relative">
                            <video ref={videoRef} autoPlay playsInline muted
                                className="w-64 h-48 rounded-[14px] object-cover bg-black" />
                            <div className="absolute inset-0 rounded-[14px] border-4 border-emerald-400 animate-pulse pointer-events-none" />
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="w-40 h-48 border-2 border-emerald-300 rounded-full opacity-60" />
                            </div>
                        </div>
                        <canvas ref={canvasRef} className="hidden" />
                        <p className="text-emerald-500 text-sm font-semibold animate-pulse">🔍 Scanning face...</p>
                        <button onClick={resetKiosk} className="text-slate-400 text-sm underline">Cancel</button>
                        <div className="w-full border-t pt-3">
                            <p className="text-xs text-slate-400 text-center mb-2">Face not matching? Search by name</p>
                            <EmployeeSearch employees={employees} onSelect={selectEmployee} />
                        </div>
                    </div>
                )}

                {/* MATCHED */}
                {state === "matched" && matched && (
                    <div className="p-8 flex flex-col items-center gap-5">
                        <div className="relative">
                            {matched.photo ? (
                                <img src={matched.photo} alt={matched.firstName}
                                    className="w-24 h-24 rounded-full object-cover border-4 border-emerald-400" />
                            ) : (
                                <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center text-3xl font-bold text-emerald-600 border-4 border-emerald-400">
                                    {matched.firstName[0]}{matched.lastName[0]}
                                </div>
                            )}
                            <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center">
                                <span className="text-white text-xs">✓</span>
                            </div>
                        </div>

                        <div className="text-center">
                            <p className="text-xl font-bold text-slate-800">{matched.firstName} {matched.lastName}</p>
                            <p className="text-slate-500 text-sm">{matched.designation || ""}{matched.department ? ` · ${matched.department.name}` : ""}</p>
                            <p className="text-slate-400 text-xs mt-0.5">ID: {matched.employeeId}</p>
                        </div>

                        {/* Today's punch history */}
                        {todayPunches.length > 0 && (
                            <div className="w-full bg-slate-50 rounded-[12px] p-3">
                                <p className="text-xs font-semibold text-slate-500 mb-2">Today's Punch History</p>
                                <div className="flex flex-wrap gap-2">
                                    {todayPunches.map(p => (
                                        <div key={p.punchNumber}
                                            className={`flex items-center gap-1.5 px-2 py-1 rounded-[8px] text-xs font-semibold ${
                                                p.punchType === "IN"
                                                    ? "bg-emerald-100 text-emerald-700"
                                                    : "bg-red-100 text-red-600"
                                            }`}>
                                            <span>{p.punchType === "IN" ? "🟢" : "🔴"}</span>
                                            <span>#{p.punchNumber} {p.punchType}</span>
                                            <span className="text-slate-500 font-normal">{format(new Date(p.punchTime), "hh:mm a")}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Single PUNCH button */}
                        <button onClick={() => doPunch(matched)}
                            className={`w-full py-5 text-white text-xl font-bold rounded-[14px] transition-all active:scale-95 flex flex-col items-center gap-1 ${
                                nextPunchType === "IN"
                                    ? "bg-emerald-500 hover:bg-emerald-600"
                                    : "bg-red-500 hover:bg-red-600"
                            }`}>
                            <span className="text-3xl">{nextPunchType === "IN" ? "🟢" : "🔴"}</span>
                            <span>PUNCH {nextPunchType}</span>
                            <span className="text-sm font-normal opacity-80">
                                Tap #{todayPunches.length + 1} · {nextPunchType === "IN" ? "Clock In" : "Clock Out"}
                            </span>
                        </button>

                        <button onClick={resetKiosk} className="text-slate-400 text-sm underline">Cancel</button>
                    </div>
                )}

                {/* SUCCESS */}
                {state === "success" && matched && punchResult && (
                    <div className="p-8 flex flex-col items-center gap-4 text-center">
                        <div className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl ${
                            punchResult.punchType === "IN" ? "bg-emerald-100" : "bg-red-100"
                        }`}>
                            {punchResult.punchType === "IN" ? "✅" : "👋"}
                        </div>
                        <div>
                            <p className={`text-2xl font-bold ${punchResult.punchType === "IN" ? "text-emerald-600" : "text-red-500"}`}>
                                {punchResult.punchType === "IN" ? "Punched IN!" : "Punched OUT!"}
                            </p>
                            <p className="text-slate-700 font-semibold mt-1">{matched.firstName} {matched.lastName}</p>
                            <p className="text-slate-500 text-sm mt-1">Time: <strong>{punchResult.time}</strong></p>
                            <p className="text-slate-500 text-sm">Punch #{punchResult.punchNumber}</p>
                            {isLate && punchResult.punchType === "IN" && (
                                <div className="mt-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-[10px] inline-block">
                                    <p className="text-amber-700 font-bold text-sm">⚠️ Late Arrival — After 9:15 AM</p>
                                </div>
                            )}
                            {punchResult.punchType === "OUT" && punchResult.totalWorkingHrs > 0 && (
                                <div className="mt-2 px-4 py-2 bg-blue-50 rounded-[10px] inline-block">
                                    <p className="text-blue-700 font-bold text-base">
                                        ⏱ Total Working: {punchResult.totalWorkingHrs.toFixed(2)} hrs
                                    </p>
                                </div>
                            )}
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
                            <div className="bg-emerald-400 h-1.5 rounded-full"
                                style={{ animation: "shrinkBar 5s linear forwards" }} />
                        </div>
                        <p className="text-slate-400 text-xs">Auto reset in a few seconds...</p>
                        <style>{`@keyframes shrinkBar { from { width: 100% } to { width: 0% } }`}</style>
                    </div>
                )}

                {/* ERROR */}
                {state === "error" && (
                    <div className="p-8 flex flex-col items-center gap-4 text-center">
                        <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center text-4xl">❌</div>
                        <p className="text-xl font-bold text-red-600">Error</p>
                        <p className="text-slate-600 text-sm">{errorMsg}</p>
                        <button onClick={resetKiosk} className="mt-2 px-6 py-3 bg-slate-800 text-white rounded-[12px] font-semibold">
                            Go Back
                        </button>
                    </div>
                )}
            </div>

            <p className="text-slate-600 text-xs mt-6">
                {employees.filter(e => e.photo).length}/{employees.length} employees registered with face photo
            </p>
        </div>
    )
}

function EmployeeSearch({ employees, onSelect }: { employees: Employee[], onSelect: (e: Employee) => void }) {
    const [query, setQuery] = useState("")
    const filtered = query.trim().length >= 1
        ? employees.filter(e =>
            `${e.firstName} ${e.lastName} ${e.employeeId}`.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 5)
        : []

    return (
        <div className="relative">
            <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Type name or ID..."
                className="w-full h-10 border border-slate-200 rounded-[10px] px-3 text-sm outline-none focus:border-emerald-400 transition-colors"
            />
            {filtered.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-[10px] shadow-lg z-10 overflow-hidden">
                    {filtered.map(emp => (
                        <button key={emp.id} onClick={() => { onSelect(emp); setQuery("") }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 text-left transition-colors">
                            {emp.photo ? (
                                <img src={emp.photo} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-600 shrink-0">
                                    {emp.firstName[0]}{emp.lastName[0]}
                                </div>
                            )}
                            <div>
                                <p className="text-sm font-semibold text-slate-800">{emp.firstName} {emp.lastName}</p>
                                <p className="text-xs text-slate-500">{emp.employeeId}{emp.designation ? ` · ${emp.designation}` : ""}</p>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
