import { CheckCircleIcon, ClockIcon, OrdersIcon, StaffIcon } from "@/components/icons";
import type { StaffPerformanceReport } from "@/lib/reports/types";
import { AnalyticsCard, DashboardEmptyState, RankedBars } from "./analytics-charts";
import { StatCard } from "./stat-card";

export function StaffPanel({ report }: { report: StaffPerformanceReport }) {
  const totalCreated = report.staff.reduce((sum, member) => sum + member.ordersCreated, 0);
  const totalServed = report.staff.reduce((sum, member) => sum + member.ordersServed, 0);
  const turnaroundValues = report.staff.map((member) => member.avgTurnaroundMinutes).filter((minutes): minutes is number => minutes !== null);
  const averageTurnaround = turnaroundValues.length > 0 ? turnaroundValues.reduce((sum, minutes) => sum + minutes, 0) / turnaroundValues.length : null;
  const completionRate = totalCreated > 0 ? Math.round((totalServed / totalCreated) * 100) : 0;
  const activeContributors = report.staff.filter((member) => member.ordersCreated > 0 || member.ordersServed > 0).length;

  return (
    <div className="space-y-5" role="tabpanel" id="dashboard-panel-staff" aria-labelledby="dashboard-tab-staff">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Staff tracked" value={String(report.staff.length)} icon={StaffIcon} />
        <StatCard label="Orders created" value={String(totalCreated)} icon={OrdersIcon} />
        <StatCard label="Orders served" value={String(totalServed)} icon={CheckCircleIcon} tone="success" />
        <StatCard label="Average turnaround" value={averageTurnaround === null ? "—" : `${averageTurnaround.toFixed(1)} min`} icon={ClockIcon} tone={averageTurnaround !== null && averageTurnaround > 30 ? "warning" : "default"} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StaffMetric label="Service completion" value={`${completionRate}%`} helper="Served compared with orders created" />
        <StaffMetric label="Active contributors" value={String(activeContributors)} helper="Staff with activity in the last 7 days" />
        <StaffMetric label="Reporting period" value="7 days" helper={`${formatPeriod(report.from)} – ${formatPeriod(report.to)}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AnalyticsCard title="Orders served by staff" subtitle="Last 7 days · highest output first">
          <RankedBars
            data={[...report.staff].sort((a, b) => b.ordersServed - a.ordersServed).slice(0, 8).map((member) => ({ key: member.staffId, label: member.name, value: member.ordersServed, detail: formatRole(member.role), tone: "secondary" }))}
            valueFormatter={(value) => `${value}`}
            emptyMessage="No staff member has served an order in this period."
          />
        </AnalyticsCard>
        <AnalyticsCard title="Average turnaround" subtitle="Minutes from order creation to service">
          <RankedBars
            data={[...report.staff].filter((member) => member.avgTurnaroundMinutes !== null).sort((a, b) => (a.avgTurnaroundMinutes ?? 0) - (b.avgTurnaroundMinutes ?? 0)).slice(0, 8).map((member) => ({ key: member.staffId, label: member.name, value: member.avgTurnaroundMinutes ?? 0, detail: `${member.ordersServed} served`, tone: (member.avgTurnaroundMinutes ?? 0) > 30 ? "warning" : "primary" }))}
            valueFormatter={(value) => `${value.toFixed(1)} min`}
            emptyMessage="Turnaround appears after staff have served completed orders."
          />
        </AnalyticsCard>
      </div>

      <AnalyticsCard title="Staff performance detail" subtitle="Orders created, served and average service time">
        {report.staff.length === 0 ? <DashboardEmptyState message="No staff accounts are available in this reporting period." /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-small">
              <thead><tr className="border-b border-border text-text-muted"><th className="pb-3 font-medium">Staff member</th><th className="pb-3 font-medium">Role</th><th className="pb-3 text-right font-medium">Created</th><th className="pb-3 text-right font-medium">Served</th><th className="pb-3 text-right font-medium">Completion</th><th className="pb-3 text-right font-medium">Turnaround</th></tr></thead>
              <tbody>
                {report.staff.map((member) => {
                  const memberCompletion = member.ordersCreated > 0 ? Math.round((member.ordersServed / member.ordersCreated) * 100) : 0;
                  return <tr key={member.staffId} className="border-b border-border/70 last:border-0"><td className="py-3 font-medium text-text">{member.name}</td><td className="py-3 text-text-muted">{formatRole(member.role)}</td><td className="py-3 text-right tabular-nums text-text">{member.ordersCreated}</td><td className="py-3 text-right tabular-nums text-text">{member.ordersServed}</td><td className="py-3 text-right tabular-nums text-text">{memberCompletion}%</td><td className="py-3 text-right tabular-nums text-text">{member.avgTurnaroundMinutes === null ? "—" : `${member.avgTurnaroundMinutes.toFixed(1)} min`}</td></tr>;
                })}
              </tbody>
            </table>
          </div>
        )}
      </AnalyticsCard>
    </div>
  );
}

function StaffMetric({ label, value, helper }: { label: string; value: string; helper: string }) {
  return <div className="rounded-2xl border border-border bg-surface px-4 py-3 shadow-sm"><p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">{label}</p><p className="mt-1 tabular-nums text-body font-semibold text-text">{value}</p><p className="mt-0.5 text-[11px] text-text-muted">{helper}</p></div>;
}

function formatRole(role: string): string {
  return role.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function formatPeriod(value: string): string {
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
