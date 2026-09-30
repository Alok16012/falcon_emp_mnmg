"use client"

import { Sidebar } from "@/components/Sidebar"
import { TopNav } from "@/components/TopNav"
import { MobileBottomNav } from "@/components/MobileBottomNav"

// Desktop: ERP layout with the dark-blue sidebar.
// Phone: app-style shell (Pushpak design) — header + floating pill nav, no sidebar.
export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="flex min-h-screen w-full bg-[var(--bg)]">
            <div className="hidden md:block w-60 shrink-0 sticky top-0 h-screen">
                <Sidebar />
            </div>

            <div className="flex flex-col w-full min-w-0">
                <TopNav />
                <main className="flex-1 overflow-x-hidden flex flex-col pb-[96px] md:pb-0">
                    <div className="flex-1 mx-auto w-full flex flex-col gap-0 p-0 lg:gap-8 lg:px-8 lg:pb-8 max-w-7xl animate-in fade-in duration-150">
                        {children}
                    </div>
                    <footer className="py-4 text-center text-[12px] text-[var(--text3)] mt-auto">
                        Developed by <a href="https://blinks-ai.com" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline font-semibold">Blinks AI</a>
                    </footer>
                </main>
            </div>

            <div className="md:hidden">
                <MobileBottomNav />
            </div>
        </div>
    )
}
