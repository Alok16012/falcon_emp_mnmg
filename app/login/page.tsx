
"use client"

import { useState, useEffect } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function LoginPage() {
    const router = useRouter()
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)
    const [isRecovering, setIsRecovering] = useState(false)

    useEffect(() => {
        const handleError = (e: ErrorEvent) => {
            if (e.message?.includes("ChunkLoadError") || e.message?.includes("Loading chunk")) {
                console.warn("ChunkLoadError detected, performing emergency reload...")
                setIsRecovering(true)
                window.location.reload()
            }
        }
        window.addEventListener("error", handleError, true)
        return () => window.removeEventListener("error", handleError, true)
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError("")

        try {
            const result = await signIn("credentials", {
                redirect: false,
                email,
                password,
            })

            if (result?.error) {
                setError("Invalid email or password")
            } else {
                router.refresh()
                window.location.href = "/"
            }
        } catch (err) {
            setError("An unexpected error occurred")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-[#ededf9] flex items-center justify-center p-6">
            <div className="bg-white border border-[#e8e6e1] rounded-[16px] w-[420px] max-w-full p-9" style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
                <div className="text-center mb-7">
                    <div className="flex items-center justify-center gap-2.5 mb-4">
                        <div className="w-9 h-9 bg-gradient-to-br from-[#4f7cf6] to-[#5b5bd6] rounded-[10px] flex items-center justify-center">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                                <path d="M4 4h10c3.3 0 6 2.7 6 6s-2.7 6-6 6H9v4H4V4zm5 8h5c1.1 0 2-.9 2-2s-.9-2-2-2H9v4z"/>
                            </svg>
                        </div>
                        <span className="text-[20px] font-bold text-[#1a1a18] tracking-[-0.4px]">Falcon <span className="text-[#8b8be8]">Plus</span></span>
                    </div>
                    <p className="text-[13px] text-[#9e9b95] leading-relaxed">
                        Enter your credentials to access the system
                    </p>
                </div>

                <div className="border-t border-[#e8e6e1] mb-6"></div>

                <form onSubmit={handleSubmit}>
                    {error && (
                        <div className="bg-[#fef2f2] border border-[#fca5a5] rounded-[8px] p-[10px_14px] mb-3 flex items-center gap-2 text-[13px] text-[#dc2626]">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="email" className="text-[13px] font-medium text-[#1a1a18]">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="user@cims.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full py-[10px] px-[14px] bg-[#f9f8f5] border border-[#e8e6e1] rounded-[9px] text-[13px] text-[#1a1a18] placeholder:text-[#9e9b95] focus:border-[#5b5bd6] focus:bg-white focus:ring-[3px] focus:ring-[rgba(91,91,214,0.10)] focus:outline-none transition-all"
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="password" className="text-[13px] font-medium text-[#1a1a18]">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full py-[10px] px-[14px] bg-[#f9f8f5] border border-[#e8e6e1] rounded-[9px] text-[13px] text-[#1a1a18] placeholder:text-[#9e9b95] focus:border-[#5b5bd6] focus:bg-white focus:ring-[3px] focus:ring-[rgba(91,91,214,0.10)] focus:outline-none transition-all"
                                required
                            />
                        </div>
                    </div>

                    <Button
                        type="submit"
                        disabled={loading}
                        className="w-full mt-3 py-[11px] bg-[#5b5bd6] hover:bg-[#4a4ac8] text-white border-none rounded-[9px] text-[14px] font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                    >
                        {loading ? "Signing in..." : "Sign In"}
                    </Button>

                </form>
            </div>

            <div className="absolute bottom-6 text-center text-[13px] text-[#9e9b95]">
                Developed by <a href="https://blinks-ai.com" target="_blank" rel="noopener noreferrer" className="text-[#5b5bd6] hover:underline font-medium">Blinks AI</a>
            </div>
        </div>
    )
}
