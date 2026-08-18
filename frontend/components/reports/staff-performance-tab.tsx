import type { StaffPerformanceReport } from "@/lib/reports/types";

export function StaffPerformanceTab({ report }: { report: StaffPerformanceReport }) {
  if (report.staff.length === 0) {
    return <p className="text-small text-text-muted">No staff activity in this range yet.</p>;
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <table className="w-full text-small">
        <thead>
          <tr className="border-b border-border text-left text-text-muted">
            <th className="py-1 font-medium">Staff</th>
            <th className="py-1 font-medium">Role</th>
            <th className="py-1 text-right font-medium">Orders Created</th>
            <th className="py-1 text-right font-medium">Orders Served</th>
            <th className="py-1 text-right font-medium">Avg Turnaround</th>
          </tr>
        </thead>
        <tbody>
          {report.staff.map((entry) => (
            <tr key={entry.staffId} className="border-b border-border last:border-0">
              <td className="py-1.5 text-text">{entry.name}</td>
              <td className="py-1.5 capitalize text-text-muted">{entry.role.replace("_", " ")}</td>
              <td className="py-1.5 text-right tabular-nums text-text">{entry.ordersCreated}</td>
              <td className="py-1.5 text-right tabular-nums text-text">{entry.ordersServed}</td>
              <td className="py-1.5 text-right tabular-nums text-text-muted">
                {entry.avgTurnaroundMinutes !== null ? `${entry.avgTurnaroundMinutes} min` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
