import { useState } from "react";
import {
  getActions,
  getInvoices,
  getReminders,
  type ActionItem,
  type Invoice,
  type Reminder,
} from "../api";
import Card from "../components/Card";
import ErrorBox from "../components/ErrorBox";
import ReminderPanel from "../components/ReminderPanel";
import { useAsync } from "../useAsync";

function lastReminderFor(invoice: Invoice, reminders: Reminder[]): Reminder | undefined {
  let latest: Reminder | undefined;
  for (const r of reminders) {
    if (r.invoice_id !== invoice.id) continue;
    if (!latest || r.sent_date > latest.sent_date) latest = r;
  }
  return latest;
}

export default function Actions() {
  const actions = useAsync(getActions);
  const invoices = useAsync(getInvoices);
  const reminders = useAsync(getReminders);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detailOpenId, setDetailOpenId] = useState<string | null>(null);

  const reloadAll = () => {
    actions.reload();
    invoices.reload();
    reminders.reload();
  };

  if (actions.loading || invoices.loading || reminders.loading) {
    return (
      <Card title="Today's actions">
        <p className="text-slate-500">Loading…</p>
      </Card>
    );
  }
  if (actions.error) {
    return (
      <Card title="Today's actions">
        <ErrorBox message={actions.error} />
      </Card>
    );
  }
  if (invoices.error) {
    return (
      <Card title="Today's actions">
        <ErrorBox message={invoices.error} />
      </Card>
    );
  }
  if (reminders.error) {
    return (
      <Card title="Today's actions">
        <ErrorBox message={reminders.error} />
      </Card>
    );
  }

  const actionList: ActionItem[] = actions.data ?? [];
  const invoiceList: Invoice[] = invoices.data ?? [];
  const reminderList: Reminder[] = reminders.data ?? [];

  if (actionList.length === 0) {
    return (
      <Card title="Today's actions">
        <p className="text-slate-500">Nothing needs action today. Nice work.</p>
      </Card>
    );
  }

  return (
    <Card title="Today's actions">
      <ol className="space-y-3">
        {actionList.map((item) => {
          if (item.kind === "cash_gap") {
            const expanded = detailOpenId === item.id;
            return (
              <li key={item.id} className="rounded-xl border border-red-200 bg-red-50 p-4">
                <div className="font-medium text-red-800">{item.title}</div>
                {item.detail && (
                  <>
                    <button
                      type="button"
                      onClick={() => setDetailOpenId(expanded ? null : item.id)}
                      className="mt-3 min-h-[40px] w-full rounded-xl border border-red-300 bg-white px-4 text-sm font-medium text-red-800"
                    >
                      Collect these first
                    </button>
                    {expanded && (
                      <p className="mt-3 whitespace-pre-line text-sm text-red-700">{item.detail}</p>
                    )}
                  </>
                )}
              </li>
            );
          }

          const invoice =
            item.invoiceId === null
              ? undefined
              : invoiceList.find((i) => i.id === item.invoiceId);

          return (
            <li key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="font-medium text-slate-900">{item.title}</div>
              {item.detail && <div className="text-sm text-slate-600">{item.detail}</div>}
              {invoice && (
                <>
                  <button
                    type="button"
                    onClick={() => setOpenId(openId === item.id ? null : item.id)}
                    className="mt-3 min-h-[40px] w-full rounded-xl bg-brand px-4 text-white"
                  >
                    Draft reminder
                  </button>
                  {openId === item.id && (
                    <div className="mt-3">
                      <ReminderPanel
                        invoice={invoice}
                        lastReminder={lastReminderFor(invoice, reminderList)}
                        onLogged={reloadAll}
                      />
                    </div>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
