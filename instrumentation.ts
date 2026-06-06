/**
 * Next.js Instrumentation Hook
 * Runs ONCE on server startup (both dev and production).
 * Used to start the hardware auto-sync background timer.
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
    // Only run in Node.js runtime (not Edge), and only on the server
    if (process.env.NEXT_RUNTIME === "nodejs") {
        const { startHardwareSyncScheduler } = await import("@/lib/hardwareScheduler")
        const { startAutoRegServer } = await import("@/lib/dahuaAutoReg")
        const { startChannelSyncScheduler } = await import("@/lib/channelSync")
        startHardwareSyncScheduler()
        startAutoRegServer()
        // Auto import device users + pull punches every 90s (works via TCP proxy)
        startChannelSyncScheduler()
    }
}
