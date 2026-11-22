import { useEffect, useState } from "react";
import { getForecast } from "../api";
import type { ForecastResult } from "../api";
import Card from "../components/Card";
import ErrorBox from "../components/ErrorBox";
import ForecastChart from "../components/ForecastChart";
import { formatDate, formatINR } from "../format";

type Horizon = 30 | 60 | 90;
const HORIZONS: Horizon[] = [30, 60, 90];

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong";
}

function horizonClass(active: boolean): string {
  const base = "rounded-xl px-4 py-2 text-sm font-medium transition-colors";
  return active
    ? `${base} bg-brand text-white`
    : `${base} border border-slate-200 bg-white text-slate-600 hover:bg-slate-100`;
}

export default function Forecast() {
  const [horizon, setHorizon] = useState<Horizon>(90);
  const [delay, setDelay] = useState<number>(0);
  // Base = no delay for the largest payer; scenario = with the chosen delay. Both come from the server.
  const [base, setBase] = useState<ForecastResult | null>(null);
  const [baseError, setBaseError] = useState<string | null>(null);
  const [scenario, setScenario] = useState<ForecastResult | null>(null);
  const [scenarioError, setScenarioError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getForecast(horizon, 0)
      .then((result) => {
        if (cancelled) return;
        setBase(result);
        setBaseError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setBaseError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [horizon]);

  useEffect(() => {
    let cancelled = false;
    getForecast(horizon, delay)
      .then((result) => {
        if (cancelled) return;
        setScenario(result);
        setScenarioError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setScenarioError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [horizon, delay]);

  const error = scenarioError ?? baseError;
  const showComparison = delay > 0 && base !== null && scenario !== null;

  return (
    <div className="space-y-4">
      <Card title="Forecast">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Forecast horizon">
            {HORIZONS.map((h) => (
              <button
                key={h}
                type="button"
                aria-pressed={horizon === h}
                onClick={() => setHorizon(h)}
                className={horizonClass(horizon === h)}
              >
                {h} days
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="delay-slider" className="text-sm font-medium text-slate-700">
              Largest payer pays {delay} days late
            </label>
            <input
              id="delay-slider"
              type="range"
              min={0}
              max={30}
              step={1}
              value={delay}
              onChange={(e) => setDelay(Number(e.target.value))}
              className="w-full accent-brand"
            />
          </div>

          {showComparison && base && scenario ? (
            <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
              <div className="font-medium">Base forecast vs your scenario</div>
              <div>
                Base lowest: {formatINR(base.lowestBalance)} on {formatDate(base.lowestDate)}
              </div>
              <div>
                Your scenario lowest: {formatINR(scenario.lowestBalance)} on{" "}
                {formatDate(scenario.lowestDate)}
              </div>
            </div>
          ) : null}
        </div>
      </Card>

      {error ? <ErrorBox message={error} /> : null}

      {scenario === null && error === null ? (
        <p className="text-sm text-slate-500">Loading forecast…</p>
      ) : null}

      {scenario ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card title="Lowest balance">
              <div className="text-lg font-semibold">{formatINR(scenario.lowestBalance)}</div>
              <div className="text-xs text-slate-500">on {formatDate(scenario.lowestDate)}</div>
            </Card>
            <Card title="Expected collections">
              <div className="text-lg font-semibold">
                {formatINR(scenario.totalExpectedCollections)}
              </div>
            </Card>
            <Card title="Unaffordable bills">
              <div className="text-lg font-semibold">{scenario.unaffordableBills.length}</div>
            </Card>
            <Card title="Largest payer">
              <div className="text-lg font-semibold">{scenario.largestPayer?.name ?? "—"}</div>
              {scenario.largestPayer ? (
                <div className="text-xs text-slate-500">
                  outstanding {formatINR(scenario.largestPayer.outstanding)}
                </div>
              ) : null}
            </Card>
          </div>

          <Card title="Projected balance">
            {delay > 0 ? (
              <p className="mb-2 text-xs text-slate-500">
                Solid line: your scenario. Dashed grey line: base forecast (no delay).
              </p>
            ) : null}
            <ForecastChart
              days={scenario.days}
              baseDays={delay > 0 && base ? base.days : undefined}
            />
          </Card>

          <Card title="Unaffordable bills">
            {scenario.unaffordableBills.length === 0 ? (
              <p className="text-sm text-emerald-700">No bill goes below zero in this period.</p>
            ) : (
              <ul className="space-y-2">
                {scenario.unaffordableBills.map((b, idx) => (
                  <li key={`${b.name}-${b.date}-${idx}`} className="text-sm text-red-700">
                    <div className="font-medium">
                      {b.name} · {formatDate(b.date)} · {formatINR(b.amount)}
                    </div>
                    <div className="text-xs">balance after {formatINR(b.balanceAfter)}</div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}
