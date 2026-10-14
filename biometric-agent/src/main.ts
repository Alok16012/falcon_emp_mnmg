import http from "http"
import { startAutoRegServer, getConnectedDevices, deviceSessions } from "@/lib/dahuaAutoReg"
import { startChannelSyncScheduler, backfillPunches } from "@/lib/channelSync"

const STATUS_PORT = parseInt(process.env.AGENT_STATUS_PORT || "8098")
// On every (re)connect, re-pull this many past days so punches stored on the
// device while the agent/PC/network was down reach the ERP automatically.
const AUTO_BACKFILL_DAYS = parseInt(process.env.AGENT_BACKFILL_DAYS || "3")
const DAY = 86400

const startedAt = new Date()
const backfilledSockets = new WeakSet<object>()
let lastBackfill: { at: string; deviceId: string; totalNew: number; totalScanned: number } | null = null

// Timestamp every log line — the Windows log file is the only diagnostic we have.
for (const level of ["log", "error"] as const) {
    const orig = console[level].bind(console)
    console[level] = (...args: unknown[]) => orig(new Date().toISOString(), ...args)
}

function dayStartEpoch(d: string): number {
    return Math.floor(new Date(d + "T00:00:00Z").getTime() / 1000)
}

async function runBackfill(deviceId: string, fromEpoch: number, toEpoch: number) {
    console.log(`[AGENT] backfill ${deviceId} ${new Date(fromEpoch * 1000).toISOString().slice(0, 10)} → ${new Date((toEpoch - DAY) * 1000).toISOString().slice(0, 10)}`)
    const r = await backfillPunches(deviceId, fromEpoch, toEpoch)
    lastBackfill = { at: new Date().toISOString(), deviceId, totalNew: r.totalNew, totalScanned: r.totalScanned }
    console.log(`[AGENT] backfill done: new=${r.totalNew} scanned=${r.totalScanned}`)
    return r
}

// Watch for newly connected device sessions and backfill each one once.
function startAutoBackfill() {
    setInterval(() => {
        for (const s of deviceSessions.values()) {
            if (!s.socket.writable || backfilledSockets.has(s.socket)) continue
            backfilledSockets.add(s.socket)
            const now = Math.floor(Date.now() / 1000)
            const today = dayStartEpoch(new Date().toISOString().slice(0, 10))
            runBackfill(s.deviceId, today - AUTO_BACKFILL_DAYS * DAY, Math.min(today + DAY, now + DAY))
                .catch(e => console.error("[AGENT] auto backfill failed:", e))
        }
    }, 15_000)
}

// Local status page: http://localhost:8098/  and
// http://localhost:8098/backfill?from=YYYY-MM-DD&to=YYYY-MM-DD
function startStatusServer() {
    http.createServer(async (req, res) => {
        const url = new URL(req.url || "/", "http://localhost")
        const send = (code: number, body: unknown) => {
            res.writeHead(code, { "Content-Type": "application/json" })
            res.end(JSON.stringify(body, null, 2))
        }
        try {
            if (url.pathname === "/backfill") {
                const from = url.searchParams.get("from") || ""
                const to = url.searchParams.get("to") || new Date().toISOString().slice(0, 10)
                if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
                    return send(400, { error: "use ?from=YYYY-MM-DD&to=YYYY-MM-DD" })
                }
                const dev = getConnectedDevices().find(d => d.connected)
                if (!dev) return send(503, { error: "no device connected" })
                return send(200, await runBackfill(dev.deviceId, dayStartEpoch(from), dayStartEpoch(to) + DAY))
            }
            send(200, {
                ok: true,
                startedAt: startedAt.toISOString(),
                devices: getConnectedDevices(),
                lastBackfill,
            })
        } catch (e) {
            send(500, { error: e instanceof Error ? e.message : String(e) })
        }
    }).listen(STATUS_PORT, "127.0.0.1", () => {
        console.log(`[AGENT] status page on http://localhost:${STATUS_PORT}/`)
    })
}

export function main() {
    console.log(`[AGENT] Falcon biometric agent starting (TZ=${process.env.TZ})`)
    // A DB blip inside a socket handler must not kill the process (and with it
    // the device session) — log it and keep serving.
    process.on("unhandledRejection", e => console.error("[AGENT] unhandled rejection:", e))
    startAutoRegServer()
    startChannelSyncScheduler()
    startAutoBackfill()
    startStatusServer()
}
