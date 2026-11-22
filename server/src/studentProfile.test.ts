import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildStudentProfile,
  type ProfileInvoice,
  type ProfilePayment,
  type ProfileStudent,
} from "./studentProfile.js";

const STUDENT: ProfileStudent = {
  id: 1,
  name: "Aarav Sharma",
  parent_name: "Sunita Sharma",
  phone: "9876543210",
  batch_id: 1,
  batch_name: "Class 8 Maths",
  monthly_fee: 2500,
};

const INV1: ProfileInvoice = {
  id: 1,
  amount: 2500,
  issue_date: "2026-10-01",
  due_date: "2026-10-10",
  paid: 2500,
  balance: 0,
  status: "paid",
  days_overdue: 0,
};

const INV2: ProfileInvoice = {
  id: 2,
  amount: 2500,
  issue_date: "2026-11-01",
  due_date: "2026-11-10",
  paid: 1000,
  balance: 1500,
  status: "partial",
  days_overdue: 12,
};

const INV3: ProfileInvoice = {
  id: 3,
  amount: 2500,
  issue_date: "2026-12-01",
  due_date: "2026-12-10",
  paid: 0,
  balance: 2500,
  status: "unpaid",
  days_overdue: 0,
};

const PAY1: ProfilePayment = { id: 1, invoice_id: 1, amount: 2500, date: "2026-11-01", method: "UPI" };
const PAY2: ProfilePayment = { id: 2, invoice_id: 2, amount: 1000, date: "2026-11-15", method: "Cash" };

test("student with no invoices or payments has zero summary", () => {
  const profile = buildStudentProfile(STUDENT, [], []);
  assert.deepEqual(profile.summary, {
    totalInvoiced: 0,
    totalPaid: 0,
    outstanding: 0,
    overdue: 0,
    pendingInvoiceCount: 0,
  });
  assert.deepEqual(profile.invoices, []);
  assert.deepEqual(profile.payments, []);
  assert.deepEqual(profile.student, STUDENT);
});

test("summary totals come from server-provided invoice and payment values", () => {
  const profile = buildStudentProfile(STUDENT, [INV1, INV2], [PAY1, PAY2]);
  assert.equal(profile.summary.totalInvoiced, 5000);
  assert.equal(profile.summary.totalPaid, 3500);
  assert.equal(profile.summary.outstanding, 1500);
  assert.equal(profile.summary.overdue, 1500);
  assert.equal(profile.summary.pendingInvoiceCount, 1);
});

test("unpaid invoice adds to outstanding and pending count, not to overdue when not late", () => {
  const profile = buildStudentProfile(STUDENT, [INV1, INV2, INV3], [PAY1, PAY2]);
  assert.equal(profile.summary.outstanding, 4000);
  assert.equal(profile.summary.overdue, 1500);
  assert.equal(profile.summary.pendingInvoiceCount, 2);
});

test("invoices sort by due_date then id, payments by date then id", () => {
  const profile = buildStudentProfile(STUDENT, [INV3, INV2, INV1], [PAY2, PAY1]);
  assert.deepEqual(
    profile.invoices.map((i) => i.id),
    [1, 2, 3],
  );
  assert.deepEqual(
    profile.payments.map((p) => p.id),
    [1, 2],
  );
});

test("inputs are not mutated", () => {
  const invoices = [INV3, INV2, INV1];
  const payments = [PAY2, PAY1];
  const before = JSON.stringify({ invoices, payments });
  buildStudentProfile(STUDENT, invoices, payments);
  assert.equal(JSON.stringify({ invoices, payments }), before);
});

test("totalPaid equals the sum of payment amounts", () => {
  const profile = buildStudentProfile(STUDENT, [INV1, INV2], [PAY1, PAY2]);
  const paymentSum = [PAY1, PAY2].reduce((sum, p) => sum + p.amount, 0);
  assert.equal(profile.summary.totalPaid, paymentSum);
  assert.equal(paymentSum, 3500);
});
