import { db, withTransaction } from "./db.js";

export interface GenerateResult {
  created: number;
  skipped: number;
  month: string;
}

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Fixed rule: every monthly invoice is due on the 10th. Batches carry no due day. */
const DUE_DAY = "10";

interface BilledStudentRow {
  student_id: number;
  monthly_fee: number;
}

/**
 * Creates one unpaid invoice per student with a batch for the given YYYY-MM month.
 * Students who already have an invoice issued in that month are skipped.
 */
export function generateMonthInvoices(month: string): GenerateResult {
  if (!MONTH_PATTERN.test(month)) throw new Error("month must be YYYY-MM");

  const issueDate = `${month}-01`;
  const dueDate = `${month}-${DUE_DAY}`;

  const students = db
    .prepare(
      `SELECT s.id AS student_id, b.monthly_fee
       FROM students s
       JOIN batches b ON b.id = s.batch_id
       WHERE s.batch_id IS NOT NULL
       ORDER BY s.id`,
    )
    .all() as unknown as BilledStudentRow[];

  const findExisting = db.prepare(
    "SELECT id FROM invoices WHERE student_id = ? AND issue_date LIKE ? LIMIT 1",
  );
  const insertInvoice = db.prepare(
    "INSERT INTO invoices (student_id, amount, issue_date, due_date, status) VALUES (?, ?, ?, ?, 'unpaid')",
  );

  return withTransaction(() => {
    let created = 0;
    let skipped = 0;
    for (const student of students) {
      const existing = findExisting.get(student.student_id, `${month}-%`);
      if (existing) {
        skipped++;
        continue;
      }
      insertInvoice.run(student.student_id, student.monthly_fee, issueDate, dueDate);
      created++;
    }
    return { created, skipped, month };
  });
}
