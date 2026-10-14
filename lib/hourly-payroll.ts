// ─── Falcon hourly payroll — 30-day base · shift-wise · Sunday rules ──────────
// Pure functions (no DB / no React) so the Payroll page and the API that saves
// a payroll record compute exactly the same numbers.
//
// Rules (Falcon "Hourly Based Salary Calculation Rules"):
//  1. Salary is ALWAYS calculated on 30 days — whether the month has 28, 30 or 31.
//       Daily rate  = monthly ÷ 30
//       Hourly rate = monthly ÷ (30 × shift hours)
//  2. Working day (Mon–Sat): paid hours = shift hours − late hours − early hours.
//     Coming early / staying late adds nothing; coming late / leaving early is cut
//     at the exact minute.
//  3. Free Sundays (paid without working) depend on days worked in the month:
//       0–5 → 0 · 6–11 → 1 · 12–17 → 2 · 18–23 → 3 · 24+ → 4   (max 4)
//     Each free Sunday = one day's salary (monthly ÷ 30).
//  4. Working on a Sunday is paid double. Sunday shift ends at 5:00 PM for
//     everyone; working from shift start till 5:00 PM counts as the FULL
//     regular shift hours (e.g. 10 h). Late / leaving before 5:00 PM is cut.
//       Sunday pay = (shift hrs − late − early-before-5:00) × hourly × 2
//     That Sunday gets ONLY the double pay — no extra free-day salary on top.

export const SALARY_BASE_DAYS = 30
export const MAX_FREE_SUNDAYS = 4
export const SUNDAY_END_MIN = 17 * 60 // 5:00 PM
const IST_OFFSET_MIN = 330 // punches are stored as true instants; the site runs on IST

export const FREE_SUNDAY_SLABS = [
    { from: 0, to: 5, sundays: 0 },
    { from: 6, to: 11, sundays: 1 },
    { from: 12, to: 17, sundays: 2 },
    { from: 18, to: 23, sundays: 3 },
    { from: 24, to: 31, sundays: 4 },
] as const

/** Free (paid) Sundays earned for the number of Mon–Sat days worked. */
export function freeSundaysFor(daysWorked: number) {
    return Math.min(MAX_FREE_SUNDAYS, Math.floor(Math.max(0, daysWorked) / 6))
}

export type PayAttendance = {
    date: string | Date
    status?: string | null
    checkIn?: string | Date | null
    checkOut?: string | Date | null
    workingHrs?: number | null
    punchLogs?: { punchTime: string | Date }[]
}

export type PayEmployee = {
    basicSalary: number
    shiftHours?: number | null
    shiftStart?: string | null
    shiftEnd?: string | null
}

export type DayLine = {
    date: string          // YYYY-MM-DD
    weekday: string       // Mon … Sun
    isSunday: boolean
    kind: "WORK" | "SUNDAY_WORK" | "FREE_SUNDAY"
    inTime: string | null
    outTime: string | null
    hours: number         // paid hours (for FREE_SUNDAY: 0)
    lateHrs: number
    earlyHrs: number
    rate: number          // ₹ per hour actually applied (hourly, or hourly × 2 on Sunday)
    amount: number
    remark: string
}

export type HourlyPayResult = {
    monthlySalary: number
    shiftHours: number
    shiftLabel: string
    dailyRate: number
    hourlyRate: number
    // Mon–Sat
    daysWorked: number
    workHours: number
    lateEarlyHrs: number
    workPay: number
    // Sundays
    sundaysInPeriod: number
    sundaysWorked: number
    sundayHours: number
    sundayPay: number
    freeSundaysEarned: number   // from the slab table
    freeSundays: number         // actually paid (earned, minus Sundays that were worked)
    freeSundayPay: number
    // Manual extras
    otHrs: number
    otPay: number
    gross: number
    advance: number
    net: number
    missingPunchDays: number
    lines: DayLine[]
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const INACTIVE = new Set(["ABSENT", "LEAVE", "HOLIDAY", "WEEK_OFF"])

const r2 = (n: number) => Math.round(n * 100) / 100

/** IST wall-clock view of an instant — read it with getUTC*(). */
function ist(d: Date) { return new Date(d.getTime() + IST_OFFSET_MIN * 60000) }
function istMinutes(d: Date) { const x = ist(d); return x.getUTCHours() * 60 + x.getUTCMinutes() }
function istDateKey(d: Date) { return ist(d).toISOString().slice(0, 10) }

/** "HH:MM" (24h) → minutes after midnight, or null. */
export function hmToMin(t?: string | null): number | null {
    if (!t) return null
    const [h, m] = String(t).split(":").map(Number)
    if (Number.isNaN(h) || Number.isNaN(m)) return null
    return h * 60 + m
}

/** minutes after midnight → "8:30 AM" */
export function minToLabel(min: number) {
    const m = ((Math.round(min) % 1440) + 1440) % 1440
    const h = Math.floor(m / 60), mm = m % 60
    const ap = h >= 12 ? "PM" : "AM"
    const h12 = h % 12 === 0 ? 12 : h % 12
    return `${h12}:${String(mm).padStart(2, "0")} ${ap}`
}

export function shiftLabelOf(start?: string | null, end?: string | null) {
    const s = hmToMin(start), e = hmToMin(end)
    if (s == null || e == null) return ""
    return `${minToLabel(s)} – ${minToLabel(e)}`
}

/** All YYYY-MM-DD Sundays between two YYYY-MM-DD dates (inclusive). */
export function sundaysBetween(from: string, to: string): string[] {
    const [fy, fm, fd] = from.split("-").map(Number)
    const [ty, tm, td] = to.split("-").map(Number)
    const out: string[] = []
    const end = Date.UTC(ty, tm - 1, td)
    for (let t = Date.UTC(fy, fm - 1, fd); t <= end; t += 86400000) {
        const d = new Date(t)
        if (d.getUTCDay() === 0) out.push(d.toISOString().slice(0, 10))
    }
    return out
}

/** First and last YYYY-MM-DD of a month (month is 1-12). */
export function monthPeriod(year: number, month: number) {
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
    const mm = String(month).padStart(2, "0")
    return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${String(last).padStart(2, "0")}` }
}

export function calcHourlyPayroll(
    emp: PayEmployee,
    attendance: PayAttendance[],
    period: { from: string; to: string },
    extra: { advance?: number; otHrs?: number } = {},
): HourlyPayResult {
    const monthlySalary = Number(emp.basicSalary) || 0
    const shiftStart = hmToMin(emp.shiftStart)
    let shiftEnd = hmToMin(emp.shiftEnd)
    if (shiftStart != null && shiftEnd != null && shiftEnd <= shiftStart) shiftEnd += 1440 // overnight
    const shiftHours = Number(emp.shiftHours) > 0
        ? Number(emp.shiftHours)
        : (shiftStart != null && shiftEnd != null ? (shiftEnd - shiftStart) / 60 : 8)

    const dailyRate = monthlySalary / SALARY_BASE_DAYS
    const hourlyRate = shiftHours > 0 ? dailyRate / shiftHours : 0

    const lines: DayLine[] = []
    let daysWorked = 0, workHours = 0, lateEarlyHrs = 0, workPay = 0
    let sundaysWorked = 0, sundayHours = 0, sundayPay = 0, missingPunchDays = 0
    const workedSundayKeys = new Set<string>()

    // One record per day; ignore anything outside the period
    const seen = new Set<string>()
    const sorted = [...attendance].sort((a, b) => +new Date(a.date) - +new Date(b.date))
    for (const a of sorted) {
        const key = istDateKey(new Date(a.date))
        if (key < period.from || key > period.to || seen.has(key)) continue
        seen.add(key)
        if (a.status && INACTIVE.has(a.status)) continue

        const punches = (a.punchLogs ?? []).map(p => new Date(p.punchTime)).filter(d => !isNaN(+d)).sort((x, y) => +x - +y)
        const inDT = a.checkIn ? new Date(a.checkIn) : (punches[0] ?? null)
        const outDT = a.checkOut ? new Date(a.checkOut) : (punches.length >= 2 ? punches[punches.length - 1] : null)
        const inMin = inDT ? istMinutes(inDT) : null
        let outMin = outDT ? istMinutes(outDT) : null
        if (inMin != null && outMin != null && outMin < inMin) outMin += 1440

        const isSunday = new Date(key + "T00:00:00Z").getUTCDay() === 0
        const weekday = WEEKDAYS[new Date(key + "T00:00:00Z").getUTCDay()]
        const inTime = inMin != null ? minToLabel(inMin) : null
        const outTime = outMin != null ? minToLabel(outMin) : null
        const halfDay = a.status === "HALF_DAY"

        if (isSunday) {
            // Sunday shift = usual shift start → 5:00 PM, but working it fully is
            // paid as the FULL regular shift hours (e.g. 10 h), then doubled.
            // Late arrival / leaving before 5:00 PM is cut like a normal day.
            let hours = 0, late = 0, early = 0
            const notes: string[] = []
            if (inMin != null && outMin != null) {
                late = shiftStart != null ? Math.max(0, inMin - shiftStart) / 60 : 0
                early = Math.max(0, SUNDAY_END_MIN - outMin) / 60
                hours = Math.max(0, shiftHours - late - early)
            } else if (inMin != null) {
                missingPunchDays++
                notes.push("Out punch missing (0 hrs)")
            } else {
                // Marked present by hand, no punch times → full shift (half for HALF_DAY)
                hours = halfDay ? shiftHours / 2 : shiftHours
                notes.push("marked manually")
            }
            late = r2(late); early = r2(early); hours = r2(hours)
            if (late > 0) notes.push(`${Math.round(late * 60)} min late (${late} hr cut)`)
            if (early > 0) notes.push(`left ${Math.round(early * 60)} min before 5:00 PM (${early} hr cut)`)
            const remark = ["Sunday (Double Pay)", ...notes].join(" · ")
            if (hours > 0) {
                sundaysWorked++
                workedSundayKeys.add(key)
            }
            const amount = r2(hours * hourlyRate * 2)
            sundayHours += hours
            sundayPay += amount
            lines.push({ date: key, weekday, isSunday, kind: "SUNDAY_WORK", inTime, outTime, hours, lateHrs: late, earlyHrs: early, rate: r2(hourlyRate * 2), amount, remark })
            continue
        }

        // ── Mon–Sat ──
        daysWorked++
        let hours = 0, late = 0, early = 0
        const notes: string[] = []
        if (inMin != null && outMin != null) {
            if (shiftStart != null && shiftEnd != null) {
                late = Math.max(0, inMin - shiftStart) / 60
                early = Math.max(0, shiftEnd - outMin) / 60
                hours = Math.max(0, shiftHours - late - early)
            } else {
                const span = a.workingHrs && a.workingHrs > 0 ? a.workingHrs : (outMin - inMin) / 60
                hours = Math.min(span, shiftHours)
            }
        } else if (inMin != null) {
            missingPunchDays++
            notes.push("Out punch missing (0 hrs)")
        } else {
            // Marked present by hand, no punch times → full shift (half for HALF_DAY)
            hours = halfDay ? shiftHours / 2 : shiftHours
            notes.push(halfDay ? "Half day · marked manually" : "Marked present manually")
        }
        late = r2(late); early = r2(early); hours = r2(hours)
        if (late > 0) notes.push(`${Math.round(late * 60)} min late (${late} hr cut)`)
        if (early > 0) notes.push(`${Math.round(early * 60)} min early (${early} hr cut)`)
        const amount = r2(hours * hourlyRate)
        workHours += hours
        lateEarlyHrs += late + early
        workPay += amount
        lines.push({
            date: key, weekday, isSunday, kind: "WORK", inTime, outTime, hours,
            lateHrs: late, earlyHrs: early, rate: r2(hourlyRate), amount,
            remark: notes.length ? notes.join(" · ") : "Present (full shift)",
        })
    }

    // ── Free Sundays ──
    const allSundays = sundaysBetween(period.from, period.to)
    const freeSundaysEarned = freeSundaysFor(daysWorked)
    const openSundays = allSundays.filter(k => !workedSundayKeys.has(k))
    const freeSundays = Math.min(freeSundaysEarned, openSundays.length)
    const freeSundayPay = r2(freeSundays * dailyRate)
    for (const key of openSundays.slice(0, freeSundays)) {
        lines.push({
            date: key, weekday: "Sun", isSunday: true, kind: "FREE_SUNDAY", inTime: null, outTime: null,
            hours: 0, lateHrs: 0, earlyHrs: 0, rate: 0, amount: r2(dailyRate), remark: "Sunday (Free Salary)",
        })
    }
    lines.sort((x, y) => x.date.localeCompare(y.date))

    const otHrs = Math.max(0, Number(extra.otHrs) || 0)
    const otPay = r2(otHrs * hourlyRate * 1.5)
    const advance = Math.max(0, Number(extra.advance) || 0)
    const gross = r2(workPay + sundayPay + freeSundayPay + otPay)
    const net = Math.max(0, Math.round(gross - advance))

    return {
        monthlySalary, shiftHours: r2(shiftHours),
        shiftLabel: shiftLabelOf(emp.shiftStart, emp.shiftEnd),
        dailyRate: r2(dailyRate), hourlyRate: r2(hourlyRate),
        daysWorked, workHours: r2(workHours), lateEarlyHrs: r2(lateEarlyHrs), workPay: r2(workPay),
        sundaysInPeriod: allSundays.length, sundaysWorked, sundayHours: r2(sundayHours), sundayPay: r2(sundayPay),
        freeSundaysEarned, freeSundays, freeSundayPay,
        otHrs, otPay, gross, advance, net, missingPunchDays, lines,
    }
}
