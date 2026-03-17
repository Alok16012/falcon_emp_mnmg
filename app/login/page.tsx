
"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

export default function LoginPage() {
    const router = useRouter()
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)

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
                // Redirection is handled by middleware but we can also push here safely
                // But since we use redirect: false, we need to handle it client side or reload
                // Actually middleware runs on request, client side navigation might need explicit push
                // Ideally we let effective redirection handle it, but for SPA feel:
                router.refresh()
                // We can also let the middleware redirect logic run on next page load or
                // we can guess the path. Middleware handles protection.
                // Let's just reload or push to root and let middleware intercept.
                window.location.href = "/" // Hard reload to ensure session is picked up
            }
        } catch (err) {
            setError("An unexpected error occurred")
        } finally {
            setLoading(false)
        }
    }

    const handleDemoLogin = async (roleEmail: string) => {
        setLoading(true)
        setError("")
        const demoEmail = roleEmail
        const demoPassword = "demo123"

        try {
            const result = await signIn("credentials", {
                redirect: false,
                email: demoEmail,
                password: demoPassword,
            })

            if (result?.error) {
                setError("Demo login failed")
            } else {
                window.location.href = "/"
            }
        } catch (err) {
            setError("An unexpected error occurred")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="text-2xl text-center">CIMS Login v2</CardTitle>
                    <CardDescription className="text-center">
                        Enter your credentials to access the system
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-4">
                        {error && (
                            <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-md text-center">
                                {error}
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="user@cims.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col space-y-4">
                        <Button className="w-full" type="submit" disabled={loading}>
                            {loading ? "Signing in..." : "Sign In"}
                        </Button>

                        <div className="relative w-full">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-background px-2 text-muted-foreground">Or demo access</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 w-full">
                            <Button variant="outline" size="sm" onClick={() => handleDemoLogin("admin@cims.com")} disabled={loading}>
                                Admin
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleDemoLogin("manager@cims.com")} disabled={loading}>
                                Manager
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleDemoLogin("inspector@cims.com")} disabled={loading}>
                                Inspector
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleDemoLogin("client@cims.com")} disabled={loading}>
                                Client
                            </Button>
                        </div>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}
