// Minimal RFC 4180 CSV reader/writer. Handles quoted fields, embedded commas,
// quotes and line breaks, CRLF line endings and the BOM that Excel and
// Google Sheets add to exports.

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const src = String(text).replace(/^﻿/, '');

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

// "Participant ID" → "participant_id", so headers typed by hand in a sheet
// still match the template columns.
export function normalizeHeader(header) {
  return String(header)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// Parses a CSV with a header row into objects keyed by normalized header.
export function parseCsvRecords(text) {
  const [header, ...body] = parseCsv(text);
  if (!header) return { columns: [], records: [] };
  const columns = header.map(normalizeHeader);
  const records = body.map((cells, index) => {
    const record = { _row: index + 2 };
    columns.forEach((col, i) => {
      record[col] = (cells[i] ?? '').trim();
    });
    return record;
  });
  return { columns, records };
}

function escapeCell(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function toCsv(columns, rows) {
  const lines = [columns.map(escapeCell).join(',')];
  for (const row of rows) {
    lines.push(columns.map((col) => escapeCell(row[col])).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}
