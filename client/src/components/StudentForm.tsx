import { useRef, useState, type FormEvent } from "react";
import { createStudent, type Batch } from "../api";
import { formatINR } from "../format";
import ErrorBox from "./ErrorBox";

const inputClass =
  "w-full min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand";
const labelClass = "flex flex-col gap-1 text-sm text-slate-600";
const submitButtonClass =
  "w-full min-h-[40px] rounded-xl bg-brand px-4 font-medium text-white sm:w-auto disabled:cursor-not-allowed disabled:opacity-50";

export default function StudentForm({
  batches,
  onCreated,
}: {
  batches: Batch[];
  onCreated: () => void;
}) {
  const [name, setName] = useState<string>("");
  const [parentName, setParentName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [batchId, setBatchId] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const submittingRef = useRef<boolean>(false);

  const selectedBatch = batches.find((b) => String(b.id) === batchId);
  const noBatches = batches.length === 0;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submittingRef.current) return;
    setError(null);
    setMessage(null);

    const trimmedName = name.trim();
    const trimmedParent = parentName.trim();
    const cleanedPhone = phone.replace(/[\s-]/g, "");

    if (trimmedName === "") {
      setError("Enter the student's name.");
      return;
    }
    if (trimmedParent === "") {
      setError("Enter the parent's name.");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(cleanedPhone)) {
      setError("Enter a valid 10-digit mobile number starting with 6, 7, 8 or 9.");
      return;
    }
    if (!selectedBatch) {
      setError("Choose a batch.");
      return;
    }

    submittingRef.current = true;
    setSaving(true);
    try {
      await createStudent({
        name: trimmedName,
        parent_name: trimmedParent,
        phone: cleanedPhone,
        batch_id: selectedBatch.id,
      });
      setName("");
      setParentName("");
      setPhone("");
      setBatchId("");
      setMessage("Student added.");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the student");
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className={labelClass}>
          Student name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Parent name
          <input
            type="text"
            value={parentName}
            onChange={(e) => setParentName(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Mobile number
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputClass}
          />
          <span className="text-xs text-slate-500">10-digit mobile number</span>
        </label>
        <div className={labelClass}>
          <label className="flex flex-col gap-1">
            Batch
            <select
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              disabled={noBatches}
              className={inputClass}
            >
              <option value="">Choose a batch</option>
              {batches.map((b) => (
                <option key={b.id} value={String(b.id)}>
                  {`${b.name} (${formatINR(b.monthly_fee)}/month)`}
                </option>
              ))}
            </select>
          </label>
          {selectedBatch && (
            <span className="text-sm text-slate-700">
              Monthly fee: {formatINR(selectedBatch.monthly_fee)} (set by the batch)
            </span>
          )}
        </div>
      </div>
      {noBatches && (
        <p className="text-sm text-amber-700">Create a batch before adding students.</p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={saving || noBatches} className={submitButtonClass}>
          {saving ? "Adding…" : "Add student"}
        </button>
        {message && <span className="text-sm text-green-700">{message}</span>}
      </div>
      {error && <ErrorBox message={error} />}
    </form>
  );
}
