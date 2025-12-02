# Corpus Processing Pipeline

## Executive Summary

Parse De Bello Gallico Book 1, Chapter 1 into a structured corpus (~50 sentences) that feeds the Caesar-in-a-Year learning app. Sources: Perseus TEI XML (Latin) + MIT Classics (English). Output: `corpus.json` synced to Convex. Designed for easy extension to remaining chapters and books.

**Success criteria**: Query "sentences with difficulty < 30" returns easiest sentences with accurate Latin/English pairs.

## User Context

**Who**: Latin learners progressing through Caesar's Gallic War.

**Problem**: App has 3 hardcoded sentences. Need ~50 from Chapter 1 to validate the pipeline before scaling.

**Value**: Automated corpus processing enables content scaling. Ship small, validate, then scale.

## Requirements

### Functional

1. **Fetch sources**: Download Book 1 Latin (Perseus XML) and English (MIT Classics HTML)
2. **Parse structure**: Extract chapter → section hierarchy  
3. **Segment sentences**: Split Latin text into individual sentences
4. **Align translations**: Match Latin sentences to English by position
5. **Lemmatize**: Extract dictionary forms (CLTK/Stanza, 95%+ accuracy)
6. **Score difficulty**: Rank by average word frequency (simpler = more common words)
7. **Export**: Generate `corpus.json` with validated schema
8. **Sync to Convex**: Idempotent upsert with unique constraint

### Non-Functional

- **Reproducibility**: Same sources → identical output
- **Extensibility**: Adding chapters/books = parameter change + re-run
- **Validation**: Alignment confidence scoring, flag low-confidence pairs

## Architecture

### Selected Approach: Offline Python → JSON → Convex

```
┌─────────────────────────────────────────────────┐
│              OFFLINE (Python)                   │
├─────────────────────────────────────────────────┤
│  scripts/process-corpus.py --book 1 --chapter 1 │
│                                                 │
│  fetch → parse → segment → annotate → validate  │
│                     ↓                           │
│           content/corpus.json                   │
└─────────────────────────────────────────────────┘
                      │
                      ▼ pnpm corpus:sync
┌─────────────────────────────────────────────────┐
│              RUNTIME (Convex)                   │
├─────────────────────────────────────────────────┤
│  sentences table (idempotent upsert)            │
│         ↓                                       │
│  DataAdapter.getContent()                       │
└─────────────────────────────────────────────────┘
```

### Data Schema (Minimal)

```typescript
// corpus.json — Compatible with existing types.ts
interface Sentence {
  id: string;                      // "bg.1.1.1"
  latin: string;                   // "Gallia est omnis divisa..."
  referenceTranslation: string;    // ✅ Matches existing field name
  difficulty: number;              // 1-100 (lower = easier)
  order: number;                   // Sequential position for reading
  alignmentConfidence?: number;    // 0-1, flag if < 0.8
}
```

**5 fields, not 9.** Lemmas computed during processing, discarded after difficulty scoring.

### Convex Schema

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  sentences: defineTable({
    sentenceId: v.string(),
    latin: v.string(),
    referenceTranslation: v.string(),
    difficulty: v.number(),
    order: v.number(),
  })
    .index("by_sentence_id", ["sentenceId"])  // Unique lookup
    .index("by_difficulty", ["difficulty"]),
});
```

### Sync Safety

```typescript
// scripts/corpus-sync.ts
async function syncCorpus() {
  const corpus = JSON.parse(fs.readFileSync('content/corpus.json'));
  
  // Validate before touching database
  for (const s of corpus) {
    if (!s.id || !s.latin || !s.referenceTranslation) {
      throw new Error(`Invalid sentence: ${JSON.stringify(s)}`);
    }
  }
  
  // Idempotent upsert: delete existing, insert fresh
  await client.mutation("sentences:replaceAll", { sentences: corpus });
}
```

## Implementation

### Phase 1: MVP (This Sprint)

**One Python script, one sync script, one JSON file.**

```
scripts/
  process-corpus.py      # All pipeline logic in one file
  corpus-sync.ts         # Convex upsert
content/
  corpus.json            # ~50 sentences from Chapter 1
```

**Steps:**
1. Fetch Book 1 sources, cache locally
2. Parse Chapter 1 only (sections 1-12)
3. Segment into sentences using CLTK
4. Align Latin ↔ English by position
5. Lemmatize, compute frequency, score difficulty
6. Add alignment confidence (flag mismatches)
7. Export corpus.json
8. Sync to Convex
9. Update DataAdapter to query Convex

**Error handling:**
- CLTK fails on sentence → log warning, use regex fallback (split on periods)
- Alignment count mismatch → flag with low confidence, don't halt
- Convex sync fails → full rollback, no partial state

### Phase 2: Scale (If Chapter 1 Works)

- Process remaining Book 1 chapters (2-54)
- Manual review of flagged low-confidence alignments
- Tune difficulty algorithm based on user feedback

### Phase 3: Books 2-8

- Parameterize pipeline for book number
- Build corpus-wide frequency table
- Incremental sync (only changed sentences)

## Risks & Mitigation

| Risk | Mitigation |
|------|------------|
| Translation misalignment | Confidence scoring + manual review queue |
| CLTK accuracy < 95% | Regex fallback for tokenization failures |
| Schema breaks existing code | Keep `referenceTranslation` field name |
| Sync corrupts data | Atomic replace-all, no partial updates |

## Test Scenarios

- [ ] `process-corpus.py --book 1 --chapter 1` completes in < 2 min
- [ ] corpus.json has 40-60 sentences
- [ ] All sentences have non-empty latin and referenceTranslation
- [ ] Difficulty scores range 1-100
- [ ] Low-confidence alignments flagged (if any)
- [ ] `pnpm corpus:sync` idempotent (re-run produces same result)
- [ ] DataAdapter.getContent() returns sentences from Convex

## What We're NOT Building (Yet)

- ❌ vocabulary.json — Compute from corpus if needed later
- ❌ Lewis & Short definitions — Use LLM for contextual glossary
- ❌ Grammar tagging — Grader provides dynamic feedback
- ❌ Full Book 1 (300 sentences) — Start with 50, validate, scale
- ❌ Multi-factor difficulty — Frequency only for MVP
- ❌ ReadingPassage generation — Manual for now, automate in Phase 2

---

*PRD Version 2.0 — Simplified per expert review*
