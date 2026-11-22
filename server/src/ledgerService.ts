import { db } from "./db.js";
import { getInvoices } from "./invoiceService.js";
import { parseLedgerText, type ParseResult } from "./ledgerParser.js";

export interface OldestUnpaid {
  id: number;
  amount: number;
}

/** Oldest open invoice (balance > 0) for a student: smallest due_date, then smallest id. */
export function oldestUnpaidInvoice(studentId: number): OldestUnpaid | null {
  const open = getInvoices().filter(
    (inv) => inv.student_id === studentId && inv.balance > 0,
  );
  if (open.length === 0) return null;
  open.sort((a, b) => {
    if (a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1;
    return a.id - b.id;
  });
  const first = open[0];
  return { id: first.id, amount: first.amount };
}

/** Parses a free-text ledger note against current students. Read-only. */
export function parseForLedger(text: string, today: string): ParseResult {
  const students = db
    .prepare("SELECT id, name FROM students ORDER BY id")
    .all() as { id: number; name: string }[];

  const oldestUnpaidAmount = new Map<number, number>();
  for (const student of students) {
    const oldest = oldestUnpaidInvoice(student.id);
    if (oldest) oldestUnpaidAmount.set(student.id, oldest.amount);
  }

  return parseLedgerText(text, students, today, oldestUnpaidAmount);
}
