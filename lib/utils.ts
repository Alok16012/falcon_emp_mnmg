
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

// ─── Salary divisor ───────────────────────────────────────────────────────────
// Salary is ALWAYS calculated on 30 days — every month, February included, and
// whether the month has 28, 30 or 31 days. One day's pay = monthly salary ÷ 30.
// Every rate shown or paid anywhere in the app goes through these helpers so the
// numbers never disagree (see lib/hourly-payroll.ts for the full payroll rules).

/** Payroll divisor: always 30. Arguments are kept for existing callers. */
export function daysInMonth(_year?: number, _month?: number) {
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
