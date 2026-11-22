import { useState } from "react";
import { getBatches, getStudents } from "../api";
import Card from "../components/Card";
import ErrorBox from "../components/ErrorBox";
import StudentForm from "../components/StudentForm";
import StudentProfileView from "../components/StudentProfileView";
import { useAsync } from "../useAsync";

const primaryButtonClass = "min-h-[40px] rounded-xl bg-brand px-4 text-white";
const secondaryButtonClass =
  "min-h-[40px] rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-700";

export default function Students() {
  const students = useAsync(getStudents);
  const batches = useAsync(getBatches);
  const [showAdd, setShowAdd] = useState<boolean>(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const reloadAll = () => {
    students.reload();
    batches.reload();
  };

  if (selectedId !== null) {
    return (
      <StudentProfileView studentId={selectedId} onBack={() => setSelectedId(null)} />
    );
  }

  const studentList = students.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Students</h2>
          <p className="text-sm text-slate-600">
            Students, their batches and fees. Select a student to see invoices and payments.
          </p>
        </div>
        <button type="button" onClick={() => setShowAdd((v) => !v)} className={primaryButtonClass}>
          Add student
        </button>
      </div>

      {showAdd && (
        <Card title="New student">
          {batches.error && <ErrorBox message={batches.error} />}
          <StudentForm batches={batches.data ?? []} onCreated={reloadAll} />
        </Card>
      )}

      <Card>
        {students.loading && <p className="text-slate-500">Loading…</p>}
        {!students.loading && students.error && <ErrorBox message={students.error} />}
        {!students.loading && !students.error && (
          <>
            {studentList.length === 0 && (
              <p className="text-slate-500">No students yet. Use Add student to create the first one.</p>
            )}

            {/* Mobile: stacked cards */}
            <ul className="space-y-3 md:hidden">
              {studentList.map((s) => (
                <li key={s.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="font-medium text-slate-900">{s.name}</div>
                  <div className="mt-1 text-sm text-slate-600">
                    Parent: {s.parent_name ?? "—"}
                  </div>
                  <div className="text-sm text-slate-600">Phone: {s.phone ?? "—"}</div>
                  <div className="text-sm text-slate-500">Batch: {s.batch_name ?? "—"}</div>
                  <button
                    type="button"
                    onClick={() => setSelectedId(s.id)}
                    className={`${secondaryButtonClass} mt-3 w-full`}
                  >
                    View details
                  </button>
                </li>
              ))}
            </ul>

            {/* md+: table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Name</th>
                    <th className="py-2 pr-4 font-medium">Parent</th>
                    <th className="py-2 pr-4 font-medium">Phone</th>
                    <th className="py-2 pr-4 font-medium">Batch</th>
                    <th className="py-2 pr-4 font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {studentList.map((s) => (
                    <tr key={s.id} className="border-b border-slate-100">
                      <td className="py-2 pr-4 text-slate-900">{s.name}</td>
                      <td className="py-2 pr-4 text-slate-600">{s.parent_name ?? "—"}</td>
                      <td className="py-2 pr-4 text-slate-600">{s.phone ?? "—"}</td>
                      <td className="py-2 pr-4 text-slate-600">{s.batch_name ?? "—"}</td>
                      <td className="py-2 pr-4">
                        <button
                          type="button"
                          onClick={() => setSelectedId(s.id)}
                          className={secondaryButtonClass}
                        >
                          View details
                        </button>
                      </td>
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
