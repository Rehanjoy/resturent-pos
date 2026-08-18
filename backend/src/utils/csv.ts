/**
 * Minimal CSV serializer for the Reports export endpoint (PRD §3.12 "Export
 * to CSV/Excel/PDF" — this MVP covers CSV only, see `report.service.ts`
 * doc comment). Headers are passed explicitly rather than inferred from
 * `rows[0]` so an empty result set (a brand-new restaurant with no
 * invoices yet) still downloads a valid CSV with just a header row instead
 * of an empty/broken file.
 */
export function toCsv(headers: string[], rows: Record<string, string | number>[]): string {
  const escapeCell = (value: string | number | undefined): string => {
    const str = String(value ?? "");
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => escapeCell(row[header])).join(","));
  }
  return lines.join("\n");
}
