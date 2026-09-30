"use client"

import { TopNav } from "@/components/TopNav"
import { MobileBottomNav } from "@/components/MobileBottomNav"

// App-style shell (Pushpak design): header on the canvas, content, floating
// pill bottom nav. No sidebar at any width.
export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="flex min-h-screen w-full flex-col bg-[var(--bg)]">
            <TopNav />
            <main className="flex-1 flex flex-col overflow-x-hidden pb-[96px]">
                <div className="flex-1 mx-auto w-full max-w-[1180px] flex flex-col animate-in fade-in duration-150">
                    {children}
                </div>
                <footer className="py-4 text-center text-[12px] text-[var(--text3)]">
                    Developed by <a href="https://blinks-ai.com" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline font-semibold">Blinks AI</a>
                </footer>
            </main>
            <MobileBottomNav />
        </div>
    )
}
