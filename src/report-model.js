// Turns computed metrics into the words and rows a funder reads. The dashboard
// and the PDF both render this model, so they can never disagree.

import { formatDate, formatRange } from './dates.js';
import { FOLLOWUP_STATUSES } from './config.js';

export const pct = (x) => (x === null || x === undefined ? '—' : `${Math.round(x * 100)}%`);
const signedPts = (v) => `${v > 0 ? '+' : ''}${v} pts`;
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
// "Northside Youth Works'" rather than "Works's".
const possessive = (name) => (/s$/i.test(name) ? `${name}'` : `${name}'s`);

const STATUS_LABEL = Object.fromEntries(FOLLOWUP_STATUSES.map((s) => [s.id, s.label]));

function targetNote(t, format) {
  if (!t) return null;
  const label = { met: 'met', pending: 'not yet met', not_met: 'not met' }[t.state];
  return { state: t.state, text: `Target ${format(t.target)} · ${label}` };
}

// opts.arrow lets the PDF swap "→" for a character its built-in font has.
export function buildReportModel(report, config, opts = {}) {
  const arrow = opts.arrow ?? '→';
  const { totals: t, targets } = report;
  const single = report.selection !== 'all';
  const allFinished = t.inProgressCohortCount === 0;
  const fu = t.followup;
  const sk = t.skills;
  const endText = t.inProgressEndDay ? formatDate(t.inProgressEndDay) : '';

  const kpis = !t.enrollments ? emptyKpis() : [
    {
      id: 'enrollments',
      label: 'Enrollments',
      value: String(t.enrollments),
      detail: [
        single ? report.selectionLabel : `Across ${plural(t.cohortCount, 'cohort')}`,
        t.inProgressEnrolled ? `${t.inProgressEnrolled} still in the program` : null,
      ].filter(Boolean).join(' · '),
      target: targetNote(targets.enrollments, String),
    },
    t.finishedEnrolled
      ? {
          id: 'completion',
          label: 'Completion rate',
          value: pct(t.completionRate),
          detail: `${t.completed} of ${t.finishedEnrolled} ${allFinished ? 'participants' : 'in finished cohorts'}`,
          target: targetNote(targets.completionRate, pct),
        }
      : {
          id: 'completion',
          label: 'Completion rate',
          value: t.inProgressEnrolled ? 'In progress' : 'Pending',
          pending: true,
          detail: t.inProgressEnrolled ? `Attendance so far ${pct(t.attendanceSoFar)} · ends ${endText}` : 'Shown once a cohort finishes',
          target: null,
        },
    t.finishedEnrolled
      ? {
          id: 'certificates',
          label: 'Certificates',
          value: String(t.certificates),
          detail: `${pct(t.certificateRate)} of completers`,
          target: targetNote(targets.certificates, String),
        }
      : {
          id: 'certificates',
          label: 'Certificates',
          value: 'Pending',
          pending: true,
          detail: endText ? `Issued after the last session, ${endText}` : 'Issued after the last session',
          target: null,
        },
    sk.n
      ? {
          id: 'skills',
          label: 'Skills gained',
          value: signedPts(sk.gainPts),
          detail: `Avg score ${pct(sk.pre)} ${arrow} ${pct(sk.post)} · ${pct(sk.improvedRate)} improved`,
          target: targetNote(targets.skillsGainPts, signedPts),
        }
      : {
          id: 'skills',
          label: 'Skills gained',
          value: 'Pending',
          pending: true,
          detail: sk.baselineN && endText ? `Starting score ${pct(sk.baseline)} · post-assessment ${endText}` : 'Post-assessment at the last session',
          target: null,
        },
    fu.surveyed
      ? {
          id: 'placements',
          label: 'Job placements',
          value: String(fu.placed),
          detail: `${pct(fu.placementRate)} of ${fu.surveyed} graduates surveyed · ${pct(fu.responseRate)} of surveys returned`,
          target: targetNote(targets.placements, String),
        }
      : {
          id: 'placements',
          label: 'Job placements',
          value: 'Pending',
          pending: true,
          detail: firstSurveyText(report),
          target: null,
        },
  ];

  const journeyBase = t.finishedEnrolled;
  const journey = journeyBase
    ? [
        { label: 'Enrolled', value: journeyBase },
        { label: 'Completed', value: t.completed },
        { label: 'Earned certificate', value: t.certificates },
        { label: 'Reported a new job', value: fu.placed },
      ].map((row) => ({ ...row, share: row.value / journeyBase }))
    : [];

  const cohortRows = report.byCohort.map((row) => {
    const finished = row.status === 'finished';
    return {
      id: row.cohort.id,
      name: row.cohort.name,
      dates: formatRange(row.cohort.startDay, row.cohort.endDay),
      status: { finished: 'Finished', in_progress: 'In progress', upcoming: 'Upcoming' }[row.status],
      statusId: row.status,
      enrolled: String(row.enrollments),
      completion: finished ? `${pct(row.completionRate)} (${row.completed}/${row.finishedEnrolled})` : '—',
      certificates: finished ? String(row.certificates) : '—',
      skills: row.skills.n ? `${pct(row.skills.pre)} ${arrow} ${pct(row.skills.post)}` : row.skills.baselineN ? `${pct(row.skills.baseline)} start` : '—',
      placed: row.followup.surveyed ? `${row.followup.placed} of ${row.followup.surveyed}` : '—',
    };
  });

  // No graduates yet means no surveys yet: show the first survey date instead of empty rows.
  const followupRows = !t.completed ? [] : fu.checkpoints.map((c) => ({
    label: `${c.days}-day`,
    due: c.due,
    responded: c.due ? `${c.responded} (${pct(c.responseRate)})` : '—',
    responseRate: c.responseRate,
    // Graduates with a new job by this checkpoint, out of those the survey went to.
    placed: c.due ? `${c.placedCumulative} (${pct(c.placedCumulative / c.due)})` : '—',
    placedRate: c.due ? c.placedCumulative / c.due : null,
    pending: c.pending ? `${c.pending} · ${formatDate(c.nextDueDay)}` : 'None',
  }));

  return {
    title: config.programName,
    partner: config.partnerName,
    provider: config.provider,
    isSample: config.isSampleData,
    selectionLabel: report.selectionLabel,
    period: report.periodStart !== null ? formatRange(report.periodStart, report.periodEnd) : '',
    asOf: formatDate(report.asOf),
    narrative: buildNarrative(report, config),
    kpis,
    journey,
    journeyBaseNote: journeyBase ? `${allFinished ? 'All participants' : 'Finished cohorts only'} · share of enrolled` : '',
    skillAreas: sk.areas,
    skillsN: sk.n,
    cohortRows,
    followupRows,
    followupNote: t.completed ? followupNote(fu) : `${firstSurveyText(report)}, ${config.rules.followupCheckpoints[0]} days after the last session.`,
    ageBands: t.ageBands,
    ageUnknown: t.ageUnknown,
    definitions: definitions(config),
  };
}

function emptyKpis() {
  return [
    ['enrollments', 'Enrollments'],
    ['completion', 'Completion rate'],
    ['certificates', 'Certificates'],
    ['skills', 'Skills gained'],
    ['placements', 'Job placements'],
  ].map(([id, label]) => ({ id, label, value: '—', pending: true, detail: 'No participants loaded', target: null }));
}

function firstSurveyText(report) {
  const fu = report.totals.followup;
  const day = fu.checkpoints[0]?.nextDueDay ?? fu.firstSurveyDay;
  return day ? `First follow-up survey ${formatDate(day)}` : 'First survey after the last session';
}

function followupNote(fu) {
  const parts = [];
  if (fu.furtherEducation) parts.push(`${fu.furtherEducation} more ${fu.furtherEducation === 1 ? 'graduate is' : 'graduates are'} in further education or training.`);
  if (fu.placed && fu.usesAiRate !== null) parts.push(`${pct(fu.usesAiRate)} of graduates in new jobs use AI tools at work.`);
  return parts.join(' ');
}

// The paragraph Mark can paste into a funder report or board deck.
export function buildNarrative(report, config) {
  const { totals: t } = report;
  const sk = t.skills;
  const fu = t.followup;
  const single = report.selection !== 'all';
  const sentences = [];

  if (!t.enrollments) return 'No participant data is loaded yet. Check the data files listed under Data and settings.';
  if (single) {
    sentences.push(
      `${plural(t.enrollments, 'participant')} enrolled in the ${report.selectionLabel} cohort of ${possessive(config.partnerName)} ${config.programName} (${formatRange(report.cohorts[0].startDay, report.cohorts[0].endDay)}).`,
    );
  } else {
    sentences.push(
      `Between ${formatDate(report.periodStart)} and ${formatDate(report.asOf)}, ${plural(t.enrollments, 'participant')} enrolled in ${possessive(config.partnerName)} ${config.programName} across ${plural(t.cohortCount, 'cohort')}.`,
    );
  }

  if (t.finishedEnrolled) {
    const scope = t.inProgressCohortCount ? `Of the ${t.finishedEnrolled} in cohorts that have finished, ${t.completed}` : `${t.completed} of ${t.finishedEnrolled}`;
    sentences.push(`${scope} (${pct(t.completionRate)}) completed the program and ${t.certificates} earned a certificate.`);
  }

  if (sk.n) {
    sentences.push(
      `Average scores on the AI skills assessment rose from ${pct(sk.pre)} to ${pct(sk.post)}, and ${pct(sk.improvedRate)} of participants improved.`,
    );
  }

  if (fu.surveyed) {
    const job = fu.placed === 1 ? 'graduate has' : 'graduates have';
    let s = `So far ${fu.placed} ${job} reported a new job (${pct(fu.placementRate)} of those surveyed; ${pct(fu.responseRate)} of follow-up surveys returned)`;
    s += fu.stillOpen && fu.lastDueDay ? `; follow-up surveys continue through ${formatDate(fu.lastDueDay)}.` : '.';
    sentences.push(s);
  }

  if (t.inProgressEnrolled) {
    sentences.push(
      single
        ? `The cohort is mid-program and finishes on ${formatDate(t.inProgressEndDay)}.`
        : `${t.inProgressEnrolled === 1 ? 'One more participant is' : `Another ${t.inProgressEnrolled} participants are`} mid-program and will finish by ${formatDate(t.inProgressEndDay)}.`,
    );
  }
  return sentences.join(' ');
}

export function definitions(config) {
  const r = config.rules;
  const statuses = r.placementStatuses.map((id) => (STATUS_LABEL[id] ?? id).toLowerCase());
  const statusList = statuses.length > 1 ? `${statuses.slice(0, -1).join(', ')} or ${statuses[statuses.length - 1]}` : statuses[0];
  const checkpoints = r.followupCheckpoints;
  const cpList = `${checkpoints.slice(0, -1).join(', ')} and ${checkpoints[checkpoints.length - 1]}`;
  return [
    { term: 'Enrollments', text: 'Participants on the cohort roster, each counted once.' },
    {
      term: 'Completion rate',
      text: `Share of participants in finished cohorts who attended at least ${pct(r.completionAttendance)} of planned sessions. Cohorts still running are counted once they finish.`,
    },
    {
      term: 'Certificates',
      text:
        r.certificatePostScore === null
          ? 'Issued to every participant who completes the program.'
          : `Issued to participants who complete the program and score at least ${pct(r.certificatePostScore)} on the post-assessment.`,
    },
    {
      term: 'Skills gained',
      text: `Change in average score on the same ${r.assessmentItems}-question assessment taken at the first and last session, for participants who took both. Shown in percentage points.`,
    },
    {
      term: 'Job placements',
      text: `Graduates who report ${r.placementRequiresNewRole ? 'a new job or role that started after they joined' : 'a job'} (${statusList}) in self-reported surveys ${cpList} days after the last session. Rate is out of graduates surveyed so far.`,
    },
  ];
}

export { STATUS_LABEL };
