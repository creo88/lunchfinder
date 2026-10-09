// Builds the PDF one-pager and both CSVs from the data files, without a
// browser. Handy for emailing a report or checking numbers before a meeting.
//
//   npm run export                     all cohorts → exports/
//   npm run export -- spring-2026      one cohort
//   npm run export -- all out/dir      choose the output folder

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jsPDF } from 'jspdf';
import { config } from '../src/config.js';
import { buildDataset, FILE_KINDS } from '../src/data.js';
import { computeReport } from '../src/metrics.js';
import { buildPdf } from '../src/pdf.js';
import { exportFileName, participantCsv, summaryCsv } from '../src/exports.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const selection = process.argv[2] ?? 'all';
const outDir = resolve(process.argv[3] ?? join(root, 'exports'));

const texts = Object.fromEntries(
  FILE_KINDS.map((kind) => [kind, readFileSync(join(root, config.dataFiles[kind]), 'utf8')]),
);
const dataset = buildDataset(texts, config);
if (selection !== 'all' && !dataset.cohorts.has(selection)) {
  console.error(`No cohort "${selection}". Choose one of: all, ${[...dataset.cohorts.keys()].join(', ')}`);
  process.exit(1);
}
const report = computeReport(dataset, config, selection);

mkdirSync(outDir, { recursive: true });
// Generated date pinned to the data date so sample exports are reproducible.
const pdf = buildPdf(jsPDF, report, config, new Date(`${config.dataAsOf}T12:00:00Z`));
const files = [
  [exportFileName(config, report, 'impact-summary', 'pdf'), Buffer.from(pdf.output('arraybuffer'))],
  [exportFileName(config, report, 'summary', 'csv'), summaryCsv(report, config)],
  [exportFileName(config, report, 'participants', 'csv'), participantCsv(report)],
];
for (const [name, content] of files) {
  writeFileSync(join(outDir, name), content);
  console.log(`Wrote ${join(outDir, name)}`);
}
const issues = [...dataset.issues, ...report.checks];
if (issues.length) {
  console.log(`\nData checks (${issues.length}):`);
  for (const i of issues) console.log(`  [${i.level}] ${i.file}: ${i.message} (${i.count})${i.examples.length ? ` e.g. ${i.examples.join(', ')}` : ''}`);
}
