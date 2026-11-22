import { db } from "./db.js";
import { getInvoices } from "./invoiceService.js";
import {
  computeForecast,
  type ForecastBill,
  type ForecastInvoice,
  type ForecastResult,
} from "./forecast.js";

interface BillRow {
  name: string;
  amount: number;
  due_date: string;
  recurring_monthly: string;
}

interface SettingRow {
  value: string | null;
}

/** Builds the cash-flow forecast from the database. Synchronous. */
export function buildForecast(
  today: string,
  horizonDays: number,
  extraDelayDays: number,
): ForecastResult {
  const setting = db
    .prepare("SELECT value FROM settings WHERE key = 'opening_cash'")
    .get() as SettingRow | undefined;
  const parsedCash = setting?.value == null ? NaN : parseInt(setting.value, 10);
  const openingCash = Number.isNaN(parsedCash) ? 0 : parsedCash;

  const invoices: ForecastInvoice[] = getInvoices()
    .filter((inv) => inv.balance > 0)
    .map((inv) => ({
      id: inv.id,
      studentId: inv.student_id,
      studentName: inv.student_name,
      balance: inv.balance,
      dueDate: inv.due_date,
    }));

  const billRows = db
    .prepare("SELECT name, amount, due_date, recurring_monthly FROM bills ORDER BY id")
    .all() as unknown as BillRow[];
  const bills: ForecastBill[] = billRows.map((b) => ({
    name: b.name,
    amount: b.amount,
    dueDate: b.due_date,
    recurringMonthly: b.recurring_monthly === "Y",
  }));

  return computeForecast({
    today,
    openingCash,
    invoices,
    bills,
    horizonDays,
    extraDelayDays,
  });
}
