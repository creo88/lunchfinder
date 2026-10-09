// Writes realistic, made-up program data to data/sample/ for demos and tests.
// Seeded, so every run produces the same files. Run: npm run sample-data
//
// Story the numbers tell: two finished cohorts (Spring and Summer 2026) and
// one mid-program (Fall 2026), with Summer's 90-day follow-up not yet due.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { toCsv } from '../src/csv.js';
import { parseDate, toIsoDate } from '../src/dates.js';
import { config } from '../src/config.js';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'sample');
const AS_OF = parseDate(config.dataAsOf);

// mulberry32
let seed = 20261009;
function rand() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const randInt = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
const pick = (xs) => xs[Math.floor(rand() * xs.length)];
const chance = (p) => rand() < p;
const normal = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
const sigmoid = (x) => 1 / (1 + Math.exp(-x));
function weighted(options) {
  let r = rand() * options.reduce((a, [, w]) => a + w, 0);
  for (const [value, w] of options) if ((r -= w) < 0) return value;
  return options[options.length - 1][0];
}

const FIRST = [
  'Aaliyah', 'Andre', 'Ana', 'Brianna', 'Carlos', 'Chloe', 'Darnell', 'Destiny', 'Diego', 'Elena', 'Emmanuel',
  'Fatima', 'Gabriel', 'Grace', 'Hassan', 'Imani', 'Isaiah', 'Jasmine', 'Javier', 'Jordan', 'Kayla', 'Keisha',
  'Kevin', 'Kiara', 'Lamar', 'Layla', 'Luis', 'Malik', 'Maria', 'Marcus', 'Maya', 'Mei', 'Miguel', 'Nadia',
  'Naomi', 'Nia', 'Omar', 'Priya', 'Rafael', 'Rosa', 'Samuel', 'Sofia', 'Tariq', 'Tiana', 'Trevor', 'Vanessa',
  'Victor', 'Wei', 'Xavier', 'Yasmin', 'Zoe', 'Amir', 'Bianca', 'Devon', 'Ebony', 'Hector', 'Jada', 'Khalil',
  'Lena', 'Mateo', 'Noah', 'Olivia', 'Quinn', 'Renee', 'Sean', 'Tanya', 'Uriel', 'Valeria', 'Wesley', 'Yusuf',
];
const LAST = [
  'Adams', 'Ali', 'Alvarez', 'Baker', 'Banks', 'Brooks', 'Castillo', 'Chen', 'Coleman', 'Cruz', 'Davis', 'Diaz',
  'Edwards', 'Flores', 'Foster', 'Garcia', 'Gonzalez', 'Green', 'Hall', 'Harris', 'Hernandez', 'Hill', 'Ibrahim',
  'Jackson', 'James', 'Johnson', 'Kim', 'Lee', 'Lewis', 'Lopez', 'Martinez', 'Mitchell', 'Morales', 'Nguyen',
  'Okafor', 'Ortiz', 'Patel', 'Perez', 'Phillips', 'Ramirez', 'Reed', 'Reyes', 'Rivera', 'Robinson', 'Sanchez',
  'Scott', 'Singh', 'Thomas', 'Torres', 'Turner', 'Walker', 'Washington', 'White', 'Williams', 'Wright', 'Young',
];
const JOBS = [
  ['Operations Assistant', 'Northgate Logistics'],
  ['Customer Support Associate', 'Cedar Credit Union'],
  ['Administrative Assistant', 'Riverside Community Clinic'],
  ['Junior Data Analyst', 'Oakline Insurance'],
  ['IT Help Desk Technician', 'Summit Staffing Partners'],
  ['Marketing Coordinator', 'Lumen Marketing Co.'],
  ['Program Assistant', 'Brightpath Tutoring'],
  ['Social Media Assistant', 'Greenway Grocers'],
  ['Bookkeeping Assistant', 'Fairmount Tax Services'],
  ['Data Entry Specialist', 'Metro Housing Authority'],
  ['Office Coordinator', 'Hillside Property Management'],
  ['Sales Associate', 'Parkview Home Supply'],
];

const COHORTS = [
  { cohort_id: 'spring-2026', cohort_name: 'Spring 2026', code: 'SP26', start_date: '2026-03-02', end_date: '2026-04-24', sessions_planned: 16, sessions_held: 16, size: 26 },
  { cohort_id: 'summer-2026', cohort_name: 'Summer 2026', code: 'SU26', start_date: '2026-06-15', end_date: '2026-08-07', sessions_planned: 16, sessions_held: 16, size: 24 },
  { cohort_id: 'fall-2026', cohort_name: 'Fall 2026', code: 'FA26', start_date: '2026-09-14', end_date: '2026-11-06', sessions_planned: 16, sessions_held: 8, size: 25 },
];

// Logit difficulty per question (1–10); lower = harder at the start.
const ITEM_BASE = [0.3, -0.2, -0.7, -0.9, -1.1, -0.8, 0.2, -0.3, -0.6, -1.0];
const ITEMS = ITEM_BASE.map((_, i) => `q${i + 1}`);

const roster = [];
const attendance = [];
const assessments = [];
const followups = [];
const usedNames = new Set();

function uniqueName() {
  for (;;) {
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
  }
}

function assessmentRow(id, phase, day, ability, learned) {
  const row = { participant_id: id, phase, completed_date: toIsoDate(day) };
  ITEM_BASE.forEach((base, i) => {
    row[ITEMS[i]] = chance(sigmoid(base + 0.9 * ability + learned)) ? 1 : 0;
  });
  return row;
}

for (const c of COHORTS) {
  const start = parseDate(c.start_date);
  const end = parseDate(c.end_date);
  const finished = end <= AS_OF;

  for (let n = 1; n <= c.size; n++) {
    const id = `AIC-${c.code}-${String(n).padStart(2, '0')}`;
    const age = weighted([
      [randInt(16, 17), 10],
      [randInt(18, 24), 55],
      [randInt(25, 34), 25],
      [randInt(35, 52), 10],
    ]);
    roster.push({
      participant_id: id,
      name: uniqueName(),
      age,
      enrollment_date: toIsoDate(start - randInt(4, 30)),
      cohort_id: c.cohort_id,
    });

    // Attendance: most stay engaged, some fade, a few leave early.
    const held = c.sessions_held;
    const kind = weighted([['engaged', 76], ['partial', 12], ['left', 12]]);
    const attended =
      kind === 'engaged' ? held - randInt(0, Math.round(held * 0.18)) :
      kind === 'partial' ? Math.round(held * (0.5 + rand() * 0.25)) :
      randInt(1, Math.max(1, Math.round(held * 0.35)));
    attendance.push({ participant_id: id, sessions_attended: attended });

    const ability = normal();
    if (chance(0.96)) assessments.push(assessmentRow(id, 'pre', start, ability, 0));
    if (!finished) continue;

    const rate = attended / c.sessions_planned;
    if (chance(attended >= 10 ? 0.95 : 0.12)) {
      assessments.push(assessmentRow(id, 'post', end, ability, 0.4 + 1.9 * rate + normal() * 0.3));
    }

    // Follow-up surveys (completers only).
    if (rate < config.rules.completionAttendance) continue;
    const alreadyEmployed = chance(0.3);
    const furtherEd = !alreadyEmployed && chance(0.08);
    // Day after the last session when a new job starts, or never.
    const jobDay = weighted([[randInt(5, 30), 22], [randInt(31, 60), 15], [randInt(61, 90), 10], [null, 53]]);
    const [jobTitle, employer] = pick(JOBS);
    const jobStatus = weighted([['employed_full_time', 55], ['employed_part_time', 25], ['internship_apprenticeship', 12], ['self_employed', 8]]);
    const usesAi = weighted([['regularly', 45], ['sometimes', 30], ['never', 25]]);
    const consent = chance(0.4) ? 'yes' : 'no';

    for (const [days, respondP] of [[30, 0.88], [60, 0.8], [90, 0.74]]) {
      const due = end + days;
      if (due > AS_OF || !chance(respondP)) continue;
      const responseDay = Math.min(AS_OF, due + randInt(0, 9));
      const row = { participant_id: id, checkpoint_days: days, response_date: toIsoDate(responseDay), status: '', new_role: '', employer: '', job_title: '', uses_ai: '', story_consent: consent };
      if (jobDay !== null && jobDay <= days) {
        Object.assign(row, { status: jobStatus, new_role: 'yes', employer, job_title: jobTitle, uses_ai: usesAi });
      } else if (alreadyEmployed) {
        Object.assign(row, { status: chance(0.6) ? 'employed_part_time' : 'employed_full_time', new_role: 'no', uses_ai: pick(['sometimes', 'never']) });
      } else if (furtherEd) {
        row.status = 'further_education';
      } else {
        row.status = chance(0.85) ? 'seeking' : 'not_seeking';
      }
      followups.push(row);
    }
  }
}

mkdirSync(OUT, { recursive: true });
const write = (file, columns, rows) => writeFileSync(join(OUT, file), toCsv(columns, rows));
write('cohorts.csv', ['cohort_id', 'cohort_name', 'start_date', 'end_date', 'sessions_planned', 'sessions_held'], COHORTS);
write('roster.csv', ['participant_id', 'name', 'age', 'enrollment_date', 'cohort_id'], roster);
write('attendance.csv', ['participant_id', 'sessions_attended'], attendance);
write('assessments.csv', ['participant_id', 'phase', 'completed_date', ...ITEMS], assessments);
write('followups.csv', ['participant_id', 'checkpoint_days', 'response_date', 'status', 'new_role', 'employer', 'job_title', 'uses_ai', 'story_consent'], followups);
console.log(`Wrote ${roster.length} participants, ${assessments.length} assessments, ${followups.length} follow-up responses to ${OUT}`);
