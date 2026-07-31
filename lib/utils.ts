
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

// ─── Salary divisor ───────────────────────────────────────────────────────────
// One day's pay = monthly salary ÷ 30 for EVERY month (Jan, Jul, Jun … all 30),
// with February as the only exception — it uses its real length (28 or 29) so a
// short month is never over-divided. Not a fixed 26, not the true calendar days.
// Every rate shown or paid anywhere in the app goes through these helpers so the
// numbers never disagree.

/** Payroll divisor for a month: 30 for all months, real days for February.
 *  `month` is 1-12. Defaults to the current month. */
export function daysInMonth(year?: number, month?: number) {
    const now = new Date()
    const y = year ?? now.getFullYear()
    const m = month ?? now.getMonth() + 1
    // February → its actual length (28 or 29); every other month → flat 30.
    if (m === 2) return new Date(y, 2, 0).getDate()
    return 30
}

/** One day's pay for a monthly salary, in the given month (default: current). */
export function dailyRateOf(monthlySalary: number, year?: number, month?: number) {
    if (!monthlySalary || monthlySalary <= 0) return 0
    return monthlySalary / daysInMonth(year, month)
}

/** One hour's pay: the day's rate spread over the employee's shift hours. */
export function hourlyRateOf(monthlySalary: number, shiftHours: number, year?: number, month?: number) {
    const sh = shiftHours > 0 ? shiftHours : 8
    return dailyRateOf(monthlySalary, year, month) / sh
}
