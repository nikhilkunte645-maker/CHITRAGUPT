import { useState } from "react";
import { createReminder, type Invoice, type Reminder } from "../api";
import { formatDate, formatINR, normalisePhone } from "../format";
import ErrorBox from "./ErrorBox";

type Props = {
  invoice: Invoice;
  lastReminder?: Reminder;
  onLogged: () => void;
};

export default function ReminderPanel({ invoice, lastReminder, onLogged }: Props) {
  const [message, setMessage] = useState<string>(
    `Namaste ${invoice.parent_name ? invoice.parent_name + "ji" : "Sir/Madam"}, a gentle reminder that the fee of ${formatINR(invoice.balance)} for ${invoice.student_name}${invoice.batch_name ? ` (${invoice.batch_name})` : ""} was due on ${formatDate(invoice.due_date)} and is still pending. Please pay at your earliest convenience. Thank you! — your tutor`
  );
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const digits = invoice.phone ? normalisePhone(invoice.phone) : null;

  async function handleSend() {
    if (!digits) return;
    setError(null);
    setSent(false);
    setSending(true);
    window.open(
      `https://wa.me/${digits}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer"
    );
    try {
      await createReminder({ invoice_id: invoice.id, message });
      setSent(true);
      onLogged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <textarea
        rows={5}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
      />

      {!digits && (
        <p className="text-sm text-slate-500">No phone number on file</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSend}
          disabled={!digits || sending}
          className="min-h-[40px] rounded-xl bg-brand px-4 text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? "Sending…" : "Send on WhatsApp"}
        </button>
        {sent && <span className="text-sm text-emerald-700">Logged as sent today</span>}
        {lastReminder && (
          <span className="text-sm text-slate-500">
            Last reminder sent {formatDate(lastReminder.sent_date)}
          </span>
        )}
      </div>

      {error && <ErrorBox message={error} />}
    </div>
  );
}
