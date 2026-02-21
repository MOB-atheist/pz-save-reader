import * as XLSX from "xlsx";

function csvEscape(val: unknown): string {
  const s = val == null ? "" : String(val);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function exportCsv<T extends Record<string, unknown>>(
  rows: T[],
  headers: (keyof T)[],
  filename: string
) {
  if (!rows.length) return;
  const line = (row: T) =>
    headers.map((h) => csvEscape(row[h])).join(",");
  const csv =
    "\uFEFF" + headers.join(",") + "\n" + rows.map((r) => line(r)).join("\n");
  downloadBlob(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
    filename
  );
}

export function exportJson(data: unknown, filename: string) {
  downloadBlob(
    new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    }),
    filename
  );
}

export function exportExcel<T extends Record<string, unknown>>(
  rows: T[],
  sheetName: string,
  filename: string
) {
  if (!rows.length) return;
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  downloadBlob(
    new Blob([wbout], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    filename
  );
}
