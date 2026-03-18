"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { User, Phone, Mail, ShieldCheck, Loader2, CheckCircle2, Save } from "lucide-react"
import { toast } from "sonner"

export default function ProfilePage() {
    const { data: session, update } = useSession()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        role: ""
    })

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await fetch("/api/profile")
                const data = await res.json()
                setFormData({
                    name: data.name || "",
                    email: data.email || "",
                    phone: data.phone || "",
                    role: data.role || ""
                })
            } catch (error) {
                console.error("Failed to fetch profile", error)
            } finally {
                setLoading(false)
            }
        }
        fetchProfile()
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        try {
            const res = await fetch("/api/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: formData.name,
                    phone: formData.phone
                })
            })

            if (res.ok) {
                await update({
                    name: formData.name,
                })
                toast.success("Profile updated successfully!")
            } else {
                toast.error("Failed to update profile.")
            }
        } catch (error) {
            toast.error("An error occurred.")
        } finally {
            setSaving(false)
        }
    }

    const roleBadgeStyles: Record<string, { bg: string; color: string }> = {
        ADMIN: { bg: "#e8f7f1", color: "#0d6b4a" },
        MANAGER: { bg: "#eff6ff", color: "#1d4ed8" },
        INSPECTION_BOY: { bg: "#fef3c7", color: "#92400e" },
    }
    const roleBadge = roleBadgeStyles[formData.role] || { bg: "#f9f8f5", color: "#6b6860" }
    const roleLabel = formData.role.replace("_", " ")

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f5f4f0] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-[#9e9b95]" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#f5f4f0] p-6 lg:p-7">
            <div className="text-center mb-6">
                <h1 className="text-[22px] font-semibold text-[#1a1a18] tracking-[-0.4px]">Account Settings</h1>
                <p className="text-[13px] text-[#9e9b95] mt-1">Manage your professional profile and contact info</p>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="bg-white border border-[#e8e6e1] rounded-[16px] w-[480px] mx-auto p-7 shadow-none">
                    <div className="flex items-center gap-4 mb-5 pb-5 border-b border-[#e8e6e1]">
                        <div className="w-14 h-14 rounded-full bg-[#1a1a18] text-white flex items-center justify-center text-[20px] font-semibold">
                            {formData.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <p className="text-[16px] font-semibold text-[#1a1a18] mb-1">{formData.name}</p>
                            <span
                                className="inline-block rounded-[20px] px-[10px] py-[3px] text-[11px] font-semibold tracking-[0.5px]"
                                style={{ backgroundColor: roleBadge.bg, color: roleBadge.color }}
                            >
                                {roleLabel}
                            </span>
                        </div>
                    </div>

                    <div className="space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="name" className="text-[11.5px] font-medium text-[#9e9b95] uppercase tracking-[0.6px]">Full Name</Label>
                            <div className="relative group">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-[15px] w-[15px] text-[#9e9b95]" />
                                <Input
                                    id="name"
                                    className="pl-9 py-[10px] pr-4 bg-[#f9f8f5] border border-[#e8e6e1] rounded-[9px] text-[13.5px] font-medium text-[#1a1a18] focus:border-[#1a9e6e] focus:bg-white focus:ring-[3px] focus:ring-[rgba(26,158,110,0.08)] focus:outline-none transition-all w-full"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[11.5px] font-medium text-[#9e9b95] uppercase tracking-[0.6px]">
                                Email Address <span className="text-[#9e9b95] font-normal normal-case tracking-normal">(Read-only)</span>
                            </Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-[15px] w-[15px] text-[#9e9b95]" />
                                <Input
                                    className="pl-9 py-[10px] pr-4 bg-[#f5f4f0] border border-dashed border-[#d4d1ca] text-[#9e9b95] cursor-not-allowed w-full"
                                    value={formData.email}
                                    disabled
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="phone" className="text-[11.5px] font-medium text-[#9e9b95] uppercase tracking-[0.6px]">Phone Number</Label>
                            <div className="relative group">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-[15px] w-[15px] text-[#9e9b95]" />
                                <Input
                                    id="phone"
                                    type="tel"
                                    placeholder="+91 00000 00000"
                                    className="pl-9 py-[10px] pr-4 bg-[#f9f8f5] border border-[#e8e6e1] rounded-[9px] text-[13.5px] font-medium text-[#1a1a18] focus:border-[#1a9e6e] focus:bg-white focus:ring-[3px] focus:ring-[rgba(26,158,110,0.08)] focus:outline-none transition-all w-full"
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-[#e8e6e1] mt-6 pt-5">
                        <Button
                            type="submit"
                            className="w-full py-3 bg-[#1a9e6e] hover:bg-[#158a5e] text-white border-none rounded-[10px] text-[13.5px] font-semibold flex items-center justify-center gap-2 transition-colors"
                            disabled={saving}
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="h-[15px] w-[15px] animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="h-[15px] w-[15px]" />
                                    Save Profile
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </form>
        </div>
    )
}
