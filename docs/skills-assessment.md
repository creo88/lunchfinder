# AI skills assessment (pre and post)

Ten multiple-choice questions, two per skill area. Every participant takes the
**same ten questions in the same order** twice: at the start of the first session
(before any teaching) and at the end of the last session. The change in score is
the "Skills gained" metric.

- Time: about 10 minutes. No time limit.
- Reading level: written for roughly 8th grade. Read questions aloud or translate
  them if that helps a participant. Note any change in how you give the test.
- Each correct answer scores 1. A skipped question scores 0.
- Do **not** show correct answers after the pre-assessment. Showing them inflates
  the post score and weakens the number you report to funders.

| Skill area (dashboard label) | Questions |
| --- | --- |
| AI fundamentals | 1, 2 |
| Prompting | 3, 4 |
| Checking AI output | 5, 6 |
| Safe & responsible use | 7, 8 |
| Using AI at work | 9, 10 |

If you change a question, keep the area mapping in `src/config.js` (`skillAreas`)
in step. Never change questions in the middle of a cohort: the pre and post scores
are only comparable if the questions are identical.

---

## Questions

**Participant ID:** ____________ (from the roster, for example `AIC-SP26-07`)

**1. When you ask an AI chatbot (like ChatGPT, Claude or Gemini) a question, what is it doing?**
- A. Looking up the one correct answer in a database
- B. Writing a likely response based on patterns it learned from large amounts of text
- C. Copying the top result from a search engine
- D. Sending your question to a human expert who types the answer

**2. Which of these is a real limitation of AI chatbots?**
- A. They can only answer in English
- B. They cannot write more than one paragraph
- C. They always refuse to give an opinion
- D. They can sound confident even when they are wrong

**3. You want an AI tool to help with a cover letter. Which request will probably give the most useful first draft?**
- A. "Write a cover letter."
- B. "Cover letter, good, fast."
- C. "Write a one-page cover letter for a customer service job at a credit union. I have 2 years of retail experience and speak English and Spanish. Keep it friendly and professional."
- D. "Pretend you are me and apply for jobs for me."

**4. The AI's first answer is close, but it is too long and too formal. What is the best next step?**
- A. Reply with specific feedback, such as "Make it half as long and more conversational."
- B. Start a new chat and type the same request again
- C. Use it as it is, because the AI knows best
- D. Paste it into a different AI tool without changing anything

**5. An AI tool gives you a statistic and names a source for a report you are writing. What should you do before using it?**
- A. Use it, because the AI named a source
- B. Find the original source and check the number yourself
- C. Ask the AI "Are you sure?" and use it if it says yes
- D. Round the number so it is less likely to be wrong

**6. What does it mean when people say an AI "hallucinated"?**
- A. It refused to answer the question
- B. It took a long time to respond
- C. It made a picture instead of writing text
- D. It gave false or made-up information that sounds believable

**7. You work at a health clinic. Which of these is safe to type into a free, public AI chatbot?**
- A. A patient's name and diagnosis, so it can help draft a letter
- B. A list of clients' phone numbers, so it can format them
- C. A general question such as "How do I write a friendly appointment reminder?"
- D. Your work password, to check whether it is strong

**8. An AI tool used to sort job applications seems to rank some groups of people lower than others. What is the most likely reason?**
- A. The AI may have learned unfair patterns (bias) from the data it was trained on
- B. Nothing is wrong: computers are always fair
- C. Those applicants must be less qualified, so the AI is right
- D. The tool is broken and just needs to be restarted

**9. Which work task is a good fit for an AI assistant?**
- A. Making the final decision about who gets hired
- B. Drafting meeting notes for you to review and correct
- C. Signing a contract for your manager
- D. Sending emails to customers without anyone reading them first

**10. Your manager asks you to use AI to save time on a weekly report. What is the best approach?**
- A. Have the AI write the whole report and send it without reading it
- B. Avoid AI, because it is never allowed at work
- C. Ask the AI to fill in any missing numbers with its best guess
- D. Use AI to draft sections and summarize the data, then check the facts and edit before sending

---

## Answer key (keep separate from the participant copy)

| Q | Answer | Why it matters |
| --- | --- | --- |
| 1 | B | Knowing it predicts text explains both its strengths and its mistakes |
| 2 | D | Confident tone is not evidence of accuracy |
| 3 | C | Role, context and tone in the request give a usable first draft |
| 4 | A | Specific follow-up feedback is the core prompting skill |
| 5 | B | Named sources can be wrong or invented; check the original |
| 6 | D | Recognizing hallucination is the basis for checking output |
| 7 | C | Personal, health and login details never go into public tools |
| 8 | A | AI can repeat bias in its training data; people stay accountable |
| 9 | B | Good uses keep a person reviewing the result |
| 10 | D | Draft with AI, verify and edit as a person |

The correct letters are spread across A–D (A, B, C and D each appear 2–3 times),
so a participant who always picks the same letter does not score well.

---

## Setting it up in Google Forms

1. Create a Form, turn on **Settings → Make this a quiz**.
2. Under **Release grades**, choose **Later, after manual review**, and turn off
   **Missed questions** and **Correct answers**, so nobody sees the key after the
   pre-assessment.
3. Add a short-answer **Participant ID** question and a **Phase** question
   (`pre` / `post`), both required. Then add the 10 questions with the answer key above.
4. Use the same Form for pre and post, so the questions cannot drift apart.
5. In the linked response sheet, add columns `q1`–`q10` that score each answer, for
   example `=IF(D2="D. They can sound confident even when they are wrong",1,0)`,
   or mark each answer 1/0 by hand.
6. Copy `participant_id`, `phase`, `completed_date` and `q1`–`q10` into the
   **assessments** tab (columns as in `templates/assessments.csv`). `TRUE`/`FALSE`
   checkboxes work as well as `1`/`0`.

Paper works too: score by hand and type the 1/0s into the sheet.
