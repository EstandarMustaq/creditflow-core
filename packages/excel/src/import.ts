import * as XLSX from 'xlsx';

export function parseLoanSheet(buffer: Buffer) {
  if (!buffer.length) {
    return { rows: [], note: 'empty buffer received; provide an XLSX file' };
  }

  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0] ?? 'Sheet1';
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet ?? {});
  return { sheetName, rows };
}
