import { useRef, useState } from "react";
import {
  parseLedger,
  recordPayment,
  type LedgerCandidate,
  type LedgerParseResult,
} from "../api";
import { formatDate, formatINR } from "../format";
import ErrorBox from "./ErrorBox";

const primaryButtonClass =
  "min-h-[40px] rounded-xl bg-brand px-4 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClass =
  "min-h-[40px] rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50";
const buttonRowClass = "flex flex-col gap-2 sm:flex-row sm:flex-wrap";

function messageFrom(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

/** Why Confirm is blocked for a candidate, or null when it can be confirmed. */
function blockReason(c: LedgerCandidate): string | null {
  if (c.intent === "pending") return "Pending: nothing recorded";
  if (!(c.amount > 0)) return "Amount not given";
  if (c.invoiceId === null) return "No unpaid invoice for this student";
  return null;
}

export default function PasteToLedger({ onSaved }: { onSaved: () => void }) {
  const [text, setText] = useState<string>("");
  const [review, setReview] = useState<LedgerParseResult | null>(null);
  const [parsing, setParsing] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const savingRef = useRef<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState<boolean>(false);

  const trimmed = text.trim();

  // Parsing only reads the text and shows a review; it never saves.
  async function handleParse() {
    if (trimmed === "" || parsing || saving) return;
    setParsing(true);
    setParseError(null);
    setSaveError(null);
    setSaved(false);
    try {
      const result = await parseLedger(trimmed);
      setReview(result);
    } catch (err) {
      setReview(null);
      setParseError(messageFrom(err, "Could not read that message"));
    } finally {
      setParsing(false);
    }
  }

  function handleCancel() {
    setReview(null);
    setSaveError(null);
  }

  async function handleConfirm(c: LedgerCandidate) {
    const invoiceId = c.invoiceId;
    if (savingRef.current || invoiceId === null || blockReason(c) !== null) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      await recordPayment(invoiceId, { amount: c.amount, date: c.date, method: "UPI" });
      setText("");
      setReview(null);
      setSaved(true);
      onSaved();
    } catch (err) {
      setSaveError(messageFrom(err, "Could not record the payment"));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <textarea
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Aarav paid 3000 today"
          className="min-h-[110px] w-full rounded-xl border border-slate-300 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
        <div className={buttonRowClass}>
          <button
            type="button"
            onClick={handleParse}
            disabled={trimmed === "" || parsing || saving}
            className={primaryButtonClass}
          >
            Parse / Review Payment
          </button>
        </div>
      </div>

      {parsing && <p className="text-sm text-slate-500">Reading your message…</p>}
      {!parsing && review === null && parseError === null && !saved && (
        <p className="text-sm text-slate-500">
          Paste a WhatsApp-style message, then review it before saving.
        </p>
      )}

      {parseError && <ErrorBox message={parseError} />}
      {saveError && <ErrorBox message={saveError} />}
      {saved && <p className="text-sm font-medium text-green-700">Payment recorded.</p>}

      {review && (
        <div className="space-y-3">
          {review.candidates.length === 0 && !review.needsStudentChoice && (
            <p className="text-sm text-slate-500">No payment found in that text.</p>
          )}

          {review.candidates.map((c, idx) => {
            const reason = blockReason(c);
            return (
              <div
                key={`${c.studentId}-${idx}`}
                className="space-y-2 rounded-xl border border-slate-200 p-3"
              >
                <div className="font-medium text-slate-900">{c.studentName}</div>
                <div className="text-sm text-slate-700">
                  {c.amount > 0 ? (
                    formatINR(c.amount)
                  ) : (
                    <>
                      Amount not given
                      {review.note ? ` (${review.note})` : ""}
                    </>
                  )}
                </div>
                <div className="text-sm text-slate-700">Date: {formatDate(c.date)}</div>
                <div className="text-sm text-slate-600">
                  {c.invoiceId !== null
                    ? `Applies to oldest unpaid invoice #${c.invoiceId}`
                    : "No unpaid invoice for this student"}
                </div>
                {reason && <div className="text-xs text-amber-800">{reason}</div>}
                <div className={buttonRowClass}>
                  <button
                    type="button"
                    onClick={() => handleConfirm(c)}
                    disabled={saving || reason !== null}
                    className={primaryButtonClass}
                  >
                    Confirm Payment
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={saving}
                    className={secondaryButtonClass}
                  >
                    Cancel
                  </button>
                </div>
                {saving && <p className="text-sm text-slate-500">Saving…</p>}
              </div>
            );
          })}

          {review.needsStudentChoice && (
            <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm text-amber-900">
                Could not pick one student. Matches:{" "}
                {review.matches.length > 0
                  ? review.matches.map((m) => m.name).join(", ")
                  : "none"}
                .
              </p>
              <p className="text-sm text-amber-900">
                Pick the student and record the payment from the Invoices screen.
              </p>
              <div className={buttonRowClass}>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={saving}
                  className={secondaryButtonClass}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
