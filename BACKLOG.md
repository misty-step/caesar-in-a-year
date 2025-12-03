# Caesar in a Year: Backlog

## Philosophy

### The Bitter Lesson Applied
> "General methods that leverage computation beat hand-engineered knowledge."

**Trust the LLM.** It knows Latin grammar, cases, tenses, nuance. We don't categorize errors—we ask "did they get the meaning?" and let computation handle the rest.

**Trust the corpus.** Caesar's text IS the curriculum. Parse it exhaustively, compute difficulty, let structure emerge from data rather than hand-crafting 365 lessons.

**Trust FSRS.** Proven spaced repetition algorithm. Personalization = review timing, not content selection.

### The Backbone
```
Parsed Corpus → Difficulty-Based Selection → FSRS
```

Everything else builds on this. The corpus is the source of truth. Selection is a filter. FSRS handles memory.

---

## Data Model

### Corpus (Static, Pre-Computed)

```typescript
// Every sentence from De Bello Gallico
interface Sentence {
  id: string;                    // "dbg-1-1-1" (book-chapter-sentence)
  latin: string;                 // "Gallia est omnis divisa in partes tres."
  english: string;               // Reference translation
  passageId: string;             // Which passage it belongs to
  bookNum: number;               // 1-8
  chapterNum: number;            // For narrative ordering

  // Computed during corpus processing
  lemmas: string[];              // ["gallia", "sum", "omnis", "divido", ...]
  difficulty: number;            // 1-100 (computed)
  grammarTags: string[];         // ["nominative", "passive", "perfect"]
  wordCount: number;
  clauseDepth: number;           // Nesting level
}

// Narrative chunks for reading comprehension
interface Passage {
  id: string;                    // "dbg-1-1"
  bookNum: number;
  chapterNum: number;
  title: string;                 // "The Geography of Gaul"
  sentenceIds: string[];         // Ordered sentences
  context: string;               // Brief English context
  gistQuestion: string;          // "What are the three parts of Gaul?"
  referenceGist: string;         // Expected answer
}

// Vocabulary analytics
interface Word {
  lemma: string;                 // Dictionary form
  frequency: number;             // Count in corpus
  frequencyRank: number;         // 1 = most common
  partOfSpeech: string;
  translations: string[];        // Common meanings
  firstAppearance: string;       // Sentence ID where first used
}
```

### User State (Dynamic, Per-User)

```typescript
interface UserProgress {
  userId: string;
  level: number;                 // Current difficulty level (1-100)
  sentencesMastered: number;     // Count for stats
  streak: number;                // Consecutive days
  lastPracticeDate: string;      // ISO date
  placementComplete: boolean;    // Did placement quiz
}

// FSRS state per sentence (only for sentences user has seen)
interface SentenceReview {
  userId: string;
  sentenceId: string;

  // FSRS fields
  difficulty: number;            // Item difficulty (0-1)
  stability: number;             // Memory stability
  retrievability: number;        // Current recall probability
  scheduledDays: number;         // Days until next review
  nextReview: string;            // ISO date
  lastReview: string;            // ISO date
  reps: number;                  // Review count
  lapses: number;                // Times forgotten
  state: 'new' | 'learning' | 'review' | 'relearning';
}

// Grading history (for analytics, not core logic)
interface Attempt {
  id: string;
  userId: string;
  sentenceId: string;
  userInput: string;
  status: 'CORRECT' | 'PARTIAL' | 'INCORRECT';
  feedback: string;
  timestamp: string;
}
```

**That's it.** No concept graphs. No mastery-per-grammar-feature. No hand-crafted lesson sequences.

---

## Core Algorithms

### Difficulty Scoring (Pre-Computed)

```typescript
function computeDifficulty(sentence: Sentence, vocab: Word[]): number {
  // Factors (weights tunable)
  const wordCountScore = Math.min(sentence.wordCount / 20, 1) * 25;
  const clauseDepthScore = Math.min(sentence.clauseDepth / 4, 1) * 25;

  // Average vocabulary rarity (higher rank = rarer = harder)
  const avgVocabRank = sentence.lemmas
    .map(l => vocab.find(w => w.lemma === l)?.frequencyRank ?? 1000)
    .reduce((a, b) => a + b, 0) / sentence.lemmas.length;
  const vocabScore = Math.min(avgVocabRank / 500, 1) * 30;

  // Grammar complexity
  const complexTags = ['ablative-absolute', 'indirect-statement', 'subjunctive'];
  const grammarScore = sentence.grammarTags
    .filter(t => complexTags.includes(t)).length * 10;

  return Math.min(Math.round(wordCountScore + clauseDepthScore + vocabScore + grammarScore), 100);
}
```

### Content Selection (Runtime)

```typescript
function selectNextContent(userId: string): SessionItem[] {
  const user = getUserProgress(userId);
  const dueReviews = getDueReviews(userId);  // FSRS

  // 1. Reviews first (max 5)
  const reviews = dueReviews
    .sort((a, b) => a.nextReview - b.nextReview)
    .slice(0, 5)
    .map(r => ({ type: 'REVIEW', sentence: getSentence(r.sentenceId) }));

  // 2. New content: sentences at or below user's level, not yet seen
  const seen = new Set(getUserSeenSentences(userId));
  const candidates = corpus.sentences
    .filter(s => s.difficulty <= user.level && !seen.has(s.id))
    .sort((a, b) => {
      // Prefer narrative order within difficulty band
      if (a.bookNum !== b.bookNum) return a.bookNum - b.bookNum;
      if (a.chapterNum !== b.chapterNum) return a.chapterNum - b.chapterNum;
      return a.difficulty - b.difficulty;
    });

  // 3. Pick next sentence (or passage if enough context)
  const nextSentence = candidates[0];
  const newContent = nextSentence
    ? [{ type: 'NEW', sentence: nextSentence }]
    : [];  // User has seen everything at their level

  return [...reviews, ...newContent];
}
```

### Level Advancement

```typescript
function checkLevelAdvancement(userId: string): void {
  const user = getUserProgress(userId);
  const reviews = getUserReviews(userId);

  // Count mastered sentences at current level
  // "Mastered" = FSRS state is 'review' and stability > 7 days
  const masteredAtLevel = reviews.filter(r => {
    const sentence = getSentence(r.sentenceId);
    return sentence.difficulty <= user.level &&
           r.state === 'review' &&
           r.stability >= 7;
  }).length;

  // Threshold: master 20 sentences to unlock next level
  const threshold = 20;
  if (masteredAtLevel >= threshold && user.level < 100) {
    updateUserProgress(userId, { level: user.level + 1 });
  }
}
```

### LLM Grading

```typescript
const GRADING_PROMPT = `You are a Latin tutor evaluating comprehension.

Latin: "${latin}"
Reference translation: "${reference}"
Student's translation: "${userTranslation}"

Did the student capture the core meaning? Be flexible with wording, strict on meaning.

Respond with JSON:
{
  "status": "CORRECT" | "PARTIAL" | "INCORRECT",
  "feedback": "Brief, encouraging explanation (1-2 sentences)"
}`;

interface GradingResult {
  status: 'CORRECT' | 'PARTIAL' | 'INCORRECT';
  feedback: string;
}
```

### FSRS Integration

```typescript
// Map our grades to FSRS ratings
function gradeToFSRS(status: GradingResult['status']): FSRSRating {
  switch (status) {
    case 'CORRECT': return Rating.Good;      // 3
    case 'PARTIAL': return Rating.Hard;      // 2
    case 'INCORRECT': return Rating.Again;   // 1
  }
}

// After grading, update FSRS state
function updateReviewState(
  review: SentenceReview,
  grade: GradingResult
): SentenceReview {
  const fsrs = new FSRS();
  const card = reviewToCard(review);
  const rating = gradeToFSRS(grade.status);
  const result = fsrs.repeat(card, new Date())[rating];
  return cardToReview(result.card, review);
}
```

---

## User Flows

### First Time User
1. **Welcome** → Brief intro to the app
2. **Placement Quiz** (optional, can skip)
   - Show 10 sentences of increasing difficulty
   - User self-rates: "I got this" / "Too hard"
   - Set starting level (or default to 1)
3. **First Session** → New sentences at their level

### Daily Session
1. **Reviews** (0-5 due sentences)
   - Show Latin → User translates → LLM grades → FSRS updates
2. **New Content** (1-3 new sentences)
   - Show Latin with glossary hover → User translates → LLM grades
3. **Summary**
   - Results, streak update, level progress

### Level Up
- "You've mastered 20 sentences at Level 12!"
- "Unlocking harder content..."
- Celebration moment

---

## Implementation Phases

[~] ### Phase 1: Corpus Processing (Foundation)
**Priority: CRITICAL | Effort: High**

Parse De Bello Gallico into structured, annotated corpus.

**Tasks:**
1. Obtain Latin text (Perseus Digital Library, public domain)
2. Obtain English translation (public domain or generate)
3. Parse into sentences with book/chapter structure
4. Lemmatize all words (Latin lemmatizer: Whitaker's Words, CLTK, or LLM)
5. Build vocabulary frequency table
6. Compute difficulty scores
7. Tag grammar constructions (LLM-assisted batch job)
8. Output: `corpus.json` with all Sentences, Passages, Words

**Output:**
```
content/
  corpus.json           # Full parsed corpus
  sentences/            # Individual sentence files (optional)
  vocabulary.json       # Word frequency data
```

**Acceptance:** Can query "give me all sentences with difficulty 1-10" and get ~500 results.

---

### Phase 2: Persistence (Convex)
**Priority: CRITICAL | Effort: Medium**

Store user state with real database.

**Tasks:**
1. Define Convex schema: `userProgress`, `sentenceReviews`, `attempts`
2. Implement queries: `getUserProgress`, `getDueReviews`, `getSeenSentences`
3. Implement mutations: `updateProgress`, `recordAttempt`, `updateReview`
4. Migrate from in-memory adapter
5. Keep `DataAdapter` interface for testability

**Files:**
```
convex/
  schema.ts
  userProgress.ts
  reviews.ts
  attempts.ts
lib/data/
  convexAdapter.ts
```

**Acceptance:** User progress persists across sessions.

---

### Phase 3: FSRS Implementation
**Priority: HIGH | Effort: Low**

Proper spaced repetition scheduling.

**Tasks:**
1. Install `ts-fsrs` package (or implement core algorithm)
2. Create `lib/srs/fsrs.ts` wrapper
3. Integrate with grading flow
4. Update review state after each attempt
5. Query due reviews for session building

**Files:**
```
lib/srs/
  fsrs.ts              # FSRS wrapper
  types.ts             # Review state types
lib/session/
  builder.ts           # Use FSRS for review selection
```

**Acceptance:** Review intervals grow with correct answers, shrink with incorrect.

---

### Phase 4: Content Selection Algorithm
**Priority: HIGH | Effort: Medium**

Select appropriate content based on user level.

**Tasks:**
1. Implement `selectNextContent(userId)` algorithm
2. Load corpus data (static import or API)
3. Filter by difficulty ≤ user level
4. Sort by narrative order
5. Integrate with session builder

**Files:**
```
lib/content/
  corpus.ts            # Corpus loader
  selection.ts         # Selection algorithm
lib/session/
  builder.ts           # Integrate selection
```

**Acceptance:** User only sees sentences at or below their level.

---

### Phase 5: Level Advancement
**Priority: MEDIUM | Effort: Low**

Users progress through difficulty levels.

**Tasks:**
1. Implement mastery counting (FSRS stability > 7 days)
2. Implement level advancement check
3. Trigger after each session
4. Update UI to show level progress

**Files:**
```
lib/progression/
  levels.ts            # Level advancement logic
components/
  LevelProgress.tsx    # Progress bar UI
```

**Acceptance:** User advances from level 1 → 2 after mastering 20 sentences.

---

### Phase 6: Placement Quiz
**Priority: MEDIUM | Effort: Medium**

Optionally assess starting level.

**Tasks:**
1. Design quiz flow (10 sentences, increasing difficulty)
2. Build quiz UI
3. Calculate starting level from responses
4. Store placement result

**Files:**
```
app/(app)/placement/
  page.tsx             # Quiz UI
lib/placement/
  quiz.ts              # Level calculation
```

**Acceptance:** User can skip or take quiz; starting level reflects ability.

---

### Phase 7: Polish & UX
**Priority: LOW | Effort: Medium**

Production-ready experience.

**Tasks:**
1. Loading states (skeleton loaders)
2. Error boundaries
3. Streak tracking and display
4. Mobile optimization
5. Celebration animations (level up, streak milestones)

---

## File Structure

```
caesar-in-a-year/
├── app/
│   ├── (app)/
│   │   ├── dashboard/
│   │   ├── session/[sessionId]/
│   │   ├── placement/
│   │   └── summary/[sessionId]/
│   └── api/
│       └── grade/
├── components/
│   ├── Session/
│   ├── Dashboard/
│   └── UI/
├── lib/
│   ├── ai/
│   │   └── gradeTranslation.ts
│   ├── content/
│   │   ├── corpus.ts          # Corpus loader
│   │   └── selection.ts       # Selection algorithm
│   ├── data/
│   │   ├── types.ts
│   │   ├── adapter.ts
│   │   └── convexAdapter.ts
│   ├── srs/
│   │   └── fsrs.ts            # FSRS wrapper
│   ├── session/
│   │   ├── builder.ts
│   │   └── advance.ts
│   └── progression/
│       └── levels.ts
├── content/
│   ├── corpus.json            # Parsed De Bello Gallico
│   └── vocabulary.json
├── convex/
│   ├── schema.ts
│   ├── userProgress.ts
│   ├── reviews.ts
│   └── attempts.ts
└── scripts/
    └── process-corpus.ts      # One-time corpus processing
```

---

## Success Criteria

**MVP Complete When:**
1. User can sign in
2. Take optional placement quiz
3. Do daily sessions (reviews + new content)
4. See progress persist
5. Experience FSRS-based review scheduling
6. Advance through difficulty levels
7. Eventually reach level 100 (full Caesar readability)

**Measured By:**
- User completes 7 consecutive days
- User advances at least 3 levels
- User returns after 1 week away

---

## What We're NOT Building (Yet)

| Feature | Why Not Now |
|---------|-------------|
| Vocabulary tracking | Level-based selection is simpler; add if data shows need |
| Grammar concept graph | Difficulty scoring captures this implicitly |
| Multiple task types | Translation + comprehension is enough for MVP |
| Hand-crafted lessons | Computed difficulty + narrative order works |
| Detailed error rubrics | LLM knows grammar implicitly |
| Social features | Focus on core learning loop first |

---

## The Bet

We're betting that:
1. **Parsed corpus + difficulty scoring** can replace hand-crafted curriculum
2. **Level-based selection** is simple enough to ship, smart enough to work
3. **FSRS** handles personalization (timing), so content selection can be deterministic
4. **LLM grading** with simple schema beats complex rubrics

If wrong, we can:
- Add hand-curation on top of computed difficulty
- Add vocabulary tracking for finer selection
- Add more task types for variety

But start simple. Ship. Learn. Iterate.

---

## Appendix: Corpus Pipeline Technical Debt

Deferred items from corpus processing pipeline PR #1 review (Dec 2025).

### Cross-Platform Python Paths
**Priority: Low | Effort: Low**

The corpus pipeline uses Unix-specific paths (`.venv/bin/python`) in `package.json` and `README.md`. Windows users need `.venv\Scripts\python`.

**Options:**
- Document both paths in README
- Use `python -m pip` after venv activation (cross-platform)
- Add `cross-env` wrapper

**From:** coderabbitai PR #1 review

### NLP Library Setup Documentation
**Priority: Low | Effort: Low**

The `nltk` and `cltk` libraries may require downloading additional data files on first run, which can surprise users.

**Action:** Add note to README about first-run data downloads:
- `nltk`: punkt tokenizer download prompt
- `cltk`: ~200MB Latin models (optional, falls back to regex)

**From:** coderabbitai PR #1 review

### Python Docstring Coverage
**Priority: Low | Effort: Low**

Docstring coverage is 77.78%, below 80% threshold.

**Action:** Add docstrings to undocumented functions in:
- `scripts/corpus/models.py`
- `scripts/corpus/sources.py`

**From:** coderabbitai pre-merge checks
