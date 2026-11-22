export type ChipStatus = "paid" | "partial" | "unpaid" | "overdue";

const STYLES: Record<ChipStatus, { label: string; className: string }> = {
  paid: { label: "Paid", className: "bg-emerald-100 text-emerald-800" },
  partial: { label: "Partial", className: "bg-amber-100 text-amber-800" },
  unpaid: { label: "Unpaid", className: "bg-slate-200 text-slate-700" },
  overdue: { label: "Overdue", className: "bg-red-100 text-red-700" },
};

export default function StatusChip({ status }: { status: ChipStatus }) {
  const style = STYLES[status];
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${style.className}`}
    >
      {style.label}
    </span>
  );
}

