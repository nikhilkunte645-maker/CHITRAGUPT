// Pure read-only aggregation for a student profile. No database access here:
// the caller supplies server-computed invoice rows and payment rows.

export interface ProfileStudent {
  id: number;
  name: string;
  parent_name: string | null;
  phone: string | null;
  batch_id: number | null;
  batch_name: string | null;
  monthly_fee: number | null;
}

export interface ProfileInvoice {
  id: number;
  amount: number;
  issue_date: string;
  due_date: string;
  paid: number;
  balance: number;
  status: "paid" | "partial" | "unpaid";
  days_overdue: number;
}

export interface ProfilePayment {
  id: number;
  invoice_id: number;
  amount: number;
  date: string;
  method: string;
}

export interface ProfileSummary {
  totalInvoiced: number;
  totalPaid: number;
  outstanding: number;
  overdue: number;
  pendingInvoiceCount: number;
}

export interface StudentProfile {
  student: ProfileStudent;
  summary: ProfileSummary;
  invoices: ProfileInvoice[];
  payments: ProfilePayment[];
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function buildStudentProfile(
  student: ProfileStudent,
  invoices: ProfileInvoice[],
  payments: ProfilePayment[],
): StudentProfile {
  const sortedInvoices = invoices
    .map((inv) => ({ ...inv }))
    .sort((a, b) => compareText(a.due_date, b.due_date) || a.id - b.id);
  const sortedPayments = payments
    .map((p) => ({ ...p }))
    .sort((a, b) => compareText(a.date, b.date) || a.id - b.id);

  let totalInvoiced = 0;
  let totalPaid = 0;
  let outstanding = 0;
  let overdue = 0;
  let pendingInvoiceCount = 0;

  for (const inv of sortedInvoices) {
    totalInvoiced += inv.amount;
    totalPaid += inv.paid;
    if (inv.balance > 0) {
      outstanding += inv.balance;
      pendingInvoiceCount += 1;
      if (inv.days_overdue > 0) overdue += inv.balance;
    }
  }

  return {
    student: { ...student },
    summary: { totalInvoiced, totalPaid, outstanding, overdue, pendingInvoiceCount },
    invoices: sortedInvoices,
    payments: sortedPayments,
  };
}
