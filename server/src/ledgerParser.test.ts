import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLedgerText, type StudentRef } from "./ledgerParser.js";

const STUDENTS: StudentRef[] = [
  { id: 1, name: "Aarav Sharma" },
  { id: 2, name: "Priya Nair" },
  { id: 3, name: "Rohan Gupta" },
  { id: 4, name: "Ananya Iyer" },
];
const TODAY = "2026-11-22";
const UNPAID = new Map<number, number>([[4, 3000]]);

test("simple payment today", () => {
  const r = parseLedgerText("Aarav paid 3000 today", STUDENTS, TODAY, UNPAID);
  assert.equal(r.candidates.length, 1);
  const c = r.candidates[0];
  assert.equal(c.studentId, 1);
  assert.equal(c.amount, 3000);
  assert.equal(c.date, "2026-11-22");
  assert.equal(c.intent, "payment");
  assert.equal(r.needsStudentChoice, false);
});

test("comma amount with rupee sign and noise words", () => {
  const r = parseLedgerText("Received ₹2,500 from Priya's mom via UPI", STUDENTS, TODAY, UNPAID);
  assert.equal(r.candidates.length, 1);
  assert.equal(r.candidates[0].studentId, 2);
  assert.equal(r.candidates[0].amount, 2500);
  assert.equal(r.candidates[0].intent, "payment");
});

test("pending with no amount", () => {
  const r = parseLedgerText("Rohan fees pending", STUDENTS, TODAY, UNPAID);
  assert.equal(r.candidates.length, 1);
  assert.equal(r.candidates[0].studentId, 3);
  assert.equal(r.candidates[0].intent, "pending");
  assert.equal(r.candidates[0].amount, 0);
  assert.notEqual(r.note, null);
});

test("fraction of oldest unpaid invoice", () => {
  const r = parseLedgerText("Ananya paid 2/3 of the fee", STUDENTS, TODAY, UNPAID);
  assert.equal(r.candidates.length, 1);
  assert.equal(r.candidates[0].studentId, 4);
  assert.equal(r.candidates[0].amount, 2000);
});

test("k suffix and yesterday", () => {
  const r = parseLedgerText("Aarav paid 2.5k yesterday", STUDENTS, TODAY, UNPAID);
  assert.equal(r.candidates.length, 1);
  assert.equal(r.candidates[0].amount, 2500);
  assert.equal(r.candidates[0].date, "2026-11-21");
});

test("ambiguous first name needs a student choice", () => {
  const twoRavis: StudentRef[] = [
    { id: 5, name: "Ravi Kumar" },
    { id: 6, name: "Ravi Shah" },
  ];
  const r = parseLedgerText("Ravi paid 1000", twoRavis, TODAY, new Map());
  assert.equal(r.needsStudentChoice, true);
  assert.equal(r.candidates.length, 0);
  assert.equal(r.matches.length, 2);
});

test("no student matched lists all students", () => {
  const r = parseLedgerText("paid 1000 today", STUDENTS, TODAY, UNPAID);
  assert.equal(r.needsStudentChoice, true);
  assert.equal(r.candidates.length, 0);
  assert.equal(r.matches.length, 4);
});
