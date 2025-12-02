# DESIGN.md — Corpus Processing Pipeline

## Architecture Overview

**Selected Approach**: Single Deep Module (Monolithic Script)

**Rationale**: MVP requires ~50 sentences from one chapter. A single `process-corpus.py` script with well-defined internal functions minimizes complexity while remaining extractable to modules later. Matches PRD's "One Python script" mandate.

**Core Modules**:
- `process-corpus.py` — Fetches, parses, segments, aligns, lemmatizes, scores, exports
- `corpus-sync.ts` — Idempotent Convex upsert with validation

**Data Flow**:
```
CLI args (--book 1 --chapter 1)
    ↓
[Fetch] Perseus CTS API + MIT Classics HTML
    ↓ (cached in content/raw/)
[Parse] Extract sections from XML/HTML
    ↓
[Segment] Split Latin into sentences (CLTK/regex fallback)
    ↓
[Align] Match Latin↔English by position, compute confidence
    ↓
[Lemmatize] Extract dictionary forms, compute word frequencies
    ↓
[Score] Difficulty = f(avg word frequency)
    ↓
[Export] content/corpus.json
    ↓
pnpm corpus:sync → Convex sentences table
```

**Key Design Decisions**:
1. **Cache raw sources locally** — Reproducibility; don't hit Perseus on every run
2. **Regex fallback for segmentation** — CLTK may fail on edge cases; graceful degradation
3. **Position-based alignment** — Simple heuristic; confidence scoring flags mismatches
4. **Discard lemmas after scoring** — Corpus stores only 5 fields, not 9

---

## Module: CorpusProcessor (process-corpus.py)

**Responsibility**: Transform raw Perseus XML + MIT HTML into validated corpus.json

**Public Interface** (CLI):
```bash
python scripts/process-corpus.py --book 1 --chapter 1
python scripts/process-corpus.py --book 1 --chapter 1 --force-fetch
python scripts/process-corpus.py --validate-only content/corpus.json
```

**Arguments**:
| Arg | Type | Default | Description |
|-----|------|---------|-------------|
| `--book` | int | required | DBG book number (1-8) |
| `--chapter` | int | required | Chapter within book |
| `--force-fetch` | flag | false | Bypass cache, re-download sources |
| `--validate-only` | path | none | Validate existing JSON without processing |
| `--output` | path | `content/corpus.json` | Output file path |

**Exit Codes**:
- `0` — Success
- `1` — Fetch failed (network/404)
- `2` — Parse failed (malformed source)
- `3` — Alignment failed (count mismatch, all low-confidence)
- `4` — Validation failed (schema violation)

---

## Data Structures

```python
from dataclasses import dataclass
from typing import Optional

@dataclass
class RawSources:
    """Fetched source materials, cached locally."""
    latin_xml: str          # Perseus TEI XML
    english_html: str       # MIT Classics HTML
    book: int
    chapter: int
    fetched_at: str         # ISO timestamp

@dataclass
class Section:
    """Parsed section within a chapter (DBG has ~6-12 sections per chapter)."""
    number: int             # Section number within chapter
    latin_text: str         # Raw Latin text
    english_text: str       # Raw English text

@dataclass
class SegmentedSentence:
    """Individual sentence after segmentation."""
    id: str                 # "bg.1.1.1" format
    latin: str              # Latin sentence
    english: str            # Aligned English sentence
    section: int            # Source section number
    position: int           # Position within section
    alignment_confidence: float  # 0.0-1.0

@dataclass
class LemmatizedWord:
    """Word with dictionary form (intermediate, not persisted)."""
    surface: str            # As it appears in text
    lemma: str              # Dictionary form
    frequency_rank: int     # 1 = most common, higher = rarer

@dataclass
class Sentence:
    """Final output format matching lib/data/types.ts."""
    id: str                 # "bg.1.1.1"
    latin: str
    referenceTranslation: str
    difficulty: int         # 1-100
    order: int              # Sequential reading order
    alignmentConfidence: Optional[float] = None  # Only if < 0.8
```

**corpus.json Schema**:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "array",
  "items": {
    "type": "object",
    "required": ["id", "latin", "referenceTranslation", "difficulty", "order"],
    "properties": {
      "id": { "type": "string", "pattern": "^bg\\.[1-8]\\.[0-9]+\\.[0-9]+$" },
      "latin": { "type": "string", "minLength": 1 },
      "referenceTranslation": { "type": "string", "minLength": 1 },
      "difficulty": { "type": "integer", "minimum": 1, "maximum": 100 },
      "order": { "type": "integer", "minimum": 1 },
      "alignmentConfidence": { "type": "number", "minimum": 0, "maximum": 1 }
    }
  }
}
```

---

## Core Algorithms

### 1. Source Fetching

```pseudocode
function fetch_sources(book: int, chapter: int, force: bool) -> RawSources:
    cache_dir = "content/raw"
    latin_path = f"{cache_dir}/bg.{book}.{chapter}.latin.xml"
    english_path = f"{cache_dir}/bg.{book}.{chapter}.english.html"

    # Check cache unless forced
    if not force and exists(latin_path) and exists(english_path):
        return RawSources(
            latin_xml=read(latin_path),
            english_html=read(english_path),
            book, chapter,
            fetched_at=mtime(latin_path)
        )

    # Fetch Latin from Perseus CTS API
    # URN: urn:cts:latinLit:phi0448.phi001.perseus-lat2:{book}.{chapter}
    latin_url = f"https://scaife-cts.perseus.org/api/cts/?request=GetPassage&urn=urn:cts:latinLit:phi0448.phi001.perseus-lat2:{book}.{chapter}"
    latin_response = http_get(latin_url, timeout=30s)
    if not latin_response.ok:
        raise FetchError(f"Perseus returned {latin_response.status}")

    # Fetch English from MIT Classics
    english_url = f"https://classics.mit.edu/Caesar/gallic.{book}.{chapter}.html"
    english_response = http_get(english_url, timeout=30s)
    if not english_response.ok:
        raise FetchError(f"MIT returned {english_response.status}")

    # Cache for reproducibility
    mkdir_p(cache_dir)
    write(latin_path, latin_response.text)
    write(english_path, english_response.text)

    return RawSources(
        latin_xml=latin_response.text,
        english_html=english_response.text,
        book, chapter,
        fetched_at=now_iso()
    )
```

### 2. XML/HTML Parsing

```pseudocode
function parse_latin(xml: str) -> list[Section]:
    """Parse Perseus TEI XML into sections."""
    doc = parse_xml(xml)
    sections = []

    # TEI structure: <TEI><text><body><div type="textpart" subtype="chapter">
    #                  <div type="textpart" subtype="section" n="1">
    #                    <p>Latin text...</p>
    #                  </div>
    #                </div></body></text></TEI>

    for section_div in doc.find_all('div', subtype='section'):
        section_num = int(section_div['n'])
        # Combine all <p> text, normalize whitespace
        text = ' '.join(p.get_text() for p in section_div.find_all('p'))
        text = normalize_whitespace(text)
        sections.append(Section(number=section_num, latin_text=text, english_text=""))

    if not sections:
        raise ParseError("No sections found in Latin XML")

    return sections

function parse_english(html: str, section_count: int) -> list[str]:
    """Parse MIT Classics HTML into section texts."""
    doc = parse_html(html)

    # MIT structure: prose in single block, no section markers
    # Strategy: Split by paragraph breaks, distribute across sections

    paragraphs = [p.get_text().strip() for p in doc.find_all('p') if p.get_text().strip()]

    if len(paragraphs) < section_count:
        # Fewer paragraphs than sections: combine as single block
        full_text = ' '.join(paragraphs)
        # Split roughly by sentence count ratio
        return distribute_text(full_text, section_count)

    # More paragraphs: group into section_count buckets
    return group_paragraphs(paragraphs, section_count)

function distribute_text(text: str, n: int) -> list[str]:
    """Distribute text into n roughly equal parts by sentence."""
    sentences = split_sentences_english(text)
    per_section = max(1, len(sentences) // n)
    result = []
    for i in range(n):
        start = i * per_section
        end = start + per_section if i < n - 1 else len(sentences)
        result.append(' '.join(sentences[start:end]))
    return result
```

### 3. Sentence Segmentation

```pseudocode
function segment_latin(sections: list[Section]) -> list[SegmentedSentence]:
    """Segment Latin text into individual sentences using CLTK."""
    try:
        from cltk import NLP
        nlp = NLP(language="lat", suppress_banner=True)
        use_cltk = True
    except ImportError:
        log.warning("CLTK not available, using regex fallback")
        use_cltk = False

    sentences = []
    order = 1

    for section in sections:
        if use_cltk:
            try:
                doc = nlp.analyze(section.latin_text)
                # CLTK provides sentence boundaries
                section_sentences = extract_sentences_cltk(doc)
            except Exception as e:
                log.warning(f"CLTK failed on section {section.number}: {e}")
                section_sentences = segment_regex(section.latin_text)
        else:
            section_sentences = segment_regex(section.latin_text)

        for i, latin in enumerate(section_sentences):
            sent_id = f"bg.{book}.{chapter}.{section.number}.{i+1}"
            sentences.append(SegmentedSentence(
                id=sent_id,
                latin=latin.strip(),
                english="",  # Filled during alignment
                section=section.number,
                position=i + 1,
                alignment_confidence=0.0
            ))
            order += 1

    return sentences

function segment_regex(text: str) -> list[str]:
    """Fallback: split on sentence-ending punctuation."""
    # Latin uses . ? ! as sentence terminators (like English)
    # Handle abbreviations: don't split on common ones
    abbrevs = ['cf.', 'etc.', 'i.e.', 'e.g.', 'vs.', 'al.']

    # Protect abbreviations
    protected = text
    for abbr in abbrevs:
        protected = protected.replace(abbr, abbr.replace('.', '<DOT>'))

    # Split on . ? ! followed by space and capital
    pattern = r'(?<=[.?!])\s+(?=[A-Z])'
    parts = re.split(pattern, protected)

    # Restore abbreviations
    return [p.replace('<DOT>', '.').strip() for p in parts if p.strip()]
```

### 4. Translation Alignment

```pseudocode
function align_translations(
    latin_sentences: list[SegmentedSentence],
    english_sections: list[str]
) -> list[SegmentedSentence]:
    """Align Latin sentences with English translations by position."""

    # Group Latin sentences by section
    by_section = defaultdict(list)
    for sent in latin_sentences:
        by_section[sent.section].append(sent)

    aligned = []

    for section_num, latin_sents in sorted(by_section.items()):
        if section_num > len(english_sections):
            log.error(f"No English for section {section_num}")
            # Assign empty with low confidence
            for sent in latin_sents:
                sent.english = "[MISSING]"
                sent.alignment_confidence = 0.0
                aligned.append(sent)
            continue

        english_text = english_sections[section_num - 1]
        english_sents = split_sentences_english(english_text)

        # Calculate confidence based on count ratio
        ratio = len(latin_sents) / max(1, len(english_sents))
        base_confidence = 1.0 - min(1.0, abs(1.0 - ratio) * 0.5)

        if len(latin_sents) == len(english_sents):
            # Perfect 1:1 match
            for lat, eng in zip(latin_sents, english_sents):
                lat.english = eng.strip()
                lat.alignment_confidence = min(0.95, base_confidence + 0.1)
                aligned.append(lat)
        else:
            # Distribute English across Latin sentences
            aligned.extend(
                distribute_translations(latin_sents, english_sents, base_confidence)
            )

    return aligned

function distribute_translations(
    latin: list[SegmentedSentence],
    english: list[str],
    base_confidence: float
) -> list[SegmentedSentence]:
    """Distribute English sentences across Latin when counts differ."""

    if len(english) == 0:
        for sent in latin:
            sent.english = "[NO TRANSLATION]"
            sent.alignment_confidence = 0.0
        return latin

    if len(latin) > len(english):
        # More Latin than English: some Latin sentences share translation
        per_latin = len(english) / len(latin)
        for i, sent in enumerate(latin):
            eng_idx = min(int(i * per_latin), len(english) - 1)
            sent.english = english[eng_idx].strip()
            sent.alignment_confidence = base_confidence * 0.7  # Penalty for sharing
    else:
        # More English than Latin: concatenate English for each Latin
        per_eng = len(english) / len(latin)
        for i, sent in enumerate(latin):
            start = int(i * per_eng)
            end = int((i + 1) * per_eng)
            sent.english = ' '.join(english[start:end]).strip()
            sent.alignment_confidence = base_confidence * 0.8

    return latin

function split_sentences_english(text: str) -> list[str]:
    """Split English text into sentences using NLTK."""
    import nltk
    try:
        return nltk.sent_tokenize(text)
    except LookupError:
        nltk.download('punkt', quiet=True)
        return nltk.sent_tokenize(text)
```

### 5. Lemmatization & Frequency Scoring

```pseudocode
function lemmatize_and_score(sentences: list[SegmentedSentence]) -> list[Sentence]:
    """Compute difficulty scores based on word frequency."""

    # Load Latin word frequency list (from CLTK or custom)
    freq_table = load_frequency_table()

    try:
        from cltk import NLP
        nlp = NLP(language="lat", suppress_banner=True)
        use_cltk = True
    except ImportError:
        use_cltk = False

    scored = []

    for idx, sent in enumerate(sentences):
        if use_cltk:
            try:
                doc = nlp.analyze(sent.latin)
                lemmas = [w.lemma for w in doc.words if w.lemma]
            except:
                lemmas = simple_tokenize(sent.latin)
        else:
            lemmas = simple_tokenize(sent.latin)

        # Calculate average frequency rank
        if lemmas:
            ranks = [freq_table.get(lemma.lower(), 5000) for lemma in lemmas]
            avg_rank = sum(ranks) / len(ranks)
            # Normalize to 1-100 scale
            # Rank 1-100 = easy (score 1-30)
            # Rank 100-500 = medium (score 30-60)
            # Rank 500+ = hard (score 60-100)
            difficulty = rank_to_difficulty(avg_rank)
        else:
            difficulty = 50  # Default middle difficulty

        output = Sentence(
            id=sent.id,
            latin=sent.latin,
            referenceTranslation=sent.english,
            difficulty=difficulty,
            order=idx + 1
        )

        # Only include confidence if below threshold
        if sent.alignment_confidence < 0.8:
            output.alignmentConfidence = round(sent.alignment_confidence, 2)

        scored.append(output)

    return scored

function rank_to_difficulty(avg_rank: float) -> int:
    """Convert average word frequency rank to 1-100 difficulty score."""
    # Logarithmic scale: common words = low difficulty
    import math

    if avg_rank <= 0:
        return 50

    # Log scale: rank 1 → ~1, rank 100 → ~30, rank 1000 → ~60, rank 5000 → ~85
    log_rank = math.log10(avg_rank + 1)
    # Scale to 1-100, clamped
    difficulty = int(log_rank * 25)
    return max(1, min(100, difficulty))

function load_frequency_table() -> dict[str, int]:
    """Load Latin word frequency rankings."""
    # Primary: Use DCC Latin Core Vocabulary (1000 most common words)
    # Fallback: CLTK's frequency data

    freq_path = "content/latin_frequency.json"
    if exists(freq_path):
        return json.load(open(freq_path))

    # Generate from CLTK if available
    try:
        from cltk.data.fetch import FetchCorpus
        # ... load and process
    except:
        pass

    # Hardcoded fallback: top 100 words get low ranks
    return FALLBACK_FREQUENCY_TABLE
```

### 6. Export & Validation

```pseudocode
function export_corpus(sentences: list[Sentence], output_path: str):
    """Write validated corpus.json."""

    # Validate schema
    for sent in sentences:
        assert sent.id and re.match(r'^bg\.\d+\.\d+\.\d+$', sent.id)
        assert sent.latin and len(sent.latin) > 0
        assert sent.referenceTranslation and len(sent.referenceTranslation) > 0
        assert 1 <= sent.difficulty <= 100
        assert sent.order >= 1

    # Sort by order
    sentences.sort(key=lambda s: s.order)

    # Convert to JSON-serializable dicts
    data = []
    for sent in sentences:
        d = {
            "id": sent.id,
            "latin": sent.latin,
            "referenceTranslation": sent.referenceTranslation,
            "difficulty": sent.difficulty,
            "order": sent.order
        }
        if sent.alignmentConfidence is not None:
            d["alignmentConfidence"] = sent.alignmentConfidence
        data.append(d)

    # Write atomically
    tmp_path = output_path + ".tmp"
    with open(tmp_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    os.rename(tmp_path, output_path)

    # Summary
    low_confidence = [s for s in sentences if s.alignmentConfidence is not None]
    print(f"Exported {len(sentences)} sentences to {output_path}")
    print(f"Difficulty range: {min(s.difficulty for s in sentences)}-{max(s.difficulty for s in sentences)}")
    if low_confidence:
        print(f"WARNING: {len(low_confidence)} sentences flagged for manual review")
```

---

## Module: CorpusSync (scripts/corpus-sync.ts)

**Responsibility**: Idempotent upsert of corpus.json to Convex

**Public Interface**:
```bash
pnpm corpus:sync                    # Sync content/corpus.json
pnpm corpus:sync --file other.json  # Sync specific file
pnpm corpus:sync --dry-run          # Validate without writing
```

**Implementation**:
```typescript
// scripts/corpus-sync.ts
import { ConvexClient } from 'convex/browser';
import fs from 'fs';
import { z } from 'zod';

const SentenceSchema = z.object({
  id: z.string().regex(/^bg\.\d+\.\d+\.\d+$/),
  latin: z.string().min(1),
  referenceTranslation: z.string().min(1),
  difficulty: z.number().int().min(1).max(100),
  order: z.number().int().min(1),
  alignmentConfidence: z.number().min(0).max(1).optional(),
});

const CorpusSchema = z.array(SentenceSchema);

async function syncCorpus(filePath: string, dryRun: boolean) {
  // 1. Load and validate
  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);
  const corpus = CorpusSchema.parse(data);

  console.log(`Validated ${corpus.length} sentences`);

  if (dryRun) {
    console.log('Dry run: no changes made');
    return;
  }

  // 2. Connect to Convex
  const client = new ConvexClient(process.env.CONVEX_URL!);

  // 3. Atomic replace: delete all, insert fresh
  // This ensures idempotency and avoids stale data
  await client.mutation('sentences:replaceAll', {
    sentences: corpus.map(s => ({
      sentenceId: s.id,
      latin: s.latin,
      referenceTranslation: s.referenceTranslation,
      difficulty: s.difficulty,
      order: s.order,
    }))
  });

  console.log(`Synced ${corpus.length} sentences to Convex`);
}
```

---

## Convex Schema

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  sentences: defineTable({
    sentenceId: v.string(),      // "bg.1.1.1"
    latin: v.string(),
    referenceTranslation: v.string(),
    difficulty: v.number(),       // 1-100
    order: v.number(),           // Reading sequence
  })
    .index("by_sentence_id", ["sentenceId"])
    .index("by_difficulty", ["difficulty"])
    .index("by_order", ["order"]),
});
```

```typescript
// convex/sentences.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const replaceAll = mutation({
  args: {
    sentences: v.array(v.object({
      sentenceId: v.string(),
      latin: v.string(),
      referenceTranslation: v.string(),
      difficulty: v.number(),
      order: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    // Delete all existing sentences
    const existing = await ctx.db.query("sentences").collect();
    for (const doc of existing) {
      await ctx.db.delete(doc._id);
    }

    // Insert new sentences
    for (const sentence of args.sentences) {
      await ctx.db.insert("sentences", sentence);
    }

    return { count: args.sentences.length };
  },
});

export const getByDifficulty = query({
  args: { maxDifficulty: v.number() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("sentences")
      .withIndex("by_difficulty", q => q.lte("difficulty", args.maxDifficulty))
      .collect();
  },
});

export const getAll = query({
  handler: async (ctx) => {
    return ctx.db.query("sentences").withIndex("by_order").collect();
  },
});
```

---

## File Organization

```
scripts/
  process-corpus.py        # Main pipeline (all logic in one file)
  corpus-sync.ts           # Convex upsert script

content/
  raw/                     # Cached source files (gitignored)
    bg.1.1.latin.xml
    bg.1.1.english.html
  corpus.json              # Output: ~50 sentences from Ch.1
  latin_frequency.json     # Word frequency table (optional, can generate)

convex/
  schema.ts                # sentences table definition
  sentences.ts             # Queries and mutations

package.json               # Add scripts:
  # "corpus:process": "python scripts/process-corpus.py --book 1 --chapter 1"
  # "corpus:sync": "npx tsx scripts/corpus-sync.ts"
  # "corpus:all": "pnpm corpus:process && pnpm corpus:sync"

requirements.txt           # Python deps: cltk, requests, beautifulsoup4, lxml
```

---

## Integration with Existing Code

**Modifications to `lib/data/adapter.ts`**:

```typescript
// After Convex integration, update getContent():
async getContent(): Promise<ContentSeed> {
  // Query Convex for sentences by difficulty
  const sentences = await convex.query('sentences:getAll');

  // Transform to existing Sentence type
  const review: Sentence[] = sentences.slice(0, 3).map(s => ({
    id: s.sentenceId,
    latin: s.latin,
    referenceTranslation: s.referenceTranslation,
  }));

  // For now, keep static reading passage
  // TODO: Generate ReadingPassage from corpus in Phase 2
  return {
    review,
    reading: DAILY_READING,
  };
}
```

---

## Error Handling Strategy

| Error | Detection | Response |
|-------|-----------|----------|
| Network timeout | requests.Timeout | Retry 3x with backoff, then exit 1 |
| 404 from Perseus | status 404 | Log error, exit 1 with clear message |
| Malformed XML | lxml.XMLSyntaxError | Log position, exit 2 |
| CLTK model missing | ImportError | Download automatically, or use regex fallback |
| Zero sentences extracted | len(sentences) == 0 | Exit 2 |
| All low-confidence | all(c < 0.5) | Warning, continue but flag in output |
| Convex sync failure | ConvexError | Exit with error, no partial state |

**Logging**:
```python
import logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
log = logging.getLogger('corpus')
```

---

## Testing Strategy

**Unit Tests** (`scripts/test_corpus.py`):
```python
def test_segment_regex_basic():
    text = "Gallia est omnis divisa. Quarum unam incolunt Belgae."
    result = segment_regex(text)
    assert len(result) == 2
    assert "Gallia" in result[0]
    assert "Belgae" in result[1]

def test_segment_regex_handles_abbreviations():
    text = "Cf. Caesar. Hoc est verum."
    result = segment_regex(text)
    assert len(result) == 2  # Not 3

def test_rank_to_difficulty():
    assert rank_to_difficulty(1) < 20      # Very common = easy
    assert rank_to_difficulty(100) < 40    # Common = medium-easy
    assert rank_to_difficulty(1000) > 50   # Uncommon = medium-hard
    assert rank_to_difficulty(5000) > 80   # Rare = hard

def test_distribute_translations_even():
    latin = [SegmentedSentence(...) for _ in range(3)]
    english = ["First.", "Second.", "Third."]
    result = distribute_translations(latin, english, 0.9)
    assert all(s.alignment_confidence > 0.8 for s in result)

def test_distribute_translations_uneven():
    latin = [SegmentedSentence(...) for _ in range(3)]
    english = ["First.", "Second."]  # Fewer English
    result = distribute_translations(latin, english, 0.9)
    assert all(s.alignment_confidence < 0.8 for s in result)  # Penalized
```

**Integration Test**:
```python
def test_full_pipeline_chapter_1():
    """End-to-end test with real data (slow, network-dependent)."""
    result = subprocess.run([
        'python', 'scripts/process-corpus.py',
        '--book', '1', '--chapter', '1',
        '--output', 'test_output.json'
    ], capture_output=True)

    assert result.returncode == 0

    with open('test_output.json') as f:
        corpus = json.load(f)

    assert 40 <= len(corpus) <= 60  # Expected range
    assert all('id' in s for s in corpus)
    assert all('latin' in s for s in corpus)
    assert all(1 <= s['difficulty'] <= 100 for s in corpus)
```

---

## Performance Considerations

**Expected Load**:
- One-time processing per chapter
- ~50 sentences per chapter, ~300 per book
- Processing time: < 2 min per chapter

**Optimizations**:
- Cache raw sources locally (avoid repeated network)
- Lazy-load CLTK models (only download when needed)
- Batch Convex writes in single transaction

**No premature optimization needed** — this is offline batch processing.

---

## Alternative Architectures Considered

### Alternative A: Single Script (Selected)
- **Pros**: Simple, matches PRD, fast to build
- **Cons**: Harder to test stages in isolation
- **Ousterhout Analysis**: Deep module — CLI args in, corpus.json out. Hides fetch/parse/align complexity.
- **Verdict**: Selected for MVP simplicity

### Alternative B: Multi-Stage Pipeline
- **Pros**: Can re-run individual stages, debuggable intermediate files
- **Cons**: Coordination overhead, more files, state management
- **Ousterhout Analysis**: Multiple shallow modules with file-based coupling
- **Verdict**: Rejected — premature for 50 sentences

### Alternative C: CLI with Subcommands
- **Pros**: Flexible (`process fetch`, `process align`, etc.)
- **Cons**: Overkill complexity for one-shot processing
- **Ousterhout Analysis**: Exposes internal stages as public interface
- **Verdict**: Rejected — unnecessary interface complexity

---

## Security Considerations

- **No secrets in scripts** — Convex URL from environment
- **Validate all external data** — Perseus/MIT could return malformed content
- **No user input in commands** — Book/chapter are validated integers
- **Content sanitization** — Strip HTML tags, normalize whitespace

---

## Success Criteria (from TASK.md)

- [ ] `process-corpus.py --book 1 --chapter 1` completes in < 2 min
- [ ] corpus.json has 40-60 sentences
- [ ] All sentences have non-empty latin and referenceTranslation
- [ ] Difficulty scores range 1-100
- [ ] Low-confidence alignments flagged (if any)
- [ ] `pnpm corpus:sync` idempotent
- [ ] `getByDifficulty(30)` returns easiest sentences

---

*DESIGN.md v1.0 — Corpus Processing Pipeline*
