import { test } from "node:test";
import assert from "node:assert/strict";
import { computeDashboard } from "./dashboardService.js";

const TODAY = "2026-11-22";

function inv(id: number, balance: number, due_date: string) {
  return { id, balance, due_date };
}

test("overdue totals exclude paid and not-yet-due invoices", () => {
  const result = computeDashboard(TODAY, [
    inv(1, 4500, "2026-11-04"),
    inv(2, 2000, "2026-11-10"),
    inv(3, 0, "2026-11-01"),
    inv(4, 1500, "2026-11-28"),
  ]);
  assert.equal(result.overdueTotal, 6500);
  assert.equal(result.overdueCount, 2);
});

test("bucket boundaries", () => {
  const result = computeDashboard(TODAY, [
    inv(1, 100, "2026-11-21"),
    inv(2, 100, "2026-11-15"),
    inv(3, 100, "2026-11-14"),
    inv(4, 100, "2026-11-07"),
    inv(5, 100, "2026-11-06"),
  ]);
  assert.deepEqual(
    result.buckets.map((b) => b.label),
    ["0-7 days", "8-15 days", "16+ days"],
  );
  assert.deepEqual(
    result.buckets.map((b) => b.count),
    [2, 2, 1],
  );
  assert.deepEqual(
    result.buckets.map((b) => b.total),
    [200, 200, 100],
  );
});

test("invoice due today is not overdue", () => {
  const result = computeDashboard(TODAY, [inv(1, 500, TODAY)]);
  assert.equal(result.overdueCount, 0);
  assert.equal(result.overdueTotal, 0);
  assert.equal(result.rows.length, 0);
});

test("rows sort by days overdue desc, then balance desc, then id asc", () => {
  const input = [
    inv(1, 100, "2026-11-10"),
    inv(2, 300, "2026-11-10"),
    inv(3, 50, "2026-11-01"),
    inv(4, 999, "2026-11-15"),
  ];
  const before = input.map((x) => x.id);
  const result = computeDashboard(TODAY, input);
  assert.deepEqual(
    result.rows.map((r) => r.id),
    [3, 2, 1, 4],
  );
  assert.deepEqual(
    input.map((x) => x.id),
    before,
  );
});
