import { useEffect, useState, type FormEvent } from "react";
import {
  createInvoice,
  generateMonthInvoices,
  getInvoices,
  getStudents,
  recordPayment,
  type Invoice,
  type PaymentMethod,
} from "../api";
import Card from "../components/Card";
import ErrorBox from "../components/ErrorBox";
import PrintableInvoice from "../components/PrintableInvoice";
import StatusChip from "../components/StatusChip";
import { formatDate, formatINR, todayISO } from "../format";
import { useAsync } from "../useAsync";

const inputClass =
  "w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand";
const labelClass = "flex flex-col gap-1 text-sm text-slate-600";
const primaryButtonClass =
  "min-h-[40px] rounded-xl bg-brand px-4 text-white disabled:cursor-not-allowed disabled:opacity-50";
const pdfButtonClass = "no-print mt-2 text-sm font-medium text-brand underline";

function chipStatus(invoice: Invoice): "paid" | "partial" | "unpaid" | "overdue" {
  return invoice.balance > 0 && invoice.days_overdue > 0 ? "overdue" : invoice.status;
}

export default function Invoices() {
  const invoices = useAsync(getInvoices);
  const students = useAsync(getStudents);

  const reloadAll = () => {
    invoices.reload();
    students.reload();
  };

  // New invoice form state
  const [studentId, setStudentId] = useState<string>("");
  const [invAmount, setInvAmount] = useState<string>("");
  const [issueDate, setIssueDate] = useState<string>(todayISO());
  const [dueDate, setDueDate] = useState<string>(todayISO());
  const [invSubmitting, setInvSubmitting] = useState(false);
  const [invError, setInvError] = useState<string | null>(null);
  const [invMessage, setInvMessage] = useState<string | null>(null);

  // Record payment form state
  const [payInvoiceId, setPayInvoiceId] = useState<string>("");
  const [payAmount, setPayAmount] = useState<string>("");
  const [payDate, setPayDate] = useState<string>(todayISO());
  const [payMethod, setPayMethod] = useState<PaymentMethod>("UPI");
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [payMessage, setPayMessage] = useState<string | null>(null);

  // Monthly invoices form state
  const [genMonth, setGenMonth] = useState<string>(todayISO().slice(0, 7));
  const [genSubmitting, setGenSubmitting] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [genMessage, setGenMessage] = useState<string | null>(null);

  const invoiceList = invoices.data ?? [];
  const studentList = students.data ?? [];
  const openInvoices = invoiceList.filter((i) => i.balance > 0);

  // Invoice PDF: render the selected invoice into .print-area, print, then hide it again.
  const [printId, setPrintId] = useState<number | null>(null);
  const printInvoice = printId === null ? undefined : invoiceList.find((i) => i.id === printId);

  useEffect(() => {
    if (printId === null) return;
    const frame = requestAnimationFrame(() => {
      window.print();
      setPrintId(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [printId]);

  async function handleCreateInvoice(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setInvError(null);
    setInvMessage(null);
    const amount = Number(invAmount);
    if (!studentId) {
      setInvError("Please select a student.");
      return;
    }
    if (!(Number.isInteger(amount) && amount > 0)) {
      setInvError("Amount must be a whole number greater than 0.");
      return;
    }
    setInvSubmitting(true);
    try {
      await createInvoice({
        student_id: Number(studentId),
        amount,
        issue_date: issueDate,
        due_date: dueDate,
      });
      setInvAmount("");
      setInvMessage("Invoice created.");
      reloadAll();
    } catch (err) {
      setInvError(err instanceof Error ? err.message : String(err));
    } finally {
      setInvSubmitting(false);
    }
  }

  async function handleGenerateMonth() {
    setGenError(null);
    setGenMessage(null);
    setGenSubmitting(true);
    try {
      const result = await generateMonthInvoices(genMonth);
      setGenMessage(
        `Created ${result.created}, skipped ${result.skipped} (already had an invoice for ${result.month})`,
      );
      invoices.reload();
    } catch (err) {
      setGenError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenSubmitting(false);
    }
  }

  async function handleRecordPayment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPayError(null);
    setPayMessage(null);
    const amount = Number(payAmount);
    if (!payInvoiceId) {
      setPayError("Please select an invoice.");
      return;
    }
    if (!(Number.isInteger(amount) && amount > 0)) {
      setPayError("Amount must be a whole number greater than 0.");
      return;
    }
    setPaySubmitting(true);
    try {
      const updated = await recordPayment(Number(payInvoiceId), {
        amount,
        date: payDate,
        method: payMethod,
      });
      setPayAmount("");
      setPayMessage("Payment recorded. Balance now " + formatINR(updated.balance));
      reloadAll();
    } catch (err) {
      setPayError(err instanceof Error ? err.message : String(err));
    } finally {
      setPaySubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card title="Invoices">
        {invoices.loading && <p className="text-slate-500">Loading…</p>}
        {invoices.error && <ErrorBox message={invoices.error} />}
        {!invoices.loading && !invoices.error && invoiceList.length === 0 && (
          <p className="text-slate-500">No invoices yet.</p>
        )}

        {/* Mobile: stacked cards */}
        <ul className="space-y-3 md:hidden">
          {invoiceList.map((inv) => (
            <li key={inv.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-slate-900">{inv.student_name}</div>
                  <div className="text-xs text-slate-500">{inv.batch_name ?? "—"}</div>
                </div>
                <StatusChip status={chipStatus(inv)} />
              </div>
              <div className="mt-2 text-sm text-slate-600">
                Parent: {inv.parent_name ?? "—"}
              </div>
              <div className="mt-1 text-sm text-slate-600">
                Due {formatDate(inv.due_date)}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <div className="text-xs text-slate-500">Amount</div>
                  <div>{formatINR(inv.amount)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Paid</div>
                  <div>{formatINR(inv.paid)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Balance</div>
                  <div>{formatINR(inv.balance)}</div>
                </div>
              </div>
              {inv.balance > 0 && inv.days_overdue > 0 && (
              <div className="mt-2 text-sm text-red-700">
                {inv.days_overdue} days overdue
              </div>
              )}
              <button type="button" onClick={() => setPrintId(inv.id)} className={pdfButtonClass}>
              Invoice PDF
              </button>
            </li>
          ))}
        </ul>

        {/* md+: table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="py-2 pr-4 font-medium">Student</th>
                <th className="py-2 pr-4 font-medium">Parent</th>
                <th className="py-2 pr-4 font-medium">Amount</th>
                <th className="py-2 pr-4 font-medium">Due</th>
                <th className="py-2 pr-4 font-medium">Paid</th>
                <th className="py-2 pr-4 font-medium">Balance</th>
                <th className="py-2 pr-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoiceList.map((inv) => (
                <tr key={inv.id} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-4">
                    <div className="text-slate-900">{inv.student_name}</div>
                    <div className="text-xs text-slate-500">{inv.batch_name ?? "—"}</div>
                  </td>
                  <td className="py-2 pr-4 text-slate-600">{inv.parent_name ?? "—"}</td>
                  <td className="py-2 pr-4 text-slate-600">{formatINR(inv.amount)}</td>
                  <td className="py-2 pr-4 text-slate-600">{formatDate(inv.due_date)}</td>
                  <td className="py-2 pr-4 text-slate-600">{formatINR(inv.paid)}</td>
                  <td className="py-2 pr-4 text-slate-600">{formatINR(inv.balance)}</td>
                  <td className="py-2 pr-4">
                    <StatusChip status={chipStatus(inv)} />
                    {inv.balance > 0 && inv.days_overdue > 0 && (
                      <div className="mt-1 text-xs text-red-700">
                        {inv.days_overdue} days overdue
                      </div>
                    )}
                    <button type="button" onClick={() => setPrintId(inv.id)} className={pdfButtonClass}>
                      Invoice PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {printInvoice && (
        <div className="print-area">
          <PrintableInvoice invoice={printInvoice} />
        </div>
      )}

      <Card title="Monthly invoices">
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className={`${labelClass} md:w-56`}>
              Month
              <input
                type="month"
                value={genMonth}
                onChange={(e) => setGenMonth(e.target.value)}
                className={inputClass}
              />
            </label>
            <button
              type="button"
              onClick={handleGenerateMonth}
              disabled={genSubmitting || genMonth === ""}
              className={primaryButtonClass}
            >
              {genSubmitting ? "Generating…" : "Generate this month's invoices"}
            </button>
          </div>
          {genMessage && <p className="text-sm text-emerald-700">{genMessage}</p>}
          {genError && <ErrorBox message={genError} />}
        </div>
      </Card>

      <Card title="New invoice">
        <form onSubmit={handleCreateInvoice} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className={labelClass}>
              Student
              <select
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className={inputClass}
              >
                <option value="">Select a student</option>
                {studentList.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.name}
                    {s.batch_name ? ` (${s.batch_name})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Amount (₹)
              <input
                type="number"
                min={1}
                step={1}
                value={invAmount}
                onChange={(e) => setInvAmount(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Issue date
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Due date
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={invSubmitting} className={primaryButtonClass}>
              {invSubmitting ? "Creating…" : "Create invoice"}
            </button>
            {invMessage && <span className="text-sm text-emerald-700">{invMessage}</span>}
          </div>
          {invError && <ErrorBox message={invError} />}
        </form>
      </Card>

      <Card title="Record payment">
        <form onSubmit={handleRecordPayment} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className={`${labelClass} md:col-span-2`}>
              Invoice
              <select
                value={payInvoiceId}
                onChange={(e) => setPayInvoiceId(e.target.value)}
                className={inputClass}
              >
                <option value="">Select an invoice</option>
                {openInvoices.map((inv) => (
                  <option key={inv.id} value={String(inv.id)}>
                    {`${inv.student_name} · due ${formatDate(inv.due_date)} · balance ${formatINR(inv.balance)}`}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Amount (₹)
              <input
                type="number"
                min={1}
                step={1}
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Date
              <input
                type="date"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Method
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                className={inputClass}
              >
                <option value="UPI">UPI</option>
                <option value="Cash">Cash</option>
                <option value="Bank">Bank</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={paySubmitting} className={primaryButtonClass}>
              {paySubmitting ? "Recording…" : "Record payment"}
            </button>
            {payMessage && <span className="text-sm text-emerald-700">{payMessage}</span>}
          </div>
          {payError && <ErrorBox message={payError} />}
        </form>
      </Card>
    </div>
  );
}
