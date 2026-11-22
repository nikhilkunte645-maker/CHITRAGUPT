import path from "node:path";
import { pathToFileURL } from "node:url";
import { db, withTransaction } from "./db.js";
import {
  addDays,
  deriveStatus,
  monthStartMonthsAgo,
  nextDayOfMonth,
  todayISO,
} from "./money.js";
import type { PaymentMethod } from "./invoiceService.js";

const BATCHES = [
  { name: "Class 8 Maths", monthly_fee: 2500 },
  { name: "Class 10 Science", monthly_fee: 3000 },
  { name: "Class 5 Foundation", monthly_fee: 1800 },
];

/** `batch` is an index into BATCHES. */
const STUDENTS: { name: string; parent_name: string; phone: string; batch: number }[] = [
  { name: "Aarav Sharma", parent_name: "Sunita Sharma", phone: "9876543210", batch: 0 },
  { name: "Priya Nair", parent_name: "Rakesh Nair", phone: "9845012345", batch: 0 },
  { name: "Ishaan Verma", parent_name: "Anita Verma", phone: "8765432109", batch: 0 },
  { name: "Ananya Iyer", parent_name: "Suresh Iyer", phone: "9988776655", batch: 0 },
  { name: "Rohan Gupta", parent_name: "Vikas Gupta", phone: "7012345678", batch: 1 },
  { name: "Kavya Reddy", parent_name: "Lakshmi Reddy", phone: "9440123456", batch: 1 },
  { name: "Vihaan Mehta", parent_name: "Nisha Mehta", phone: "8888012345", batch: 1 },
  { name: "Diya Joshi", parent_name: "Manoj Joshi", phone: "9822334455", batch: 1 },
  { name: "Arjun Singh", parent_name: "Harpreet Singh", phone: "7878901234", batch: 2 },
  { name: "Sneha Patil", parent_name: "Deepa Patil", phone: "9123456780", batch: 2 },
  { name: "Kabir Khanna", parent_name: "Rajesh Khanna", phone: "8130457896", batch: 2 },
  { name: "Meera Pillai", parent_name: "Gopinath Pillai", phone: "9567890123", batch: 2 },
];

const BILLS = [
  { name: "Rent", amount: 12000, day: 1 },
  { name: "Internet", amount: 999, day: 5 },
  { name: "Assistant salary", amount: 5000, day: 1 },
  { name: "Electricity", amount: 1500, day: 10 },
];

/*
 * Invoice plan (30 total: 14 paid, 4 partial, 12 unpaid).
 * Paid / partial invoices are issued on the 1st of a past month (monthsAgo >= 1),
 * due 10 days later, so they are always past due for partials.
 * Unpaid invoices are placed by days overdue relative to today (dueAgo);
 * negative dueAgo means not yet due.
 */

/** [studentIndex, monthsAgo, dayAfterIssueWhenPaid, method] — paid in full. */
const PAID: [number, number, number, PaymentMethod][] = [
  [0, 3, 3, "UPI"],
  [0, 2, 5, "UPI"],
  [1, 2, 4, "Bank"],
  [2, 3, 6, "Cash"],
  [2, 2, 1, "UPI"],
  [3, 3, 8, "Bank"],
  [3, 1, 3, "UPI"],
  [4, 3, 2, "UPI"],
  [4, 2, 7, "Cash"],
  [5, 2, 4, "UPI"],
  [6, 3, 5, "Bank"],
  [7, 1, 6, "Cash"],
  [8, 2, 3, "UPI"],
  [9, 1, 9, "UPI"],
];

/** [studentIndex, monthsAgo, amountPaid, method] — one partial payment, balance remains. */
const PARTIAL: [number, number, number, PaymentMethod][] = [
  [6, 1, 1500, "UPI"],
  [7, 2, 1000, "Cash"],
  [10, 2, 900, "Bank"],
  [11, 1, 800, "UPI"],
];

/** [studentIndex, amount, dueAgo] — unpaid; amount 4500 for Priya is an explicit override. */
const UNPAID: [number, number, number][] = [
  [1, 4500, 18],
  [0, 2500, 5],
  [2, 2500, 9],
  [3, 2500, 12],
  [4, 3000, 14],
  [5, 3000, 7],
  [6, 3000, 22],
  [8, 1800, 25],
  [9, 1800, 16],
  [10, 1800, 20],
  [0, 2500, -3],
  [4, 3500, -6],
];

/** Seeds demo data. Returns false (and changes nothing) if students already exist. */
export function seedIfEmpty(): boolean {
  const { count } = db.prepare("SELECT COUNT(*) AS count FROM students").get() as { count: number };
  if (count > 0) return false;

  const today = todayISO();

  const insertBatch = db.prepare("INSERT INTO batches (name, monthly_fee) VALUES (?, ?)");
  const insertStudent = db.prepare(
    "INSERT INTO students (name, parent_name, phone, batch_id) VALUES (?, ?, ?, ?)",
  );
  const insertInvoice = db.prepare(
    "INSERT INTO invoices (student_id, amount, issue_date, due_date, status) VALUES (?, ?, ?, ?, ?)",
  );
  const insertPayment = db.prepare(
    "INSERT INTO payments (invoice_id, amount, date, method) VALUES (?, ?, ?, ?)",
  );
  const insertBill = db.prepare(
    "INSERT INTO bills (name, amount, due_date, recurring_monthly) VALUES (?, ?, ?, 'Y')",
  );
  const insertOneOffBill = db.prepare(
    "INSERT INTO bills (name, amount, due_date, recurring_monthly) VALUES (?, ?, ?, 'N')",
  );
  const insertSetting = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)");

  withTransaction(() => {
    const batchIds = BATCHES.map((b) => Number(insertBatch.run(b.name, b.monthly_fee).lastInsertRowid));

    const studentIds = STUDENTS.map((s) =>
      Number(insertStudent.run(s.name, s.parent_name, s.phone, batchIds[s.batch]).lastInsertRowid),
    );

    const feeOf = (studentIndex: number): number => BATCHES[STUDENTS[studentIndex].batch].monthly_fee;

    /** Inserts an invoice with an optional single payment, then sets its derived status. */
    const seedInvoice = (
      studentIndex: number,
      amount: number,
      issue: string,
      due: string,
      payment?: { amount: number; date: string; method: PaymentMethod },
    ): void => {
      const id = Number(
        insertInvoice.run(studentIds[studentIndex], amount, issue, due, "unpaid").lastInsertRowid,
      );
      const paid = payment ? payment.amount : 0;
      if (payment) insertPayment.run(id, payment.amount, payment.date, payment.method);
      db.prepare("UPDATE invoices SET status = ? WHERE id = ?").run(deriveStatus(amount, paid), id);
    };

    for (const [studentIndex, monthsAgo, dayAfter, method] of PAID) {
      const fee = feeOf(studentIndex);
      const issue = monthStartMonthsAgo(today, monthsAgo);
      seedInvoice(studentIndex, fee, issue, addDays(issue, 10), {
        amount: fee,
        date: addDays(issue, dayAfter),
        method,
      });
    }

    for (const [studentIndex, monthsAgo, paidAmount, method] of PARTIAL) {
      const fee = feeOf(studentIndex);
      const issue = monthStartMonthsAgo(today, monthsAgo);
      seedInvoice(studentIndex, fee, issue, addDays(issue, 10), {
        amount: paidAmount,
        date: addDays(issue, 3),
        method,
      });
    }

    for (const [studentIndex, amount, dueAgo] of UNPAID) {
      const due = addDays(today, -dueAgo);
      seedInvoice(studentIndex, amount, addDays(due, -10), due);
    }

    // Monthly fee invoices for next month and the month after: issued on the 1st, due on the 10th.
    // monthStartMonthsAgo accepts negative values, so -1 is next month and -2 is the month after.
    for (const monthsAgo of [-1, -2]) {
      const issue = monthStartMonthsAgo(today, monthsAgo);
      for (let studentIndex = 0; studentIndex < STUDENTS.length; studentIndex++) {
        seedInvoice(studentIndex, feeOf(studentIndex), issue, addDays(issue, 9));
      }
    }

    for (const bill of BILLS) {
      insertBill.run(bill.name, bill.amount, nextDayOfMonth(bill.day, today));
    }

    // One-off bill due on the 3rd of next month (recurring 'N').
    const nextMonthStart = monthStartMonthsAgo(today, -1);
    insertOneOffBill.run("Exam hall and study material advance", 22000, addDays(nextMonthStart, 2));

    insertSetting.run("opening_cash", "5000");
  });

  return true;
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (invokedDirectly) {
  const seeded = seedIfEmpty();
  console.log(seeded ? "Seed complete." : "Seed skipped: students already exist.");
}
