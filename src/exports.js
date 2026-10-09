// CSV exports. The summary file is one row per cohort plus a total row, for
// pasting into a spreadsheet. The participant file is one row per person with
// plain column names, ISO dates and TRUE/FALSE flags, the shape the Salesforce
// Data Import Wizard maps without fuss.

import { toCsv } from './csv.js';
import { toIsoDate } from './dates.js';
import { STATUS_LABEL } from './report-model.js';

// Byte-order mark so Excel opens names with accents correctly.
const BOM = '\uFEFF';
const pctNum = (x) => (x === null || x === undefined ? '' : Math.round(x * 1000) / 10);
const bool = (b) => (b ? 'TRUE' : 'FALSE');
// Free text from rosters and surveys: a leading = + - @ would run as a
// formula when the file is opened in Excel or Sheets, so quote it.
const safeText = (v) => (typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? `'${v}` : v);

const SUMMARY_COLUMNS = [
  'cohort',
  'status',
  'start_date',
  'end_date',
  'enrolled',
  'enrolled_finished_cohorts',
  'completed',
  'completion_rate_pct',
  'certificates',
  'avg_pre_score_pct',
  'avg_post_score_pct',
  'skills_gain_pts',
  'pct_improved',
  'graduates_surveyed',
  'followup_response_rate_pct',
  'job_placements',
  'placement_rate_pct',
  'further_education',
  'data_as_of',
  'sample_data',
];

function summaryRow(label, status, start, end, s, report, config) {
  return {
    cohort: safeText(label),
    status,
    start_date: toIsoDate(start),
    end_date: toIsoDate(end),
    enrolled: s.enrollments,
    enrolled_finished_cohorts: s.finishedEnrolled,
    completed: s.completed,
    completion_rate_pct: pctNum(s.completionRate),
    certificates: s.certificates,
    avg_pre_score_pct: pctNum(s.skills.pre),
    avg_post_score_pct: pctNum(s.skills.post),
    skills_gain_pts: s.skills.gainPts ?? '',
    pct_improved: pctNum(s.skills.improvedRate),
    graduates_surveyed: s.followup.surveyed,
    followup_response_rate_pct: pctNum(s.followup.responseRate),
    job_placements: s.followup.placed,
    placement_rate_pct: pctNum(s.followup.placementRate),
    further_education: s.followup.furtherEducation,
    data_as_of: toIsoDate(report.asOf),
    sample_data: bool(config.isSampleData),
  };
}

export function summaryCsv(report, config) {
  const rows = report.byCohort.map((row) =>
    summaryRow(row.cohort.name, row.status, row.cohort.startDay, row.cohort.endDay, row, report, config),
  );
  if (report.selection === 'all') {
    const ends = report.cohorts.map((c) => c.endDay);
    rows.push(summaryRow('All cohorts', '', report.periodStart, ends.length ? Math.max(...ends) : null, report.totals, report, config));
  }
  return BOM + toCsv(SUMMARY_COLUMNS, rows);
}

const PARTICIPANT_COLUMNS = [
  'participant_id',
  'name',
  'age',
  'cohort',
  'enrollment_date',
  'sessions_attended',
  'sessions_planned',
  'attendance_pct',
  'completed',
  'certificate',
  'pre_score_pct',
  'post_score_pct',
  'skills_gain_pts',
  'latest_followup_status',
  'job_placement',
  'placement_checkpoint_days',
  'employer',
  'job_title',
  'data_as_of',
];

export function participantCsv(report) {
  const rows = report.participants.map((p) => ({
    participant_id: safeText(p.id),
    name: safeText(p.name),
    age: p.age ?? '',
    cohort: safeText(p.cohortName),
    enrollment_date: toIsoDate(p.enrollmentDay),
    sessions_attended: p.sessionsAttended ?? '',
    sessions_planned: p.sessionsPlanned,
    attendance_pct: pctNum(p.attendanceRate),
    completed: p.cohortStatus === 'finished' ? bool(p.completed) : '',
    certificate: p.cohortStatus === 'finished' ? bool(p.certified) : '',
    pre_score_pct: pctNum(p.preScore),
    post_score_pct: pctNum(p.postScore),
    skills_gain_pts: p.gain === null ? '' : Math.round(p.gain * 100),
    latest_followup_status: p.latestStatus ? STATUS_LABEL[p.latestStatus] : '',
    job_placement: p.completed ? bool(p.placed) : '',
    placement_checkpoint_days: p.placedCheckpoint ?? '',
    employer: safeText(p.placement?.employer ?? ''),
    job_title: safeText(p.placement?.jobTitle ?? ''),
    data_as_of: toIsoDate(report.asOf),
  }));
  return BOM + toCsv(PARTICIPANT_COLUMNS, rows);
}

export function exportFileName(config, report, kind, ext) {
  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const scope = report.selection === 'all' ? 'all-cohorts' : slug(report.selectionLabel);
  return `${slug(config.programName)}-${kind}-${scope}-${toIsoDate(report.asOf)}${config.isSampleData ? '-SAMPLE' : ''}.${ext}`;
}
