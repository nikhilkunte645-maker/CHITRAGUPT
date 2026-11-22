import { formatDate, formatINR } from "../format";
import type { Invoice } from "../api";

interface PrintableInvoiceProps {
  invoice: Invoice;
}

function statusLabel(invoice: Invoice): string {
  if (invoice.balance > 0 && invoice.days_overdue > 0) return "Overdue";
  const s = invoice.status;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function PrintableInvoice({ invoice }: PrintableInvoiceProps) {
  const invoiceNumber = "INV-" + String(invoice.id).padStart(4, "0");

  return (
    <div className="print-only-invoice">
      <div className="border-b pb-4">
        <div className="text-xl font-bold">Chitragupt Demo Tuition</div>
        <div className="text-xs text-slate-500">
          The divine accountant for your tuition business.
        </div>
      </div>

      <div className="mt-4 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Invoice</h2>
        <div className="font-medium">{invoiceNumber}</div>
      </div>

      <table className="mt-4 w-full text-left text-sm">
        <tbody>
          <tr className="border-b">
            <th className="py-1 pr-4 font-medium text-slate-600">Student</th>
            <td className="py-1">{invoice.student_name}</td>
            <th className="py-1 pr-4 font-medium text-slate-600">Parent</th>
            <td className="py-1">{invoice.parent_name ?? "—"}</td>
          </tr>
          <tr className="border-b">
            <th className="py-1 pr-4 font-medium text-slate-600">Batch</th>
            <td className="py-1">{invoice.batch_name ?? "—"}</td>
            <th className="py-1 pr-4 font-medium text-slate-600">Status</th>
            <td className="py-1">{statusLabel(invoice)}</td>
          </tr>
          <tr className="border-b">
            <th className="py-1 pr-4 font-medium text-slate-600">Issue date</th>
            <td className="py-1">{formatDate(invoice.issue_date)}</td>
            <th className="py-1 pr-4 font-medium text-slate-600">Due date</th>
            <td className="py-1">{formatDate(invoice.due_date)}</td>
          </tr>
        </tbody>
      </table>

      <table className="mt-6 w-full text-left text-sm">
        <tbody>
          <tr className="border-b">
            <th className="py-1 pr-4 font-medium text-slate-600">Amount</th>
            <td className="py-1 text-right">{formatINR(invoice.amount)}</td>
          </tr>
          <tr className="border-b">
            <th className="py-1 pr-4 font-medium text-slate-600">Paid</th>
            <td className="py-1 text-right">{formatINR(invoice.paid)}</td>
          </tr>
          <tr>
            <th className="py-1 pr-4 font-semibold">Balance</th>
            <td className="py-1 text-right font-semibold">{formatINR(invoice.balance)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
