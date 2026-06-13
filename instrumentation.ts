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
        const { startAutoRegServer } = await import("@/lib/dahuaAutoReg")
        const { startChannelSyncScheduler } = await import("@/lib/channelSync")
        startAutoRegServer()
        // Auto import device users + pull punches every 90s (works via TCP proxy).
        // NOTE: the legacy hardwareScheduler (direct device-IP fetch) is intentionally
        // NOT started — it cannot reach the device over the cloud proxy and only
        // produced misleading "fetch failed" sync logs. Channel sync replaces it.
        startChannelSyncScheduler()
    }
}
