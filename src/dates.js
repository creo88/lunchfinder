// Dates are handled as whole days in UTC so a report never shifts by a day
// depending on the viewer's time zone.

const DAY_MS = 86400000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Accepts 2026-03-02 (ISO) and 3/2/2026 (US, the Google Sheets default).
// Returns a day number, or null when the value is empty or not a real date.
export function parseDate(value) {
  const str = String(value ?? '').trim();
  let y, m, d;
  let match = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    [, y, m, d] = match.map(Number);
  } else if ((match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) {
    [, m, d, y] = match.map(Number);
  } else {
    return null;
  }
  const ms = Date.UTC(y, m - 1, d);
  const check = new Date(ms);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
  return ms / DAY_MS;
}

export function toIsoDate(day) {
  if (day === null || day === undefined) return '';
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

// "Oct 9, 2026"
export function formatDate(day) {
  if (day === null || day === undefined) return '';
  const d = new Date(day * DAY_MS);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

// "Mar 2 – Oct 9, 2026", or "Nov 3, 2025 – Feb 6, 2026" across years.
export function formatRange(start, end) {
  if (start === null || end === null) return '';
  const a = new Date(start * DAY_MS);
  const b = new Date(end * DAY_MS);
  if (a.getUTCFullYear() === b.getUTCFullYear()) {
    return `${MONTHS[a.getUTCMonth()]} ${a.getUTCDate()} – ${formatDate(end)}`;
  }
  return `${formatDate(start)} – ${formatDate(end)}`;
}
