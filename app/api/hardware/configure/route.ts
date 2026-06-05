/**
 * Auto-configure Dahua device to push events to our server
 * POST /api/hardware/configure
 *
 * Sends CGI setConfig commands to the device (Section 4.18.2 Auto Event Upload)
 * so the device automatically POSTs punch events to /api/hardware/event
 */

import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { dahuaRequest } from "@/lib/dahua"

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return new NextResponse("Unauthorized", { status: 401 })
    if (session.user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 })

    const { deviceId } = await req.json()
    if (!deviceId) return new NextResponse("deviceId required", { status: 400 })

    const device = await prisma.hardwareDevice.findUnique({ where: { id: deviceId } })
    if (!device) return new NextResponse("Device not found", { status: 404 })

    // Our server URL — use NEXT_PUBLIC_APP_URL or fallback
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://falcon-emp-mnmg.vercel.app"
    const serverUrl = new URL(appUrl)
    const serverHost = serverUrl.hostname
    const serverPort = serverUrl.port || (serverUrl.protocol === "https:" ? "443" : "80")
    const isHttps = serverUrl.protocol === "https:"

    const results: { step: string; ok: boolean; response?: string }[] = []

    // ── Step 1: Enable EventHttpUpload (Auto Event Upload — Section 4.18.2) ──
    try {
        const path =
            `/cgi-bin/configManager.cgi?action=setConfig` +
            `&EventHttpUpload.Enable=true` +
            `&EventHttpUpload.UploadServerList[0].Address=${serverHost}` +
            `&EventHttpUpload.UploadServerList[0].Port=${serverPort}` +
            `&EventHttpUpload.UploadServerList[0].HttpsEnable=${isHttps}` +
            `&EventHttpUpload.UploadServerList[0].Uploadpath=/api/hardware/event` +
            `&EventHttpUpload.UploadServerList[0].EventType[0]=AccessControl` +
            `&EventHttpUpload.UploadServerList[0].EventType[1]=FaceRecognition` +
            `&EventHttpUpload.UploadServerList[0].EventType[2]=CardVerification`

        const resp = await dahuaRequest(
            { ip: device.ip, port: device.port, username: device.username, password: device.password },
            path
        )
        results.push({ step: "EventHttpUpload (Auto Event Push)", ok: resp.includes("OK"), response: resp.trim() })
    } catch (e) {
        results.push({ step: "EventHttpUpload (Auto Event Push)", ok: false, response: e instanceof Error ? e.message : "Error" })
    }

    // ── Step 2: Enable PictureHttpUpload (Auto Image Upload — Section 4.18.1) ──
    try {
        const path =
            `/cgi-bin/configManager.cgi?action=setConfig` +
            `&PictureHttpUpload.Enable=true` +
            `&PictureHttpUpload.UploadServerList[0].Address=${serverHost}` +
            `&PictureHttpUpload.UploadServerList[0].Port=${serverPort}` +
            `&PictureHttpUpload.UploadServerList[0].HttpsEnable=${isHttps}` +
            `&PictureHttpUpload.UploadServerList[0].Uploadpath=/api/hardware/event` +
            `&PictureHttpUpload.UploadServerList[0].EventType[0]=AccessControl` +
            `&PictureHttpUpload.UploadServerList[0].rall=3`

        const resp = await dahuaRequest(
            { ip: device.ip, port: device.port, username: device.username, password: device.password },
            path
        )
        results.push({ step: "PictureHttpUpload (Auto Image Push)", ok: resp.includes("OK"), response: resp.trim() })
    } catch (e) {
        results.push({ step: "PictureHttpUpload (Auto Image Push)", ok: false, response: e instanceof Error ? e.message : "Error" })
    }

    // ── Step 3: Verify config was applied ──
    try {
        const path = `/cgi-bin/configManager.cgi?action=getConfig&name=EventHttpUpload`
        const resp = await dahuaRequest(
            { ip: device.ip, port: device.port, username: device.username, password: device.password },
            path
        )
        const enabled = resp.includes("Enable=true") || resp.includes("Enable=1")
        results.push({ step: "Verify config applied", ok: enabled, response: enabled ? "Upload enabled ✓" : "Check manually" })
    } catch (e) {
        results.push({ step: "Verify config", ok: false, response: e instanceof Error ? e.message : "Error" })
    }

    const allOk = results.every(r => r.ok)

    // Update device record
    if (allOk) {
        await prisma.hardwareDevice.update({
            where: { id: deviceId },
            data: { updatedAt: new Date() },
        })
    }

    return NextResponse.json({ ok: allOk, serverUrl: appUrl, results })
}
