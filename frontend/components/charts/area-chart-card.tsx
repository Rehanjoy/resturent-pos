"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { ChartCard, ChartEmptyState } from "./chart-card";

export interface AreaChartPoint {
  label: string;
  value: number;
}

/**
 * Smooth gradient-filled area chart — used for Dashboard's weekly revenue
 * trend and Reports' revenue-by-hour (single-day ranges only). Matches the
 * reference screenshots' "soft gradient fill under the line, rounded
 * curves, minimal gridlines" aesthetic.
 */
export function AreaChartCard({
  title,
  subtitle,
  data,
  valueFormatter,
  emptyMessage,
  color = "var(--color-primary)",
}: {
  title: string;
  subtitle?: string;
  data: AreaChartPoint[];
  valueFormatter: (value: number) => string;
  emptyMessage: string;
  color?: string;
}) {
  const gradientId = useId();
  const hasData = data.some((point) => point.value > 0);

  return (
    <ChartCard title={title} subtitle={subtitle}>
      {!hasData ? (
        <ChartEmptyState message={emptyMessage} />
      ) : (
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.32} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                stroke="var(--color-border)"
                strokeDasharray="4 6"
              />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
                minTickGap={16}
              />
              <Tooltip
                cursor={{ stroke: "var(--color-border)", strokeWidth: 1 }}
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
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2.5}
                fill={`url(#${gradientId})`}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
