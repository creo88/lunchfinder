// Turns the five CSV files into typed records and lists anything in them that
// would make a number wrong. Problems never stop the dashboard from loading;
// they show up under "Data checks" so they can be fixed in the sheet.

import { parseCsvRecords } from './csv.js';
import { parseDate } from './dates.js';
import { FOLLOWUP_STATUSES } from './config.js';

export const FILE_KINDS = ['cohorts', 'roster', 'attendance', 'assessments', 'followups'];

export function itemColumns(count) {
  return Array.from({ length: count }, (_, i) => `q${i + 1}`);
}

export function requiredColumns(kind, rules) {
  switch (kind) {
    case 'cohorts':
      return ['cohort_id', 'cohort_name', 'start_date', 'end_date', 'sessions_planned'];
    case 'roster':
      return ['participant_id', 'name', 'age', 'enrollment_date', 'cohort_id'];
    case 'attendance':
      return ['participant_id', 'sessions_attended'];
    case 'assessments':
      return ['participant_id', 'phase', ...itemColumns(rules.assessmentItems)];
    case 'followups':
      return ['participant_id', 'checkpoint_days', 'status'];
    default:
      return [];
  }
}

// Answers typed by hand or exported from a form, mapped to the status ids.
const STATUS_ALIASES = {
  full_time: 'employed_full_time',
  employed_full_time: 'employed_full_time',
  part_time: 'employed_part_time',
  employed_part_time: 'employed_part_time',
  internship: 'internship_apprenticeship',
  apprenticeship: 'internship_apprenticeship',
  internship_or_apprenticeship: 'internship_apprenticeship',
  internship_apprenticeship: 'internship_apprenticeship',
  self_employed: 'self_employed',
  self_employed_or_freelance: 'self_employed',
  freelance: 'self_employed',
  further_education: 'further_education',
  in_school: 'further_education',
  in_school_or_a_training_program: 'further_education',
  in_school_or_training: 'further_education',
  training: 'further_education',
  seeking: 'seeking',
  looking_for_work: 'seeking',
  unemployed: 'seeking',
  not_seeking: 'not_seeking',
  not_looking_for_work: 'not_seeking',
  not_looking_for_work_right_now: 'not_seeking',
};
const STATUS_IDS = new Set(FOLLOWUP_STATUSES.map((s) => s.id));

function slug(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function normalizeStatus(value) {
  const key = slug(value);
  if (STATUS_IDS.has(key)) return key;
  return STATUS_ALIASES[key] ?? null;
}

// yes / no / true / false / 1 / 0 (Google Sheets checkboxes export TRUE/FALSE),
// plus full survey answers such as "Yes, it's a new job" or "No, I had this job before".
export function parseYesNo(value) {
  const key = slug(value);
  if (['yes', 'y', 'true', '1', 'correct'].includes(key) || key.startsWith('yes_')) return true;
  if (['no', 'n', 'false', '0', 'incorrect'].includes(key) || key.startsWith('no_')) return false;
  return null;
}

function parseCount(value) {
  const str = String(value ?? '').trim();
  if (!/^\d+$/.test(str)) return null;
  return Number(str);
}

// Collects repeated problems into one readable line per kind of problem.
class IssueLog {
  constructor() {
    this.groups = new Map();
  }
  add(level, file, message, example) {
    const key = `${level}|${file}|${message}`;
    if (!this.groups.has(key)) this.groups.set(key, { level, file, message, count: 0, examples: [] });
    const group = this.groups.get(key);
    group.count++;
    if (example && group.examples.length < 3) group.examples.push(example);
  }
  list() {
    const order = { error: 0, warning: 1, info: 2 };
    return [...this.groups.values()].sort((a, b) => order[a.level] - order[b.level]);
  }
}

// texts: { cohorts, roster, attendance, assessments, followups } → CSV text or null.
export function buildDataset(texts, config) {
  const { rules } = config;
  const log = new IssueLog();
  const tables = {};

  for (const kind of FILE_KINDS) {
    const file = `${kind}.csv`;
    if (texts[kind] === null || texts[kind] === undefined) {
      log.add('error', file, 'File not loaded, so the metrics that use it are empty');
      tables[kind] = [];
      continue;
    }
    const { columns, records } = parseCsvRecords(texts[kind]);
    const missing = requiredColumns(kind, rules).filter((c) => !columns.includes(c));
    if (missing.length) {
      log.add('error', file, `Missing column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`);
      tables[kind] = [];
      continue;
    }
    tables[kind] = records;
  }

  // Cohorts
  const cohorts = new Map();
  for (const r of tables.cohorts) {
    const startDay = parseDate(r.start_date);
    const endDay = parseDate(r.end_date);
    const sessionsPlanned = parseCount(r.sessions_planned);
    if (!r.cohort_id) {
      log.add('error', 'cohorts.csv', 'Row has no cohort_id and was skipped', `row ${r._row}`);
      continue;
    }
    if (startDay === null || endDay === null || endDay < startDay) {
      log.add('error', 'cohorts.csv', 'Start or end date is missing or invalid; cohort skipped', r.cohort_id);
      continue;
    }
    if (!sessionsPlanned) {
      log.add('error', 'cohorts.csv', 'sessions_planned must be a whole number above 0; cohort skipped', r.cohort_id);
      continue;
    }
    const held = parseCount(r.sessions_held);
    cohorts.set(r.cohort_id, {
      id: r.cohort_id,
      name: r.cohort_name || r.cohort_id,
      startDay,
      endDay,
      sessionsPlanned,
      sessionsHeld: held === null ? null : Math.min(held, sessionsPlanned),
    });
  }

  // Roster
  const participants = new Map();
  for (const r of tables.roster) {
    const id = r.participant_id;
    if (!id) {
      log.add('error', 'roster.csv', 'Row has no participant_id and was skipped', `row ${r._row}`);
      continue;
    }
    if (participants.has(id)) {
      log.add('error', 'roster.csv', 'Duplicate participant_id; later row ignored', id);
      continue;
    }
    if (!cohorts.has(r.cohort_id)) {
      log.add('error', 'roster.csv', 'cohort_id is not in cohorts.csv; participant skipped', `${id} → ${r.cohort_id || '(blank)'}`);
      continue;
    }
    const age = parseCount(r.age);
    if (age === null) log.add('warning', 'roster.csv', 'Age missing or not a number; counted as "age not recorded"', id);
    const enrollmentDay = parseDate(r.enrollment_date);
    if (enrollmentDay === null) log.add('warning', 'roster.csv', 'Enrollment date missing or invalid', id);
    participants.set(id, {
      id,
      name: r.name,
      age,
      enrollmentDay,
      cohortId: r.cohort_id,
      sessionsAttended: null,
      pre: null,
      post: null,
      followups: new Map(),
    });
  }

  const unknownId = (file, r) => log.add('warning', file, 'participant_id is not in roster.csv; row ignored', `${r.participant_id || '(blank)'} (row ${r._row})`);

  // Attendance
  for (const r of tables.attendance) {
    const p = participants.get(r.participant_id);
    if (!p) {
      unknownId('attendance.csv', r);
      continue;
    }
    const n = parseCount(r.sessions_attended);
    if (n === null) {
      log.add('warning', 'attendance.csv', 'sessions_attended is not a whole number; row ignored', p.id);
      continue;
    }
    const cohort = cohorts.get(p.cohortId);
    if (n > cohort.sessionsPlanned) {
      log.add('warning', 'attendance.csv', 'More sessions attended than planned; capped at sessions_planned', p.id);
    }
    p.sessionsAttended = Math.min(n, cohort.sessionsPlanned);
  }

  // Assessments
  const items = itemColumns(rules.assessmentItems);
  for (const r of tables.assessments) {
    const p = participants.get(r.participant_id);
    if (!p) {
      unknownId('assessments.csv', r);
      continue;
    }
    const phase = slug(r.phase);
    if (phase !== 'pre' && phase !== 'post') {
      log.add('warning', 'assessments.csv', 'phase must be "pre" or "post"; row ignored', `${p.id} (row ${r._row})`);
      continue;
    }
    if (items.every((q) => r[q] === '')) {
      log.add('warning', 'assessments.csv', 'All answers blank; row ignored', `${p.id} ${phase}`);
      continue;
    }
    const scored = items.map((q) => {
      if (r[q] === '') return 0;
      const v = parseYesNo(r[q]);
      if (v === null) log.add('warning', 'assessments.csv', 'Answer is not 1/0 or TRUE/FALSE; scored as incorrect', `${p.id} ${phase} ${q}`);
      return v ? 1 : 0;
    });
    if (p[phase]) log.add('warning', 'assessments.csv', `More than one ${phase}-assessment; the last row is used`, p.id);
    p[phase] = { items: scored, score: scored.reduce((a, b) => a + b, 0) / scored.length };
  }

  // Follow-ups
  for (const r of tables.followups) {
    const p = participants.get(r.participant_id);
    if (!p) {
      unknownId('followups.csv', r);
      continue;
    }
    const checkpoint = parseInt(String(r.checkpoint_days), 10);
    if (!rules.followupCheckpoints.includes(checkpoint)) {
      log.add('warning', 'followups.csv', `checkpoint_days must be one of ${rules.followupCheckpoints.join(', ')}; row ignored`, `${p.id} (row ${r._row})`);
      continue;
    }
    const status = normalizeStatus(r.status);
    if (!status) {
      log.add('warning', 'followups.csv', 'Status not recognized; row ignored', `${p.id}: "${r.status}"`);
      continue;
    }
    if (p.followups.has(checkpoint)) log.add('warning', 'followups.csv', 'More than one response for the same checkpoint; the last row is used', `${p.id} day ${checkpoint}`);
    p.followups.set(checkpoint, {
      checkpoint,
      responseDay: parseDate(r.response_date),
      status,
      newRole: parseYesNo(r.new_role),
      employer: r.employer ?? '',
      jobTitle: r.job_title ?? '',
      usesAi: slug(r.uses_ai) || '',
      storyConsent: parseYesNo(r.story_consent),
    });
  }

  return { cohorts, participants: [...participants.values()], issues: log.list() };
}
