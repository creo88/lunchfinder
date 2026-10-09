# Review of the MVP plan (v1, Oct 2026)

The plan is sound. It names one job for one person (Mark), asks him for one input,
leaves out the right things (Salesforce API, logins, a portal, payments), and has
a pass/fail test that requires a written commitment, not just praise. This build
follows it. The notes below are where the plan was silent or where I made a
call while building. Each call can be reversed in `src/config.js`.

## Gaps closed in the build

1. **The metrics had no definitions.** A funder's first question about any number
   is "how is that counted?". Each metric now has a definition, and it is printed
   on the dashboard and on the PDF:
   - **Completion:** attended at least 80% of planned sessions. Only finished
     cohorts count, so a cohort that is still running doesn't drag the rate down.
   - **Certificates:** completed **and** scored at least 70% on the post-assessment.
     As written in the plan (certificate = completion), the two numbers would always
     be identical, which reads as padding on a one-pager. Set
     `certificatePostScore: null` to go back to the plan's rule.
   - **Skills gained:** change in average score (percentage points) for people who
     took both the pre and post assessment, plus the share who improved.
   - **Job placements:** only jobs or roles that started **after** joining. Without
     that rule, a participant who already had a job counts as "placed", and a
     funder who asks will discount the whole number. Non-responders stay in the
     denominator, which keeps the rate conservative.
2. **A placement rate needs its response rate next to it.** Both are shown
   (surveys returned ÷ surveys sent).
3. **Placements lag.** With an 8-week cohort and a 90-day survey, the final
   placement number arrives about 5 months after the cohort starts. Surveys that
   aren't due yet show as pending, never as zero. Tell Mark early that placements
   will trail his first report.
4. **"Live" means as fresh as the last data update.** Every view and export says
   "Data as of".
5. **Boards compare to goals.** Optional targets (met / not yet met) are in the
   config, set to sample values. Clear them if Mark has none.
6. **The paste-ready paragraph.** What actually goes into a funder report is a
   sentence, not a tile. The dashboard writes it from the numbers and has a copy
   button.

## Decisions that are yours

1. **Add-on or new online product.** The plan asks this but doesn't say when to
   decide. Decide **before** the walkthrough, because the test asks for a budget
   figure and you need a range to anchor it. My recommendation, following the
   plan's own point that the dashboard alone isn't the product: don't price the
   dashboard separately. Price the online program pilot, with reporting included.
2. **Participant privacy.** The roster has names and ages, and youth programs
   include minors (the sample has 16–17 year olds). "One shared link, no logins"
   is fine for sample data. It is not fine for a real roster: anyone with the link
   to a hosted copy can open the CSV files. For the pilot, either send Mark the
   PDF and CSVs (`npm run export`), or load the real files with *Load your CSV
   files* (they stay in that browser). Get parental consent before surveying
   participants under 18.
3. **Whose placement definition?** Some funders count "employment or education"
   as a positive outcome, and some require verified jobs. Ask Mark which funder's
   rules apply when you ask for a past report.

## Risks to watch

- **Response rate decides whether the placement number is believable.** Below
  about 70%, expect pushback. The survey doc lists the tactics; the most important
  ones (consent and a personal phone number) have to happen at enrollment.
- **Same 10 questions pre and post.** This is standard and fine for an MVP. Don't
  reveal the answers after the pre-assessment, or the gain is inflated.
- **Self-reported outcomes.** Labeled as such in the definitions.

## Next steps, updated

1. ~~Write the 10-question skills assessment and 30/60/90-day survey.~~ Drafted in
   [`skills-assessment.md`](skills-assessment.md) and
   [`follow-up-survey.md`](follow-up-survey.md). Have your instructor review the wording.
2. ~~Build the sample-data dashboard and PDF export.~~ Built. Sample PDF in `examples/`.
3. **Book the walkthrough**, after asking Mark for one past funder report or
   template and deciding your price range. Run it with
   [`walkthrough-guide.md`](walkthrough-guide.md).
4. **New:** before any pilot starts, add the follow-up consent line and
   personal contact fields to enrollment. A low response rate can't be fixed after
   graduation.
