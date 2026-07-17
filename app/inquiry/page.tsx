"use client"

import { useState } from "react"
import { PackageSearch, Loader2, CheckCircle2 } from "lucide-react"

export default function PublicInquiryForm() {
    const [form, setForm] = useState({ partyName: "", name: "", productName: "", quantity: "", rate: "", location: "" })
    const [saving, setSaving] = useState(false)
    const [done, setDone] = useState(false)
    const [error, setError] = useState("")

    function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

    async function submit(e: React.FormEvent) {
        e.preventDefault()
        setError("")
        if (!form.partyName || !form.name || !form.productName || !form.quantity || !form.rate || !form.location) {
            setError("Please fill all fields.")
            return
        }
        setSaving(true)
        try {
            const res = await fetch("/api/public/inquiries", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            })
            if (!res.ok) throw new Error()
            setDone(true)
        } catch {
            setError("Something went wrong. Please try again.")
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="min-h-screen bg-[#f4f5f7] flex items-center justify-center p-4">
            <div className="w-full max-w-lg">
                <div className="rounded-[16px] bg-white shadow-sm border border-gray-200 overflow-hidden">
                    {/* Header */}
                    <div className="bg-[#5b5bd6] px-6 py-5 flex items-center gap-3 text-white">
                        <div className="h-10 w-10 rounded-[10px] bg-white/15 flex items-center justify-center">
                            <PackageSearch size={20} />
                        </div>
                        <div>
                            <h1 className="text-[18px] font-bold leading-tight">Product Inquiry</h1>
                            <p className="text-[12.5px] text-white/80">Fill in the details and we'll get back to you</p>
                        </div>
                    </div>

                    {done ? (
                        <div className="px-6 py-12 text-center">
                            <CheckCircle2 size={48} className="text-[#1a9e6e] mx-auto mb-4" />
                            <h2 className="text-[18px] font-bold text-gray-900 mb-1">Inquiry submitted!</h2>
                            <p className="text-[13.5px] text-gray-500 mb-6">Thank you. Our team will review your inquiry shortly.</p>
                            <button
                                onClick={() => { setForm({ partyName: "", name: "", productName: "", quantity: "", rate: "", location: "" }); setDone(false) }}
                                className="rounded-[8px] bg-[#5b5bd6] px-4 py-2 text-[13px] font-medium text-white hover:opacity-90"
                            >
                                Submit another
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={submit} className="p-6 grid grid-cols-2 gap-4">
                            <Field label="Party Name" className="col-span-2">
                                <Inp value={form.partyName} onChange={v => set("partyName", v)} placeholder="Company / firm name" />
                            </Field>
                            <Field label="Your Name" className="col-span-2">
                                <Inp value={form.name} onChange={v => set("name", v)} placeholder="Contact person" />
                            </Field>
                            <Field label="Product Name" className="col-span-2">
                                <Inp value={form.productName} onChange={v => set("productName", v)} placeholder="What are you looking for?" />
                            </Field>
                            <Field label="Quantity">
                                <Inp type="number" value={form.quantity} onChange={v => set("quantity", v)} placeholder="0" />
                            </Field>
                            <Field label="Expected Rate (₹)">
                                <Inp type="number" value={form.rate} onChange={v => set("rate", v)} placeholder="0" />
                            </Field>
                            <Field label="Location" className="col-span-2">
                                <Inp value={form.location} onChange={v => set("location", v)} placeholder="City / area" />
                            </Field>

                            {error && <p className="col-span-2 text-[13px] text-red-600">{error}</p>}

                            <button
                                type="submit"
                                disabled={saving}
                                className="col-span-2 mt-1 inline-flex items-center justify-center gap-2 rounded-[10px] bg-[#5b5bd6] px-4 py-2.5 text-[14px] font-semibold text-white hover:opacity-90 disabled:opacity-60"
                            >
                                {saving && <Loader2 size={16} className="animate-spin" />}
                                Submit Inquiry
                            </button>
                        </form>
                    )}
                </div>
                <p className="text-center text-[11.5px] text-gray-400 mt-4">Powered by Falcon Plus EMP</p>
            </div>
        </div>
    )
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
    return (
        <div className={className}>
            <label className="mb-1.5 block text-[12.5px] font-medium text-gray-600">{label}</label>
            {children}
        </div>
    )
}

function Inp({ value, onChange, type = "text", placeholder }: { value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
    return (
        <input
            type={type}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-[8px] border border-gray-300 bg-white px-3 py-2 text-[14px] text-gray-900 outline-none focus:border-[#5b5bd6] focus:ring-1 focus:ring-[#5b5bd6]"
        />
    )
}
