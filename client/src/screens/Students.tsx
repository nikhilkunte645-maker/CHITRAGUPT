import { getStudents } from "../api";
import Card from "../components/Card";
import ErrorBox from "../components/ErrorBox";
import { useAsync } from "../useAsync";

export default function Students() {
  const { data, error, loading } = useAsync(getStudents);

  if (loading) return <p className="text-slate-500">Loading…</p>;
  if (error) return <ErrorBox message={error} />;

  const students = data ?? [];

  return (
    <Card title="Students">
      {students.length === 0 && <p className="text-slate-500">No students yet.</p>}
      {/* Mobile: stacked cards */}
      <ul className="space-y-3 md:hidden">
        {students.map((s) => (
          <li key={s.id} className="rounded-xl border border-slate-200 p-4">
            <div className="font-medium text-slate-900">{s.name}</div>
            <div className="mt-1 text-sm text-slate-600">
              Parent: {s.parent_name ?? "—"}
            </div>
            <div className="text-sm text-slate-600">Phone: {s.phone ?? "—"}</div>
            <div className="text-sm text-slate-500">Batch: {s.batch_name ?? "—"}</div>
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
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} className="border-b border-slate-100">
                <td className="py-2 pr-4 text-slate-900">{s.name}</td>
                <td className="py-2 pr-4 text-slate-600">{s.parent_name ?? "—"}</td>
                <td className="py-2 pr-4 text-slate-600">{s.phone ?? "—"}</td>
                <td className="py-2 pr-4 text-slate-600">{s.batch_name ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
