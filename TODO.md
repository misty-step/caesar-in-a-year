# TODO: Corpus Processing Pipeline

## Context
- **Architecture**: Single deep module (DESIGN.md) — one Python script, one TS sync script
- **Key Files**: `scripts/process-corpus.py`, `scripts/corpus-sync.ts`, `convex/schema.ts`, `convex/sentences.ts`
- **Patterns**: Vitest for TS tests, pytest for Python, existing Convex schema in placeholder state

## Implementation Tasks

### Phase 1: Python Pipeline

- [x] Create Python project structure with dependencies
  ```
  Files: scripts/process-corpus.py (new), requirements.txt (new), content/raw/.gitkeep (new)
  Architecture: Single script with CLI using argparse, all functions in one file
  Pseudocode: DESIGN.md sections 1-6
  Success: `python scripts/process-corpus.py --help` shows usage
  Test: Script runs without import errors
  Dependencies: None
  Time: 15min
  ```

- [x] Implement source fetching with caching
  ```
  Files: scripts/process-corpus.py (fetch_sources function)
  Architecture: Cache raw sources in content/raw/, retry 3x with backoff
  Pseudocode: DESIGN.md "1. Source Fetching"
  Success:
    - Fetches from Perseus CTS API and MIT Classics
    - Caches to content/raw/bg.1.1.latin.xml and .english.html
    - Respects --force-fetch flag
  Test:
    - fetch_sources(1, 1, False) returns cached data if exists
    - fetch_sources(1, 1, True) re-downloads
    - Returns RawSources dataclass
  Dependencies: Python project structure
  Time: 45min
  ```

- [ ] Implement Latin XML parsing
  ```
  Files: scripts/process-corpus.py (parse_latin function)
  Architecture: BeautifulSoup with lxml parser for TEI XML
  Pseudocode: DESIGN.md "2. XML/HTML Parsing" — parse_latin
  Success:
    - Extracts sections from TEI <div subtype="section">
    - Returns list[Section] with number and latin_text
    - Raises ParseError if no sections found
  Test:
    - parse_latin(valid_xml) returns Section objects
    - parse_latin("<empty/>") raises ParseError
  Dependencies: Source fetching
  Time: 30min
  ```

- [ ] Implement English HTML parsing
  ```
  Files: scripts/process-corpus.py (parse_english, distribute_text, group_paragraphs)
  Architecture: BeautifulSoup for HTML, distribute text across section count
  Pseudocode: DESIGN.md "2. XML/HTML Parsing" — parse_english
  Success:
    - Extracts paragraphs from MIT Classics HTML
    - Distributes text into N sections matching Latin count
  Test:
    - parse_english(html, 6) returns 6 strings
    - Handles fewer paragraphs than sections
  Dependencies: Latin parsing (to know section_count)
  Time: 30min
  ```

- [ ] Implement Latin sentence segmentation
  ```
  Files: scripts/process-corpus.py (segment_latin, segment_regex, extract_sentences_cltk)
  Architecture: CLTK primary, regex fallback; graceful degradation
  Pseudocode: DESIGN.md "3. Sentence Segmentation"
  Success:
    - Splits Latin text into individual sentences
    - Handles abbreviations (cf., etc., i.e.)
    - Returns list[SegmentedSentence] with IDs like "bg.1.1.1"
  Test:
    - segment_regex("A. B.") → ["A.", "B."] (not split on abbreviation)
    - segment_regex("First. Second.") → ["First.", "Second."]
    - Fallback works when CLTK unavailable
  Dependencies: Latin/English parsing
  Time: 45min
  ```

- [ ] Implement translation alignment
  ```
  Files: scripts/process-corpus.py (align_translations, distribute_translations, split_sentences_english)
  Architecture: Position-based alignment with confidence scoring
  Pseudocode: DESIGN.md "4. Translation Alignment"
  Success:
    - Matches Latin sentences to English by position
    - Computes alignment_confidence (0.0-1.0)
    - Handles count mismatches gracefully
  Test:
    - 3 Latin + 3 English → confidence > 0.9
    - 3 Latin + 2 English → confidence < 0.8 (penalized)
    - Missing section → confidence = 0.0, english = "[MISSING]"
  Dependencies: Sentence segmentation
  Time: 45min
  ```

- [ ] Implement lemmatization and difficulty scoring
  ```
  Files: scripts/process-corpus.py (lemmatize_and_score, rank_to_difficulty, load_frequency_table), content/latin_frequency.json (new)
  Architecture: CLTK lemmas + word frequency lookup; fallback to simple tokenization
  Pseudocode: DESIGN.md "5. Lemmatization & Frequency Scoring"
  Success:
    - Computes difficulty 1-100 based on average word frequency
    - Common words (sum, est, in) → low difficulty
    - Rare words → high difficulty
    - Returns list[Sentence] matching types.ts schema
  Test:
    - rank_to_difficulty(1) < 20
    - rank_to_difficulty(5000) > 80
    - "Gallia est omnis divisa" → difficulty < 50 (common words)
  Dependencies: Translation alignment
  Time: 45min
  ```

- [ ] Implement export and validation
  ```
  Files: scripts/process-corpus.py (export_corpus, validate_sentence, main)
  Architecture: Atomic write with validation; CLI with argparse
  Pseudocode: DESIGN.md "6. Export & Validation"
  Success:
    - Writes valid corpus.json to content/
    - Validates schema (id pattern, non-empty fields, difficulty range)
    - Logs summary with sentence count and difficulty range
    - Exit codes per DESIGN.md (0=success, 1=fetch, 2=parse, 3=align, 4=validate)
  Test:
    - export_corpus([valid]) creates file
    - export_corpus([invalid_id]) raises ValidationError
    - Full pipeline: `python scripts/process-corpus.py --book 1 --chapter 1` → corpus.json
  Dependencies: Lemmatization and scoring
  Time: 30min
  ```

- [ ] Create Latin word frequency table
  ```
  Files: content/latin_frequency.json (new)
  Architecture: DCC Latin Core Vocabulary ranks; hardcoded top 500 words
  Pseudocode: DESIGN.md load_frequency_table FALLBACK_FREQUENCY_TABLE
  Success:
    - JSON with word→rank mapping
    - Covers top 500 Latin words (sum=1, est=2, in=3, etc.)
  Test: load_frequency_table()["sum"] == 1
  Dependencies: None (can parallelize with other tasks)
  Time: 30min
  ```

### Phase 2: Convex Integration

- [ ] Implement Convex schema for sentences
  ```
  Files: convex/schema.ts (replace placeholder)
  Architecture: sentences table with indexes per DESIGN.md
  Pseudocode: DESIGN.md "Convex Schema" — defineSchema
  Success:
    - sentences table with sentenceId, latin, referenceTranslation, difficulty, order
    - Indexes: by_sentence_id, by_difficulty, by_order
    - `npx convex dev` accepts schema
  Test: Schema deploys without errors
  Dependencies: None
  Time: 15min
  ```

- [ ] Implement Convex sentences mutations and queries
  ```
  Files: convex/sentences.ts (new)
  Architecture: replaceAll mutation (atomic), getByDifficulty query, getAll query
  Pseudocode: DESIGN.md "Convex Schema" — sentences.ts
  Success:
    - replaceAll deletes existing, inserts new
    - getByDifficulty filters by maxDifficulty
    - getAll returns ordered by reading sequence
  Test:
    - replaceAll([s1, s2]) → count: 2
    - getByDifficulty(30) returns only easy sentences
  Dependencies: Convex schema
  Time: 30min
  ```

- [ ] Implement corpus-sync.ts script
  ```
  Files: scripts/corpus-sync.ts (new), package.json (add scripts)
  Architecture: Zod validation, ConvexClient, atomic replace
  Pseudocode: DESIGN.md "Module: CorpusSync"
  Success:
    - Validates corpus.json with Zod schema
    - Syncs to Convex via replaceAll mutation
    - --dry-run flag validates without writing
  Test:
    - `pnpm corpus:sync --dry-run` validates and exits
    - `pnpm corpus:sync` updates Convex
    - Re-running produces same result (idempotent)
  Dependencies: Convex mutations
  Time: 30min
  ```

- [ ] Add npm scripts for corpus processing
  ```
  Files: package.json
  Architecture: Scripts for corpus:process, corpus:sync, corpus:all
  Success:
    - `pnpm corpus:process` runs Python pipeline
    - `pnpm corpus:sync` runs TypeScript sync
    - `pnpm corpus:all` runs both sequentially
  Test: All scripts execute correctly
  Dependencies: Both scripts complete
  Time: 10min
  ```

### Phase 3: Integration

- [ ] Wire DataAdapter to query Convex sentences
  ```
  Files: lib/data/adapter.ts (modify getContent)
  Architecture: Query sentences table, transform to existing Sentence type
  Pseudocode: DESIGN.md "Integration with Existing Code"
  Success:
    - getContent() queries Convex instead of returning static content
    - Returns first 3 sentences as review items
    - Falls back to static content if Convex unavailable
  Test:
    - getContent() returns sentences from Convex
    - Sentence format matches lib/data/types.ts
  Dependencies: corpus-sync complete with real data
  Time: 30min
  ```

## Test Plan

### Python Unit Tests
```
scripts/test_corpus.py:
  - test_segment_regex_basic
  - test_segment_regex_handles_abbreviations
  - test_rank_to_difficulty
  - test_distribute_translations_even
  - test_distribute_translations_uneven
  - test_export_validates_schema
```

### Integration Test
```
scripts/test_integration.py:
  - test_full_pipeline_chapter_1 (slow, network)
```

### TypeScript Tests
```
scripts/__tests__/corpus-sync.test.ts:
  - validates corpus.json schema
  - handles dry-run mode
  - mocks Convex client
```

## Success Criteria (from TASK.md)

- [ ] `process-corpus.py --book 1 --chapter 1` completes in < 2 min
- [ ] corpus.json has 40-60 sentences
- [ ] All sentences have non-empty latin and referenceTranslation
- [ ] Difficulty scores range 1-100
- [ ] Low-confidence alignments flagged (if any)
- [ ] `pnpm corpus:sync` idempotent
- [ ] `getByDifficulty(30)` returns easiest sentences

## Not In Scope (Phase 2+)

- Chapters 2-54 processing
- ReadingPassage generation from corpus
- Spaced repetition integration
- Multi-book frequency tables

---

*TODO.md v1.0 — Corpus Processing Pipeline*
