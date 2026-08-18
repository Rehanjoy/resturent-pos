"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ChartCard, ChartEmptyState } from "./chart-card";

export interface DonutChartSlice {
  key: string;
  label: string;
  value: number;
  color: string;
}

/**
 * Donut/ring chart with a "Total ₹X" label centered inside the ring and a
 * colored legend list (amount + percentage) beside it — matches the
 * reference screenshots' payment-mode-split chart. Reused for both
 * Dashboard and Reports' revenue-by-payment-mode.
 */
export function DonutChartCard({
  title,
  subtitle,
  data,
  valueFormatter,
  emptyMessage,
  totalLabel = "Total",
}: {
  title: string;
  subtitle?: string;
  data: DonutChartSlice[];
  valueFormatter: (value: number) => string;
  emptyMessage: string;
  totalLabel?: string;
}) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0);
  const hasData = total > 0;

  return (
    <ChartCard title={title} subtitle={subtitle}>
      {!hasData ? (
        <ChartEmptyState message={emptyMessage} />
      ) : (
        <div className="flex flex-col items-center gap-6 sm:flex-row">
          <div className="relative h-[180px] w-[180px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={56}
                  outerRadius={80}
                  paddingAngle={3}
                  strokeWidth={0}
                  cornerRadius={4}
                >
                  {data.map((slice) => (
                    <Cell key={slice.key} fill={slice.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const slice = payload[0]?.payload as DonutChartSlice | undefined;
                    if (!slice) return null;
                    return (
                      <div className="rounded-lg border border-border bg-surface px-3 py-2 text-small shadow-md">
                        <p className="text-text-muted">{slice.label}</p>
                        <p className="font-semibold text-text">{valueFormatter(slice.value)}</p>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[11px] uppercase tracking-wide text-text-muted">
                {totalLabel}
              </span>
              <span className="font-heading text-h4 font-semibold text-text">
                {valueFormatter(total)}
              </span>
            </div>
          </div>

          <ul className="flex w-full flex-1 flex-col gap-3">
            {data.map((slice) => {
              const percent = total > 0 ? Math.round((slice.value / total) * 100) : 0;
              return (
                <li key={slice.key} className="flex items-center gap-2.5 text-small">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: slice.color }}
                    aria-hidden
                  />
                  <span className="flex-1 text-text">{slice.label}</span>
                  <span className="w-10 text-right tabular-nums text-text-muted">{percent}%</span>
                  <span className="w-24 text-right tabular-nums font-medium text-text">
                    {valueFormatter(slice.value)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </ChartCard>
  );
}
