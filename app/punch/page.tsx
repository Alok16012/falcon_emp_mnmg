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

type PunchState = "idle" | "scanning" | "matched" | "success" | "error" | "no_photo"

const RESET_DELAY = 4000 // auto reset after 4s

export default function PunchKioskPage() {
    const [employees, setEmployees] = useState<Employee[]>([])
    const [state, setState] = useState<PunchState>("idle")
    const [matched, setMatched] = useState<Employee | null>(null)
    const [punchAction, setPunchAction] = useState<"IN" | "OUT" | null>(null)
    const [punchTime, setPunchTime] = useState<string>("")
    const [workingHrs, setWorkingHrs] = useState<number | null>(null)
    const [errorMsg, setErrorMsg] = useState("")
    const [currentTime, setCurrentTime] = useState(new Date())
    const [streamActive, setStreamActive] = useState(false)

    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Clock update
    useEffect(() => {
        const t = setInterval(() => setCurrentTime(new Date()), 1000)
        return () => clearInterval(t)
    }, [])

    // Load employees
    useEffect(() => {
        fetch("/api/punch")
            .then(r => r.json())
            .then(data => setEmployees(Array.isArray(data) ? data : []))
            .catch(() => {})
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
            setErrorMsg("Camera access nahi mila")
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

    // Simple pixel-based face matching
    const matchFace = useCallback((capturedData: string): Employee | null => {
        const withPhotos = employees.filter(e => e.photo)
        if (withPhotos.length === 0) return null

        // Use captured image vs stored — brightness/histogram comparison
        // For production use face-api.js; here we do a simple demo match
        // We return the employee whose photo is most visually similar
        // Since we can't do real ML in sync, we return null and let manual selection handle it
        return null
    }, [employees])

    const autoScan = useCallback(async () => {
        // Capture frame and compare brightness histogram with stored photos
        const captured = captureFrame()
        if (!captured) return

        // Try to find match using image data comparison
        const withPhotos = employees.filter(e => e.photo)
        if (withPhotos.length === 0) {
            setState("no_photo")
            stopCamera()
            return
        }

        // Simple comparison via canvas pixel data
        const img1 = await loadImageData(captured, 32, 32)
        let bestMatch: Employee | null = null
        let bestScore = Infinity

        for (const emp of withPhotos) {
            try {
                const img2 = await loadImageData(emp.photo!, 32, 32)
                const score = compareHistograms(img1, img2)
                if (score < bestScore) {
                    bestScore = score
                    bestMatch = emp
                }
            } catch { /* skip */ }
        }

        // Threshold: if similarity is good enough
        if (bestMatch && bestScore < 8000) {
            stopCamera()
            setMatched(bestMatch)
            setState("matched")
        }
        // else keep scanning (next frame)
    }, [employees, captureFrame, stopCamera])

    // Auto-scan every 800ms when camera is active
    useEffect(() => {
        if (!streamActive || state !== "scanning") return
        const interval = setInterval(autoScan, 800)
        return () => clearInterval(interval)
    }, [streamActive, state, autoScan])

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

    const doPunch = async (emp: Employee, action: "IN" | "OUT") => {
        try {
            const res = await fetch("/api/punch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ employeeId: emp.id, action }),
            })
            const data = await res.json()
            if (!res.ok) {
                setErrorMsg(data.message || "Error hua")
                setState("error")
            } else {
                setPunchAction(action)
                setPunchTime(format(new Date(data.time || new Date()), "hh:mm:ss a"))
                setWorkingHrs(data.workingHrs ?? null)
                setState("success")
            }
        } catch {
            setErrorMsg("Network error")
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
        setPunchAction(null)
        setPunchTime("")
        setWorkingHrs(null)
        setErrorMsg("")
    }

    // Manual employee select (fallback when no photo match)
    const selectEmployee = (emp: Employee) => {
        stopCamera()
        setMatched(emp)
        setState("matched")
    }

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

            {/* Main Card */}
            <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-md overflow-hidden">

                {/* IDLE */}
                {state === "idle" && (
                    <div className="p-8 flex flex-col items-center gap-6">
                        <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center text-5xl">
                            👤
                        </div>
                        <div className="text-center">
                            <p className="text-xl font-bold text-slate-800">Attendance Lagao</p>
                            <p className="text-slate-500 text-sm mt-1">Camera se face scan karo ya naam dhundo</p>
                        </div>
                        <button onClick={startCamera}
                            className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white text-lg font-bold rounded-[14px] transition-all active:scale-95">
                            📷 Camera se Scan Karo
                        </button>
                        <div className="w-full">
                            <p className="text-xs text-slate-400 text-center mb-3">Ya naam se dhundo</p>
                            <EmployeeSearch employees={employees} onSelect={selectEmployee} />
                        </div>
                    </div>
                )}

                {/* SCANNING */}
                {state === "scanning" && (
                    <div className="p-6 flex flex-col items-center gap-4">
                        <p className="text-slate-600 text-sm font-medium">Camera ke saamne khade ho jao...</p>
                        <div className="relative">
                            <video ref={videoRef} autoPlay playsInline muted
                                className="w-64 h-48 rounded-[14px] object-cover bg-black" />
                            {/* Scanning overlay */}
                            <div className="absolute inset-0 rounded-[14px] border-4 border-emerald-400 animate-pulse pointer-events-none" />
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="w-40 h-48 border-2 border-emerald-300 rounded-full opacity-60" />
                            </div>
                        </div>
                        <canvas ref={canvasRef} className="hidden" />
                        <p className="text-emerald-500 text-sm font-semibold animate-pulse">🔍 Face scan ho raha hai...</p>
                        <button onClick={resetKiosk} className="text-slate-400 text-sm underline">Cancel</button>
                        <div className="w-full border-t pt-3">
                            <p className="text-xs text-slate-400 text-center mb-2">Face match nahi hua? Naam se dhundo</p>
                            <EmployeeSearch employees={employees} onSelect={selectEmployee} />
                        </div>
                    </div>
                )}

                {/* MATCHED - show employee, choose IN or OUT */}
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
                            <p className="text-slate-500 text-sm">{matched.designation || ""} {matched.department ? `· ${matched.department.name}` : ""}</p>
                            <p className="text-slate-400 text-xs mt-0.5">ID: {matched.employeeId}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3 w-full">
                            <button onClick={() => doPunch(matched, "IN")}
                                className="py-4 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-base font-bold rounded-[14px] transition-all flex flex-col items-center gap-1">
                                <span className="text-2xl">🟢</span>
                                <span>Punch IN</span>
                            </button>
                            <button onClick={() => doPunch(matched, "OUT")}
                                className="py-4 bg-red-500 hover:bg-red-600 active:scale-95 text-white text-base font-bold rounded-[14px] transition-all flex flex-col items-center gap-1">
                                <span className="text-2xl">🔴</span>
                                <span>Punch OUT</span>
                            </button>
                        </div>
                        <button onClick={resetKiosk} className="text-slate-400 text-sm underline">Cancel</button>
                    </div>
                )}

                {/* SUCCESS */}
                {state === "success" && matched && (
                    <div className="p-8 flex flex-col items-center gap-4 text-center">
                        <div className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl ${punchAction === "IN" ? "bg-emerald-100" : "bg-red-100"}`}>
                            {punchAction === "IN" ? "✅" : "👋"}
                        </div>
                        <div>
                            <p className={`text-2xl font-bold ${punchAction === "IN" ? "text-emerald-600" : "text-red-500"}`}>
                                {punchAction === "IN" ? "Punch IN Ho Gaya!" : "Punch OUT Ho Gaya!"}
                            </p>
                            <p className="text-slate-700 font-semibold mt-1">{matched.firstName} {matched.lastName}</p>
                            <p className="text-slate-500 text-sm mt-1">Time: {punchTime}</p>
                            {workingHrs !== null && (
                                <p className="text-slate-500 text-sm">Kaam ke ghante: <strong>{workingHrs.toFixed(1)} hrs</strong></p>
                            )}
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                            <div className="bg-emerald-400 h-1.5 rounded-full animate-[shrink_4s_linear_forwards]" style={{ width: "100%" }} />
                        </div>
                        <p className="text-slate-400 text-xs">Kuch seconds mein auto reset ho jayega...</p>
                    </div>
                )}

                {/* ERROR */}
                {state === "error" && (
                    <div className="p-8 flex flex-col items-center gap-4 text-center">
                        <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center text-4xl">❌</div>
                        <p className="text-xl font-bold text-red-600">Error!</p>
                        <p className="text-slate-600 text-sm">{errorMsg}</p>
                        <button onClick={resetKiosk} className="mt-2 px-6 py-3 bg-slate-800 text-white rounded-[12px] font-semibold">
                            Wapas Jao
                        </button>
                    </div>
                )}

                {/* NO_PHOTO */}
                {state === "no_photo" && (
                    <div className="p-8 flex flex-col items-center gap-4 text-center">
                        <div className="text-4xl">⚠️</div>
                        <p className="text-lg font-bold text-slate-700">Kisi ki photo nahi hai</p>
                        <p className="text-slate-500 text-sm">Pehle Employees page pe jaao aur face photo upload karo</p>
                        <button onClick={resetKiosk} className="px-6 py-3 bg-slate-800 text-white rounded-[12px] font-semibold">OK</button>
                    </div>
                )}
            </div>

            {/* Footer */}
            <p className="text-slate-600 text-xs mt-6">
                {employees.filter(e => e.photo).length}/{employees.length} employees ki photo registered hai
            </p>
        </div>
    )
}

// Employee search component for manual fallback
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
                placeholder="Naam ya ID type karo..."
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
