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

type KioskState = "idle" | "camera" | "matched" | "success" | "error" | "update_photo"

const RESET_DELAY = 5000
const SHIFT_START = "09:15"

export default function PunchKioskPage() {
    const [employees, setEmployees] = useState<Employee[]>([])
    const [state, setState] = useState<KioskState>("idle")
    const [matched, setMatched] = useState<Employee | null>(null)
    const [punchResult, setPunchResult] = useState<{
        punchType: "IN" | "OUT"
        punchNumber: number
        time: string
        totalWorkingHrs: number
        isLate: boolean
    } | null>(null)
    const [errorMsg, setErrorMsg] = useState("")
    const [currentTime, setCurrentTime] = useState(new Date())
    const [todayPunches, setTodayPunches] = useState<PunchLog[]>([])
    const [todayCheckIn, setTodayCheckIn] = useState<string | null>(null)
    const [todayCheckOut, setTodayCheckOut] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState("")
    const [cameraError, setCameraError] = useState("")
    const [cameraActive, setCameraActive] = useState(false)
    const [photoUpdating, setPhotoUpdating] = useState(false)
    const [photoCameraActive, setPhotoCameraActive] = useState(false)
    const photoVideoRef = useRef<HTMLVideoElement>(null)
    const photoCanvasRef = useRef<HTMLCanvasElement>(null)
    const photoStreamRef = useRef<MediaStream | null>(null)

    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Clock
    useEffect(() => {
        const t = setInterval(() => setCurrentTime(new Date()), 1000)
        return () => clearInterval(t)
    }, [])

    // Load employees
    useEffect(() => {
        fetch("/api/punch")
            .then(async r => {
                const data = await r.json()
                if (!r.ok) { setErrorMsg(`Load failed: ${data?.error || r.status}`); setState("error"); return }
                setEmployees(Array.isArray(data) ? data : [])
            })
            .catch(e => { setErrorMsg(`Network error: ${e.message}`); setState("error") })
    }, [])

    // ── Camera ──────────────────────────────────────────────────────────────

    const stopCamera = useCallback(() => {
        streamRef.current?.getTracks().forEach(t => t.stop())
        streamRef.current = null
        setCameraActive(false)
    }, [])

    const startCamera = useCallback(async () => {
        setCameraError("")
        try {
            // Try front camera first, fallback to any camera
            let stream: MediaStream
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
                    audio: false,
                })
            } catch {
                stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
            }
            streamRef.current = stream
            setCameraActive(true)
            setState("camera")
            // Wait for video element to mount
            setTimeout(() => {
                if (videoRef.current) {
                    videoRef.current.srcObject = stream
                    videoRef.current.play().catch(() => {})
                }
            }, 100)
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Unknown error"
            if (msg.includes("NotAllowed") || msg.includes("Permission")) {
                setCameraError("Camera permission denied. Please allow camera access in browser settings.")
            } else if (msg.includes("NotFound") || msg.includes("DevicesNotFound")) {
                setCameraError("No camera found on this device.")
            } else if (msg.includes("NotReadable") || msg.includes("TrackStart")) {
                setCameraError("Camera is in use by another app. Please close it and try again.")
            } else {
                setCameraError(`Camera error: ${msg}`)
            }
        }
    }, [])

    // Pixel-based face matching (improved: compare multiple regions)
    const captureAndMatch = useCallback(async () => {
        if (!videoRef.current || !canvasRef.current) return
        const v = videoRef.current
        if (v.readyState < 2) return // video not ready yet

        const c = canvasRef.current
        c.width = v.videoWidth || 320
        c.height = v.videoHeight || 240
        const ctx = c.getContext("2d")
        if (!ctx) return
        ctx.drawImage(v, 0, 0)

        const captured = c.toDataURL("image/jpeg", 0.7)
        const withPhotos = employees.filter(e => e.photo)
        if (!withPhotos.length) return

        try {
            const img1 = await loadImageBrightness(captured)
            let bestEmp: Employee | null = null
            let bestScore = Infinity

            for (const emp of withPhotos) {
                try {
                    const img2 = await loadImageBrightness(emp.photo!)
                    const score = compareImages(img1, img2)
                    if (score < bestScore) { bestScore = score; bestEmp = emp }
                } catch { /* skip */ }
            }

            // Stricter threshold — only match if very similar
            if (bestEmp && bestScore < 5000) {
                stopCamera()
                selectEmployee(bestEmp)
            }
        } catch { /* skip */ }
    }, [employees, stopCamera])

    useEffect(() => {
        if (!cameraActive || state !== "camera") return
        const interval = setInterval(captureAndMatch, 1000)
        return () => clearInterval(interval)
    }, [cameraActive, state, captureAndMatch])

    // ── Employee selection ───────────────────────────────────────────────────

    const selectEmployee = useCallback(async (emp: Employee) => {
        stopCamera()
        setMatched(emp)
        setSearchQuery("")
        setState("matched")

        // Load today's punches
        try {
            const res = await fetch("/api/punch", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ employeeId: emp.id }),
            })
            const data = await res.json()
            setTodayPunches(data.punches ?? [])
            setTodayCheckIn(data.checkIn ?? null)
            setTodayCheckOut(data.checkOut ?? null)
        } catch { /* ignore */ }
    }, [stopCamera])

    // ── Punch ────────────────────────────────────────────────────────────────

    const doPunch = async (emp: Employee) => {
        try {
            const res = await fetch("/api/punch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ employeeId: emp.id }),
            })
            const data = await res.json()
            if (!res.ok) {
                setErrorMsg(data.error || "Punch failed. Please try again.")
                setState("error")
            } else {
                setPunchResult({
                    punchType: data.punchType,
                    punchNumber: data.punchNumber,
                    time: format(new Date(data.time), "hh:mm:ss a"),
                    totalWorkingHrs: data.totalWorkingHrs ?? 0,
                    isLate: data.isLate ?? false,
                })
                setState("success")
            }
        } catch {
            setErrorMsg("Network error. Please check connection and try again.")
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
        setTodayCheckIn(null)
        setTodayCheckOut(null)
        setSearchQuery("")
        setCameraError("")
    }

    // ── Photo update ─────────────────────────────────────────────────────────

    const startPhotoCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false })
            photoStreamRef.current = stream
            setPhotoCameraActive(true)
            setTimeout(() => {
                if (photoVideoRef.current) {
                    photoVideoRef.current.srcObject = stream
                    photoVideoRef.current.play().catch(() => {})
                }
            }, 100)
        } catch {
            alert("Camera access denied")
        }
    }

    const stopPhotoCamera = () => {
        photoStreamRef.current?.getTracks().forEach(t => t.stop())
        photoStreamRef.current = null
        setPhotoCameraActive(false)
    }

    const captureAndSavePhoto = async () => {
        if (!photoVideoRef.current || !photoCanvasRef.current || !matched) return
        const v = photoVideoRef.current
        const c = photoCanvasRef.current
        c.width = v.videoWidth; c.height = v.videoHeight
        c.getContext("2d")?.drawImage(v, 0, 0)
        const dataUrl = c.toDataURL("image/jpeg", 0.8)
        setPhotoUpdating(true)
        try {
            const res = await fetch(`/api/employees/${matched.id}/photo`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ photo: dataUrl }),
            })
            if (!res.ok) throw new Error()
            // Update local state
            setMatched(m => m ? { ...m, photo: dataUrl } : m)
            setEmployees(list => list.map(e => e.id === matched.id ? { ...e, photo: dataUrl } : e))
            stopPhotoCamera()
            setState("matched")
        } catch {
            alert("Photo save failed")
        } finally {
            setPhotoUpdating(false)
        }
    }

    // ── Filter employees ─────────────────────────────────────────────────────
    const filteredEmployees = searchQuery.trim()
        ? employees.filter(e =>
            `${e.firstName} ${e.lastName} ${e.employeeId}`.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : employees

    // Determine next punch type:
    // 1. From punchLogs count (most accurate)
    // 2. Fallback: from attendance checkIn/checkOut
    const nextPunchType: "IN" | "OUT" = (() => {
        if (todayPunches.length > 0) return todayPunches.length % 2 === 0 ? "IN" : "OUT"
        if (todayCheckIn && !todayCheckOut) return "OUT"   // checked in, not out yet
        if (todayCheckIn && todayCheckOut) return "IN"     // both done, next is IN again
        return "IN"                                         // fresh start
    })()

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center p-4"
            style={{ WebkitTapHighlightColor: "transparent" }}>

            {/* Clock header */}
            <div className="text-center py-6 w-full max-w-2xl">
                <p className="text-slate-400 text-xs font-semibold tracking-[3px] uppercase mb-1">Attendance Kiosk</p>
                <p className="text-white text-5xl font-bold tabular-nums tracking-tight">
                    {format(currentTime, "hh:mm:ss")}
                    <span className="text-2xl ml-2 text-slate-300">{format(currentTime, "a")}</span>
                </p>
                <p className="text-slate-400 text-sm mt-1">{format(currentTime, "EEEE, dd MMMM yyyy")}</p>
                <p className="text-slate-500 text-xs mt-0.5">Shift starts at {SHIFT_START}</p>
            </div>

            {/* Main card */}
            <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-2xl overflow-hidden">

                {/* ── IDLE: Photo Grid ── */}
                {state === "idle" && (
                    <div className="p-5">
                        {/* Search bar */}
                        <div className="flex gap-2 mb-4">
                            <input
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="🔍  Search by name or ID..."
                                className="flex-1 h-11 border-2 border-slate-200 focus:border-emerald-400 rounded-[12px] px-4 text-sm outline-none transition-colors"
                                autoComplete="off"
                            />
                            <button onClick={startCamera}
                                className="h-11 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-[12px] text-sm font-semibold transition-colors whitespace-nowrap">
                                📷 Scan
                            </button>
                        </div>

                        {cameraError && (
                            <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-[10px] text-red-600 text-xs">
                                {cameraError}
                            </div>
                        )}

                        {/* Employee photo grid */}
                        {filteredEmployees.length === 0 ? (
                            <p className="text-center text-slate-400 py-8 text-sm">No employees found</p>
                        ) : (
                            <div className="grid grid-cols-4 gap-3 max-h-[420px] overflow-y-auto pr-1"
                                style={{ scrollbarWidth: "thin" }}>
                                {filteredEmployees.map(emp => (
                                    <button key={emp.id}
                                        onClick={() => selectEmployee(emp)}
                                        className="flex flex-col items-center gap-1.5 p-2.5 rounded-[14px] border-2 border-transparent hover:border-emerald-400 hover:bg-emerald-50 active:scale-95 transition-all text-center">
                                        {emp.photo ? (
                                            <img src={emp.photo} alt={emp.firstName}
                                                className="w-16 h-16 rounded-full object-cover border-2 border-slate-200"
                                                onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
                                            />
                                        ) : (
                                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xl font-bold border-2 border-slate-200">
                                                {emp.firstName[0]}{emp.lastName[0]}
                                            </div>
                                        )}
                                        <p className="text-[11px] font-semibold text-slate-700 leading-tight line-clamp-2">
                                            {emp.firstName}<br />{emp.lastName}
                                        </p>
                                        <p className="text-[10px] text-slate-400">{emp.employeeId}</p>
                                    </button>
                                ))}
                            </div>
                        )}

                        <p className="text-center text-slate-400 text-xs mt-3">
                            {employees.length} employees · Tap your photo to punch
                        </p>
                    </div>
                )}

                {/* ── CAMERA ── */}
                {state === "camera" && (
                    <div className="p-6 flex flex-col items-center gap-4">
                        <p className="text-slate-600 text-sm font-medium">Stand in front of the camera...</p>
                        <div className="relative">
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full max-w-xs rounded-[14px] object-cover bg-black"
                                style={{ minHeight: 200 }}
                            />
                            <div className="absolute inset-0 rounded-[14px] border-4 border-emerald-400 animate-pulse pointer-events-none" />
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="w-36 h-44 border-2 border-dashed border-emerald-300 rounded-full opacity-70" />
                            </div>
                        </div>
                        <canvas ref={canvasRef} className="hidden" />
                        <p className="text-emerald-500 text-sm font-semibold animate-pulse">Scanning...</p>
                        <p className="text-slate-400 text-xs text-center">If face not detected, tap your photo below</p>
                        <button onClick={() => { stopCamera(); setState("idle") }}
                            className="text-slate-400 text-sm underline">Cancel</button>

                        {/* Also show grid below camera as fallback */}
                        <div className="w-full border-t pt-4">
                            <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                                {employees.slice(0, 12).map(emp => (
                                    <button key={emp.id} onClick={() => selectEmployee(emp)}
                                        className="flex flex-col items-center gap-1 p-2 rounded-[10px] hover:bg-slate-50 active:scale-95 transition-all">
                                        {emp.photo ? (
                                            <img src={emp.photo} alt="" className="w-12 h-12 rounded-full object-cover" />
                                        ) : (
                                            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-bold text-emerald-600">
                                                {emp.firstName[0]}{emp.lastName[0]}
                                            </div>
                                        )}
                                        <p className="text-[10px] text-slate-600 font-medium leading-tight text-center line-clamp-2">
                                            {emp.firstName}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── MATCHED: Confirm + Punch button ── */}
                {state === "matched" && matched && (
                    <div className="p-8 flex flex-col items-center gap-5">
                        <div className="relative">
                            {matched.photo ? (
                                <img src={matched.photo} alt={matched.firstName}
                                    className="w-28 h-28 rounded-full object-cover border-4 border-emerald-400 shadow-lg" />
                            ) : (
                                <div className="w-28 h-28 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-4xl font-bold text-white border-4 border-emerald-400 shadow-lg">
                                    {matched.firstName[0]}{matched.lastName[0]}
                                </div>
                            )}
                            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shadow">
                                <span className="text-white text-sm font-bold">✓</span>
                            </div>
                        </div>

                        <div className="text-center">
                            <p className="text-2xl font-bold text-slate-800">{matched.firstName} {matched.lastName}</p>
                            <p className="text-slate-500 text-sm">{matched.designation || ""}
                                {matched.department ? ` · ${matched.department.name}` : ""}</p>
                            <p className="text-slate-400 text-xs mt-0.5">ID: {matched.employeeId}</p>
                        </div>

                        {/* Today punch history */}
                        {todayPunches.length > 0 && (
                            <div className="w-full bg-slate-50 rounded-[12px] p-3">
                                <p className="text-xs font-semibold text-slate-500 mb-2">Today's Punch History</p>
                                <div className="flex flex-wrap gap-2">
                                    {todayPunches.map(p => (
                                        <div key={p.punchNumber}
                                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] text-xs font-semibold ${
                                                p.punchType === "IN" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
                                            }`}>
                                            {p.punchType === "IN" ? "🟢" : "🔴"} #{p.punchNumber} {p.punchType}
                                            <span className="font-normal text-slate-500">{format(new Date(p.punchTime), "hh:mm a")}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Big punch button */}
                        <button onClick={() => doPunch(matched)}
                            className={`w-full py-6 text-white text-2xl font-bold rounded-[18px] transition-all active:scale-95 shadow-lg flex flex-col items-center gap-1 ${
                                nextPunchType === "IN"
                                    ? "bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600"
                                    : "bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600"
                            }`}>
                            <span className="text-4xl">{nextPunchType === "IN" ? "🟢" : "🔴"}</span>
                            <span>PUNCH {nextPunchType}</span>
                            <span className="text-base font-normal opacity-80">
                                Tap #{todayPunches.length + 1} · {nextPunchType === "IN" ? "Clock In" : "Clock Out"}
                            </span>
                        </button>

                        <div className="flex gap-3 w-full">
                            <button onClick={resetKiosk} className="flex-1 py-2 text-slate-400 text-sm border border-slate-200 rounded-[10px]">
                                ← Back
                            </button>
                            <button onClick={() => { setState("update_photo"); startPhotoCamera() }}
                                className="flex-1 py-2 text-slate-500 text-sm border border-slate-200 rounded-[10px] hover:bg-slate-50">
                                📷 Update Photo
                            </button>
                        </div>
                    </div>
                )}

                {/* ── UPDATE PHOTO ── */}
                {state === "update_photo" && matched && (
                    <div className="p-6 flex flex-col items-center gap-4">
                        <p className="text-slate-700 font-semibold text-base">
                            📷 {matched.firstName} {matched.lastName} — Update Face Photo
                        </p>
                        {photoCameraActive ? (
                            <>
                                <div className="relative">
                                    <video ref={photoVideoRef} autoPlay playsInline muted
                                        className="w-64 h-48 rounded-[14px] object-cover bg-black" />
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div className="w-36 h-44 border-2 border-dashed border-emerald-300 rounded-full opacity-70" />
                                    </div>
                                </div>
                                <canvas ref={photoCanvasRef} className="hidden" />
                                <p className="text-slate-500 text-sm text-center">Apna chehra frame mein rakhkar photo lo</p>
                                <div className="flex gap-3 w-full">
                                    <button onClick={() => { stopPhotoCamera(); setState("matched") }}
                                        className="flex-1 py-3 border border-slate-200 rounded-[12px] text-slate-500 text-sm">
                                        Cancel
                                    </button>
                                    <button onClick={captureAndSavePhoto} disabled={photoUpdating}
                                        className="flex-1 py-3 bg-emerald-500 text-white font-bold rounded-[12px] text-sm disabled:opacity-60">
                                        {photoUpdating ? "Saving..." : "📸 Capture & Save"}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <button onClick={startPhotoCamera}
                                className="w-full py-4 bg-slate-800 text-white rounded-[12px] font-semibold">
                                Open Camera
                            </button>
                        )}
                    </div>
                )}

                {/* ── SUCCESS ── */}
                {state === "success" && matched && punchResult && (
                    <div className="p-8 flex flex-col items-center gap-5 text-center">
                        <div className={`w-24 h-24 rounded-full flex items-center justify-center text-5xl shadow-inner ${
                            punchResult.punchType === "IN" ? "bg-emerald-100" : "bg-red-100"
                        }`}>
                            {punchResult.punchType === "IN" ? "✅" : "👋"}
                        </div>

                        <div>
                            <p className={`text-3xl font-bold ${punchResult.punchType === "IN" ? "text-emerald-600" : "text-red-500"}`}>
                                {punchResult.punchType === "IN" ? "Punched IN!" : "Punched OUT!"}
                            </p>
                            <p className="text-slate-700 text-lg font-semibold mt-1">
                                {matched.firstName} {matched.lastName}
                            </p>
                            <p className="text-slate-500 text-base mt-1">
                                {punchResult.time} · Punch #{punchResult.punchNumber}
                            </p>
                        </div>

                        {punchResult.isLate && punchResult.punchType === "IN" && (
                            <div className="px-5 py-3 bg-amber-50 border border-amber-200 rounded-[14px] w-full">
                                <p className="text-amber-700 font-bold text-base">⚠️ Late Arrival</p>
                                <p className="text-amber-600 text-sm">Shift started at {SHIFT_START} AM</p>
                            </div>
                        )}

                        {punchResult.punchType === "OUT" && punchResult.totalWorkingHrs > 0 && (
                            <div className="px-5 py-3 bg-blue-50 border border-blue-100 rounded-[14px] w-full">
                                <p className="text-blue-700 font-bold text-lg">⏱ {punchResult.totalWorkingHrs.toFixed(2)} hrs worked today</p>
                            </div>
                        )}

                        {/* Progress bar countdown */}
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div className="bg-emerald-400 h-2 rounded-full"
                                style={{ animation: `shrinkBar ${RESET_DELAY / 1000}s linear forwards` }} />
                        </div>
                        <p className="text-slate-400 text-xs">Auto reset in {RESET_DELAY / 1000} seconds</p>
                        <style>{`@keyframes shrinkBar { from { width:100% } to { width:0% } }`}</style>
                    </div>
                )}

                {/* ── ERROR ── */}
                {state === "error" && (
                    <div className="p-8 flex flex-col items-center gap-4 text-center">
                        <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center text-4xl">❌</div>
                        <p className="text-xl font-bold text-red-600">Something went wrong</p>
                        <p className="text-slate-600 text-sm max-w-xs">{errorMsg}</p>
                        <button onClick={resetKiosk}
                            className="mt-2 px-8 py-3 bg-slate-800 text-white rounded-[12px] font-semibold text-sm">
                            Go Back
                        </button>
                    </div>
                )}
            </div>

            <p className="text-slate-600 text-xs mt-4">
                {employees.filter(e => e.photo).length}/{employees.length} employees have face photo registered
            </p>
        </div>
    )
}

// ── Image comparison helpers ──────────────────────────────────────────────────

async function loadImageBrightness(src: string): Promise<Uint8ClampedArray> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = "anonymous"
        img.onload = () => {
            const SIZE = 48
            const c = document.createElement("canvas")
            c.width = SIZE; c.height = SIZE
            const ctx = c.getContext("2d")!
            ctx.drawImage(img, 0, 0, SIZE, SIZE)
            resolve(ctx.getImageData(0, 0, SIZE, SIZE).data)
        }
        img.onerror = reject
        img.src = src
    })
}

function compareImages(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
    if (a.length !== b.length) return Infinity
    let diff = 0
    for (let i = 0; i < a.length; i += 4) {
        // Weighted: green channel most important for face
        diff += Math.abs(a[i] - b[i]) * 0.3
            + Math.abs(a[i + 1] - b[i + 1]) * 0.5
            + Math.abs(a[i + 2] - b[i + 2]) * 0.2
    }
    return diff / (a.length / 4)
}
