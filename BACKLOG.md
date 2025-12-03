# BACKLOG

Prioritized work items for Caesar in a Year. Grouped by theme, ordered by dependency and impact.

---

## 1. DATA PERSISTENCE (Foundation)

The app currently uses an in-memory adapter that resets on every page refresh. All progression features depend on real persistence.

### 1.1 Convex Integration
**Priority: Critical | Effort: Medium**

The `DataAdapter` interface in `lib/data/types.ts` is already Convex-ready. Need to implement the Convex backend.

**Tables needed:**
- `userProgress` — day, streak, totalXp, unlockedPhase per user
- `sessions` — session state, items, currentIndex, status
- `attempts` — grading history for analytics and spaced repetition

**Files:**
- `convex/schema.ts` — define tables
- `convex/userProgress.ts` — queries/mutations
- `convex/sessions.ts` — queries/mutations
- `lib/data/convexAdapter.ts` — implement DataAdapter interface
- `lib/data/adapter.ts` — switch factory to return Convex adapter

**Acceptance:**
- Progress persists across browser sessions
- Session state survives page refresh
- Grading attempts recorded for future spaced repetition

---

## 2. CONTENT PIPELINE (The Big Lift)

Currently: 3 review sentences + 1 reading passage (Day 1 only).
Needed: 365 days of progressive Caesar content.

### 2.1 Content Data Model
**Priority: High | Effort: Low**

Define structure for multi-day content.

```typescript
type DayContent = {
  day: number;
  phase: number; // DBG book/chapter grouping
  review: Sentence[];
  reading: ReadingPassage;
};
```

**Files:**
- `lib/data/types.ts` — add DayContent type
- `constants.ts` → `content/day-001.ts` — migrate to per-day files or JSON

### 2.2 Content Source Strategy
**Priority: High | Effort: TBD**

Three options (pick one):

| Option | Quality | Speed | Notes |
|--------|---------|-------|-------|
| Manual curation | High | 6-12mo | Scholar-reviewed, pedagogically sound |
| AI-assisted | Medium | 1-2mo | Gemini generates, human QAs |
| Latin corpus | High | 2-3mo | Perseus/Dickinson, needs licensing check |

**Decision needed:** Which approach? Hybrid?

**Output:**
- 365 JSON/TS files with DayContent
- Glossary entries per passage
- Reference translations (AI-generated OK, human-verified)
- Review sentences selected from prior days

### 2.3 Content Ingestion
**Priority: Medium | Effort: Medium**

Once content exists, need pipeline to:
- Validate content structure
- Import to Convex (or keep as static JSON)
- Support incremental updates

---

## 3. PROGRESSION SYSTEM

User advancement through the curriculum.

### 3.1 Day Tracking
**Priority: High | Effort: Low**

After completing a session:
- Increment `userProgress.day`
- Load next day's content
- Block access to future days

**Files:**
- `lib/session/advance.ts` — add day increment logic
- `lib/data/adapter.ts` — `getContent(day)` instead of static content

### 3.2 Phase/Chapter Unlocking
**Priority: Medium | Effort: Low**

DBG has 8 books. Gate access by progress:
- Phase 1: Book I (Days 1-45)
- Phase 2: Book II (Days 46-90)
- etc.

**Files:**
- `lib/data/types.ts` — define phase boundaries
- Dashboard UI — show locked/unlocked phases

### 3.3 XP Awards
**Priority: Low | Effort: Low**

Currently `totalXp` displayed but never computed.

**Logic:**
- CORRECT = 10 XP
- PARTIAL = 5 XP
- INCORRECT = 0 XP
- Streak bonus: +1 XP per day streak

**Files:**
- `lib/session/xp.ts` — calculation logic
- `app/(app)/session/[sessionId]/actions.ts` — award XP on grading

### 3.4 Streak Tracking
**Priority: Low | Effort: Low**

Track consecutive days of practice.

**Logic:**
- Session completed today? Increment streak
- Missed a day? Reset to 0
- Store `lastSessionDate` in userProgress

---

## 4. SPACED REPETITION

Smart review scheduling for long-term retention.

### 4.1 Sentence Difficulty Tracking
**Priority: Medium | Effort: Medium**

Track per-sentence performance:
- Times seen
- Times correct/partial/incorrect
- Ease factor (SM-2 style)

**Tables:**
- `sentenceProgress` — userId, sentenceId, easeFactor, nextReviewDate, history

### 4.2 Review Selection Algorithm
**Priority: Medium | Effort: Medium**

Replace random review selection with SM-2 or similar:
- Due for review? Include in session
- Struggled recently? Review sooner
- Mastered? Space out further

**Files:**
- `lib/session/builder.ts` — inject spaced repetition logic
- `lib/srs/sm2.ts` — algorithm implementation

---

## 5. POLISH & UX

### 5.1 Loading States
**Priority: Low | Effort: Low**

Add skeleton loaders for:
- Dashboard stats
- Session loading
- Grading in progress

### 5.2 Error Boundaries
**Priority: Low | Effort: Low**

Graceful failure UI for:
- AI grading timeout
- Network errors
- Invalid session state

### 5.3 Mobile Optimization
**Priority: Low | Effort: Medium**

Current UI is desktop-first. Need:
- Touch-friendly glossary
- Responsive text sizing
- Swipe gestures for navigation

---

## Dependency Graph

```
[Convex Persistence]
        │
        ├──► [Day Tracking] ──► [Phase Unlocking]
        │
        ├──► [Content Pipeline] ──► [365 Days of Content]
        │
        └──► [Spaced Repetition] ──► [Review Selection]
                                          │
                                          ▼
                                   [XP Awards, Streaks]
```

---

## 6. CORPUS PIPELINE IMPROVEMENTS

Deferred items from PR #1 code review (Dec 2025).

### 6.1 Cross-Platform Python Paths
**Priority: Low | Effort: Low**

The corpus pipeline uses Unix-specific paths (`.venv/bin/python`) in `package.json` and `README.md`. Windows users need `.venv\Scripts\python`.

**Options:**
- Document both paths in README
- Use `python -m pip` after venv activation (cross-platform)
- Add `cross-env` wrapper

**From:** coderabbitai PR #1 review

### 6.2 NLP Library Setup Documentation
**Priority: Low | Effort: Low**

The `nltk` and `cltk` libraries may require downloading additional data files on first run, which can surprise users.

**Action:** Add note to README about first-run data downloads:
- `nltk`: punkt tokenizer download prompt
- `cltk`: ~200MB Latin models (optional, falls back to regex)

**From:** coderabbitai PR #1 review

### 6.3 Python Docstring Coverage
**Priority: Low | Effort: Low**

Docstring coverage is 77.78%, below 80% threshold.

**Action:** Add docstrings to undocumented functions in:
- `scripts/corpus/models.py`
- `scripts/corpus/sources.py`

**From:** coderabbitai pre-merge checks

---

## Next Actions

1. **Now:** Fix params bug (TODO.md)
2. **This week:** Convex integration (2.1)
3. **Decision needed:** Content strategy (2.2)
4. **After content exists:** Day tracking, phases, SRS
