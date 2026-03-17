"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { User, Phone, Mail, ShieldCheck, Loader2, CheckCircle2 } from "lucide-react"
import { toast } from "sonner" // Assuming sonner is available or will be handled via default alert if not

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
                // Update next-auth session
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

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        )
    }

    return (
        <div className="max-w-2xl mx-auto py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Account Settings</h1>
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-1">Manage your professional profile and contact info</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <Card className="border-none bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] rounded-[32px] overflow-hidden">
                    <CardHeader className="p-8 pb-0">
                        <div className="flex items-center gap-4">
                            <div className="h-16 w-16 rounded-[24px] bg-slate-900 text-white flex items-center justify-center text-3xl font-black shadow-xl shadow-slate-200">
                                {formData.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <CardTitle className="text-xl font-black text-slate-800">{formData.name}</CardTitle>
                                <CardDescription className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{formData.role.replace("_", " ")}</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                        <div className="grid gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Full Name</Label>
                                <div className="relative group">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
                                    <Input
                                        id="name"
                                        className="pl-11 h-12 rounded-2xl border-slate-100 bg-slate-50/50 font-bold focus:bg-white focus:ring-4 focus:ring-blue-50/50 transition-all"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2 opacity-60">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Email Address (Read-only)</Label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                                    <Input
                                        className="pl-11 h-12 rounded-2xl border-slate-100 bg-slate-50/50 font-bold cursor-not-allowed"
                                        value={formData.email}
                                        disabled
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="phone" className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Phone Number</Label>
                                <div className="relative group">
                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-emerald-500 transition-colors" />
                                    <Input
                                        id="phone"
                                        type="tel"
                                        placeholder="+91 00000 00000"
                                        className="pl-11 h-12 rounded-2xl border-slate-100 bg-slate-50/50 font-bold focus:bg-white focus:ring-4 focus:ring-emerald-50/50 transition-all"
                                        value={formData.phone}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-4">
                            <Button
                                type="submit"
                                className="w-full h-12 rounded-2xl font-black bg-slate-900 hover:bg-slate-800 shadow-xl shadow-slate-200 transition-all hover:scale-[1.01] active:scale-[0.99]"
                                disabled={saving}
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        SAVING CHANGES...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="mr-2 h-4 w-4" />
                                        SAVE PROFILE
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </form>
        </div>
    )
}
