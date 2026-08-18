export function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "error";
}) {
  const toneClass =
    tone === "success" ? "text-success" : tone === "error" ? "text-error" : "text-text";

  return (
    <div className="flex flex-1 flex-col gap-1 rounded-lg border border-border bg-surface p-4 shadow-sm">
      <p className="text-small text-text-muted">{label}</p>
      <p className={`font-heading text-h2 font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
