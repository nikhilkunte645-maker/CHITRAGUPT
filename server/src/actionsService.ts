import { getInvoices } from "./invoiceService.js";
import { buildForecast } from "./forecastService.js";
import { formatINR } from "./money.js";

export interface ActionItem {
  id: string;
  kind: "chase" | "cash_gap";
  priority: number;
  title: string;
  detail: string;
  invoiceId: number | null;
  amount: number | null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-12-12" -> "12 Dec 2026". */
function formatDateLong(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d} ${MONTHS[Number(m) - 1]} ${y}`;
}

/** Ranked collection actions: cash gap first (if any), then the top overdue invoices. */
export function buildActions(today: string): ActionItem[] {
  const invoices = getInvoices();
  const items: ActionItem[] = [];

  const chase = invoices
    .filter((inv) => inv.balance > 0 && inv.days_overdue > 0)
    .map((inv) => ({ inv, score: inv.balance * inv.days_overdue }))
    .sort((a, b) => b.score - a.score || a.inv.id - b.inv.id)
    .slice(0, 5);

  chase.forEach(({ inv }, index) => {
    items.push({
      id: `chase-${inv.id}`,
      kind: "chase",
      priority: index + 1,
      title: `Chase ${inv.student_name}: ${formatINR(inv.balance)} overdue ${inv.days_overdue} days`,
      detail: inv.parent_name ?? "",
      invoiceId: inv.id,
      amount: inv.balance,
    });
  });

  const forecast = buildForecast(today, 90, 0);
  const firstGap = forecast.unaffordableBills[0];
  if (firstGap) {
    const topPayers = invoices
      .filter((inv) => inv.balance > 0)
      .sort((a, b) => b.balance - a.balance || a.id - b.id)
      .slice(0, 3)
      .map((inv) => `${inv.student_name} (${formatINR(inv.balance)})`)
      .join(", ");
    items.push({
      id: "cash-gap",
      kind: "cash_gap",
      priority: 0,
      title: `Cash goes below zero on ${formatDateLong(firstGap.date)} when ${firstGap.name} is due - collect these first`,
      detail: topPayers,
      invoiceId: null,
      amount: firstGap.amount,
    });
  }

  return items.sort((a, b) => a.priority - b.priority);
}
