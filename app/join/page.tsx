"use client"

import { useState } from "react"
import { CheckCircle2, Upload, Loader2, X } from "lucide-react"

// ── Helpers ──────────────────────────────────────────────────────────────────
// Resize image files to keep the base64 payload small. PDFs pass through as-is.
function fileToDataUrl(file: File, maxDim = 1280, quality = 0.8): Promise<string> {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith("image/")) {
            const r = new FileReader()
            r.onload = () => resolve(String(r.result))
            r.onerror = reject
            r.readAsDataURL(file)
            return
        }
        const reader = new FileReader()
        reader.onload = () => {
            const img = new Image()
            img.onload = () => {
                let { width, height } = img
                if (width > maxDim || height > maxDim) {
                    if (width >= height) { height = Math.round(height * maxDim / width); width = maxDim }
                    else { width = Math.round(width * maxDim / height); height = maxDim }
                }
                const canvas = document.createElement("canvas")
                canvas.width = width; canvas.height = height
                const ctx = canvas.getContext("2d")
                if (!ctx) { resolve(String(reader.result)); return }
                ctx.drawImage(img, 0, 0, width, height)
                resolve(canvas.toDataURL("image/jpeg", quality))
            }
            img.onerror = reject
            img.src = String(reader.result)
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
    })
}

type FileVal = { fileName: string; dataUrl: string }

const ACCENT = "#1e3799"

export default function WorkerJoiningFormPage() {
    const [f, setF] = useState({
        dateOfJoining: "", fullName: "", fathersName: "", dateOfBirth: "",
        gender: "", mobileNumber: "", permanentAddress: "", currentAddress: "",
        aadharNumber: "", panNumber: "", designation: "", departmentSite: "",
        providedEmployeeId: "", wageRate: "",
        emergencyName: "", emergencyRelationship: "", emergencyPhone: "",
        declaration: false, website: "", // website = honeypot
    })
    const [sameAddr, setSameAddr] = useState(false)
    const [photo, setPhoto] = useState<string>("")
    const [aadharDoc, setAadharDoc] = useState<FileVal | null>(null)
    const [panDoc, setPanDoc] = useState<FileVal | null>(null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState("")
    const [done, setDone] = useState<string | null>(null)

    const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
        setF(p => ({ ...p, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }))

    async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]; if (!file) return
        try { setPhoto(await fileToDataUrl(file, 800, 0.85)) }
        catch { setError("Could not read photo. Try another image.") }
    }
    async function onDoc(e: React.ChangeEvent<HTMLInputElement>, setter: (v: FileVal) => void) {
        const file = e.target.files?.[0]; if (!file) return
        try { setter({ fileName: file.name, dataUrl: await fileToDataUrl(file, 1600, 0.8) }) }
        catch { setError("Could not read file. Try again.") }
    }

    async function submit() {
        setError("")
        if (!f.fullName.trim()) { setError("Please enter your full name."); return }
        if (f.mobileNumber.trim().length < 7) { setError("Please enter a valid mobile number."); return }
        if (!f.declaration) { setError("Please accept the declaration to continue."); return }
        setBusy(true)
        try {
            const res = await fetch("/api/join", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...f, photo, aadharDoc, panDoc }),
            })
            const data = await res.json()
            if (!res.ok || !data.ok) throw new Error(data.error || "Submission failed")
            setDone(data.employeeId || "")
        } catch (err) {
            setError(err instanceof Error ? err.message : "Submission failed. Please try again.")
        } finally { setBusy(false) }
    }

    const inputCls = "w-full h-11 rounded-[10px] border border-gray-300 bg-white px-3 text-[15px] outline-none focus:border-[#1e3799] focus:ring-1 focus:ring-[#1e3799] transition"
    const labelCls = "block text-[13px] font-medium text-gray-700 mb-1.5"
    const sectionCls = "text-[15px] font-bold text-[#1e3799] mt-7 mb-3 pb-1.5 border-b-2 border-[#1e3799]/15"

    if (done !== null) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-5">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 max-w-md w-full p-8 text-center">
                    <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 size={36} className="text-green-600" />
                    </div>
                    <h1 className="text-[20px] font-bold text-gray-900">Form Submitted!</h1>
                    <p className="text-[14px] text-gray-600 mt-2">
                        Thank you. Your joining form has been received and is pending verification by the office.
                    </p>
                    {done && <p className="text-[13px] text-gray-500 mt-3">Reference: <span className="font-semibold">{done}</span></p>}
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 py-6 px-4">
            <div className="max-w-2xl mx-auto">
                {/* Brand header */}
                <div className="text-center mb-5">
                    <h2 className="text-[30px] font-extrabold italic tracking-tight" style={{ color: "#111" }}>
                        FALCON<sup className="text-[12px] not-italic">®</sup> <span className="text-[15px] font-bold">plus</span>
                    </h2>
                    <p className="text-[13px] font-semibold tracking-[1px] text-gray-500 uppercase mt-1">Worker Joining Form</p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 sm:p-7">
                    {/* honeypot — hidden from users */}
                    <input type="text" value={f.website} onChange={set("website")} name="website" autoComplete="off" tabIndex={-1}
                        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} aria-hidden="true" />

                    <div>
                        <label className={labelCls}>Date of Joining</label>
                        <input type="date" value={f.dateOfJoining} onChange={set("dateOfJoining")} className={inputCls} />
                    </div>

                    <div className={sectionCls}>Personal Details</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                            <label className={labelCls}>Full Name <span className="text-red-500">*</span></label>
                            <input value={f.fullName} onChange={set("fullName")} className={inputCls} placeholder="As per Aadhaar" />
                        </div>
                        <div className="sm:col-span-2">
                            <label className={labelCls}>Father&apos;s / Husband&apos;s Name</label>
                            <input value={f.fathersName} onChange={set("fathersName")} className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Date of Birth</label>
                            <input type="date" value={f.dateOfBirth} onChange={set("dateOfBirth")} className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Gender</label>
                            <select value={f.gender} onChange={set("gender")} className={inputCls}>
                                <option value="">Select</option>
                                <option value="MALE">Male</option>
                                <option value="FEMALE">Female</option>
                                <option value="OTHER">Other</option>
                            </select>
                        </div>
                        <div className="sm:col-span-2">
                            <label className={labelCls}>Mobile Number <span className="text-red-500">*</span></label>
                            <input type="tel" inputMode="numeric" value={f.mobileNumber} onChange={set("mobileNumber")} className={inputCls} placeholder="10-digit mobile" />
                        </div>
                        <div className="sm:col-span-2">
                            <label className={labelCls}>Permanent Address</label>
                            <textarea
                                value={f.permanentAddress}
                                onChange={e => {
                                    const v = e.target.value
                                    setF(p => ({ ...p, permanentAddress: v, ...(sameAddr ? { currentAddress: v } : {}) }))
                                }}
                                rows={2}
                                className={`${inputCls} h-auto py-2.5 resize-none`}
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="flex items-center gap-2 cursor-pointer select-none mb-1.5">
                                <input
                                    type="checkbox"
                                    checked={sameAddr}
                                    onChange={e => {
                                        const on = e.target.checked
                                        setSameAddr(on)
                                        if (on) setF(p => ({ ...p, currentAddress: p.permanentAddress }))
                                    }}
                                    className="h-4 w-4 accent-[#1e3799]"
                                />
                                <span className="text-[13px] font-medium text-gray-700">Current address same as permanent</span>
                            </label>
                            <label className={labelCls}>Current Address</label>
                            <textarea
                                value={f.currentAddress}
                                onChange={set("currentAddress")}
                                rows={2}
                                disabled={sameAddr}
                                className={`${inputCls} h-auto py-2.5 resize-none ${sameAddr ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
                            />
                        </div>
                    </div>

                    {/* Passport photo */}
                    <div className={sectionCls}>Passport-size Photo</div>
                    <div className="flex items-center gap-4">
                        <div className="w-24 h-28 rounded-[10px] border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                            {photo
                                ? <img src={photo} alt="photo" className="w-full h-full object-cover" />
                                : <span className="text-[11px] text-gray-400 text-center px-2">No photo</span>}
                        </div>
                        <div>
                            <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-white text-[14px] font-semibold cursor-pointer" style={{ background: ACCENT }}>
                                <Upload size={16} /> {photo ? "Change Photo" : "Upload Photo"}
                                <input type="file" accept="image/*" capture="user" onChange={onPhoto} className="hidden" />
                            </label>
                            <p className="text-[11px] text-gray-500 mt-1.5">Clear front-facing photo. JPG/PNG.</p>
                        </div>
                    </div>

                    <div className={sectionCls}>Identification Details</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Aadhaar Number</label>
                            <input value={f.aadharNumber} onChange={set("aadharNumber")} className={inputCls} placeholder="XXXX XXXX XXXX" inputMode="numeric" />
                        </div>
                        <div>
                            <label className={labelCls}>PAN Number (if applicable)</label>
                            <input value={f.panNumber} onChange={set("panNumber")} className={inputCls} placeholder="ABCDE1234F" />
                        </div>
                        <DocUpload label="Upload Aadhaar Card" doc={aadharDoc} onPick={(e) => onDoc(e, setAadharDoc)} onClear={() => setAadharDoc(null)} />
                        <DocUpload label="Upload PAN Card" doc={panDoc} onPick={(e) => onDoc(e, setPanDoc)} onClear={() => setPanDoc(null)} />
                    </div>

                    <div className={sectionCls}>Employment Details</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Designation / Trade</label>
                            <input value={f.designation} onChange={set("designation")} className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Department / Site</label>
                            <input value={f.departmentSite} onChange={set("departmentSite")} className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Employee ID (if assigned)</label>
                            <input value={f.providedEmployeeId} onChange={set("providedEmployeeId")} className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Monthly / Daily Wage Rate</label>
                            <input value={f.wageRate} onChange={set("wageRate")} className={inputCls} placeholder="e.g. 18000" inputMode="numeric" />
                        </div>
                    </div>

                    <div className={sectionCls}>Emergency Contact</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                            <label className={labelCls}>Contact Person Name</label>
                            <input value={f.emergencyName} onChange={set("emergencyName")} className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Relationship</label>
                            <input value={f.emergencyRelationship} onChange={set("emergencyRelationship")} className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Mobile Number</label>
                            <input type="tel" inputMode="numeric" value={f.emergencyPhone} onChange={set("emergencyPhone")} className={inputCls} />
                        </div>
                    </div>

                    {/* Declaration */}
                    <div className={sectionCls}>Declaration</div>
                    <label className="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" checked={f.declaration} onChange={set("declaration")} className="mt-1 w-5 h-5 accent-[#1e3799] shrink-0" />
                        <span className="text-[13px] text-gray-700 leading-relaxed">
                            I hereby declare that the information provided above is true and correct to the best of my
                            knowledge. I agree to abide by the rules and regulations of the company.
                        </span>
                    </label>

                    {error && <p className="mt-4 text-[13px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

                    <button onClick={submit} disabled={busy}
                        className="mt-6 w-full h-12 rounded-[12px] text-white text-[15px] font-bold flex items-center justify-center gap-2 disabled:opacity-60 transition"
                        style={{ background: ACCENT }}>
                        {busy ? <><Loader2 size={18} className="animate-spin" /> Submitting…</> : "Submit Joining Form"}
                    </button>
                    <p className="text-[11px] text-gray-400 text-center mt-3">Your details are sent securely to the Falcon Plus office for verification.</p>
                </div>
                <div className="h-10" />
            </div>
        </div>
    )
}

function DocUpload({ label, doc, onPick, onClear }: {
    label: string; doc: FileVal | null
    onPick: (e: React.ChangeEvent<HTMLInputElement>) => void; onClear: () => void
}) {
    return (
        <div className="sm:col-span-1">
            <label className="block text-[13px] font-medium text-gray-700 mb-1.5">{label}</label>
            {doc ? (
                <div className="flex items-center justify-between gap-2 h-11 px-3 rounded-[10px] border border-green-300 bg-green-50">
                    <span className="text-[12px] text-green-800 truncate">{doc.fileName}</span>
                    <button type="button" onClick={onClear} className="text-green-700 hover:text-green-900 shrink-0"><X size={16} /></button>
                </div>
            ) : (
                <label className="flex items-center gap-2 h-11 px-3 rounded-[10px] border border-dashed border-gray-300 bg-gray-50 cursor-pointer text-[13px] text-gray-600 hover:border-[#1e3799]">
                    <Upload size={15} /> Choose file
                    <input type="file" accept="image/*,application/pdf" capture="environment" onChange={onPick} className="hidden" />
                </label>
            )}
        </div>
    )
}
