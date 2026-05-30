/**
 * Dahua Hardware Event Webhook (Section 4.18/4.19 — Auto Upload)
 * Device pushes events to: POST /api/hardware/event
 *
 * Device configuration:
 *   EventHandler.SubscribeAll → URL: http://<your-server>/api/hardware/event
 *   Or Section 4.19 CGI Auto Registration
 *
 * Dahua sends multipart/form-data or JSON depending on firmware version.
 * This handler supports both formats.
 */

import { NextResponse } from "next/server"
import { processHardwareRecord } from "@/app/api/hardware/sync/route"
import type { AccessControlRecord } from "@/lib/dahua"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function POST(req: Request) {
    try {
        const contentType = req.headers.get("content-type") || ""

        let record: Partial<AccessControlRecord> | null = null

        if (contentType.includes("application/json")) {
            const json = await req.json()
            record = parseJsonEvent(json)
        } else if (contentType.includes("multipart/form-data")) {
            const formData = await req.formData()
            record = parseFormDataEvent(formData)
        } else {
            // Try raw text (some Dahua firmware versions)
            const text = await req.text()
            record = parseTextEvent(text)
        }

        if (!record || !record.UserID) {
            // Not a card/face punch event — ignore silently (heartbeat etc.)
            return NextResponse.json({ ok: true, skipped: true })
        }

        const processed = await processHardwareRecord(record as AccessControlRecord)
        return NextResponse.json({ ok: true, processed })
    } catch (e) {
        console.error("[HW_EVENT]", e)
        // Always return 200 to device (so it doesn't retry indefinitely)
        return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Unknown" })
    }
}

// Dahua JSON event format
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseJsonEvent(json: any): Partial<AccessControlRecord> | null {
    // Common Dahua JSON event structure
    const event = json?.Events?.[0] || json?.AccessControl || json
    if (!event) return null

    const userId =
        event.UserID ||
        event.EmployeeNo ||
        event.CardNo ||
        event.CardInfo?.CardNo

    if (!userId) return null

    return {
        UserID: String(userId),
        CardNo: String(event.CardNo || event.CardInfo?.CardNo || userId),
        CardName: event.UserName || event.CardName || "",
        CreateTime: event.UTC || event.CreateTime || event.LocalTime || new Date().toISOString().replace("T", " ").slice(0, 19),
        RecNo: event.RecNo || 0,
        Door: event.DoorIndex || event.Door || 0,
        Direction: event.Direction || 2,
        Method: event.Method || 0,
    }
}

// Dahua multipart form-data event
function parseFormDataEvent(formData: FormData): Partial<AccessControlRecord> | null {
    const userId = formData.get("UserID") || formData.get("EmployeeNo") || formData.get("CardNo")
    if (!userId) return null

    return {
        UserID: String(userId),
        CardNo: String(formData.get("CardNo") || userId),
        CardName: String(formData.get("UserName") || formData.get("CardName") || ""),
        CreateTime: String(formData.get("CreateTime") || formData.get("UTC") || new Date().toISOString().replace("T", " ").slice(0, 19)),
        RecNo: parseInt(String(formData.get("RecNo") || "0")),
        Door: parseInt(String(formData.get("Door") || "0")),
        Direction: parseInt(String(formData.get("Direction") || "2")),
        Method: parseInt(String(formData.get("Method") || "0")),
    }
}

// Plain text CGI-style event
function parseTextEvent(text: string): Partial<AccessControlRecord> | null {
    const obj: Record<string, string> = {}
    for (const line of text.split("\n")) {
        const eq = line.indexOf("=")
        if (eq === -1) continue
        obj[line.slice(0, eq).trim()] = line.slice(eq + 1).trim()
    }

    const userId = obj.UserID || obj.EmployeeNo || obj.CardNo
    if (!userId) return null

    return {
        UserID: userId,
        CardNo: obj.CardNo || userId,
        CardName: obj.UserName || obj.CardName || "",
        CreateTime: obj.CreateTime || obj.UTC || new Date().toISOString().replace("T", " ").slice(0, 19),
        RecNo: parseInt(obj.RecNo || "0"),
        Door: parseInt(obj.Door || "0"),
        Direction: parseInt(obj.Direction || "2"),
        Method: parseInt(obj.Method || "0"),
    }
}

// GET — for device CGI auto-registration handshake (some Dahua devices ping first)
export async function GET() {
    return NextResponse.json({ status: "ok", service: "Falcon Plus EMP Hardware Endpoint" })
}
