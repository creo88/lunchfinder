// The five funder metrics, worked out from the typed dataset (see data.js).
// Pure functions: the same code runs in the browser and in the Node export
// script, and is covered by tests/metrics.test.js.

import { parseDate } from './dates.js';

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const ratio = (num, den) => (den ? num / den : null);

export function cohortStatus(cohort, asOf) {
  if (cohort.startDay > asOf) return 'upcoming';
  if (cohort.endDay <= asOf) return 'finished';
  return 'in_progress';
}

function isPlacement(response, rules) {
  if (!response || !rules.placementStatuses.includes(response.status)) return false;
  return rules.placementRequiresNewRole ? response.newRole === true : true;
}

// Everything the report needs to know about one participant.
export function evaluateParticipant(p, cohort, asOf, config) {
  const { rules, skillAreas } = config;
  const status = cohortStatus(cohort, asOf);
  const finished = status === 'finished';
  const sessionsSoFar = finished ? cohort.sessionsPlanned : cohort.sessionsHeld;
  const attended = p.sessionsAttended ?? 0;
  const attendanceRate = sessionsSoFar ? attended / sessionsSoFar : null;

  const completed = finished && attended / cohort.sessionsPlanned >= rules.completionAttendance;
  const preScore = p.pre ? p.pre.score : null;
  const postScore = finished && p.post ? p.post.score : null;
  const certified =
    completed && (rules.certificatePostScore === null || (postScore !== null && postScore >= rules.certificatePostScore));

  const areaScore = (assessment, area) =>
    assessment ? mean(area.items.map((n) => assessment.items[n - 1] ?? 0)) : null;
  const areas = skillAreas.map((area) => ({
    id: area.id,
    pre: areaScore(p.pre, area),
    post: finished ? areaScore(p.post, area) : null,
  }));

  // Follow-up surveys go to completers only.
  const checkpoints = rules.followupCheckpoints.map((days) => {
    const dueDay = cohort.endDay + days;
    const response = completed ? p.followups.get(days) ?? null : null;
    return { days, dueDay, due: completed && dueDay <= asOf, response };
  });
  const responses = checkpoints.filter((c) => c.response).map((c) => c.response);
  const placedAt = checkpoints.find((c) => isPlacement(c.response, rules));
  const latest = responses.length ? responses[responses.length - 1] : null;
  const furtherEducation = !placedAt && responses.some((r) => r.status === 'further_education');

  return {
    id: p.id,
    name: p.name,
    age: p.age,
    enrollmentDay: p.enrollmentDay,
    cohortId: cohort.id,
    cohortName: cohort.name,
    cohortStatus: status,
    sessionsAttended: p.sessionsAttended,
    sessionsPlanned: cohort.sessionsPlanned,
    attendanceRate,
    completed,
    certified,
    preScore,
    postScore,
    gain: preScore !== null && postScore !== null ? postScore - preScore : null,
    areas,
    checkpoints,
    // Surveyed: a completer whose first follow-up is due, or who already answered one.
    surveyed: completed && (checkpoints[0].due || responses.length > 0),
    responded: responses.length > 0,
    placed: Boolean(placedAt),
    placedCheckpoint: placedAt ? placedAt.days : null,
    placement: placedAt ? placedAt.response : null,
    furtherEducation,
    latestStatus: latest ? latest.status : null,
  };
}

// Totals for any set of evaluated participants and the cohorts they belong to.
export function summarize(people, cohorts, asOf, config) {
  const finishedCohorts = cohorts.filter((c) => cohortStatus(c, asOf) === 'finished');
  const inProgressCohorts = cohorts.filter((c) => cohortStatus(c, asOf) === 'in_progress');
  const finished = people.filter((p) => p.cohortStatus === 'finished');
  const inProgress = people.filter((p) => p.cohortStatus === 'in_progress');
  const completers = finished.filter((p) => p.completed);
  const paired = finished.filter((p) => p.gain !== null);

  const areas = config.skillAreas.map((area, i) => ({
    id: area.id,
    label: area.label,
    pre: mean(paired.map((p) => p.areas[i].pre)),
    post: mean(paired.map((p) => p.areas[i].post)),
  }));

  const surveyed = completers.filter((p) => p.surveyed);
  const placed = surveyed.filter((p) => p.placed);
  const checkpoints = config.rules.followupCheckpoints.map((days, i) => {
    const due = completers.filter((p) => p.checkpoints[i].due);
    const responded = due.filter((p) => p.checkpoints[i].response);
    const notDue = completers.filter((p) => !p.checkpoints[i].due);
    const nextDueDay = notDue.length ? Math.min(...notDue.map((p) => p.checkpoints[i].dueDay)) : null;
    return {
      days,
      due: due.length,
      responded: responded.length,
      responseRate: ratio(responded.length, due.length),
      placedCumulative: due.filter((p) => p.placed && p.placedCheckpoint <= days).length,
      pending: notDue.length,
      nextDueDay,
    };
  });

  const ageBands = config.ageBands.map((band) => ({
    label: band.label,
    count: people.filter(
      (p) => p.age !== null && (band.min === undefined || p.age >= band.min) && (band.max === undefined || p.age <= band.max),
    ).length,
  }));

  const usesAi = placed.filter((p) => p.placement.usesAi === 'regularly' || p.placement.usesAi === 'sometimes');

  return {
    cohortCount: cohorts.length,
    finishedCohortCount: finishedCohorts.length,
    inProgressCohortCount: inProgressCohorts.length,
    inProgressEndDay: inProgressCohorts.length ? Math.max(...inProgressCohorts.map((c) => c.endDay)) : null,
    enrollments: people.length,
    inProgressEnrolled: inProgress.length,
    finishedEnrolled: finished.length,
    completed: completers.length,
    completionRate: ratio(completers.length, finished.length),
    certificates: completers.filter((p) => p.certified).length,
    certificateRate: ratio(completers.filter((p) => p.certified).length, completers.length),
    attendanceSoFar: mean(inProgress.filter((p) => p.attendanceRate !== null).map((p) => p.attendanceRate)),
    skills: {
      n: paired.length,
      pre: mean(paired.map((p) => p.preScore)),
      post: mean(paired.map((p) => p.postScore)),
      // Difference of the rounded averages, so "41% → 76%" always reads as +35 pts.
      gainPts: paired.length ? Math.round(mean(paired.map((p) => p.postScore)) * 100) - Math.round(mean(paired.map((p) => p.preScore)) * 100) : null,
      improvedRate: ratio(paired.filter((p) => p.gain > 0).length, paired.length),
      areas,
      baselineN: inProgress.filter((p) => p.preScore !== null).length,
      baseline: mean(inProgress.filter((p) => p.preScore !== null).map((p) => p.preScore)),
    },
    followup: {
      surveyed: surveyed.length,
      // Response rate counts surveys, not people: returned ÷ sent across all checkpoints due.
      surveysSent: checkpoints.reduce((a, c) => a + c.due, 0),
      surveysReturned: checkpoints.reduce((a, c) => a + c.responded, 0),
      responseRate: ratio(checkpoints.reduce((a, c) => a + c.responded, 0), checkpoints.reduce((a, c) => a + c.due, 0)),
      placed: placed.length,
      placementRate: ratio(placed.length, surveyed.length),
      furtherEducation: surveyed.filter((p) => p.furtherEducation).length,
      usesAiRate: ratio(usesAi.length, placed.length),
      notYetSurveyed: completers.length - surveyed.length,
      checkpoints,
      lastDueDay: completers.length ? Math.max(...completers.map((p) => p.checkpoints[p.checkpoints.length - 1].dueDay)) : null,
      stillOpen: checkpoints.some((c) => c.pending > 0),
      // First survey date for cohorts that have not finished yet.
      firstSurveyDay: inProgressCohorts.length
        ? Math.min(...inProgressCohorts.map((c) => c.endDay)) + config.rules.followupCheckpoints[0]
        : null,
    },
    ageBands,
    ageUnknown: people.filter((p) => p.age === null).length,
  };
}

function targetStatus(value, target, stillOpen) {
  if (target === null || target === undefined || value === null) return null;
  if (value >= target) return { target, state: 'met' };
  return { target, state: stillOpen ? 'pending' : 'not_met' };
}

// The whole report for one selection: "all" or a single cohort id.
export function computeReport(dataset, config, selection = 'all') {
  const asOf = parseDate(config.dataAsOf);
  const allCohorts = [...dataset.cohorts.values()].sort((a, b) => a.startDay - b.startDay);
  const evaluated = dataset.participants.map((p) =>
    evaluateParticipant(p, dataset.cohorts.get(p.cohortId), asOf, config),
  );

  const chosen = selection === 'all' ? allCohorts : allCohorts.filter((c) => c.id === selection);
  const chosenIds = new Set(chosen.map((c) => c.id));
  const people = evaluated.filter((p) => chosenIds.has(p.cohortId));
  const totals = summarize(people, chosen, asOf, config);

  const byCohort = allCohorts.map((cohort) => ({
    cohort,
    status: cohortStatus(cohort, asOf),
    ...summarize(
      evaluated.filter((p) => p.cohortId === cohort.id),
      [cohort],
      asOf,
      config,
    ),
  }));

  // Targets are program-level goals, so they only apply to the all-cohorts view.
  const t = selection === 'all' ? config.targets ?? {} : {};
  const targets = {
    enrollments: targetStatus(totals.enrollments, t.enrollments, totals.inProgressCohortCount > 0),
    completionRate: targetStatus(totals.completionRate, t.completionRate, false),
    certificates: targetStatus(totals.certificates, t.certificates, totals.inProgressCohortCount > 0),
    skillsGainPts: targetStatus(totals.skills.gainPts, t.skillsGainPts, false),
    placements: targetStatus(totals.followup.placed, t.placements, totals.followup.stillOpen || totals.inProgressCohortCount > 0),
  };

  const periodStart = chosen.length ? Math.min(...chosen.map((c) => c.startDay)) : null;
  return {
    asOf,
    selection,
    selectionLabel: selection === 'all' ? `All cohorts (${allCohorts.length})` : chosen[0]?.name ?? selection,
    periodStart,
    periodEnd: asOf,
    cohorts: chosen,
    totals,
    targets,
    byCohort: selection === 'all' ? byCohort : byCohort.filter((row) => chosenIds.has(row.cohort.id)),
    participants: people,
    checks: deliveryChecks(evaluated),
  };
}

// Gaps in the delivery data that will pull a metric down if left unfixed.
function deliveryChecks(evaluated) {
  const checks = [];
  const add = (level, message, people) => {
    if (people.length) checks.push({ level, file: 'delivery', message, count: people.length, examples: people.slice(0, 3).map((p) => p.id) });
  };
  add('warning', 'No attendance recorded; counted as 0 sessions', evaluated.filter((p) => p.sessionsAttended === null && p.cohortStatus !== 'upcoming'));
  add('info', 'No pre-assessment on file; left out of skills gained', evaluated.filter((p) => p.preScore === null && p.cohortStatus !== 'upcoming'));
  add('warning', 'Completed the program but has no post-assessment, so no certificate', evaluated.filter((p) => p.completed && p.postScore === null));
  return checks;
}
