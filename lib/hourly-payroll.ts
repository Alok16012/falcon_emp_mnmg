// ─── Falcon hourly payroll — 30-day base · shift-wise · Sunday rules ──────────
// Pure functions (no DB / no React) so the Payroll page and the API that saves
// a payroll record compute exactly the same numbers.
//
// Rules (Falcon "Hourly Based Salary Calculation Rules"):
//  1. Salary is ALWAYS the full monthly salary on a 30-day base, minus cuts —
//     whether the month has 28, 30 or 31 days.
//       Daily rate  = monthly ÷ 30
//       Hourly rate = monthly ÷ (30 × shift hours)
//     A 31st day worked earns nothing extra; an absent day (31st included) is
//     cut one day's salary.
//  2. Working day (Mon–Sat): late / early is cut at the exact minute (hourly).
//     Coming early / staying late adds nothing. Grace: arriving up to 7 min after
//     shift start (e.g. 8:37 for an 8:30 shift — morning briefing) is not late;
//     from the 8th minute the full lateness from shift start is cut.
//     Lunch is 37 min and company-paid — never cut.
//     No punch / ABSENT / LEAVE → one day cut. Only an IN punch → one day cut
//     until the attendance is corrected.
//  3. Free Sundays depend on days worked in the month:
//       0–5 → 0 · 6–11 → 1 · 12–17 → 2 · 18–23 → 3 · 24+ → 4   (max 4)
//     A Sunday that is not free is cut one day. Full attendance → every Sunday paid.
//  4. Sunday duty is 9:00 AM – 5:00 PM. Working it fully counts as the FULL
//     regular shift hours (e.g. 12 h), paid double. Late after 9:07 / leaving
//     before 5:00 PM is cut.
//       Sunday pay = (shift hrs − late − early) × hourly × 2
//     That Sunday gets ONLY the double pay (it replaces its day in the base).
//  5. Days before joining / after leaving, and days not yet reached in the
//     current month, are cut one day each.
//  6. Carry forward: if less than Net Payable was paid last month, the balance
//     is added to this month (paid more → the extra is taken back).

export const SALARY_BASE_DAYS = 30
export const MAX_FREE_SUNDAYS = 4
export const SUNDAY_START_MIN = 9 * 60 // 9:00 AM
export const SUNDAY_END_MIN = 17 * 60  // 5:00 PM
export const LATE_GRACE_MIN = 7        // in by shift start + 7 min = on time (briefing)
export const LUNCH_MIN = 37            // company-paid lunch, never cut
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
    dateOfJoining?: string | Date | null
    dateOfLeaving?: string | Date | null
}

export type PayAdvance = { date: string | null; amount: number; reason: string | null }

export type DayLine = {
    date: string          // YYYY-MM-DD
    weekday: string       // Mon … Sun
    isSunday: boolean
    kind: "WORK" | "SUNDAY_WORK" | "FREE_SUNDAY" | "ABSENT" | "UNPAID_SUNDAY" | "HOLIDAY" | "NOT_EMPLOYED"
    inTime: string | null
    outTime: string | null
    hours: number         // paid hours (for FREE_SUNDAY: 0)
    lateHrs: number
    earlyHrs: number
    rate: number          // ₹ per hour actually applied (hourly, or hourly × 2 on Sunday)
    amount: number        // what this day is worth (0 for an absent day)
    cut: number           // ₹ taken off the monthly salary for this day
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
    lateEarlyCut: number
    workPay: number              // value of the Mon–Sat days worked (for reference)
    absentDays: number           // Mon–Sat absent (incl. out-punch-missing days)
    absentDates: string[]
    absentCut: number
    halfDays: number
    // Sundays
    sundaysInPeriod: number
    sundaysWorked: number
    sundayHours: number
    sundayPay: number
    sundayExtra: number          // Sunday double pay − the day it replaces in the base
    freeSundaysEarned: number    // from the slab table
    freeSundays: number          // not-worked Sundays that are paid
    freeSundayPay: number
    unpaidSundays: number
    unpaidSundayCut: number
    // Outside employment / not yet reached
    notEmployedDays: number
    upcomingDays: number
    otherCut: number
    // Manual extras
    otHrs: number
    otPay: number
    gross: number
    advance: number
    advances: PayAdvance[]
    carryForward: number
    net: number
    missingPunchDays: number
    lines: DayLine[]
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const ABSENT_STATUS = new Set(["ABSENT", "LEAVE"])
const PAID_OFF_STATUS = new Set(["HOLIDAY", "WEEK_OFF"])

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

/** Late hours for an IN time: 0 within the grace window, else the full minutes after shift start. */
function lateHrsOf(inMin: number, shiftStart: number | null): number {
    if (shiftStart == null) return 0
    const lateMin = inMin - shiftStart
    return lateMin > LATE_GRACE_MIN ? lateMin / 60 : 0
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

/** Every YYYY-MM-DD between two YYYY-MM-DD dates (inclusive). */
export function datesBetween(from: string, to: string): string[] {
    const [fy, fm, fd] = from.split("-").map(Number)
    const [ty, tm, td] = to.split("-").map(Number)
    const out: string[] = []
    const end = Date.UTC(ty, tm - 1, td)
    for (let t = Date.UTC(fy, fm - 1, fd); t <= end; t += 86400000) out.push(new Date(t).toISOString().slice(0, 10))
    return out
}

/** Today's date in IST as YYYY-MM-DD. */
export function todayIST() { return istDateKey(new Date()) }

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
    extra: { advance?: number; advances?: PayAdvance[]; otHrs?: number; carryForward?: number; today?: string } = {},
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
    const today = extra.today ?? todayIST()
    const joinKey = emp.dateOfJoining ? istDateKey(new Date(emp.dateOfJoining)) : null
    const leaveKey = emp.dateOfLeaving ? istDateKey(new Date(emp.dateOfLeaving)) : null

    // One attendance record per IST day
    const byDay = new Map<string, PayAttendance>()
    for (const a of [...attendance].sort((x, y) => +new Date(x.date) - +new Date(y.date))) {
        const key = istDateKey(new Date(a.date))
        if (key >= period.from && key <= period.to && !byDay.has(key)) byDay.set(key, a)
    }

    const lines: DayLine[] = []
    let daysWorked = 0, workHours = 0, lateEarlyHrs = 0, workPay = 0
    let absentDays = 0, halfDays = 0, missingPunchDays = 0
    let sundaysWorked = 0, sundayHours = 0, sundayPay = 0
    let notEmployedDays = 0, upcomingDays = 0
    const absentDates: string[] = []
    const openSundays: string[] = []   // Sundays in employment, not worked
    let mondayToSatAvailable = 0       // Mon–Sat days in employment and already reached

    const line = (l: Omit<DayLine, "rate" | "lateHrs" | "earlyHrs" | "inTime" | "outTime" | "hours"> & Partial<DayLine>) =>
        lines.push({ rate: 0, lateHrs: 0, earlyHrs: 0, inTime: null, outTime: null, hours: 0, ...l } as DayLine)

    for (const key of datesBetween(period.from, period.to)) {
        const dow = new Date(key + "T00:00:00Z").getUTCDay()
        const isSunday = dow === 0
        const weekday = WEEKDAYS[dow]

        if ((joinKey && key < joinKey) || (leaveKey && key > leaveKey)) {
            notEmployedDays++
            line({ date: key, weekday, isSunday, kind: "NOT_EMPLOYED", amount: 0, cut: r2(dailyRate),
                remark: joinKey && key < joinKey ? "Before joining (1 day cut)" : "After leaving (1 day cut)" })
            continue
        }
        const a = byDay.get(key)
        if (key > today && !a) { upcomingDays++; continue } // not reached yet → cut, no line

        const punches = (a?.punchLogs ?? []).map(p => new Date(p.punchTime)).filter(d => !isNaN(+d)).sort((x, y) => +x - +y)
        const inDT = a?.checkIn ? new Date(a.checkIn) : (punches[0] ?? null)
        const outDT = a?.checkOut ? new Date(a.checkOut) : (punches.length >= 2 ? punches[punches.length - 1] : null)
        const inMin = inDT ? istMinutes(inDT) : null
        let outMin = outDT ? istMinutes(outDT) : null
        if (inMin != null && outMin != null && outMin < inMin) outMin += 1440
        const inTime = inMin != null ? minToLabel(inMin) : null
        const outTime = outMin != null ? minToLabel(outMin) : null
        const status = a?.status ?? null
        const halfDay = status === "HALF_DAY"
        const isAbsent = !a || (status != null && ABSENT_STATUS.has(status))

        if (isSunday) {
            if (isAbsent || (status != null && PAID_OFF_STATUS.has(status))) { openSundays.push(key); continue }
            // Sunday duty 9:00 AM – 5:00 PM = FULL regular shift hours, doubled.
            let hours = 0, late = 0, early = 0
            const notes: string[] = []
            if (inMin != null && outMin != null) {
                late = lateHrsOf(inMin, SUNDAY_START_MIN)
                early = Math.max(0, SUNDAY_END_MIN - outMin) / 60
                hours = Math.max(0, shiftHours - late - early)
            } else if (inMin != null) {
                missingPunchDays++
                notes.push("Out punch missing (0 hrs)")
            } else {
                hours = halfDay ? shiftHours / 2 : shiftHours
                notes.push("marked manually")
            }
            late = r2(late); early = r2(early); hours = r2(hours)
            if (late > 0) notes.push(`${Math.round(late * 60)} min late after 9:00 AM (${late} hr cut)`)
            if (early > 0) notes.push(`left ${Math.round(early * 60)} min before 5:00 PM (${early} hr cut)`)
            if (hours <= 0) {
                openSundays.push(key)
                if (notes.length) line({ date: key, weekday, isSunday, kind: "SUNDAY_WORK", inTime, outTime, amount: 0, cut: 0, remark: ["Sunday", ...notes].join(" · ") })
                continue
            }
            sundaysWorked++
            const amount = r2(hours * hourlyRate * 2)
            sundayHours += hours
            sundayPay += amount
            line({ date: key, weekday, isSunday, kind: "SUNDAY_WORK", inTime, outTime, hours, lateHrs: late, earlyHrs: early,
                rate: r2(hourlyRate * 2), amount, cut: 0, remark: ["Sunday (Double Pay)", ...notes].join(" · ") })
            continue
        }

        // ── Mon–Sat ──
        mondayToSatAvailable++
        if (status != null && PAID_OFF_STATUS.has(status)) {
            line({ date: key, weekday, isSunday, kind: "HOLIDAY", amount: r2(dailyRate), cut: 0,
                remark: status === "HOLIDAY" ? "Holiday (paid)" : "Week off (paid)" })
            continue
        }
        if (isAbsent) {
            absentDays++
            absentDates.push(key)
            line({ date: key, weekday, isSunday, kind: "ABSENT", amount: 0, cut: r2(dailyRate),
                remark: status === "LEAVE" ? "Leave (1 day cut)" : "Absent — no punch (1 day cut)" })
            continue
        }
        if (inMin != null && outMin == null) {
            // Only an IN punch → treated as absent until corrected
            missingPunchDays++
            absentDays++
            absentDates.push(key)
            line({ date: key, weekday, isSunday, kind: "ABSENT", inTime, amount: 0, cut: r2(dailyRate),
                remark: "Out punch missing (1 day cut until corrected)" })
            continue
        }

        daysWorked++
        let hours = shiftHours, late = 0, early = 0
        const notes: string[] = []
        if (inMin != null && outMin != null) {
            if (shiftStart != null && shiftEnd != null) {
                late = lateHrsOf(inMin, shiftStart)
                early = Math.max(0, shiftEnd - outMin) / 60
                hours = Math.max(0, shiftHours - late - early)
            } else {
                const span = a?.workingHrs && a.workingHrs > 0 ? a.workingHrs : (outMin - inMin) / 60
                hours = Math.min(span, shiftHours)
                early = Math.max(0, shiftHours - hours)
            }
        } else {
            // Marked present by hand, no punch times → full shift (half for HALF_DAY)
            if (halfDay) { hours = shiftHours / 2; halfDays++ }
            notes.push(halfDay ? "Half day · marked manually" : "Marked present manually")
        }
        late = r2(late); early = r2(early); hours = r2(hours)
        if (late > 0) notes.push(`${Math.round(late * 60)} min late (${late} hr cut)`)
        if (early > 0 && inMin != null) notes.push(`${Math.round(early * 60)} min early (${early} hr cut)`)
        const amount = r2(hours * hourlyRate)
        const cut = r2((shiftHours - hours) * hourlyRate)
        workHours += hours
        lateEarlyHrs += late + early
        workPay += amount
        line({ date: key, weekday, isSunday, kind: "WORK", inTime, outTime, hours, lateHrs: late, earlyHrs: early,
            rate: r2(hourlyRate), amount, cut, remark: notes.length ? notes.join(" · ") : "Present (full shift)" })
    }

    // ── Free / unpaid Sundays ──
    const allSundays = sundaysBetween(period.from, period.to)
    const freeSundaysEarned = freeSundaysFor(daysWorked)
    const fullAttendance = mondayToSatAvailable > 0 && absentDays === 0
    const freeSlots = fullAttendance ? openSundays.length : Math.max(0, freeSundaysEarned - sundaysWorked)
    const freeSundays = Math.min(freeSlots, openSundays.length)
    openSundays.forEach((key, i) => {
        const free = i < freeSundays
        line({ date: key, weekday: "Sun", isSunday: true, kind: free ? "FREE_SUNDAY" : "UNPAID_SUNDAY",
            amount: free ? r2(dailyRate) : 0, cut: free ? 0 : r2(dailyRate),
            remark: free ? "Sunday (paid)" : `Sunday not paid — only ${freeSundaysEarned} free for ${daysWorked} days worked (1 day cut)` })
    })
    const unpaidSundays = openSundays.length - freeSundays
    lines.sort((x, y) => x.date.localeCompare(y.date))

    const absentCut = r2(absentDays * dailyRate)
    const halfDayCut = r2(halfDays * dailyRate / 2)
    const lateEarlyCut = r2(lines.filter(l => l.kind === "WORK").reduce((s, l) => s + l.cut, 0) - halfDayCut)
    const unpaidSundayCut = r2(unpaidSundays * dailyRate)
    const otherCut = r2((notEmployedDays + upcomingDays) * dailyRate)
    const sundayExtra = r2(sundayPay - sundaysWorked * dailyRate)

    const otHrs = Math.max(0, Number(extra.otHrs) || 0)
    const otPay = r2(otHrs * hourlyRate * 1.5)
    const gross = monthlySalary > 0
        ? r2(Math.max(0, monthlySalary - absentCut - halfDayCut - lateEarlyCut - unpaidSundayCut - otherCut + sundayExtra + otPay))
        : 0
    const advances = extra.advances ?? []
    const advance = Math.max(0, Number(extra.advance ?? advances.reduce((s, a) => s + a.amount, 0)) || 0)
    const carryForward = r2(Number(extra.carryForward) || 0)
    const net = Math.max(0, Math.round(gross - advance + carryForward))

    return {
        monthlySalary, shiftHours: r2(shiftHours),
        shiftLabel: shiftLabelOf(emp.shiftStart, emp.shiftEnd),
        dailyRate: r2(dailyRate), hourlyRate: r2(hourlyRate),
        daysWorked, workHours: r2(workHours), lateEarlyHrs: r2(lateEarlyHrs), lateEarlyCut, workPay: r2(workPay),
        absentDays, absentDates, absentCut, halfDays,
        sundaysInPeriod: allSundays.length, sundaysWorked, sundayHours: r2(sundayHours), sundayPay: r2(sundayPay), sundayExtra,
        freeSundaysEarned, freeSundays, freeSundayPay: r2(freeSundays * dailyRate), unpaidSundays, unpaidSundayCut,
        notEmployedDays, upcomingDays, otherCut,
        otHrs, otPay, gross, advance, advances, carryForward, net, missingPunchDays, lines,
    }
}
