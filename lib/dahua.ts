/**
 * Dahua Access Control Hardware API Helper
 * Implements HTTP Digest Authentication (RFC 2617) for CGI endpoints
 * Based on: Access Control API Guide v2.4
 */

import crypto from "crypto"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DahuaDevice {
  ip: string
  port: number
  username: string
  password: string
}

export interface AccessControlRecord {
  RecNo: number
  CardNo: string
  CardName: string
  UserID: string
  CreateTime: string // UTC string e.g. "2024-01-15 09:30:00"
  Door: number
  Direction: number  // 0=Enter, 1=Exit, 2=None
  Method: number     // access method
}

export interface PunchResult {
  employeeId: string // our DB employee id
  hardwareUserId: string
  punchTime: Date
  direction: "IN" | "OUT"
  rawRecord: AccessControlRecord
}

// ─── Digest Auth ──────────────────────────────────────────────────────────────

function md5(str: string): string {
  return crypto.createHash("md5").update(str).digest("hex")
}

function parseWwwAuthenticate(header: string): Record<string, string> {
  const result: Record<string, string> = {}
  const matches = header.matchAll(/(\w+)="([^"]+)"/g)
  for (const m of matches) result[m[1]] = m[2]
  const qopMatch = header.match(/qop=(\S+)/)
  if (qopMatch) result.qop = qopMatch[1].replace(/"/g, "")
  return result
}

function buildDigestHeader(
  method: string,
  uri: string,
  username: string,
  password: string,
  params: Record<string, string>
): string {
  const ha1 = md5(`${username}:${params.realm}:${password}`)
  const ha2 = md5(`${method}:${uri}`)
  const nc = "00000001"
  const cnonce = crypto.randomBytes(8).toString("hex")
  const response = md5(`${ha1}:${params.nonce}:${nc}:${cnonce}:auth:${ha2}`)
  return (
    `Digest username="${username}", realm="${params.realm}", nonce="${params.nonce}", ` +
    `uri="${uri}", qop=auth, nc=${nc}, cnonce="${cnonce}", response="${response}", ` +
    `opaque="${params.opaque || ""}"`
  )
}

// ─── Core CGI Request ─────────────────────────────────────────────────────────

export async function dahuaRequest(
  device: DahuaDevice,
  path: string,
  method = "GET",
  body?: string
): Promise<string> {
  const base = `http://${device.ip}:${device.port}`
  const url = `${base}${path}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)

  try {
    // Step 1: initial request (no auth) → expect 401
    const r1 = await fetch(url, { method, signal: controller.signal })
    clearTimeout(timeout)

    if (r1.status !== 401) {
      // Already authenticated or no auth required
      return await r1.text()
    }

    const wwwAuth = r1.headers.get("www-authenticate") || ""
    const authParams = parseWwwAuthenticate(wwwAuth)

    const authHeader = buildDigestHeader(
      method,
      path,
      device.username,
      device.password,
      authParams
    )

    const controller2 = new AbortController()
    const timeout2 = setTimeout(() => controller2.abort(), 10000)
    const r2 = await fetch(url, {
      method,
      headers: {
        Authorization: authHeader,
        "Content-Type": "text/plain",
      },
      body,
      signal: controller2.signal,
    })
    clearTimeout(timeout2)

    if (!r2.ok) {
      const text = await r2.text()
      throw new Error(`Dahua device returned ${r2.status}: ${text}`)
    }
    return await r2.text()
  } catch (e) {
    clearTimeout(timeout)
    throw e
  }
}

// ─── Parse CGI Response ───────────────────────────────────────────────────────

/**
 * Dahua CGI responses are key=value per line, e.g.:
 * records[0].RecNo=1
 * records[0].UserID=0001
 * records[0].CreateTime=2024-01-15 09:30:00
 */
export function parseCgiResponse(text: string): Record<string, string> {
  const obj: Record<string, string> = {}
  for (const line of text.split("\n")) {
    const eq = line.indexOf("=")
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    const val = line.slice(eq + 1).trim()
    obj[key] = val
  }
  return obj
}

export function parseCgiRecords(text: string): AccessControlRecord[] {
  const obj = parseCgiResponse(text)
  const records: AccessControlRecord[] = []

  let i = 0
  while (true) {
    const prefix = `records[${i}]`
    if (!(`${prefix}.RecNo` in obj)) break
    records.push({
      RecNo: parseInt(obj[`${prefix}.RecNo`] || "0"),
      CardNo: obj[`${prefix}.CardNo`] || "",
      CardName: obj[`${prefix}.CardName`] || "",
      UserID: obj[`${prefix}.UserID`] || "",
      CreateTime: obj[`${prefix}.CreateTime`] || "",
      Door: parseInt(obj[`${prefix}.Door`] || "0"),
      Direction: parseInt(obj[`${prefix}.Direction`] || "2"),
      Method: parseInt(obj[`${prefix}.Method`] || "0"),
    })
    i++
  }
  return records
}

// ─── Fetch Access Control Records ─────────────────────────────────────────────

export async function fetchAccessRecords(
  device: DahuaDevice,
  startTime: Date,
  endTime: Date,
  count = 100,
  offset = 0
): Promise<AccessControlRecord[]> {
  const fmt = (d: Date) =>
    d.toISOString().replace("T", " ").slice(0, 19)

  const path =
    `/cgi-bin/recordFinder.cgi?action=find&name=AccessControlCardRec` +
    `&StartTime=${encodeURIComponent(fmt(startTime))}` +
    `&EndTime=${encodeURIComponent(fmt(endTime))}` +
    `&count=${count}&offset=${offset}`

  const text = await dahuaRequest(device, path)
  return parseCgiRecords(text)
}

// ─── Fetch All Users on Device ─────────────────────────────────────────────────

export interface DeviceUser {
  UserID: string
  UserName: string
  CardNo?: string
}

export async function fetchDeviceUsers(device: DahuaDevice): Promise<DeviceUser[]> {
  const path = `/cgi-bin/recordFinder.cgi?action=find&name=AccessControlCard&count=1000`
  const text = await dahuaRequest(device, path)
  const obj = parseCgiResponse(text)
  const users: DeviceUser[] = []
  let i = 0
  while (true) {
    const p = `records[${i}]`
    if (!(p + ".UserID" in obj)) break
    users.push({
      UserID: obj[`${p}.UserID`] || "",
      UserName: obj[`${p}.UserName`] || obj[`${p}.CardName`] || "",
      CardNo: obj[`${p}.CardNo`],
    })
    i++
  }
  return users
}

// ─── Push Employee Face to Device (Section 5.9.18) ────────────────────────────

export async function enrollUserOnDevice(
  device: DahuaDevice,
  userId: string,
  userName: string,
  cardNo?: string
): Promise<boolean> {
  // Create user record
  const userPath =
    `/cgi-bin/recordUpdater.cgi?action=insert&name=AccessControlCard` +
    `&UserID=${encodeURIComponent(userId)}` +
    `&UserName=${encodeURIComponent(userName)}` +
    (cardNo ? `&CardNo=${encodeURIComponent(cardNo)}` : "") +
    `&CardType=0&UseTime=0&Authority=1`

  const result = await dahuaRequest(device, userPath)
  return result.includes("OK") || result.includes("ok")
}

// ─── Test Connection ──────────────────────────────────────────────────────────

export async function testDeviceConnection(device: DahuaDevice): Promise<boolean> {
  try {
    const path = `/cgi-bin/magicBox.cgi?action=getSystemInfo`
    const text = await dahuaRequest(device, path)
    return text.includes("deviceType") || text.includes("serialNumber") || text.length > 10
  } catch {
    return false
  }
}
