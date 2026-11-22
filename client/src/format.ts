const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const inrFormatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** Formats a rupee amount in Indian grouping, e.g. 124500 -> "₹1,24,500", -1000 -> "-₹1,000". */
export function formatINR(n: number): string {
  const digits = inrFormatter.format(Math.abs(n));
  const negative = n < 0 && digits !== "0";
  return `${negative ? "-" : ""}₹${digits}`;
}

/** Formats "YYYY-MM-DD" as "DD Mon YYYY" without constructing a Date. */
export function formatDate(iso: string): string {
  const [yyyy = "", mm = "", dd = ""] = iso.split("-");
  const month = MONTHS[Number(mm) - 1];
  return `${dd} ${month ?? mm} ${yyyy}`;
}

/** Today's local date as "YYYY-MM-DD". */
export function todayISO(): string {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Normalises a phone number for wa.me links.
 * 10 digits -> prefixed with "91"; 12 digits starting with "91" -> as is; otherwise digits or null.
 */
export function normalisePhone(phone: string): string | null {
  const digits = phone.replace(/[\s\-()]/g, "").replace(/^\+/, "");
  if (digits.length === 10) return "91" + digits;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  return digits.length > 0 ? digits : null;
}
