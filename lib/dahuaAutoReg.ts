/**
 * Dahua Auto Registration TCP Server
 * Based on CGITestDemo (HttpServer.cs) provided by Dahua
 *
 * Flow (from C# demo):
 * 1. Device connects → sends POST /cgi-bin/api/autoRegist/connect (with DeviceID)
 * 2. Server responds 200 keep-alive
 * 3. Server sends POST /cgi-bin/api/global/login
 * 4. Device returns 401 with Digest challenge
 * 5. Server computes MD5 Digest response, sends auth login
 * 6. Device returns Token
 * 7. Server stores Token, sends heartbeat every 20s
 * 8. All subsequent requests use X-cgi-token header
 */

import net from "net"
import crypto from "crypto"
import prisma from "@/lib/prisma"
import { processHardwareRecord } from "@/app/api/hardware/sync/route"

const AUTO_REG_PORT = parseInt(process.env.DAHUA_AUTO_REG_PORT || "8099")

// Active device sessions: deviceId → { socket, token, ip }
// Stored on globalThis so the TCP server (started from instrumentation.ts) and
// the API route handlers — which Next.js may load as SEPARATE module copies —
// share the SAME Map instance. Without this, /api/hardware/sessions sees 0.
type DeviceSession = {
    socket: net.Socket
    token: string
    ip: string
    deviceId: string
}
const g = globalThis as unknown as {
    __dahuaSessions?: Map<string, DeviceSession>
    __dahuaServer?: net.Server | null
}
export const deviceSessions: Map<string, DeviceSession> =
    g.__dahuaSessions ?? (g.__dahuaSessions = new Map())

// ─── MD5 helper ──────────────────────────────────────────────────────────────
function md5(str: string): string {
    return crypto.createHash("md5").update(str, "latin1").digest("hex")
}

// ─── Parse HTTP over raw TCP ──────────────────────────────────────────────────
function parseHttpMessage(raw: string): { method: string; uri: string; headers: Record<string, string>; body: string } {
    const lines = raw.split("\r\n")
    const firstLine = lines[0] || ""
    const parts = firstLine.split(" ")
    const method = parts[0] || ""
    const uri = parts[1] || ""

    const headers: Record<string, string> = {}
    let bodyStart = -1
    for (let i = 1; i < lines.length; i++) {
        if (lines[i] === "") { bodyStart = i + 1; break }
        const colon = lines[i].indexOf(":")
        if (colon > -1) {
            headers[lines[i].slice(0, colon).trim().toLowerCase()] = lines[i].slice(colon + 1).trim()
        }
    }
    const body = bodyStart > -1 ? lines.slice(bodyStart).join("\r\n") : ""
    return { method, uri, headers, body }
}

// ─── Handle one connected device socket ──────────────────────────────────────
function handleSocket(socket: net.Socket) {
    let deviceId = ""
    let token = ""
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null
    const remoteIp = socket.remoteAddress?.replace("::ffff:", "") || ""

    console.log(`[DAHUA_REG] Device connected from ${remoteIp}`)

    socket.on("data", async (buf) => {
        const msg = buf.toString("latin1")
        console.log(`[DAHUA_REG] Received from ${remoteIp}:\n${msg.slice(0, 300)}`)

        // ── Step 1: Device auto-registration connect ──────────────────────────
        if (msg.includes("/cgi-bin/api/autoRegist/connect")) {
            // Extract DeviceID from JSON body
            const match = msg.match(/"DeviceID"\s*:\s*"([^"]+)"/)
            if (match) deviceId = match[1]

            console.log(`[DAHUA_REG] Auto-register connect from DeviceID: ${deviceId}`)

            // Respond 200 keep-alive
            const resp = "HTTP/1.1 200 OK\r\nConnection: keep-alive\r\nContent-Length: 0\r\n\r\n"
            socket.write(resp, "latin1")

            // Wait 500ms then send login
            setTimeout(() => {
                const loginReq =
                    `POST /cgi-bin/api/global/login HTTP/1.1\r\n` +
                    `Host: ${remoteIp}\r\n` +
                    `Content-Length: 0\r\n` +
                    `Accept-Encoding: gzip, deflate\r\n\r\n`
                socket.write(loginReq, "latin1")
                console.log(`[DAHUA_REG] Sent login request to ${deviceId}`)
            }, 500)
        }

        // ── Step 2: Device returns 401 with Digest challenge ──────────────────
        else if (msg.includes("HTTP/1.1 401 Unauthorized")) {
            // Find matching device credentials from DB
            const device = await prisma.hardwareDevice.findFirst({
                where: { ip: remoteIp, enabled: true }
            })

            const username = device?.username || process.env.DAHUA_REG_USER || "admin"
            const password = device?.password || process.env.DAHUA_REG_PASS || "admin"
            console.log(`[DAHUA_REG][DEBUG] creds → user="${username}" passLen=${password.length} src=${device ? "db" : (process.env.DAHUA_REG_PASS ? "env" : "fallback")}`)

            // Parse digest params
            const nonceM = msg.match(/nonce="([^"]*)"/)
            const realmM = msg.match(/realm="([^"]*)"/)
            const qopM   = msg.match(/qop="([^"]*)"/)
            const opaqueM= msg.match(/opaque="([^"]*)"/)

            const nonce  = nonceM?.[1] || ""
            const realm  = realmM?.[1] || ""
            const qop    = qopM?.[1]   || "auth"
            const opaque = opaqueM?.[1] || ""
            const uri    = "/cgi-bin/api/global/login"
            const nc     = "00000001"
            const cnonce = "004fd20e9f803827de4c39fa3a9fb115"

            const ha1 = md5(`${username}:${realm}:${password}`)
            const ha2 = md5(`POST:${uri}`)
            const response = md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)

            const authReq =
                `POST /cgi-bin/api/global/login HTTP/1.1\r\n` +
                `Authorization: Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", ` +
                `response="${response}", opaque="${opaque}", qop=${qop}, nc=${nc}, cnonce="${cnonce}"\r\n` +
                `Host: ${remoteIp}\r\n` +
                `Content-Length: 0\r\n` +
                `Accept-Encoding: gzip, deflate\r\n\r\n`

            socket.write(authReq, "latin1")
            console.log(`[DAHUA_REG] Sent Digest auth to ${deviceId}`)
            console.log(`[DAHUA_REG][DEBUG] realm="${realm}" nonce="${nonce}" qop="${qop}" response="${response}"`)
        }

        // ── Step 3: Device returns Token ──────────────────────────────────────
        else if (msg.includes('"Token"')) {
            const tokenMatch = msg.match(/"Token"\s*:\s*"([^"]+)"/)
            if (tokenMatch) {
                token = tokenMatch[1]
                console.log(`[DAHUA_REG] ✅ Login success! DeviceID: ${deviceId}, Token: ${token}`)

                // Store session
                deviceSessions.set(deviceId, { socket, token, ip: remoteIp, deviceId })

                // Update DB lastSyncAt
                await prisma.hardwareDevice.updateMany({
                    where: { ip: remoteIp },
                    data: { lastSyncAt: new Date() },
                })

                // Heartbeat every 20 seconds (from C# demo)
                heartbeatTimer = setInterval(() => {
                    if (!socket.writable) { clearInterval(heartbeatTimer!); return }
                    const hb =
                        `POST /cgi-bin/api/global/keep-alive HTTP/1.1\r\n` +
                        `Host: ${remoteIp}\r\n` +
                        `X-cgi-token: ${token}\r\n` +
                        `Content-Length: 0\r\n` +
                        `Accept-Encoding: gzip, deflate\r\n\r\n`
                    socket.write(hb, "latin1")
                }, 20_000)
            }
        }

        // ── Step 4: Handle event push (attendance punch) from device ──────────
        else if (msg.includes("AccessControl") || msg.includes("FaceRecognition") || msg.includes("CardVerification")) {
            try {
                const { body } = parseHttpMessage(msg)
                if (body) {
                    const json = JSON.parse(body)
                    const events = json?.Events || json?.AccessControl ? [json] : []
                    for (const ev of events) {
                        const userId = ev.UserID || ev.EmployeeNo || ev.CardNo || ev?.CardInfo?.CardNo
                        if (userId) {
                            await processHardwareRecord({
                                UserID: String(userId),
                                CardNo: String(ev.CardNo || userId),
                                CardName: ev.UserName || ev.CardName || "",
                                CreateTime: ev.UTC || ev.LocalTime || new Date().toISOString().replace("T", " ").slice(0, 19),
                                RecNo: ev.RecNo || 0,
                                Door: ev.Door || 0,
                                Direction: ev.Direction || 2,
                                Method: ev.Method || 0,
                            })
                        }
                    }
                }
            } catch { /* ignore parse errors */ }

            // Always ACK to device
            const ack = "HTTP/1.1 200 OK\r\nConnection: keep-alive\r\nContent-Length: 0\r\n\r\n"
            socket.write(ack, "latin1")
        }

        // ── Heartbeat ACK ─────────────────────────────────────────────────────
        else if (msg.includes("HTTP/1.1 200 OK")) {
            // Heartbeat acknowledged, do nothing
        }
    })

    socket.on("close", () => {
        console.log(`[DAHUA_REG] Device disconnected: ${deviceId || remoteIp}`)
        if (deviceId) deviceSessions.delete(deviceId)
        if (heartbeatTimer) clearInterval(heartbeatTimer)
    })

    socket.on("error", (err) => {
        console.error(`[DAHUA_REG] Socket error (${deviceId}):`, err.message)
    })
}

// ─── Send request to connected device ────────────────────────────────────────
export async function sendToDevice(deviceId: string, method: string, uri: string, body = ""): Promise<boolean> {
    const session = deviceSessions.get(deviceId)
    if (!session || !session.socket.writable) return false

    const req =
        `${method} ${uri} HTTP/1.1\r\n` +
        `Host: ${session.ip}\r\n` +
        `X-cgi-token: ${session.token}\r\n` +
        `Connection: keep-alive\r\n` +
        `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n` +
        body

    session.socket.write(req, "latin1")
    return true
}

// ─── Start TCP server ─────────────────────────────────────────────────────────
export function startAutoRegServer() {
    if (g.__dahuaServer) return

    const srv = net.createServer(handleSocket)
    g.__dahuaServer = srv

    srv.listen(AUTO_REG_PORT, "0.0.0.0", () => {
        console.log(`[DAHUA_REG] 🔌 Auto-Registration TCP server listening on port ${AUTO_REG_PORT}`)
        console.log(`[DAHUA_REG]    Configure device: Server IP = your_server_ip, Port = ${AUTO_REG_PORT}`)
    })

    srv.on("error", (err) => {
        console.error(`[DAHUA_REG] Server error:`, err.message)
    })
}

export function stopAutoRegServer() {
    if (g.__dahuaServer) {
        g.__dahuaServer.close()
        g.__dahuaServer = null
    }
}

// ─── Get connected devices ────────────────────────────────────────────────────
export function getConnectedDevices() {
    return Array.from(deviceSessions.values()).map(s => ({
        deviceId: s.deviceId,
        ip: s.ip,
        connected: s.socket.writable,
    }))
}
