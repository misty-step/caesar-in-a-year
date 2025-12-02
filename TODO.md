# TODO: Corpus Processing Pipeline

## Context
- **Architecture**: Single deep module (DESIGN.md) — one Python script, one TS sync script
- **Key Files**: `scripts/process-corpus.py`, `scripts/corpus-sync.ts`, `convex/schema.ts`, `convex/sentences.ts`
- **Patterns**: Vitest for TS tests, pytest for Python, existing Convex schema in placeholder state

## Implementation Tasks

### Phase 1: Python Pipeline ✅

- [x] Create Python project structure with dependencies
- [x] Implement source fetching with caching
- [x] Implement Latin XML parsing
- [x] Implement English HTML parsing
- [x] Implement Latin sentence segmentation
- [x] Implement translation alignment
- [x] Implement lemmatization and difficulty scoring
- [x] Implement export and validation
- [x] Create Latin word frequency table (built-in fallback)

### Phase 2: Convex Integration ✅

- [x] Implement Convex schema for sentences
- [x] Implement Convex sentences mutations and queries
- [x] Implement corpus-sync.ts script
- [x] Add npm scripts for corpus processing

### Phase 3: Integration ✅

- [x] Wire DataAdapter to query Convex sentences

## Success Criteria ✅

- [x] `process-corpus.py --book 1 --chapter 1` completes in < 2 min (1.0s)
- [x] corpus.json has sentences (9 for BG 1.1 - short chapter)
- [x] All sentences have non-empty latin and referenceTranslation
- [x] Difficulty scores range 1-100 (actual: 52-62)
- [x] Low-confidence alignments flagged (4 sentences < 0.8)
- [x] `pnpm corpus:sync` idempotent (dry-run works)
- [ ] `getByDifficulty(30)` returns easiest sentences (needs Convex deployment)

## Usage

```bash
# Process corpus (Python pipeline)
pnpm corpus:process

# Validate and sync to Convex (dry-run)
pnpm corpus:sync -- --dry-run

# Sync to Convex (needs CONVEX_URL env var)
pnpm corpus:sync

# Run both sequentially
pnpm corpus:all
```

## Not In Scope (Future)

- Chapters 2-54 processing
- ReadingPassage generation from corpus
- Spaced repetition integration
- Multi-book frequency tables

---

*TODO.md v1.1 — Corpus Processing Pipeline Complete*
