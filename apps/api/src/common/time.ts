// SmartBin runs in India: quota months, "today" and daily charts all use IST
export const APP_TIMEZONE = "Asia/Kolkata";

// Current month as "YYYY-MM" in IST, so the quota month flips at midnight IST (not 05:30)
export function currentMonth(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE, year: "numeric", month: "2-digit" }).format(date);
}

// First day of next month in IST, e.g. "2026-11-01"
export function nextMonthStart(date = new Date()): string {
  const [year, month] = currentMonth(date).split("-").map(Number) as [number, number];
  return month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
}
