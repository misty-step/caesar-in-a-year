
## Checkpoint 1: Core Loop Integrity

FSRS works, grading correct, stats update.

| ID | Task | Files | Status |
|----|------|-------|--------|
| 1.1 | Create distinct gist grading prompt for reading passages | `lib/ai/gradeGist.ts` (new) | TODO |
| 1.2 | Add in-memory rate limiting (100/hr per user) | `app/api/grade/route.ts` | TODO |
| 1.3 | Update streak/XP on session completion | `app/(app)/summary/[sessionId]/page.tsx` | TODO |
| 1.4 | Add tests for session advancement edge cases | `lib/session/__tests__/advance.test.ts` | TODO |
| 1.5 | Add test for FSRS recording | `lib/data/__tests__/convexAdapter.test.ts` | TODO |

