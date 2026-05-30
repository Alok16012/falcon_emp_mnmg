/**
 * Hardware Cron Endpoint
 * Called by Vercel Cron (every 30 min) OR manually triggered.
 *
 * Vercel config in vercel.json:
 * {
 *   "crons": [{ "path": "/api/hardware/cron", "schedule": "0,30 * * * *" }]
 * }
 *
 * Security: protected by CRON_SECRET env variable.
 * Vercel automatically sends Authorization: Bearer <CRON_SECRET>
 */

import { NextResponse } from "next/server"
import { runHardwareSync } from "@/lib/hardwareScheduler"

export const dynamic = "force-dynamic"
export const maxDuration = 60 // seconds (Vercel Pro allows up to 300)

export async function GET(req: Request) {
    // Verify cron secret (Vercel sends this automatically)
    const authHeader = req.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return new NextResponse("Unauthorized", { status: 401 })
    }

    console.log("[HW_CRON] Vercel cron triggered")

    try {
        const result = await runHardwareSync(1) // last 1 hour
        return NextResponse.json({
            ok: true,
            timestamp: new Date().toISOString(),
            ...result,
        })
    } catch (e) {
        console.error("[HW_CRON] Error:", e)
        return NextResponse.json(
            { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
            { status: 500 }
        )
    }
}
