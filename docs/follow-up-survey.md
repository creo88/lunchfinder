# 30 / 60 / 90-day follow-up survey

One short survey sent to every graduate (participants who completed the program)
**30, 60 and 90 days after the cohort's last session**. It feeds the "Job
placements" metric. It takes about two minutes and works on a phone.

Same questions every time, so answers can be compared across checkpoints.

## When and how to send

| Checkpoint | Send on | Reminders |
| --- | --- | --- |
| 30-day | last session + 30 days | +3 days, +7 days |
| 60-day | last session + 60 days | +3 days, +7 days |
| 90-day | last session + 90 days | +3 days, +7 days |

The dashboard shows the exact dates in the "Follow-up surveys" panel ("Not yet due").

What keeps the response rate up (funders discount a placement rate when few
people answered):

- **Collect contact details and consent at enrollment.** A personal mobile number,
  a personal email and one alternate contact. Add one line to the enrollment form:
  "We'll check in 30, 60 and 90 days after the program to see how you're doing."
- **Text first.** A text with a short link gets more replies than email for most
  participants. Send from a named person ("Hi Jordan, it's Sam from the AI Club…").
- **Tell them on the last day** that the survey is coming, and why it matters.
- **A small thank-you at 90 days** (for example a $10 gift card) if a funder allows it.
- **No answer is fine.** Don't add a row for non-responders; the dashboard counts
  them as "sent, not returned" and does not count them as placed.

## Message to send

> Hi {first name}, it's {your name} from The AI Club. It's been {30/60/90} days
> since you finished the AI Skills Program. Could you answer 5 quick questions
> about where you are now? It takes 2 minutes: {link}
> Your answers stay private. We only share totals with funders, unless you say we
> can share your story.

## Questions

Pre-fill the participant ID in the link (Google Forms: **⋮ → Get pre-filled link**)
so graduates don't have to type it.

1. **Participant ID** *(pre-filled, hidden from view if your tool allows)*

2. **Which best describes you right now?** *(required, choose one)*
   - Employed full-time
   - Employed part-time
   - Internship or apprenticeship
   - Self-employed or freelance
   - In school or a training program
   - Looking for work
   - Not looking for work right now

3. **If you are working: did this job or role start after you joined the program?**
   - Yes, it's a new job
   - Yes, it's a promotion or new role with the same employer
   - No, I had this job before the program

4. **Employer name** *(optional)*

5. **Job title** *(optional)*

6. **Do you use AI tools in this job?**
   - Regularly
   - Sometimes
   - Never

7. **May we share your story with funders, using your first name only?**
   - Yes
   - No

8. **Anything else you'd like to tell us?** *(optional, open text, not used in the dashboard)*

## Turning answers into the followups tab

One row per response, columns as in `templates/followups.csv`:

| Column | From | Values |
| --- | --- | --- |
| `participant_id` | Q1 | as on the roster |
| `checkpoint_days` | which survey it was | `30`, `60` or `90` |
| `response_date` | form timestamp | `2026-05-28` or `5/28/2026` |
| `status` | Q2 | the answer text works as-is (for example `Employed part-time`), or the short ids `employed_full_time`, `employed_part_time`, `internship_apprenticeship`, `self_employed`, `further_education`, `seeking`, `not_seeking` |
| `new_role` | Q3 | `yes` for either "Yes" answer, `no` for "No", blank if not working |
| `employer`, `job_title` | Q4, Q5 | free text |
| `uses_ai` | Q6 | `regularly`, `sometimes`, `never` |
| `story_consent` | Q7 | `yes` / `no` |

## How placements are counted

A graduate counts as **placed** once, at the first survey where they report an
employed status (full-time, part-time, internship/apprenticeship or self-employed)
**and** say the job or role is new since joining. "No, I had this job before"
does not count; funders ask about this, and it keeps the number defensible.
"In school or a training program" is shown separately as further education.

The placement rate is placed ÷ graduates surveyed so far (non-responders stay
in the denominator, which keeps the rate conservative). The response rate is
surveys returned ÷ surveys sent across all checkpoints that are due.

All of this is self-reported. If a funder needs verified placements (an offer
letter, pay stub or employer confirmation), add a "verified" column and collect
proof for the graduates who report a job. That is not in the MVP.
