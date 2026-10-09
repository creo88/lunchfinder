// Program settings and metric rules. Edit this file to point the dashboard at a
// partner's data and to change how the five metrics are defined. Every rule
// here is printed in the "How we measure" section of the dashboard and the PDF,
// so funders always see the definition next to the number.

export const config = {
  programName: 'AI Skills Program',
  provider: 'The AI Club',
  partnerName: 'Partner Nonprofit',

  // Shows a "Sample data" label on the dashboard, PDF and CSVs.
  // Set to false once the files below hold a real cohort.
  isSampleData: true,

  // The date the data files were last brought up to date. Cohort status and
  // follow-up due dates are worked out against this date, not today's date,
  // so the report never claims data you have not collected yet.
  dataAsOf: '2026-10-09',

  // One CSV per Google Sheet tab. Paths are relative to index.html; a
  // "Publish to web → CSV" Google Sheets URL works too.
  dataFiles: {
    cohorts: 'data/sample/cohorts.csv',
    roster: 'data/sample/roster.csv',
    attendance: 'data/sample/attendance.csv',
    assessments: 'data/sample/assessments.csv',
    followups: 'data/sample/followups.csv',
  },

  rules: {
    // Completion: attended at least this share of the cohort's planned sessions.
    completionAttendance: 0.8,
    // Certificate: completed AND scored at least this on the post-assessment.
    // Set to null to issue a certificate on completion alone.
    certificatePostScore: 0.7,
    // Number of scored items on the pre/post skills assessment.
    assessmentItems: 10,
    // Days after the cohort's last session that each follow-up survey goes out.
    followupCheckpoints: [30, 60, 90],
    // Follow-up statuses that count as a job placement.
    placementStatuses: ['employed_full_time', 'employed_part_time', 'internship_apprenticeship', 'self_employed'],
    // Only count jobs (or new roles) that started after the participant joined.
    placementRequiresNewRole: true,
  },

  // Optional goals from the grant or board plan. Each one shows as
  // "Target … met / not yet met" on its metric. Use null to hide a target.
  targets: {
    enrollments: 70,
    completionRate: 0.75,
    certificates: 35,
    skillsGainPts: 25,
    placements: 20,
  },

  // The 10 assessment questions grouped into the skill areas funders see.
  // Item numbers match docs/skills-assessment.md.
  skillAreas: [
    { id: 'fundamentals', label: 'AI fundamentals', items: [1, 2] },
    { id: 'prompting', label: 'Prompting', items: [3, 4] },
    { id: 'evaluating', label: 'Checking AI output', items: [5, 6] },
    { id: 'responsible', label: 'Safe & responsible use', items: [7, 8] },
    { id: 'applying', label: 'Using AI at work', items: [9, 10] },
  ],

  ageBands: [
    { label: 'Under 18', max: 17 },
    { label: '18–24', min: 18, max: 24 },
    { label: '25–34', min: 25, max: 34 },
    { label: '35+', min: 35 },
  ],
};

// Follow-up survey answers. The first column is what goes in followups.csv;
// the label is what the participant sees in the survey (docs/follow-up-survey.md).
export const FOLLOWUP_STATUSES = [
  { id: 'employed_full_time', label: 'Employed full-time' },
  { id: 'employed_part_time', label: 'Employed part-time' },
  { id: 'internship_apprenticeship', label: 'Internship or apprenticeship' },
  { id: 'self_employed', label: 'Self-employed or freelance' },
  { id: 'further_education', label: 'In school or a training program' },
  { id: 'seeking', label: 'Looking for work' },
  { id: 'not_seeking', label: 'Not looking for work right now' },
];
