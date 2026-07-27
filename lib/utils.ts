
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

// ─── Salary divisor ───────────────────────────────────────────────────────────
// One day's pay = monthly salary ÷ the CALENDAR days of that month (31 in Jul,
// 30 in Jun, 28 in Feb) — not a fixed 26 or 30. Every rate shown or paid anywhere
// in the app must go through these two helpers so the numbers never disagree.

/** Calendar days in a month. `month` is 1-12. Defaults to the current month. */
export function daysInMonth(year?: number, month?: number) {
    const now = new Date()
    const y = year ?? now.getFullYear()
    const m = month ?? now.getMonth() + 1
    return new Date(y, m, 0).getDate()
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
