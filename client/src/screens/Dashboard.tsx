import { useState } from "react";
import {
  getDashboardSummary,
  getReminders,
  type Invoice,
  type Reminder,
} from "../api";
import Card from "../components/Card";
import ErrorBox from "../components/ErrorBox";
import PasteToLedger from "../components/PasteToLedger";
import ReminderPanel from "../components/ReminderPanel";
import { formatINR } from "../format";
import { useAsync } from "../useAsync";

function lastReminderFor(invoice: Invoice, reminders: Reminder[]): Reminder | undefined {
  let latest: Reminder | undefined;
  for (const r of reminders) {
    if (r.invoice_id !== invoice.id) continue;
    if (!latest || r.sent_date > latest.sent_date) latest = r;
  }
  return latest;
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const summary = useAsync(getDashboardSummary);
  const reminders = useAsync(getReminders);
  const [openId, setOpenId] = useState<number | null>(null);

  const reloadAll = () => {
    summary.reload();
    reminders.reload();
  };

  const s = summary.data;
  const reminderList = reminders.data ?? [];
  const rows: Invoice[] = s?.rows ?? [];

  return (
    <div className="space-y-6">
      <Card title="Paste to ledger">
        <PasteToLedger onSaved={reloadAll} />
      </Card>

      {(summary.loading || reminders.loading) && <p className="text-slate-500">Loading…</p>}
      {summary.error && <ErrorBox message={summary.error} />}
      {reminders.error && <ErrorBox message={reminders.error} />}

      {s && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <SummaryCard label="Total overdue" value={formatINR(s.overdueTotal)} />
            <SummaryCard label="Overdue invoices" value={String(s.overdueCount)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {s.buckets.map((b) => (
              <div
                key={b.label}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="text-sm text-slate-500">{b.label}</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">{b.count} invoices</div>
                <div className="text-sm text-slate-600">{formatINR(b.total)}</div>
              </div>
            ))}
          </div>

          <Card title="Who owes me">
            {rows.length === 0 ? (
              <p className="text-slate-500">Nothing overdue. Nice work.</p>
            ) : (
              <>
                {/* Mobile: stacked cards */}
                <ul className="space-y-3 md:hidden">
                  {rows.map((inv) => (
                    <li key={inv.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-slate-900">{inv.student_name}</div>
                          <div className="text-sm text-slate-600">{inv.parent_name ?? "—"}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-slate-900">{formatINR(inv.balance)}</div>
                          <div className="text-sm text-red-700">{inv.days_overdue} days</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setOpenId(openId === inv.id ? null : inv.id)}
                        className="mt-3 min-h-[40px] w-full rounded-xl bg-brand px-4 text-white"
                      >
                        Draft reminder
                      </button>
                      {openId === inv.id && (
                        <div className="mt-3">
                          <ReminderPanel
                            invoice={inv}
                            lastReminder={lastReminderFor(inv, reminderList)}
                            onLogged={reloadAll}
                          />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>

                {/* md+: table, scrollable on narrow widths */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-200 text-slate-500">
                      <tr>
                        <th className="py-2 pr-4 font-medium">Student</th>
                        <th className="py-2 pr-4 font-medium">Parent</th>
                        <th className="py-2 pr-4 font-medium">Balance</th>
                        <th className="py-2 pr-4 font-medium">Overdue</th>
                        <th className="py-2 pr-4 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((inv) => (
                        <FragmentRow
                          key={inv.id}
                          inv={inv}
                          isOpen={openId === inv.id}
                          onToggle={() => setOpenId(openId === inv.id ? null : inv.id)}
                          lastReminder={lastReminderFor(inv, reminderList)}
                          onLogged={reloadAll}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function FragmentRow({
  inv,
  isOpen,
  onToggle,
  lastReminder,
  onLogged,
}: {
  inv: Invoice;
  isOpen: boolean;
  onToggle: () => void;
  lastReminder?: Reminder;
  onLogged: () => void;
}) {
  return (
    <>
      <tr className="border-b border-slate-100">
        <td className="py-2 pr-4 text-slate-900">{inv.student_name}</td>
        <td className="py-2 pr-4 text-slate-600">{inv.parent_name ?? "—"}</td>
        <td className="py-2 pr-4 text-slate-900">{formatINR(inv.balance)}</td>
        <td className="py-2 pr-4 text-red-700">{inv.days_overdue} days</td>
        <td className="py-2 pr-4">
          <button
            type="button"
            onClick={onToggle}
            className="min-h-[40px] rounded-xl bg-brand px-4 text-white"
          >
            Draft reminder
          </button>
        </td>
      </tr>
      {isOpen && (
        <tr className="border-b border-slate-100">
          <td colSpan={5} className="py-3">
            <ReminderPanel invoice={inv} lastReminder={lastReminder} onLogged={onLogged} />
          </td>
        </tr>
      )}
    </>
  );
}
