// The board/funder one-pager. Drawn with jsPDF's vector primitives so text
// stays crisp and selectable, on one US Letter page. Pass in the jsPDF
// constructor (window.jspdf.jsPDF in the browser, the npm package in Node).

import { buildReportModel } from './report-model.js';
import { formatDate } from './dates.js';

const C = {
  ink: '#121a26',
  ink2: '#4a5466',
  muted: '#6b7484',
  rule: '#dfe4ea',
  tile: '#f3f6f9',
  track: '#e8eef5',
  ramp: ['#86b6ef', '#3987e5', '#256abf', '#184f95'],
  pre: '#86b6ef',
  post: '#1c5cab',
  good: '#0ca30c',
  warning: '#fab219',
  critical: '#d03b3b',
  sampleFill: '#fff6dc',
};

const PAGE_W = 612;
const PAGE_H = 792;
const M = 40;
const W = PAGE_W - M * 2;

export function buildPdf(JsPDF, report, config, now = new Date()) {
  const model = buildReportModel(report, config, { arrow: 'to' });
  const doc = new JsPDF({ unit: 'pt', format: 'letter', compress: true });
  doc.setProperties({
    title: `${model.title} impact summary`,
    subject: `${model.partner} · ${model.selectionLabel} · data as of ${model.asOf}`,
    author: model.provider,
    creator: `${model.provider} impact dashboard`,
  });

  const font = (style, size, color = C.ink) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(color);
  };
  const eyebrow = (text, x, y, color = C.muted) => {
    font('bold', 6.8, color);
    doc.text(text.toUpperCase(), x, y, { charSpace: 0.6 });
  };
  const hairline = (x1, y1, x2, y2, color = C.rule, w = 0.6) => {
    doc.setDrawColor(color);
    doc.setLineWidth(w);
    doc.line(x1, y1, x2, y2);
  };
  // Bar with a rounded data end and a square end on the baseline.
  const bar = (x, y, w, h, color) => {
    if (w <= 0) return;
    doc.setFillColor(color);
    if (w < 4) {
      doc.rect(x, y, w, h, 'F');
      return;
    }
    doc.roundedRect(x, y, w, h, 2, 2, 'F');
    doc.rect(x, y, 3, h, 'F');
  };
  const statusIcon = (state, x, y) => {
    doc.setLineWidth(0.9);
    if (state === 'met') {
      doc.setFillColor(C.good);
      doc.circle(x, y, 3.2, 'F');
      doc.setDrawColor('#ffffff');
      doc.lines([[1.1, 1.2], [2.2, -2.6]], x - 1.6, y + 0.1, [1, 1], 'S');
    } else {
      doc.setDrawColor(state === 'pending' ? C.warning : C.critical);
      doc.circle(x, y, 2.8, 'S');
      if (state === 'not_met') doc.line(x - 1.4, y, x + 1.4, y);
    }
  };

  // ---------- Header ----------
  let y = M + 6;
  eyebrow(`Impact summary · ${model.selectionLabel}`, M, y);
  if (model.isSample) {
    font('bold', 6.8, C.ink);
    const label = 'SAMPLE DATA';
    const tw = doc.getTextWidth(label) + 0.6 * (label.length - 1);
    doc.setFillColor(C.sampleFill);
    doc.setDrawColor(C.warning);
    doc.setLineWidth(0.8);
    doc.roundedRect(PAGE_W - M - tw - 14, y - 9, tw + 14, 13, 3, 3, 'FD');
    doc.text(label, PAGE_W - M - tw - 7, y, { charSpace: 0.6 });
  }

  y += 24;
  font('bold', 22, C.ink);
  doc.text(model.title, M, y);
  y += 16;
  font('normal', 10, C.ink2);
  doc.text(`${model.partner} · delivered by ${model.provider}`, M, y);

  font('normal', 8.5, C.ink2);
  doc.text(`Reporting period  ${model.period}`, PAGE_W - M, y - 14, { align: 'right' });
  doc.text(`Data as of  ${model.asOf}`, PAGE_W - M, y, { align: 'right' });

  y += 12;
  hairline(M, y, PAGE_W - M, y, C.ink, 0.8);

  // ---------- Narrative ----------
  y += 17;
  font('normal', 9.6, C.ink);
  const narrative = doc.splitTextToSize(model.narrative, W);
  doc.text(narrative, M, y, { lineHeightFactor: 1.38 });
  y += narrative.length * 9.6 * 1.38 + 6;

  // ---------- KPI tiles ----------
  const gap = 8;
  const tileW = (W - gap * 4) / 5;
  const tileH = 88;
  model.kpis.forEach((k, i) => {
    const x = M + i * (tileW + gap);
    doc.setFillColor(C.tile);
    doc.roundedRect(x, y, tileW, tileH, 4, 4, 'F');
    eyebrow(k.label, x + 9, y + 15);
    font('bold', k.pending ? 14 : 21, k.pending ? C.ink2 : C.ink);
    doc.text(k.value, x + 9, y + 38);
    font('normal', 7, C.ink2);
    const detail = doc.splitTextToSize(k.detail, tileW - 18);
    doc.text(detail.slice(0, 3), x + 9, y + 50, { lineHeightFactor: 1.3 });
    if (k.target) {
      statusIcon(k.target.state, x + 12.5, y + tileH - 11.5);
      font('normal', 6.8, C.ink2);
      doc.text(k.target.text, x + 19, y + tileH - 9);
    }
  });
  y += tileH + 18;

  // ---------- Journey + skills ----------
  const colW = (W - 20) / 2;
  const leftX = M;
  const rightX = M + colW + 20;
  const sectionTop = y;

  const sectionTitle = (title, sub, x, yy) => {
    font('bold', 10, C.ink);
    doc.text(title, x, yy);
    if (sub) {
      font('normal', 7.2, C.muted);
      doc.text(sub, x, yy + 11);
    }
  };

  sectionTitle('Participant journey', model.journeyBaseNote, leftX, y);
  let jy = y + 26;
  const labelW = 86;
  const valueW = 50;
  const barMax = colW - labelW - valueW;
  if (model.journey.length) {
    model.journey.forEach((row, i) => {
      font('normal', 8, C.ink);
      doc.text(row.label, leftX, jy + 8.5);
      doc.setFillColor(C.track);
      doc.rect(leftX + labelW, jy + 2, barMax, 9, 'F');
      bar(leftX + labelW, jy + 2, barMax * row.share, 9, C.ramp[i]);
      font('bold', 8, C.ink);
      const valueText = String(row.value);
      doc.text(valueText, leftX + labelW + barMax + 6, jy + 9.5);
      font('normal', 7.5, C.muted);
      doc.text(i === 0 ? '' : `${Math.round(row.share * 100)}%`, leftX + labelW + barMax + 6 + doc.getTextWidth(valueText) + 12, jy + 9.5);
      jy += 21;
    });
  } else {
    font('normal', 8, C.ink2);
    doc.text('Shown once a cohort finishes.', leftX, jy + 8);
    jy += 21;
  }

  // Skills dumbbell
  sectionTitle('Skills gained by area', model.skillsN ? `Average score at first and last session · ${model.skillsN} participants` : '', rightX, y);
  let sy = y + 26;
  const sLabelW = 98;
  const axisX = rightX + sLabelW;
  const axisW = colW - sLabelW - 8;
  const sx = (v) => axisX + axisW * v;
  if (model.skillsN) {
    // gridlines at 0/50/100
    [0, 0.5, 1].forEach((v) => hairline(sx(v), sy - 2, sx(v), sy + model.skillAreas.length * 17 - 2));
    model.skillAreas.forEach((a) => {
      font('normal', 8, C.ink);
      doc.text(a.label, rightX, sy + 7.5);
      doc.setDrawColor(C.ramp[2]);
      doc.setLineWidth(1.6);
      doc.line(sx(a.pre), sy + 4.5, sx(a.post), sy + 4.5);
      doc.setFillColor(C.pre);
      doc.setDrawColor('#ffffff');
      doc.setLineWidth(1.2);
      doc.circle(sx(a.pre), sy + 4.5, 3.6, 'FD');
      doc.setFillColor(C.post);
      doc.circle(sx(a.post), sy + 4.5, 3.6, 'FD');
      font('normal', 6.8, C.muted);
      doc.text(`${Math.round(a.pre * 100)}`, sx(a.pre) - 6, sy + 7, { align: 'right' });
      font('bold', 6.8, C.ink);
      doc.text(`${Math.round(a.post * 100)}%`, sx(a.post) + 6, sy + 7);
      sy += 17;
    });
    font('normal', 6.8, C.muted);
    doc.text('0%', sx(0), sy + 4, { align: 'center' });
    doc.text('50%', sx(0.5), sy + 4, { align: 'center' });
    doc.text('100%', sx(1), sy + 4, { align: 'right' });
    // legend
    const ly = sy + 4;
    doc.setFillColor(C.pre);
    doc.circle(rightX + 4, ly - 2.4, 3, 'F');
    font('normal', 7, C.ink2);
    doc.text('Start', rightX + 10, ly);
    doc.setFillColor(C.post);
    doc.circle(rightX + 38, ly - 2.4, 3, 'F');
    doc.text('End', rightX + 44, ly);
    sy += 10;
  } else {
    font('normal', 8, C.ink2);
    doc.text('Shown once a cohort has taken the post-assessment.', rightX, sy + 8);
    sy += 21;
  }

  y = Math.max(jy, sy) + 16;
  hairline(M, y - 8, PAGE_W - M, y - 8);

  // ---------- Results by cohort ----------
  sectionTitle('Results by cohort', null, M, y + 6);
  y += 18;
  const cols = [
    { key: 'name', label: 'Cohort', w: 74 },
    { key: 'dates', label: 'Dates', w: 104 },
    { key: 'status', label: 'Status', w: 58 },
    { key: 'enrolled', label: 'Enrolled', w: 46, align: 'right' },
    { key: 'completion', label: 'Completed', w: 70, align: 'right' },
    { key: 'certificates', label: 'Certificates', w: 58, align: 'right' },
    { key: 'skills', label: 'Skills start to end', w: 74, align: 'right' },
    { key: 'placed', label: 'New jobs', w: 48, align: 'right' },
  ];
  const drawRow = (cells, yy, header) => {
    let x = M;
    for (const col of cols) {
      const text = header ? col.label : cells[col.key];
      if (header) font('bold', 6.8, C.muted);
      else font(col.key === 'name' ? 'bold' : 'normal', 8, C.ink);
      if (col.align === 'right') doc.text(text, x + col.w, yy, { align: 'right' });
      else doc.text(text, x, yy);
      x += col.w;
    }
  };
  drawRow(null, y, true);
  hairline(M, y + 4, PAGE_W - M, y + 4);
  y += 15;
  model.cohortRows.forEach((row) => {
    drawRow(row, y, false);
    hairline(M, y + 5, PAGE_W - M, y + 5);
    y += 15;
  });
  y += 14;

  // ---------- Follow-up + who we served ----------
  const lowerTop = y;
  sectionTitle('Follow-up surveys', 'Sent to graduates 30, 60 and 90 days after the last session', leftX, y);
  let fy = y + 24;
  const fcols = [
    { key: 'label', label: 'Survey', w: 40 },
    { key: 'due', label: 'Sent', w: 30, align: 'right' },
    { key: 'responded', label: 'Returned', w: 54, align: 'right' },
    { key: 'placed', label: 'With new job', w: 64, align: 'right' },
    { key: 'pending', label: 'Not yet due', w: colW - 188, align: 'right' },
  ];
  const drawFRow = (row, yy, header) => {
    let x = leftX;
    for (const col of fcols) {
      const text = header ? col.label : String(row[col.key]);
      if (header) font('bold', 6.8, C.muted);
      else font('normal', 7.8, C.ink);
      if (col.align === 'right') doc.text(text, x + col.w, yy, { align: 'right' });
      else doc.text(text, x, yy);
      x += col.w;
    }
  };
  if (model.followupRows.length) {
    drawFRow(null, fy, true);
    hairline(leftX, fy + 4, leftX + colW, fy + 4);
    fy += 14;
    model.followupRows.forEach((row) => {
      drawFRow(row, fy, false);
      fy += 13;
    });
  }
  if (model.followupNote) {
    font('normal', 7.2, C.ink2);
    const lines = doc.splitTextToSize(model.followupNote, colW);
    doc.text(lines, leftX, fy + 3, { lineHeightFactor: 1.3 });
    fy += lines.length * 9.4 + 3;
  }

  sectionTitle('Who we served', model.ageUnknown ? `Age at enrollment · ${model.ageUnknown} not recorded` : 'Age at enrollment', rightX, lowerTop);
  let ay = lowerTop + 24;
  const maxAge = Math.max(1, ...model.ageBands.map((b) => b.count));
  const aLabelW = 52;
  const aBarMax = colW - aLabelW - 30;
  model.ageBands.forEach((b, i) => {
    font('normal', 8, C.ink);
    doc.text(b.label, rightX, ay + 7.5);
    bar(rightX + aLabelW, ay + 1, (aBarMax * b.count) / maxAge, 9, C.ramp[Math.min(i, C.ramp.length - 1)]);
    font('bold', 8, C.ink);
    doc.text(String(b.count), rightX + aLabelW + (aBarMax * b.count) / maxAge + 5, ay + 8.5);
    ay += 15;
  });

  y = Math.max(fy, ay) + 12;
  hairline(M, y - 4, PAGE_W - M, y - 4);

  // ---------- Definitions ----------
  y += 10;
  eyebrow('How we measure', M, y);
  y += 11;
  const defColW = (W - 20) / 2;
  const defs = model.definitions;
  const half = Math.ceil(defs.length / 2);
  let contentBottom = y;
  [defs.slice(0, half), defs.slice(half)].forEach((group, gi) => {
    let dy = y;
    const x = M + gi * (defColW + 20);
    group.forEach((d) => {
      font('bold', 7, C.ink);
      const termW = doc.getTextWidth(`${d.term}. `);
      doc.text(`${d.term}.`, x, dy);
      font('normal', 7, C.ink2);
      const first = doc.splitTextToSize(d.text, defColW - termW);
      const firstLine = first[0];
      const rest = doc.splitTextToSize(d.text.slice(firstLine.length).trim(), defColW);
      doc.text(firstLine, x + termW, dy);
      if (rest.length && rest[0]) doc.text(rest, x, dy + 9, { lineHeightFactor: 1.3 });
      dy += 9 + (rest[0] ? rest.length * 9.1 : 0) + 4;
    });
    contentBottom = Math.max(contentBottom, dy);
  });

  // ---------- Footer ----------
  const footY = PAGE_H - 30;
  hairline(M, footY - 10, PAGE_W - M, footY - 10);
  font('normal', 6.8, C.muted);
  doc.text(`Prepared by ${model.provider} for ${model.partner} · Generated ${formatDate(Math.floor(now.getTime() / 86400000))}`, M, footY);
  if (model.isSample) {
    font('bold', 6.8, C.ink2);
    doc.text('Sample data: illustrative figures, not a real cohort.', PAGE_W - M, footY, { align: 'right' });
  }

  // Lowest point of the body content; tests check it stays above the footer.
  doc.contentBottom = contentBottom;
  doc.footerTop = footY - 10;
  return doc;
}
