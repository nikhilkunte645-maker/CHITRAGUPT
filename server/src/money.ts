export type PaymentStatus = "paid" | "partial" | "unpaid";

const DAY_MS = 86_400_000;

/** Single source of truth for invoice status. Money is integer rupees. */
export function deriveStatus(amount: number, paid: number): PaymentStatus {
  if (paid >= amount) return "paid";
  if (paid > 0) return "partial";
  return "unpaid";
}

function toUTCms(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUTCms(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function isISODate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return fromUTCms(toUTCms(value)) === value;
}

/** Whole days past due; 0 if not yet past due. */
export function daysOverdue(dueDate: string, today: string): number {
  const diff = Math.round((toUTCms(today) - toUTCms(dueDate)) / DAY_MS);
  return diff > 0 ? diff : 0;
}

export function addDays(iso: string, days: number): string {
  return fromUTCms(toUTCms(iso) + days * DAY_MS);
}

/** First day of the month that is `monthsAgo` months before the month of `iso`. */
export function monthStartMonthsAgo(iso: string, monthsAgo: number): string {
  const [y, m] = iso.split("-").map(Number);
  return fromUTCms(Date.UTC(y, m - 1 - monthsAgo, 1));
}

/** Next occurrence (today included) of a day-of-month, as YYYY-MM-DD. */
export function nextDayOfMonth(day: number, today: string): string {
  const [y, m, d] = today.split("-").map(Number);
  const monthOffset = d > day ? 1 : 0;
  return fromUTCms(Date.UTC(y, m - 1 + monthOffset, day));
}

/** Today's date in Asia/Kolkata as YYYY-MM-DD. */
export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Indian digit grouping: 124500 -> "₹1,24,500". */
export function formatINR(n: number): string {
  const sign = n < 0 ? "-" : "";
  const digits = String(Math.round(Math.abs(n)));
  if (digits.length <= 3) return `${sign}₹${digits}`;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${sign}₹${rest},${last3}`;
}
