import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { config } from '../src/config.js';
import { buildDataset, FILE_KINDS, normalizeStatus, parseYesNo } from '../src/data.js';
import { computeReport } from '../src/metrics.js';
import { buildNarrative, buildReportModel } from '../src/report-model.js';

const header = 'participant_id,phase,completed_date,q1,q2,q3,q4,q5,q6,q7,q8,q9,q10';
const items = (n) => Array.from({ length: 10 }, (_, i) => (i < n ? 1 : 0)).join(',');

// Two cohorts: one finished on Apr 24, one still running on the as-of date.
function fixture(overrides = {}) {
  return {
    cohorts: [
      'cohort_id,cohort_name,start_date,end_date,sessions_planned,sessions_held',
      'a,Cohort A,2026-03-02,2026-04-24,10,10',
      'b,Cohort B,2026-09-14,2026-11-06,10,4',
    ].join('\n'),
    roster: [
      'participant_id,name,age,enrollment_date,cohort_id',
      'A1,Ana Lopez,19,2026-02-20,a',
      'A2,Ben Okafor,24,2026-02-21,a',
      'A3,Cara Kim,31,2026-02-22,a',
      'A4,Dev Patel,17,2026-02-23,a',
      'B1,Eli Reyes,22,2026-09-01,b',
    ].join('\n'),
    attendance: [
      'participant_id,sessions_attended',
      'A1,10', // completes
      'A2,8', // completes (exactly 80%)
      'A3,7', // does not complete
      'A4,9', // completes, no post-assessment
      'B1,4',
    ].join('\n'),
    assessments: [
      header,
      `A1,pre,2026-03-02,${items(4)}`,
      `A1,post,2026-04-24,${items(9)}`,
      `A2,pre,2026-03-02,${items(5)}`,
      `A2,post,2026-04-24,${items(6)}`, // below the 70% certificate bar
      `A3,pre,2026-03-02,${items(3)}`,
      `A3,post,2026-04-24,${items(5)}`,
      `A4,pre,2026-03-02,${items(2)}`,
      `B1,pre,2026-09-14,${items(3)}`,
      `B1,post,2026-10-01,${items(9)}`, // cohort not finished: ignored
    ].join('\n'),
    followups: [
      'participant_id,checkpoint_days,response_date,status,new_role,employer,job_title,uses_ai,story_consent',
      'A1,30,2026-05-25,seeking,,,,,no',
      'A1,60,2026-06-24,employed_full_time,yes,Cedar Credit Union,Analyst,regularly,yes',
      'A2,30,2026-05-25,employed_part_time,no,,,never,no', // job they already had
      'A3,30,2026-05-25,employed_full_time,yes,,,,', // non-completer: not surveyed
      'A4,30,2026-05-25,In school or a training program,,,,,',
    ].join('\n'),
    ...overrides,
  };
}

const cfg = (extra = {}) => ({ ...config, dataAsOf: '2026-10-09', targets: {}, ...extra, rules: { ...config.rules, ...(extra.rules ?? {}) } });

test('completion counts only finished cohorts and uses the attendance threshold', () => {
  const r = computeReport(buildDataset(fixture(), cfg()), cfg());
  assert.equal(r.totals.enrollments, 5);
  assert.equal(r.totals.finishedEnrolled, 4);
  assert.equal(r.totals.completed, 3);
  assert.equal(r.totals.completionRate, 0.75);
  assert.equal(r.totals.inProgressEnrolled, 1);
});

test('certificates need completion and a passing post-assessment', () => {
  const r = computeReport(buildDataset(fixture(), cfg()), cfg());
  assert.equal(r.totals.certificates, 1); // only A1
  const lenient = cfg({ rules: { certificatePostScore: null } });
  assert.equal(computeReport(buildDataset(fixture(), lenient), lenient).totals.certificates, 3);
});

test('skills gained pairs pre and post for finished cohorts only', () => {
  const r = computeReport(buildDataset(fixture(), cfg()), cfg());
  const s = r.totals.skills;
  assert.equal(s.n, 3); // A1, A2, A3 (B1's early post is ignored)
  assert.equal(Math.round(s.pre * 100), 40);
  assert.equal(Math.round(s.post * 100), 67);
  assert.equal(s.gainPts, 27);
  assert.equal(s.improvedRate, 1);
  assert.equal(s.baselineN, 1);
});

test('placements count new roles among surveyed graduates only', () => {
  const r = computeReport(buildDataset(fixture(), cfg()), cfg());
  const f = r.totals.followup;
  assert.equal(f.surveyed, 3); // A1, A2, A4 completed and their 30-day survey is due
  assert.equal(f.placed, 1); // A1; A2's job predates the program; A3 did not complete
  assert.equal(f.furtherEducation, 1);
  assert.equal(f.checkpoints[0].due, 3);
  assert.equal(f.checkpoints[0].responded, 3);
  assert.equal(f.checkpoints[1].responded, 1);
  assert.equal(f.surveysSent, 9);
  assert.equal(f.surveysReturned, 4);
  const anyJob = cfg({ rules: { placementRequiresNewRole: false } });
  assert.equal(computeReport(buildDataset(fixture(), anyJob), anyJob).totals.followup.placed, 2);
});

test('follow-ups that are not due yet stay pending instead of counting as zero', () => {
  const early = cfg({ dataAsOf: '2026-06-10' }); // after day 30 (May 24), before day 60 (Jun 23)
  const r = computeReport(buildDataset(fixture(), early), early);
  const [d30, d60, d90] = r.totals.followup.checkpoints;
  assert.equal(d30.due, 3);
  assert.equal(d60.due, 0);
  assert.equal(d60.pending, 3);
  assert.equal(d90.pending, 3);
  assert.equal(r.totals.followup.stillOpen, true);
});

test('a single in-progress cohort reports pending metrics, not zeros', () => {
  const r = computeReport(buildDataset(fixture(), cfg()), cfg(), 'b');
  const model = buildReportModel(r, cfg());
  assert.equal(r.totals.completionRate, null);
  assert.equal(r.totals.attendanceSoFar, 1);
  const byId = Object.fromEntries(model.kpis.map((k) => [k.id, k]));
  assert.equal(byId.completion.value, 'In progress');
  assert.equal(byId.placements.value, 'Pending');
  assert.match(byId.placements.detail, /Dec 6, 2026/);
  assert.deepEqual(model.followupRows, []);
});

test('targets report met, pending and not met', () => {
  const withTargets = cfg({ targets: { enrollments: 5, completionRate: 0.8, placements: 2 } });
  const r = computeReport(buildDataset(fixture(), withTargets), withTargets);
  assert.equal(r.targets.enrollments.state, 'met');
  assert.equal(r.targets.completionRate.state, 'not_met');
  assert.equal(r.targets.placements.state, 'pending'); // cohort B has not graduated yet
  assert.equal(r.targets.certificates, null);
  const single = computeReport(buildDataset(fixture(), withTargets), withTargets, 'a');
  assert.equal(single.targets.enrollments, null);
});

test('data problems are reported, not thrown', () => {
  const ds = buildDataset(
    fixture({
      roster: 'participant_id,name,age,enrollment_date,cohort_id\nA1,Ana,abc,2026-02-20,a\nA1,Dup,20,2026-02-20,a\nZ9,Zed,20,2026-02-20,nope',
      attendance: 'participant_id,sessions_attended\nA1,12\nXX,3',
      followups: null,
    }),
    cfg(),
  );
  const messages = ds.issues.map((i) => `${i.file}: ${i.message}`);
  assert.ok(messages.some((m) => m.startsWith('followups.csv: File not loaded')));
  assert.ok(messages.some((m) => m.includes('Duplicate participant_id')));
  assert.ok(messages.some((m) => m.includes('cohort_id is not in cohorts.csv')));
  assert.ok(messages.some((m) => m.includes('Age missing')));
  assert.ok(messages.some((m) => m.includes('More sessions attended than planned')));
  assert.ok(messages.some((m) => m.startsWith('attendance.csv: participant_id is not in roster.csv')));
  assert.equal(ds.participants[0].sessionsAttended, 10);
});

test('missing columns are named', () => {
  const ds = buildDataset(fixture({ attendance: 'participant_id,attended\nA1,3' }), cfg());
  assert.ok(ds.issues.some((i) => i.message === 'Missing column: sessions_attended'));
});

test('survey labels and spreadsheet values map to status ids', () => {
  assert.equal(normalizeStatus('Employed full-time'), 'employed_full_time');
  assert.equal(normalizeStatus('Internship or apprenticeship'), 'internship_apprenticeship');
  assert.equal(normalizeStatus('Looking for work'), 'seeking');
  assert.equal(normalizeStatus('astronaut'), null);
  assert.equal(parseYesNo("Yes, it's a promotion or new role with the same employer"), true);
  assert.equal(parseYesNo('No, I had this job before the program'), false);
  assert.equal(parseYesNo('TRUE'), true);
  assert.equal(parseYesNo(''), null);
});

test('narrative states each metric in plain sentences', () => {
  const r = computeReport(buildDataset(fixture(), cfg()), cfg());
  const text = buildNarrative(r, cfg());
  assert.match(text, /5 participants enrolled/);
  assert.match(text, /3 \(75%\) completed the program and 1 earned a certificate/);
  assert.match(text, /rose from 40% to 67%/);
  assert.match(text, /1 graduate has reported a new job/);
  assert.match(text, /One more participant is mid-program/);
});

test('bundled sample data loads without errors', () => {
  const texts = Object.fromEntries(FILE_KINDS.map((k) => [k, readFileSync(new URL(`../${config.dataFiles[k]}`, import.meta.url), 'utf8')]));
  const ds = buildDataset(texts, config);
  assert.equal(ds.issues.filter((i) => i.level === 'error').length, 0);
  const r = computeReport(ds, config);
  assert.equal(r.totals.enrollments, 75);
  assert.equal(r.totals.cohortCount, 3);
  assert.ok(r.totals.followup.placed > 0);
});
