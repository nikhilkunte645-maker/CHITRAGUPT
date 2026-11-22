import { daysOverdue } from "./money.js";

export interface DashboardBucket {
  label: string;
  count: number;
  total: number;
}

export interface DashboardSummary<T> {
  today: string;
  overdueTotal: number;
  overdueCount: number;
  buckets: DashboardBucket[];
  rows: T[];
}

/** Pure: summarises overdue balances. Money is integer rupees; input is not mutated. */
export function computeDashboard<T extends { id: number; balance: number; due_date: string }>(
  today: string,
  invoices: T[],
): DashboardSummary<T> {
  const overdue = invoices
    .map((inv) => ({ inv, days: daysOverdue(inv.due_date, today) }))
    .filter((x) => x.inv.balance > 0 && x.days > 0);

  const buckets: DashboardBucket[] = [
    { label: "0-7 days", count: 0, total: 0 },
    { label: "8-15 days", count: 0, total: 0 },
    { label: "16+ days", count: 0, total: 0 },
  ];

  for (const { inv, days } of overdue) {
    const index = days <= 7 ? 0 : days <= 15 ? 1 : 2;
    buckets[index].count += 1;
    buckets[index].total += inv.balance;
  }

  const rows = [...overdue]
    .sort((a, b) => b.days - a.days || b.inv.balance - a.inv.balance || a.inv.id - b.inv.id)
    .map((x) => x.inv);

  return {
    today,
    overdueTotal: overdue.reduce((sum, x) => sum + x.inv.balance, 0),
    overdueCount: overdue.length,
    buckets,
    rows,
  };
}
