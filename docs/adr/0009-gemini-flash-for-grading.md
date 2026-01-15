# ADR 0009: Gemini 3 Flash for AI Translation Grading

## Status
Accepted

## Context
AI grading needs to evaluate Latin-to-English translations with:
- Semantic understanding (is the meaning correct?)
- Error categorization (grammar, vocabulary, word order, omission)
- Constructive feedback generation
- Glossary extraction (word-by-word meanings)

**Response time constraint:** Grading happens inline during session. Users expect <3s response.

**Alternatives considered:**
1. GPT-4 - high quality but expensive and slower
2. GPT-3.5-turbo - faster but Latin understanding weaker
3. Claude - strong reasoning but no structured output guarantee
4. Gemini Flash - fast, structured JSON output, good multilingual

## Decision
Use `gemini-3-flash-preview` with structured JSON output schema:

```typescript
const gradingSchema = {
  type: Type.OBJECT,
  properties: {
    status: { type: Type.STRING, enum: ['CORRECT', 'PARTIAL', 'INCORRECT'] },
    feedback: { type: Type.STRING },
    correction: { type: Type.STRING },
    analysis: {
      errors: [...],
      glossary: [...],
    },
  },
};
```

**Model config:**
- `temperature: 0` for deterministic grading
- `responseMimeType: "application/json"` for structured output

## Consequences

**Good:**
- Fast (<2s typical response)
- Structured output eliminates parsing errors
- Good Latin understanding (trained on classical texts)
- Cost-effective for per-attempt grading

**Bad:**
- Preview model may change behavior between versions
- Latin grading quality not formally benchmarked
- No fine-tuning available (depends on base model quality)

**Why not GPT-4 for quality?**
GPT-4 is ~10x slower and ~20x more expensive. For MVP, Gemini Flash quality is sufficient. Can upgrade later if user feedback indicates grading quality issues.

**Why temperature 0?**
Grading should be consistent. Same input -> same output. Creativity in grading causes confusion when users retry.
