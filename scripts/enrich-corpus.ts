#!/usr/bin/env npx tsx
/**
 * Corpus Enrichment Script
 *
 * Generates vocabulary and phrase cards for all corpus sentences.
 * Run ONCE to enrich the curriculum - output is static data.
 *
 * Usage:
 *   pnpm corpus:enrich                    # Process all sentences
 *   pnpm corpus:enrich --start 100        # Resume from sentence 100
 *   pnpm corpus:enrich --batch 5          # Sentences per AI call (default: 10)
 *   pnpm corpus:enrich --dry-run          # Show first batch only
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { GoogleGenAI, Type } from "@google/genai";
import fs from "fs";
import path from "path";

const MODEL_NAME = "gemini-3-flash-preview";
const TIMEOUT_MS = 60000; // 60s for batch processing
const DEFAULT_BATCH_SIZE = 10;
const RATE_LIMIT_DELAY_MS = 1000; // 1s between batches

// Schema for enrichment output
const enrichmentSchema = {
  type: Type.OBJECT,
  properties: {
    vocab: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          latinWord: { type: Type.STRING, description: "Dictionary form (nominative singular for nouns, infinitive for verbs)" },
          meaning: { type: Type.STRING, description: "Clear English definition" },
          questionType: {
            type: Type.STRING,
            enum: ["latin_to_english"], // Meaning-focused only
          },
          question: { type: Type.STRING },
          answer: { type: Type.STRING },
          sourceSentenceId: { type: Type.STRING },
        },
        required: ["latinWord", "meaning", "questionType", "question", "answer", "sourceSentenceId"],
      },
    },
    phrases: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          latin: { type: Type.STRING, description: "2-4 word Latin phrase" },
          english: { type: Type.STRING, description: "English translation" },
          sourceSentenceId: { type: Type.STRING },
        },
        required: ["latin", "english", "sourceSentenceId"],
      },
    },
  },
  required: ["vocab", "phrases"],
};

type VocabItem = {
  latinWord: string;
  meaning: string;
  questionType: "latin_to_english";
  question: string;
  answer: string;
  sourceSentenceId: string;
};

type PhraseItem = {
  latin: string;
  english: string;
  sourceSentenceId: string;
};

type EnrichmentResult = {
  vocab: VocabItem[];
  phrases: PhraseItem[];
};

type Sentence = {
  id: string;
  latin: string;
  referenceTranslation: string;
  difficulty: number;
  order: number;
};

function parseArgs() {
  const args = process.argv.slice(2);
  let start = 0;
  let batchSize = DEFAULT_BATCH_SIZE;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--start" && args[i + 1]) {
      start = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--batch" && args[i + 1]) {
      batchSize = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    } else if (args[i] === "--help" || args[i] === "-h") {
      console.log(`
Usage: enrich-corpus.ts [options]

Options:
  --start <n>     Start from sentence index (default: 0)
  --batch <n>     Sentences per AI call (default: 10)
  --dry-run       Process first batch only, don't save
  --help, -h      Show this help message

Output: content/corpus-enriched.json
`);
      process.exit(0);
    }
  }

  return { start, batchSize, dryRun };
}

function constructPrompt(sentences: Sentence[]): string {
  const sentenceList = sentences
    .map((s, i) => `${i + 1}. [${s.id}] "${s.latin}"`)
    .join("\n");

  return `Enriching Latin curriculum with vocabulary and phrase cards.

For each sentence, extract:

VOCABULARY (2-4 key words per sentence):
- Focus on: verbs, nouns, key adjectives
- Skip ultra-common words (est, et, in, ad, qui, quae, quod, is, ea, id, hic, ille, sum)
- questionType: always "latin_to_english" (meaning only, no grammar questions)
- question: "What does '[word]' mean?"
- answer: the English meaning
- latinWord = dictionary form (nominative singular / infinitive)
- meaning = clear English definition
- Include sourceSentenceId

PHRASES (1-2 meaningful chunks per sentence):
- 2-4 word prepositional phrases, verb phrases, idiomatic expressions
- Include sourceSentenceId

SENTENCES:
${sentenceList}

Return JSON with vocab[] and phrases[] arrays.`;
}

async function processBatch(
  ai: GoogleGenAI,
  sentences: Sentence[]
): Promise<EnrichmentResult> {
  const prompt = constructPrompt(sentences);

  const responsePromise = ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: enrichmentSchema,
      temperature: 0.3,
    },
  });

  const response = await Promise.race([
    responsePromise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), TIMEOUT_MS)
    ),
  ]);

  const text = response.text;
  if (!text) {
    throw new Error("Empty response from AI");
  }

  return JSON.parse(text) as EnrichmentResult;
}

async function main() {
  const { start, batchSize, dryRun } = parseArgs();

  // Check API key
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Error: GEMINI_API_KEY not set in .env.local");
    process.exit(1);
  }

  // Load corpus
  const corpusPath = path.join(process.cwd(), "content", "corpus.json");
  if (!fs.existsSync(corpusPath)) {
    console.error(`Error: Corpus not found at ${corpusPath}`);
    process.exit(1);
  }

  const corpus = JSON.parse(fs.readFileSync(corpusPath, "utf-8"));
  const sentences: Sentence[] = corpus.sentences;

  console.log(`Loaded ${sentences.length} sentences from corpus`);
  console.log(`Processing from index ${start} with batch size ${batchSize}`);

  // Load existing enriched data (for resume support)
  const outputPath = path.join(process.cwd(), "content", "corpus-enriched.json");
  let allVocab: VocabItem[] = [];
  let allPhrases: PhraseItem[] = [];
  let processedIds = new Set<string>();

  if (fs.existsSync(outputPath) && start > 0) {
    const existing = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
    allVocab = existing.vocab || [];
    allPhrases = existing.phrases || [];
    processedIds = new Set([
      ...allVocab.map(v => v.sourceSentenceId),
      ...allPhrases.map(p => p.sourceSentenceId),
    ]);
    console.log(`Resuming: ${processedIds.size} sentences already processed`);
  }

  const ai = new GoogleGenAI({ apiKey });
  let processed = 0;
  let errors = 0;

  // Process in batches
  for (let i = start; i < sentences.length; i += batchSize) {
    const batch = sentences.slice(i, i + batchSize);
    const batchIds = batch.map(s => s.id).join(", ");

    console.log(`\n[${i}/${sentences.length}] Processing: ${batchIds}`);

    try {
      const result = await processBatch(ai, batch);

      // Deduplicate vocab by latinWord
      for (const v of result.vocab) {
        const exists = allVocab.some(
          existing => existing.latinWord === v.latinWord
        );
        if (!exists) {
          allVocab.push(v);
        }
      }

      // Deduplicate phrases by latin text
      for (const p of result.phrases) {
        const exists = allPhrases.some(
          existing => existing.latin === p.latin
        );
        if (!exists) {
          allPhrases.push(p);
        }
      }

      processed += batch.length;
      console.log(
        `  ✓ Generated ${result.vocab.length} vocab, ${result.phrases.length} phrases`
      );
      console.log(
        `  Totals: ${allVocab.length} vocab, ${allPhrases.length} phrases`
      );

      // Save progress periodically
      if (!dryRun && processed % 50 === 0) {
        saveOutput(outputPath, sentences, allVocab, allPhrases);
        console.log(`  💾 Checkpoint saved`);
      }

      // Rate limiting
      if (!dryRun && i + batchSize < sentences.length) {
        await sleep(RATE_LIMIT_DELAY_MS);
      }
    } catch (error) {
      errors++;
      console.error(`  ❌ Error: ${error}`);

      // Save on error to preserve progress
      if (!dryRun) {
        saveOutput(outputPath, sentences, allVocab, allPhrases);
        console.log(`  💾 Progress saved after error`);
      }

      // Continue to next batch
      await sleep(RATE_LIMIT_DELAY_MS * 2);
    }

    if (dryRun) {
      console.log("\n✓ Dry run complete - processed first batch only");
      console.log("\nSample vocab:", JSON.stringify(allVocab.slice(0, 2), null, 2));
      console.log("\nSample phrases:", JSON.stringify(allPhrases.slice(0, 2), null, 2));
      return;
    }
  }

  // Final save
  saveOutput(outputPath, sentences, allVocab, allPhrases);

  console.log(`\n${"=".repeat(50)}`);
  console.log(`✓ Enrichment complete!`);
  console.log(`  Sentences processed: ${processed}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Total vocab cards: ${allVocab.length}`);
  console.log(`  Total phrase cards: ${allPhrases.length}`);
  console.log(`  Output: ${outputPath}`);
}

function saveOutput(
  outputPath: string,
  sentences: Sentence[],
  vocab: VocabItem[],
  phrases: PhraseItem[]
) {
  const output = {
    metadata: {
      version: "1.0.0",
      generated_at: new Date().toISOString(),
      sentence_count: sentences.length,
      vocab_count: vocab.length,
      phrase_count: phrases.length,
    },
    sentences,
    vocab,
    phrases,
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
