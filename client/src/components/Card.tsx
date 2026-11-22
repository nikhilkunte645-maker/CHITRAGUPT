import type { ReactNode } from "react";

export default function Card({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5 ${className}`}
    >
      {title ? <h2 className="mb-3 text-base font-semibold text-slate-800">{title}</h2> : null}
      {children}
    </div>
  );
}

