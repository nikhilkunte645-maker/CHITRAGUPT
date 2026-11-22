import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { db } from "./db.js";
import { generateMonthInvoices } from "./monthlyService.js";
import { seedIfEmpty } from "./seed.js";

// Far-future month so it never clashes with seeded invoices.
const TEST_MONTH = "2099-01";

function billedStudentCount(): number {
  const row = db
    .prepare("SELECT COUNT(*) AS n FROM students WHERE batch_id IS NOT NULL")
    .get() as { n: number };
  return row.n;
}

function billedInvoiceCountForMonth(month: string): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS n
       FROM invoices i
       JOIN students s ON s.id = i.student_id
       WHERE s.batch_id IS NOT NULL AND i.issue_date LIKE ?`,
    )
    .get(`${month}-%`) as { n: number };
  return row.n;
}

function clearMonth(month: string): void {
  db.prepare("DELETE FROM invoices WHERE issue_date LIKE ?").run(`${month}-%`);
}

describe("generateMonthInvoices", () => {
  before(() => {
    seedIfEmpty();
    clearMonth(TEST_MONTH);
  });

  after(() => {
    clearMonth(TEST_MONTH);
  });

  it("creates one invoice per billed student, then skips them on a second call", () => {
    const n = billedStudentCount();
    assert.ok(n > 0, "expected seeded students with batches");

    const first = generateMonthInvoices(TEST_MONTH);
    assert.deepEqual(first, { created: n, skipped: 0, month: TEST_MONTH });

    const second = generateMonthInvoices(TEST_MONTH);
    assert.deepEqual(second, { created: 0, skipped: n, month: TEST_MONTH });

    assert.equal(billedInvoiceCountForMonth(TEST_MONTH), n);
  });

  it("rejects an invalid month", () => {
    assert.throws(() => generateMonthInvoices("2099-13"), /month must be YYYY-MM/);
  });
});
