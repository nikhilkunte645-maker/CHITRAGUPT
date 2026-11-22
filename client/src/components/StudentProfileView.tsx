import { getStudentProfile, type StudentProfile } from "../api";
import { formatDate, formatINR } from "../format";
import { useAsync } from "../useAsync";
import Card from "./Card";
import ErrorBox from "./ErrorBox";
import StatusChip, { type ChipStatus } from "./StatusChip";

const secondaryButtonClass =
  "min-h-[40px] rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-700";

export default function StudentProfileView({
  studentId,
  onBack,
}: {
  studentId: number;
  onBack: () => void;
}) {
  const { data, error, loading } = useAsync(() => getStudentProfile(studentId), [studentId]);

  return (
    <div className="space-y-6">
      <div>
        <button type="button" onClick={onBack} className={secondaryButtonClass}>
          Back to students
        </button>
      </div>

      {loading && <p className="text-slate-500">Loading student…</p>}
      {!loading && error && (
        <div className="space-y-2">
          <ErrorBox message={error} />
          <p className="text-sm text-slate-500">
            Could not load this student. Go back to the list and open the student again to retry.
          </p>
        </div>
      )}
      {!loading && !error && data && <Profile profile={data} />}
    </div>
  );
}

function chipStatus(invoice: StudentProfile["invoices"][number]): ChipStatus {
  return invoice.balance > 0 && invoice.days_overdue > 0 ? "overdue" : invoice.status;
}

function Profile({ profile }: { profile: StudentProfile }) {
  const { student, summary, invoices, payments } = profile;

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-xl font-semibold text-slate-900">{student.name}</h2>
        <div className="mt-2 space-y-1 text-sm text-slate-600">
          <div>Parent: {student.parent_name ?? "—"}</div>
          <div>Phone: {student.phone ?? "—"}</div>
          <div>Batch: {student.batch_name ?? "No batch"}</div>
          {student.monthly_fee !== null && (
            <div>
              Monthly fee: {formatINR(student.monthly_fee)}{" "}
              <span className="text-xs text-slate-500">per month, set by the batch</span>
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <SummaryTile label="Total invoiced" value={formatINR(summary.totalInvoiced)} />
        <SummaryTile label="Total paid" value={formatINR(summary.totalPaid)} />
        <SummaryTile label="Outstanding" value={formatINR(summary.outstanding)} />
        <SummaryTile
          label="Overdue"
          value={formatINR(summary.overdue)}
          valueClassName={summary.overdue > 0 ? "text-red-700" : undefined}
        />
        <SummaryTile label="Pending invoices" value={String(summary.pendingInvoiceCount)} />
      </div>

      <Card title="Invoices">
        {invoices.length === 0 ? (
          <p className="text-slate-500">No invoices yet for this student.</p>
        ) : (
          <>
            {/* Mobile: stacked cards */}
            <ul className="space-y-3 md:hidden">
              {invoices.map((inv) => (
                <li key={inv.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-medium text-slate-900">Invoice #{inv.id}</div>
                    <div className="flex flex-col items-end">
                      <StatusChip status={chipStatus(inv)} />
                      {inv.balance > 0 && inv.days_overdue > 0 && (
                        <span className="mt-1 text-xs text-red-700">
                          {inv.days_overdue} days overdue
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    Issued {formatDate(inv.issue_date)} · Due {formatDate(inv.due_date)}
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
                </li>
              ))}
            </ul>

            {/* md+: table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Invoice</th>
                    <th className="py-2 pr-4 font-medium">Issued</th>
                    <th className="py-2 pr-4 font-medium">Due</th>
                    <th className="py-2 pr-4 font-medium">Amount</th>
                    <th className="py-2 pr-4 font-medium">Paid</th>
                    <th className="py-2 pr-4 font-medium">Balance</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-slate-100 align-top">
                      <td className="py-2 pr-4 text-slate-900">#{inv.id}</td>
                      <td className="py-2 pr-4 text-slate-600">{formatDate(inv.issue_date)}</td>
                      <td className="py-2 pr-4 text-slate-600">{formatDate(inv.due_date)}</td>
                      <td className="py-2 pr-4 text-slate-600">{formatINR(inv.amount)}</td>
                      <td className="py-2 pr-4 text-slate-600">{formatINR(inv.paid)}</td>
                      <td className="py-2 pr-4 text-slate-600">{formatINR(inv.balance)}</td>
                      <td className="py-2 pr-4">
                        <StatusChip status={chipStatus(inv)} />
                        {inv.balance > 0 && inv.days_overdue > 0 && (
                          <div className="mt-1 text-xs text-red-700">
                            {inv.days_overdue} days overdue
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <Card title="Payments">
        {payments.length === 0 ? (
          <p className="text-slate-500">No payments recorded yet.</p>
        ) : (
          <>
            {/* Mobile: stacked cards */}
            <ul className="space-y-3 md:hidden">
              {payments.map((p) => (
                <li key={p.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-medium text-slate-900">{formatINR(p.amount)}</div>
                    <div className="text-sm text-slate-600">{formatDate(p.date)}</div>
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    Invoice #{p.invoice_id} · {p.method}
                  </div>
                </li>
              ))}
            </ul>

            {/* md+: table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Date</th>
                    <th className="py-2 pr-4 font-medium">Amount</th>
                    <th className="py-2 pr-4 font-medium">Invoice</th>
                    <th className="py-2 pr-4 font-medium">Method</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100">
                      <td className="py-2 pr-4 text-slate-600">{formatDate(p.date)}</td>
                      <td className="py-2 pr-4 text-slate-900">{formatINR(p.amount)}</td>
                      <td className="py-2 pr-4 text-slate-600">#{p.invoice_id}</td>
                      <td className="py-2 pr-4 text-slate-600">{p.method}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-lg font-semibold text-slate-900 ${valueClassName ?? ""}`}>
        {value}
      </div>
    </div>
  );
}
