import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { jsPDF } from 'jspdf';
import { config } from '../src/config.js';
import { parseCsv, parseCsvRecords, toCsv } from '../src/csv.js';
import { parseDate, formatDate, formatRange } from '../src/dates.js';
import { buildDataset, FILE_KINDS } from '../src/data.js';
import { computeReport } from '../src/metrics.js';
import { exportFileName, participantCsv, summaryCsv } from '../src/exports.js';
import { buildPdf } from '../src/pdf.js';

const sample = () => {
  const texts = Object.fromEntries(FILE_KINDS.map((k) => [k, readFileSync(new URL(`../${config.dataFiles[k]}`, import.meta.url), 'utf8')]));
  return buildDataset(texts, config);
};

test('CSV round-trips quotes, commas, line breaks and a BOM', () => {
  const rows = [{ a: 'plain', b: 'has, comma' }, { a: 'say "hi"', b: 'two\nlines' }];
  const csv = toCsv(['a', 'b'], rows);
  assert.deepEqual(parseCsv(`﻿${csv}`), [['a', 'b'], ['plain', 'has, comma'], ['say "hi"', 'two\nlines']]);
});

test('headers typed in a sheet are normalized', () => {
  const { columns } = parseCsvRecords('Participant ID, Sessions Attended \r\nx,1\r\n');
  assert.deepEqual(columns, ['participant_id', 'sessions_attended']);
});

test('dates accept ISO and US formats and reject impossible days', () => {
  assert.equal(parseDate('2026-03-02'), parseDate('3/2/2026'));
  assert.equal(parseDate('2026-02-30'), null);
  assert.equal(formatDate(parseDate('2026-10-09')), 'Oct 9, 2026');
  assert.equal(formatRange(parseDate('2025-11-03'), parseDate('2026-02-06')), 'Nov 3, 2025 – Feb 6, 2026');
});

test('summary CSV has a row per cohort and a total row', () => {
  const report = computeReport(sample(), config);
  const [header, ...rows] = parseCsv(summaryCsv(report, config));
  assert.equal(header[0], 'cohort');
  assert.equal(rows.length, 4);
  assert.equal(rows[3][0], 'All cohorts');
  const enrolled = header.indexOf('enrolled');
  assert.equal(Number(rows[3][enrolled]), 75);
  assert.equal(rows.reduce((a, r, i) => (i < 3 ? a + Number(r[enrolled]) : a), 0), 75);
});

test('participant CSV has one row per participant with import-friendly values', () => {
  const report = computeReport(sample(), config);
  const { records } = parseCsvRecords(participantCsv(report));
  assert.equal(records.length, 75);
  assert.match(records[0].enrollment_date, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(['TRUE', 'FALSE'].includes(records[0].completed));
  const fall = records.find((r) => r.cohort === 'Fall 2026');
  assert.equal(fall.completed, ''); // not decided while the cohort is running
});

test('free text that looks like a spreadsheet formula is neutralized', () => {
  const ds = sample();
  const report = computeReport(ds, config);
  const placed = report.participants.find((p) => p.placed);
  placed.placement = { ...placed.placement, employer: '=HYPERLINK("http://example.com","x")' };
  const { records } = parseCsvRecords(participantCsv(report));
  const row = records.find((r) => r.participant_id === placed.id);
  assert.equal(row.employer, `'=HYPERLINK("http://example.com","x")`);
});

test('export file names say what they hold and flag sample data', () => {
  const report = computeReport(sample(), config, 'spring-2026');
  assert.equal(exportFileName(config, report, 'impact-summary', 'pdf'), 'ai-skills-program-impact-summary-spring-2026-2026-10-09-SAMPLE.pdf');
});

test('PDF one-pager fits on a single letter page for every selection', () => {
  const ds = sample();
  for (const selection of ['all', ...ds.cohorts.keys()]) {
    const doc = buildPdf(jsPDF, computeReport(ds, config, selection), config, new Date('2026-10-09T12:00:00Z'));
    assert.equal(doc.getNumberOfPages(), 1, selection);
    assert.ok(doc.contentBottom < doc.footerTop, `${selection} content runs into the footer`);
    const bytes = doc.output('arraybuffer').byteLength;
    assert.ok(bytes > 5000, `${selection} PDF too small: ${bytes}`);
  }
});
