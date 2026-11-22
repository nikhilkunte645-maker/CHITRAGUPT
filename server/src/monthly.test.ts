import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";

// Point the DB at a unique temp file BEFORE any DB-using module is loaded.
const tempDbPath = path.join(
  os.tmpdir(),
  `chitragupt-monthly-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`,
);
process.env.CHITRAGUPT_DB = tempDbPath;

// Dynamic imports so db.ts opens the temp file, not the real database.
const { seedIfEmpty } = await import("./seed.js");
const { generateMonthInvoices, getMonthlyDueDay } = await import("./monthlyService.js");
const { db } = await import("./db.js");

// Far-future months so they never clash with seeded invoices.
const MONTH_A = "2099-01";
const MONTH_B = "2099-02";

function invoiceDueDatesForMonth(month: string): string[] {
  const rows = db
    .prepare("SELECT due_date FROM invoices WHERE issue_date LIKE ?")
    .all(`${month}-%`) as { due_date: string }[];
  return rows.map((r) => r.due_date);
}

function invoiceCountForMonth(month: string): number {
  const row = db
    .prepare("SELECT COUNT(*) AS n FROM invoices WHERE issue_date LIKE ?")
    .get(`${month}-%`) as { n: number };
  return row.n;
}

describe("generateMonthInvoices", () => {
  after(() => {
    db.close();
    fs.rmSync(tempDbPath, { force: true });
  });

  it("creates one invoice per billed student, then skips them on a second call", () => {
    seedIfEmpty();

    const first = generateMonthInvoices(MONTH_A);
    assert.ok(first.created > 0, "expected invoices to be created");
    assert.equal(first.skipped, 0);

    const second = generateMonthInvoices(MONTH_A);
    assert.equal(second.created, 0);
    assert.equal(second.skipped, first.created);

    assert.equal(invoiceCountForMonth(MONTH_A), first.created);
  });

  it("rejects an invalid month", () => {
    assert.throws(() => generateMonthInvoices("2099-13"), /month must be YYYY-MM/);
  });

  it("uses the default due day 10 when no setting exists", () => {
    assert.equal(getMonthlyDueDay(), 10);

    const dueDates = invoiceDueDatesForMonth(MONTH_A);
    assert.ok(dueDates.length > 0);
    for (const due of dueDates) {
      assert.ok(due.endsWith("-10"), `expected due date ending -10, got ${due}`);
    }
  });

  it("uses monthly_due_day from settings when set", () => {
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('monthly_due_day', '5')").run();
    assert.equal(getMonthlyDueDay(), 5);

    const result = generateMonthInvoices(MONTH_B);
    assert.ok(result.created > 0);

    const dueDates = invoiceDueDatesForMonth(MONTH_B);
    assert.equal(dueDates.length, result.created);
    for (const due of dueDates) {
      assert.ok(due.endsWith("-05"), `expected due date ending -05, got ${due}`);
    }
  });
});
