"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { ChartCard, ChartEmptyState } from "./chart-card";

export interface BarChartPoint {
  label: string;
  value: number;
}

/** Simple rounded-bar chart — used for Dashboard's 7-day revenue trend. */
export function BarChartCard({
  title,
  subtitle,
  data,
  valueFormatter,
  emptyMessage,
  color = "var(--color-primary)",
}: {
  title: string;
  subtitle?: string;
  data: BarChartPoint[];
  valueFormatter: (value: number) => string;
  emptyMessage: string;
  color?: string;
}) {
  const hasData = data.some((point) => point.value > 0);

  return (
    <ChartCard title={title} subtitle={subtitle}>
      {!hasData ? (
        <ChartEmptyState message={emptyMessage} />
      ) : (
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
              <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="4 6" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
              />
              <Tooltip
                cursor={{ fill: "var(--color-background)" }}
                content={({ active, payload, label }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const value = Number(payload[0]?.value ?? 0);
                  return (
                    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-small shadow-md">
                      <p className="text-text-muted">{label}</p>
                      <p className="font-semibold text-text">{valueFormatter(value)}</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="value" fill={color} radius={[6, 6, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
