import { db, withTransaction } from "./db.js";
import { daysOverdue, deriveStatus, isISODate, todayISO, type PaymentStatus } from "./money.js";

export const PAYMENT_METHODS = ["UPI", "Cash", "Bank"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Error carrying an HTTP status so routes can map it to a response. */
export class ServiceError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface InvoiceView {
  id: number;
  student_id: number;
  student_name: string;
  parent_name: string | null;
  phone: string | null;
  batch_id: number | null;
  batch_name: string | null;
  amount: number;
  issue_date: string;
  due_date: string;
  paid: number;
  balance: number;
  status: PaymentStatus;
  days_overdue: number;
}

interface InvoiceRow {
  id: number;
  student_id: number;
  student_name: string;
  parent_name: string | null;
  phone: string | null;
  batch_id: number | null;
  batch_name: string | null;
  amount: number;
  issue_date: string;
  due_date: string;
  paid: number;
}

const INVOICE_SELECT = `
  SELECT i.id,
         i.student_id,
         s.name AS student_name,
         s.parent_name,
         s.phone,
         s.batch_id,
         b.name AS batch_name,
         i.amount,
         i.issue_date,
         i.due_date,
         COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = i.id), 0) AS paid
  FROM invoices i
  JOIN students s ON s.id = i.student_id
  LEFT JOIN batches b ON b.id = s.batch_id
`;

function toView(row: InvoiceRow, today: string): InvoiceView {
  const balance = row.amount - row.paid;
  return {
    id: row.id,
    student_id: row.student_id,
    student_name: row.student_name,
    parent_name: row.parent_name,
    phone: row.phone,
    batch_id: row.batch_id,
    batch_name: row.batch_name,
    amount: row.amount,
    issue_date: row.issue_date,
    due_date: row.due_date,
    paid: row.paid,
    balance,
    status: deriveStatus(row.amount, row.paid),
    days_overdue: balance > 0 ? daysOverdue(row.due_date, today) : 0,
  };
}

export function getInvoices(): InvoiceView[] {
  const today = todayISO();
  const rows = db
    .prepare(`${INVOICE_SELECT} ORDER BY i.due_date, i.id`)
    .all() as unknown as InvoiceRow[];
  return rows.map((row) => toView(row, today));
}

function getInvoiceById(id: number): InvoiceView | undefined {
  const row = db.prepare(`${INVOICE_SELECT} WHERE i.id = ?`).get(id) as InvoiceRow | undefined;
  return row ? toView(row, todayISO()) : undefined;
}

export function recordPayment(
  invoiceId: number,
  amount: unknown,
  date: unknown,
  method: unknown,
): InvoiceView {
  const invoice = getInvoiceById(invoiceId);
  if (!invoice) throw new ServiceError(404, `Invoice ${invoiceId} not found`);

  if (typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0) {
    throw new ServiceError(400, "amount must be a positive integer (rupees)");
  }
  if (amount > invoice.balance) {
    throw new ServiceError(400, `amount exceeds balance of ${invoice.balance}`);
  }
  if (!isISODate(date)) throw new ServiceError(400, "date must be YYYY-MM-DD");
  if (typeof method !== "string" || !(PAYMENT_METHODS as readonly string[]).includes(method)) {
    throw new ServiceError(400, "method must be one of UPI, Cash, Bank");
  }

  withTransaction(() => {
    db.prepare("INSERT INTO payments (invoice_id, amount, date, method) VALUES (?, ?, ?, ?)").run(
      invoiceId,
      amount,
      date,
      method,
    );
    const paid = invoice.paid + amount;
    db.prepare("UPDATE invoices SET status = ? WHERE id = ?").run(
      deriveStatus(invoice.amount, paid),
      invoiceId,
    );
  });

  return getInvoiceById(invoiceId) as InvoiceView;
}

export function createInvoice(
  studentId: unknown,
  amount: unknown,
  issueDate: unknown,
  dueDate: unknown,
): InvoiceView {
  if (typeof studentId !== "number" || !Number.isInteger(studentId) || studentId <= 0) {
    throw new ServiceError(400, "student_id must be a positive integer");
  }
  const student = db.prepare("SELECT id FROM students WHERE id = ?").get(studentId);
  if (!student) throw new ServiceError(404, `Student ${studentId} not found`);

  if (typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0) {
    throw new ServiceError(400, "amount must be a positive integer (rupees)");
  }
  if (!isISODate(issueDate)) throw new ServiceError(400, "issue_date must be YYYY-MM-DD");
  if (!isISODate(dueDate)) throw new ServiceError(400, "due_date must be YYYY-MM-DD");
  if (dueDate < issueDate) throw new ServiceError(400, "due_date cannot be before issue_date");

  const result = db
    .prepare(
      "INSERT INTO invoices (student_id, amount, issue_date, due_date, status) VALUES (?, ?, ?, ?, ?)",
    )
    .run(studentId, amount, issueDate, dueDate, deriveStatus(amount, 0));

  return getInvoiceById(Number(result.lastInsertRowid)) as InvoiceView;
}
