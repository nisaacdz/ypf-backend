import { Response } from "express";

/**
 * Minimal RFC-4180 CSV serializer. Streams rows straight to the Express
 * response so a 50k-row export doesn't have to live in memory all at once.
 *
 * Field rules:
 *  - wrap in double-quotes if the value contains comma, quote, or newline
 *  - escape internal double-quotes by doubling them
 *  - null/undefined → empty string
 *  - Date → ISO string
 */
export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  let str: string;
  if (value instanceof Date) {
    str = value.toISOString();
  } else if (typeof value === "object") {
    str = JSON.stringify(value);
  } else {
    str = String(value);
  }

  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Serialise a single row + return the line *without* trailing CRLF.
 */
export function csvRow(values: unknown[]): string {
  return values.map(csvEscape).join(",");
}

/**
 * Stream a list of records as CSV. Sets the Content-Disposition header so
 * browsers download instead of rendering inline. Closes the response when
 * the iterable is exhausted.
 *
 * `columns` controls both the order and the header row labels — callers
 * pick exactly the fields they want exposed (we never just `Object.keys`
 * the records, to avoid accidentally leaking new columns added later).
 */
export async function streamCsv<T>(
  res: Response,
  opts: {
    filename: string;
    columns: Array<{ key: keyof T | string; label: string }>;
    rows: AsyncIterable<T> | Iterable<T>;
  },
): Promise<void> {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${opts.filename}"`,
  );

  res.write(opts.columns.map((c) => csvEscape(c.label)).join(","));
  res.write("\r\n");

  for await (const row of opts.rows as AsyncIterable<T>) {
    const line = opts.columns
      .map((c) =>
        csvEscape((row as Record<string, unknown>)[c.key as string]),
      )
      .join(",");
    res.write(line);
    res.write("\r\n");
  }

  res.end();
}
