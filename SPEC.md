# Core Loop Integrity (Checkpoint 1)

## Problem Statement
Solo Latin learners quit when the loop feels flaky: grading wrong, progress not saved, streaks lying, or the tutor goes down and you’re blocked. We need a session loop you can start/stop anytime and always trust.

## User Personas

### Primary: Solo Self‑Study Learner
- **Context**: 5–20 min bursts; phone/laptop; often interrupted; returns later.
- **Pain Point**: “Did it save?” + “Is this grading real?” + “Am I stuck if AI fails?”
- **Goal**: Make steady reading progress in Caesar with minimal friction.
- **Success**: Can resume instantly; can finish even during outages; streak reflects reality.

## Principles (MVP)
- Ad‑hoc friendly: resume beats “daily ritual only”.
- Never block learning on tutor availability.
- Trust signals > gamification noise (XP is optional / likely cut).

## User Stories & Acceptance Criteria

### Resume: As a learner, I want to pick up exactly where I left off.
**Acceptance Criteria**
- [ ] If a session is incomplete, reopening it lands on the next unanswered segment.
- [ ] Completing a segment advances progress immediately (no “lost step” on refresh).
- [ ] If the session is already complete, user goes to the summary (no looping).

### Translation Review Grading: As a learner, I want meaning‑based feedback I can act on.
**Acceptance Criteria**
- [ ] Each review submission returns: status (Correct/Partial/Incorrect), short feedback, and optional correction/reference meaning.
- [ ] Grading outcome updates spaced repetition scheduling for that sentence.
- [ ] Failure mode never blocks continuation (see “Tutor Unavailable”).

### Reading Gist Check: As a learner, I want to confirm I understood the passage (not parse it).
**Acceptance Criteria**
- [ ] Gist grading uses a distinct rubric from translation (comprehension/summary).
- [ ] Returns same status triad + short feedback; may show reference gist on request.
- [ ] Failure mode never blocks continuation (see “Tutor Unavailable”).

### Tutor Unavailable / Rate Limited: As a learner, I want to keep going anyway.
**Acceptance Criteria**
- [ ] If grading is unavailable (network/error/rate limit), user sees a clear message.
- [ ] User can reveal the reference meaning/gist and self‑grade (Correct/Partial/Incorrect) to continue.
- [ ] Self‑grade is recorded and used for scheduling (clearly labeled as self‑graded).

### Streak: As a learner, I want streak to match my local day.
**Acceptance Criteria**
- [ ] Completing at least one session in a local calendar day counts for that day.
- [ ] Max +1 streak increment per local day (multiple sessions same day don’t stack).
- [ ] Missing a local day resets streak (no backfill in MVP).

## UX Flow

Start Session → Segment Loop → Summary

1) Start session
- Action: click “Start Session”
- Response: land in session at current segment, show progress bar

2) Review segment
- Action: submit translation
- Response (normal): show feedback + “Continue”
- Response (tutor unavailable): show message + “Reveal reference” + “Self‑grade” + “Continue”

3) Reading gist segment
- Action: submit gist
- Response mirrors review segment (normal vs unavailable)

4) Completion
- Action: finish last segment
- Response: session marked complete; redirect to summary; streak updated if day qualifies

**Key Screens/States**
1. **Session Segment**: prompt + input + submit; post‑submit feedback panel; continue.
2. **Tutor Unavailable**: same screen, but with fallback path to proceed.
3. **Summary**: confirmation + next action (dashboard / new session).

## Success Metrics

| Metric | Current | Target | How Measured |
|--------|---------|--------|--------------|
| Sessions blocked by tutor failures | Unknown | 0% | % sessions where user can’t advance |
| Resume correctness | Unknown | 99%+ | reopen session lands on correct next segment |
| Streak correctness complaints | Unknown | near‑0 | support logs / user report count |
| Gist grading usefulness | Unknown | 70%+ “helpful” | lightweight thumbs up/down (later) |

## Business Constraints
- **Cost control**: per‑user grading capped (initially 100/hour/user).
- **Solo MVP**: no classroom/teacher features.
- **Timezone**: streak uses user local day (best‑effort; see Open Questions).

## Non‑Goals (This Iteration)
- XP as a primary motivator (no new XP UI; avoid gamification creep).
- Draft autosave mid‑answer (resume is per completed segment).
- Social, sharing, teacher mode, advanced analytics.
- Perfect “grading truth”; goal is consistent + non‑blocking + clearly labeled fallbacks.

## Open Questions (For /architect)
- How to define “user local day” reliably (profile timezone vs inferred).
- Where to store “self‑graded” flag and how it affects future scheduling/analytics.
- Whether gist answers should ever update FSRS (likely yes, but separate item type).

