import { useState } from "react";
import { getActions } from "./api";
import Dashboard from "./screens/Dashboard";
import Actions from "./screens/Actions";
import Forecast from "./screens/Forecast";
import Invoices from "./screens/Invoices";
import Students from "./screens/Students";
import { useAsync } from "./useAsync";

export type ScreenKey = "dashboard" | "invoices" | "students" | "forecast" | "actions";

const NAV: { key: ScreenKey; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "invoices", label: "Invoices" },
  { key: "students", label: "Students" },
  { key: "forecast", label: "Forecast" },
  { key: "actions", label: "Actions" },
];

function navClass(active: boolean): string {
  const base = "whitespace-nowrap rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors";
  return active
    ? `${base} bg-brand/10 text-brand`
    : `${base} text-slate-600 hover:bg-slate-100`;
}

export default function App() {
  const [screen, setScreen] = useState<ScreenKey>("dashboard");
  const actions = useAsync(getActions);
  const actionCount = actions.data?.length ?? 0;

  function renderScreen() {
    switch (screen) {
      case "dashboard":
        return <Dashboard />;
      case "invoices":
        return <Invoices />;
      case "students":
        return <Students />;
      case "forecast":
        return <Forecast />;
      case "actions":
        return <Actions />;
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Desktop sidebar */}
      <aside className="hidden md:fixed md:inset-y-0 md:left-0 md:flex md:w-56 md:flex-col md:border-r md:bg-white">
        <div className="border-b px-5 py-5">
          <div className="text-lg font-bold">Chitragupt</div>
          <div className="mt-1 text-xs text-slate-500">
            The divine accountant for your tuition business.
          </div>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {NAV.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setScreen(item.key)}
              className={navClass(screen === item.key)}
            >
              {item.label}
              {item.key === "actions" && actionCount > 0 && (
                <span className="ml-2 rounded-full bg-red-600 px-1.5 text-xs text-white">
                  {actionCount}
                </span>
              )}
            </button>
          ))}
        </nav>
      </aside>

      {/* Mobile header with horizontally scrolling nav */}
      <header className="border-b bg-white md:hidden">
        <div className="px-4 pb-1 pt-3">
          <div className="text-base font-bold">Chitragupt</div>
          <div className="text-xs text-slate-500">
            The divine accountant for your tuition business.
          </div>
        </div>
        <nav className="flex gap-2 overflow-x-auto px-4 pb-3 pt-2">
          {NAV.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setScreen(item.key)}
              className={navClass(screen === item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="md:ml-56">
        <div className="mx-auto max-w-5xl p-4 md:p-8">{renderScreen()}</div>
      </main>
    </div>
  );
}
