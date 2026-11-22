import { db, withTransaction } from "./db.js";

export interface GenerateResult {
  created: number;
  skipped: number;
  month: string;
}

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Day of month that monthly invoices are due, from settings.monthly_due_day.
 * Valid range 1..28; missing or invalid values fall back to 10.
 */
export function getMonthlyDueDay(): number {
  const row = db
    .prepare("SELECT value FROM settings WHERE key = 'monthly_due_day'")
    .get() as { value: string | null } | undefined;
  const raw = (row?.value ?? "").trim();
  const parsed = /^\d{1,2}$/.test(raw) ? Number(raw) : NaN;
  return parsed >= 1 && parsed <= 28 ? parsed : 10;
}

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
  const dueDate = `${month}-${String(getMonthlyDueDay()).padStart(2, "0")}`;

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
