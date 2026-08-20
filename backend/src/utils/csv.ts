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

/**
 * Minimal RFC4180-ish CSV parser for the Contacts import endpoint
 * (`contact.service.ts` `importContactsFromCsv`) — handles quoted fields
 * (commas/newlines inside quotes, escaped `""`). Deliberately not a new
 * dependency, same "small hand-rolled utility" scope as `toCsv` above.
 * Returns raw string cells; the caller is responsible for header mapping
 * and per-row validation. Fully blank trailing lines are dropped so a file
 * saved with a trailing newline doesn't produce a phantom empty row.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const input = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i]!;

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) => !(cells.length === 1 && cells[0] === ""));
}
