// Dashboard page: loads the CSVs, renders the report model and wires up the
// exports. All number logic lives in metrics.js and report-model.js.

import { config } from './config.js';
import { buildDataset, FILE_KINDS } from './data.js';
import { computeReport } from './metrics.js';
import { buildReportModel } from './report-model.js';
import { buildPdf } from './pdf.js';
import { exportFileName, participantCsv, summaryCsv } from './exports.js';
import { dumbbell, horizontalBars } from './charts.js';
import { parseDate, toIsoDate } from './dates.js';

const $ = (id) => document.getElementById(id);
const SETTINGS_KEY = 'aiclub-dashboard-settings';

const state = {
  dataset: null,
  source: { kind: 'sample', names: [] },
  selection: 'all',
  settings: { partnerName: config.partnerName, programName: config.programName, dataAsOf: config.dataAsOf },
  report: null,
  model: null,
};

function effectiveConfig() {
  return {
    ...config,
    partnerName: state.settings.partnerName.trim() || config.partnerName,
    programName: state.settings.programName.trim() || config.programName,
    dataAsOf: state.settings.dataAsOf,
    isSampleData: state.source.kind === 'sample' && config.isSampleData,
  };
}

// ---------- Settings (names only are remembered, per browser) ----------
function loadSavedSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    if (typeof saved.partnerName === 'string') state.settings.partnerName = saved.partnerName;
    if (typeof saved.programName === 'string') state.settings.programName = saved.programName;
  } catch {
    /* storage blocked: defaults are fine */
  }
}
function saveSettings() {
  try {
    const { partnerName, programName } = state.settings;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ partnerName, programName }));
  } catch {
    /* storage blocked: settings last for this visit only */
  }
}

// ---------- Data loading ----------
async function fetchText(path) {
  try {
    const res = await fetch(path, { cache: 'no-store' });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

async function loadSample() {
  const texts = {};
  await Promise.all(FILE_KINDS.map(async (kind) => (texts[kind] = await fetchText(config.dataFiles[kind]))));
  state.dataset = buildDataset(texts, config);
  state.source = { kind: 'sample', names: FILE_KINDS.map((k) => config.dataFiles[k]) };
}

function kindFromName(name) {
  const n = name.toLowerCase();
  if (n.includes('roster')) return 'roster';
  if (n.includes('attend')) return 'attendance';
  if (n.includes('assess')) return 'assessments';
  if (n.includes('follow')) return 'followups';
  if (n.includes('cohort')) return 'cohorts';
  return null;
}

async function loadFiles(files) {
  const texts = Object.fromEntries(FILE_KINDS.map((k) => [k, null]));
  const names = [];
  const unmatched = [];
  for (const file of files) {
    const kind = kindFromName(file.name);
    if (!kind) {
      unmatched.push(file.name);
      continue;
    }
    texts[kind] = await file.text();
    names.push(file.name);
  }
  if (!names.length) {
    toast('None of those files match. Name them cohorts, roster, attendance, assessments and followups.');
    return;
  }
  state.dataset = buildDataset(texts, config);
  state.source = { kind: 'files', names, unmatched };
  state.selection = 'all';
  state.settings.dataAsOf = toIsoDate(Math.floor(Date.now() / 86400000));
  $('setting-asof').value = state.settings.dataAsOf;
  update();
  toast(`Loaded ${names.length} file${names.length === 1 ? '' : 's'}. "Data as of" is set to today; change it under Report settings if needed.`);
}

// ---------- Rendering ----------
function update() {
  const cfg = effectiveConfig();
  if (!state.dataset.cohorts.has(state.selection)) state.selection = 'all';
  state.report = computeReport(state.dataset, cfg, state.selection);
  state.model = buildReportModel(state.report, cfg);
  render(state.model, state.report, cfg);
}

function text(id, value) {
  $(id).textContent = value;
}

function render(model, report, cfg) {
  text('partner-name', model.partner);
  text('provider-name', model.provider);
  text('footer-provider', model.provider);
  text('program-name', model.title);
  text('period', model.period || '—');
  text('as-of', model.asOf);
  $('sample-flag').hidden = !model.isSample;
  text('narrative', model.narrative);

  renderCohortSelect();
  renderKpis(model.kpis);
  renderCharts();
  renderCohortTable(model.cohortRows);
  renderFollowups(model, cfg);
  renderDefinitions(model.definitions);
  renderChecks([...state.dataset.issues, ...report.checks]);
}

function renderCohortSelect() {
  const select = $('cohort-select');
  const cohorts = [...state.dataset.cohorts.values()].sort((a, b) => a.startDay - b.startDay);
  const statusLabel = Object.fromEntries(state.report.byCohort.map((r) => [r.cohort.id, r.status]));
  const labels = { finished: 'finished', in_progress: 'in progress', upcoming: 'upcoming' };
  const options = [new Option(`All cohorts (${cohorts.length})`, 'all')];
  for (const c of cohorts) options.push(new Option(`${c.name} · ${labels[statusLabel[c.id]] ?? ''}`, c.id));
  select.replaceChildren(...options);
  select.value = state.selection;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
function svgIcon(parts, size = 14) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 14 14');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('aria-hidden', 'true');
  for (const [tag, attrs] of parts) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    svg.append(node);
  }
  return svg;
}
const ICONS = {
  met: () => svgIcon([['circle', { cx: 7, cy: 7, r: 6.5, class: 'status-good' }], ['path', { d: 'M4.2 7.2 6.1 9l3.7-4', class: 'status-check' }]]),
  pending: () => svgIcon([['circle', { cx: 7, cy: 7, r: 5.6, class: 'status-ring-pending' }]]),
  not_met: () => svgIcon([['circle', { cx: 7, cy: 7, r: 5.6, class: 'status-ring-miss' }], ['path', { d: 'M4.6 7h4.8', class: 'status-dash' }]]),
  error: () => svgIcon([['circle', { cx: 7, cy: 7, r: 5.6, class: 'status-ring-miss' }], ['path', { d: 'M4.6 7h4.8', class: 'status-dash' }]]),
  warning: () => svgIcon([['path', { d: 'M7 1.2 13.2 12.6H.8z', class: 'icon-warning' }]]),
  info: () => svgIcon([['circle', { cx: 7, cy: 7, r: 5.6, class: 'status-ring-pending', style: 'stroke: var(--muted)' }]]),
  ok: () => svgIcon([['circle', { cx: 7, cy: 7, r: 6.5, class: 'status-good' }], ['path', { d: 'M4.2 7.2 6.1 9l3.7-4', class: 'status-check' }]]),
};

function node(tag, className, content) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (content !== undefined) n.textContent = content;
  return n;
}

function renderKpis(kpis) {
  const tiles = kpis.map((k) => {
    const tile = node('article', 'kpi');
    if (k.pending) tile.dataset.pending = '';
    tile.append(node('h3', 'kpi-label', k.label), node('p', 'kpi-value', k.value), node('p', 'kpi-detail', k.detail));
    if (k.target) {
      const t = node('p', 'kpi-target');
      t.dataset.state = k.target.state;
      t.append(ICONS[k.target.state](), document.createTextNode(k.target.text));
      tile.append(t);
    }
    return tile;
  });
  $('kpis').replaceChildren(...tiles);
}

// Tooltip shared by every chart.
function showTip(message, x, y) {
  const tip = $('tooltip');
  if (!message) {
    tip.hidden = true;
    return;
  }
  tip.textContent = message;
  tip.hidden = false;
  const { width, height } = tip.getBoundingClientRect();
  const left = Math.min(window.innerWidth - width - 8, Math.max(8, x + 14));
  const top = y - height - 12 < 8 ? y + 18 : y - height - 12;
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
}

function tableFrom(headers, rows) {
  const table = node('table', 'data-table compact');
  const head = node('tr');
  headers.forEach(([label, num]) => head.append(node('th', num ? 'num' : '', label)));
  table.append(node('thead'));
  table.tHead.append(head);
  const body = node('tbody');
  rows.forEach((cells) => {
    const tr = node('tr');
    cells.forEach((cell, i) => tr.append(node('td', headers[i][1] ? 'num' : '', cell)));
    body.append(tr);
  });
  table.append(body);
  return table;
}

function emptyChart(container, message) {
  container.replaceChildren(node('p', 'empty', message));
}

function renderCharts() {
  const m = state.model;
  if (!m) return;

  // Journey
  const journey = $('journey-chart');
  text('journey-sub', m.journeyBaseNote || 'Shown once a cohort finishes');
  if (m.journey.length) {
    const base = m.journey[0].value;
    horizontalBars(
      journey,
      m.journey.map((r, i) => ({
        label: r.label,
        value: r.value,
        valueText: i === 0 ? '' : `${Math.round(r.share * 100)}%`,
        tip: i === 0 ? `${r.label}: ${r.value} participants` : `${r.label}: ${r.value} of ${base} enrolled (${Math.round(r.share * 100)}%)`,
      })),
      { onTip: showTip, ariaLabel: 'Participant journey from enrollment to new job', track: true, max: base },
    );
  } else emptyChart(journey, 'Shown once a cohort finishes.');
  setTable('journey-panel', tableFrom([['Stage'], ['People', true], ['Share of enrolled', true]], m.journey.map((r) => [r.label, String(r.value), `${Math.round(r.share * 100)}%`])));

  // Skills
  const skills = $('skills-chart');
  text('skills-sub', m.skillsN ? `Average score on the same 10 questions at the first and last session · ${m.skillsN} participants` : 'Shown once a cohort takes the post-assessment');
  $('skills-panel').querySelector('.legend').hidden = !m.skillsN;
  if (m.skillsN) dumbbell(skills, m.skillAreas, { onTip: showTip, ariaLabel: 'Average skills score by area at the start and end of the program' });
  else emptyChart(skills, 'Shown once a cohort takes the post-assessment.');
  setTable(
    'skills-panel',
    tableFrom(
      [['Skill area'], ['Start', true], ['End', true], ['Change', true]],
      m.skillsN ? m.skillAreas.map((a) => [a.label, `${Math.round(a.pre * 100)}%`, `${Math.round(a.post * 100)}%`, `+${Math.round(a.post * 100) - Math.round(a.pre * 100)} pts`]) : [],
    ),
  );

  // Ages
  const ages = $('age-chart');
  text('age-sub', m.ageUnknown ? `Age at enrollment · ${m.ageUnknown} not recorded` : 'Age at enrollment');
  if (m.ageBands.some((b) => b.count)) {
    const total = m.ageBands.reduce((a, b) => a + b.count, 0);
    horizontalBars(
      ages,
      m.ageBands.map((b) => ({ label: b.label, value: b.count, valueText: `${Math.round((b.count / total) * 100)}%`, tip: `${b.label}: ${b.count} participants (${Math.round((b.count / total) * 100)}%)` })),
      { onTip: showTip, ariaLabel: 'Participants by age band' },
    );
  } else emptyChart(ages, 'No ages recorded yet.');
  setTable('age-panel', tableFrom([['Age'], ['Participants', true]], m.ageBands.map((b) => [b.label, String(b.count)])));
}

function setTable(panelId, table) {
  $(panelId).querySelector('.chart-table').replaceChildren(table);
}

function renderCohortTable(rows) {
  const headers = [['Cohort'], ['Dates'], ['Status'], ['Enrolled', true], ['Completed', true], ['Certificates', true], ['Skills start → end', true], ['New jobs', true]];
  const table = tableFrom(headers, []);
  const body = table.tBodies[0];
  rows.forEach((r) => {
    const tr = node('tr');
    tr.append(node('td', '', r.name), node('td', '', r.dates));
    const statusCell = node('td');
    const pill = node('span', 'pill', r.status);
    pill.dataset.status = r.statusId;
    statusCell.append(pill);
    tr.append(statusCell);
    [r.enrolled, r.completion, r.certificates, r.skills, r.placed].forEach((v) => tr.append(node('td', 'num', v)));
    body.append(tr);
  });
  $('cohort-table').replaceWith(Object.assign(table, { id: 'cohort-table', className: 'data-table' }));
}

function renderFollowups(model, cfg) {
  const days = cfg.rules.followupCheckpoints;
  text('followup-sub', `Sent to graduates ${days.slice(0, -1).join(', ')} and ${days[days.length - 1]} days after the last session`);
  const table = tableFrom(
    [['Survey'], ['Sent', true], ['Returned', true], ['With new job', true], ['Not yet due', true]],
    model.followupRows.map((r) => [r.label, String(r.due), r.responded, r.placed, r.pending]),
  );
  table.hidden = !model.followupRows.length;
  $('followup-table').replaceWith(Object.assign(table, { id: 'followup-table' }));
  text('followup-note', model.followupNote);
  $('followup-note').hidden = !model.followupNote;
}

function renderDefinitions(defs) {
  $('definitions').replaceChildren(
    ...defs.map((d) => {
      const wrap = node('div');
      wrap.append(node('dt', '', d.term), node('dd', '', d.text));
      return wrap;
    }),
  );
}

function renderChecks(issues) {
  const src = state.source;
  text(
    'data-source',
    src.kind === 'sample'
      ? 'Showing the sample data files bundled with this dashboard.'
      : `Showing your files, loaded in this browser only: ${src.names.join(', ')}${src.unmatched?.length ? ` (not used: ${src.unmatched.join(', ')})` : ''}.`,
  );
  const items = issues.length
    ? issues.map((i) => {
        const li = node('li', 'check');
        const level = { error: 'Fix', warning: 'Check', info: 'Note' }[i.level];
        li.append(ICONS[i.level]());
        const msg = node('span');
        msg.append(node('span', 'check-file', `${level} · ${i.file === 'delivery' ? 'Delivery data' : i.file}: `), document.createTextNode(i.message));
        li.append(msg);
        const meta = [i.count > 1 ? `${i.count} rows` : null, i.examples.length ? `e.g. ${i.examples.join(', ')}` : null].filter(Boolean).join(' · ');
        li.append(node('span', 'check-meta', meta));
        return li;
      })
    : [(() => {
        const li = node('li', 'check');
        li.append(ICONS.ok(), node('span', '', 'All files loaded and consistent.'));
        return li;
      })()];
  $('checks').replaceChildren(...items);
}

// ---------- Actions ----------
let toastTimer;
function toast(message) {
  const t = $('toast');
  t.textContent = message;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 4500);
}

function download(name, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast(`Downloaded ${name}`);
}

function wireActions() {
  $('cohort-select').addEventListener('change', (e) => {
    state.selection = e.target.value;
    update();
  });

  $('download-pdf').addEventListener('click', () => {
    const JsPDF = window.jspdf?.jsPDF;
    if (!JsPDF) {
      toast('The PDF library did not load. Check that vendor/jspdf.umd.min.js is next to index.html.');
      return;
    }
    const cfg = effectiveConfig();
    const doc = buildPdf(JsPDF, state.report, cfg);
    download(exportFileName(cfg, state.report, 'impact-summary', 'pdf'), doc.output('blob'));
  });

  $('download-summary').addEventListener('click', () => {
    const cfg = effectiveConfig();
    download(exportFileName(cfg, state.report, 'summary', 'csv'), new Blob([summaryCsv(state.report, cfg)], { type: 'text/csv' }));
  });

  $('download-participants').addEventListener('click', () => {
    const cfg = effectiveConfig();
    download(exportFileName(cfg, state.report, 'participants', 'csv'), new Blob([participantCsv(state.report)], { type: 'text/csv' }));
  });

  $('copy-summary').addEventListener('click', () => {
    const narrative = $('narrative');
    const selectInstead = () => {
      const range = document.createRange();
      range.selectNodeContents(narrative);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      toast('Text selected. Press Ctrl+C (⌘C on a Mac) to copy it.');
    };
    // The clipboard API is missing on plain-http pages other than localhost.
    if (!navigator.clipboard?.writeText) {
      selectInstead();
      return;
    }
    navigator.clipboard
      .writeText(narrative.textContent)
      .then(() => toast('Summary copied. Paste it into your report or deck.'))
      .catch(selectInstead);
  });

  document.querySelectorAll('.table-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const panel = btn.closest('.panel');
      const showTable = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', String(showTable));
      btn.textContent = showTable ? 'Show chart' : 'Show table';
      panel.querySelector('.chart').hidden = showTable;
      panel.querySelector('.chart-table').hidden = !showTable;
      const legend = panel.querySelector('.legend');
      if (legend) legend.hidden = showTable || !state.model.skillsN;
      if (!showTable) renderCharts();
    });
  });

  const form = $('settings-form');
  form.addEventListener('submit', (e) => e.preventDefault());
  $('setting-partner').addEventListener('input', (e) => {
    state.settings.partnerName = e.target.value;
    saveSettings();
    update();
  });
  $('setting-program').addEventListener('input', (e) => {
    state.settings.programName = e.target.value;
    saveSettings();
    update();
  });
  $('setting-asof').addEventListener('change', (e) => {
    if (parseDate(e.target.value) === null) return;
    state.settings.dataAsOf = e.target.value;
    update();
  });

  $('file-input').addEventListener('change', async (e) => {
    if (e.target.files.length) await loadFiles([...e.target.files]);
    e.target.value = '';
  });
  $('reset-data').addEventListener('click', async () => {
    await loadSample();
    state.settings.dataAsOf = config.dataAsOf;
    $('setting-asof').value = config.dataAsOf;
    state.selection = 'all';
    update();
    toast('Back to the sample data.');
  });

  // Redraw only when a chart's width changes, so focus and hover survive.
  let resizeFrame;
  const widths = new Map();
  const observer = new ResizeObserver((entries) => {
    const changed = entries.some((e) => {
      const w = Math.round(e.contentRect.width);
      const before = widths.get(e.target);
      widths.set(e.target, w);
      return before !== undefined && before !== w && w > 0;
    });
    if (!changed) return;
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(renderCharts);
  });
  document.querySelectorAll('.chart').forEach((c) => observer.observe(c));
  // A fixed tooltip would drift on scroll: follow the focused mark, or hide.
  window.addEventListener(
    'scroll',
    () => {
      const active = document.activeElement;
      if (active?.classList?.contains('mark')) {
        const box = active.getBoundingClientRect();
        showTip(active.getAttribute('aria-label'), box.left + box.width / 2, box.top);
      } else showTip(null);
    },
    { passive: true },
  );
}

async function start() {
  loadSavedSettings();
  $('setting-partner').value = state.settings.partnerName;
  $('setting-program').value = state.settings.programName;
  $('setting-asof').value = state.settings.dataAsOf;
  wireActions();
  await loadSample();
  update();
}

start();
