import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { deriveStatus, daysOverdue } from "./money.js";

interface InvoiceLike {
  amount: number;
  paid: number;
  dueDate: string;
}

/** Sum of outstanding balances for invoices that are past due (each invoice counted once, at its balance). */
function overdueTotal(list: InvoiceLike[], today: string): { total: number; count: number } {
  let total = 0;
  let count = 0;
  for (const inv of list) {
    const balance = inv.amount - inv.paid;
    if (balance > 0 && daysOverdue(inv.dueDate, today) > 0) {
      total += balance;
      count += 1;
    }
  }
  return { total, count };
}

describe("deriveStatus", () => {
  test("partial when some but not all is paid", () => {
    assert.equal(deriveStatus(5000, 2000), "partial");
  });

  test("paid when paid equals amount", () => {
    assert.equal(deriveStatus(5000, 5000), "paid");
  });

  test("unpaid when nothing is paid", () => {
    assert.equal(deriveStatus(5000, 0), "unpaid");
  });

  test("paid when paid exceeds amount", () => {
    assert.equal(deriveStatus(5000, 6000), "paid");
  });
});

describe("balance across two payments", () => {
  test("partial after first payment, paid after second", () => {
    const amount = 5000;
    let paid = 2000;
    assert.equal(amount - paid, 3000);
    assert.equal(deriveStatus(amount, paid), "partial");

    paid += 3000;
    assert.equal(amount - paid, 0);
    assert.equal(deriveStatus(amount, paid), "paid");
  });
});

describe("daysOverdue", () => {
  test("counts whole days past due", () => {
    assert.equal(daysOverdue("2026-11-01", "2026-11-19"), 18);
  });

  test("0 when due date is after today", () => {
    assert.equal(daysOverdue("2026-11-25", "2026-11-22"), 0);
  });

  test("0 when due date is today", () => {
    assert.equal(daysOverdue("2026-11-22", "2026-11-22"), 0);
  });
});

describe("overdue total", () => {
  test("sums balances once per invoice with today 2026-11-22", () => {
    const invoices: InvoiceLike[] = [
      { amount: 4500, paid: 0, dueDate: "2026-11-04" },
      { amount: 3000, paid: 1000, dueDate: "2026-11-10" },
      { amount: 2000, paid: 2000, dueDate: "2026-11-01" },
      { amount: 1500, paid: 0, dueDate: "2026-11-28" },
    ];
    const result = overdueTotal(invoices, "2026-11-22");
    assert.equal(result.total, 6500);
    assert.equal(result.count, 2);
  });
});
