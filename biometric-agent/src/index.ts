/**
 * Falcon Biometric Agent — entry point.
 *
 * Runs the Dahua auto-registration TCP server (port 8099) + 90s punch sync on
 * the site Windows PC, writing straight to the production database. Replaces
 * the Railway deployment (which kept disappearing).
 *
 * Env must be fixed up BEFORE the app modules load: the Prisma client reads
 * DATABASE_URL when it is constructed, and punch dates are computed in the
 * process time zone (the server always ran in UTC; device records are UTC).
 */

process.env.TZ = "UTC"
for (const k of ["DATABASE_URL", "DIRECT_URL"]) {
    // Vercel-exported values carry a literal trailing "\n" — Prisma rejects it.
    const v = process.env[k]
    if (v) process.env[k] = v.replace(/\\n$/, "").trim()
}
process.env.DIRECT_URL ||= process.env.DATABASE_URL

if (!process.env.DATABASE_URL) {
    console.error("[AGENT] DATABASE_URL missing — create .env next to agent.js (see .env.example)")
    process.exit(1)
}

import("./main").then(m => m.main()).catch(e => {
    console.error("[AGENT] fatal:", e)
    process.exit(1)
})
