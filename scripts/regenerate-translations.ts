#!/usr/bin/env npx tsx
/**
 * Translation Regeneration Script
 *
 * Generates accurate sentence-level translations for the entire corpus
 * using Gemini AI, replacing the misaligned MIT Classics translations.
 *
 * Usage:
 *   pnpm corpus:translate                    # Process all sentences
 *   pnpm corpus:translate --start 100        # Resume from sentence 100
 *   pnpm corpus:translate --batch 20         # Sentences per AI call (default: 20)
 *   pnpm corpus:translate --dry-run          # Show first batch only
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { GoogleGenAI, Type } from "@google/genai";
import fs from "fs";
import path from "path";

const MODEL_NAME = "gemini-3-flash-preview";
const TIMEOUT_MS = 90000; // 90s for translation batches
const DEFAULT_BATCH_SIZE = 20;
const RATE_LIMIT_DELAY_MS = 1000; // 1s between batches

// Schema for translation output
const translationSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING, description: "Sentence ID (e.g., bg.1.44.10)" },
      literal: { type: Type.STRING, description: "Literal translation, close to Latin structure" },
      natural: { type: Type.STRING, description: "Natural, idiomatic English translation" },
    },
    required: ["id", "literal", "natural"],
  },
};

type TranslationResult = {
  id: string;
  literal: string;
  natural: string;
}[];

type Sentence = {
  id: string;
  latin: string;
  referenceTranslation: string;
  difficulty: number;
  order: number;
  alignmentConfidence?: number;
};

type UpdatedSentence = Sentence & {
  naturalTranslation: string;
  originalMITTranslation: string;
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
Usage: regenerate-translations.ts [options]

Options:
  --start <n>     Start from sentence index (default: 0)
  --batch <n>     Sentences per AI call (default: 20)
  --dry-run       Process first batch only, don't save
  --help, -h      Show this help message

Output: Updates content/corpus.json in place
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

  return `You are translating Caesar's De Bello Gallico sentence by sentence.

For each Latin sentence, provide TWO translations:
1. literal: Close to Latin word order and structure (for language learners studying grammar)
2. natural: Smooth, idiomatic English (for comprehension)

Guidelines:
- Keep translations concise and accurate
- For literal: preserve Latin word order where possible, show grammatical relationships
- For natural: prioritize readability and clarity
- Use consistent terminology for military/political terms

SENTENCES:
${sentenceList}

Return a JSON array with id, literal, and natural for each sentence.`;
}

const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY_MS = 2000;

async function processBatch(
  ai: GoogleGenAI,
  sentences: Sentence[],
  retryCount = 0
): Promise<TranslationResult> {
  const prompt = constructPrompt(sentences);

  try {
    const responsePromise = ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: translationSchema,
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

    return JSON.parse(text) as TranslationResult;
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount);
      console.log(`  ⏳ Retry ${retryCount + 1}/${MAX_RETRIES} after ${delay}ms...`);
      await sleep(delay);
      return processBatch(ai, sentences, retryCount + 1);
    }
    throw error;
  }
}

async function main() {
  const { start, batchSize, dryRun } = parseArgs();

  // Check API key
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error("Error: GEMINI_API_KEY or GOOGLE_API_KEY not set in .env.local");
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

  // Track translations
  const translationMap = new Map<string, { literal: string; natural: string }>();

  // Load existing progress if resuming
  if (start > 0) {
    // Check if we have partial translations already in corpus
    for (const s of sentences.slice(0, start)) {
      if (s.naturalTranslation && !s.referenceTranslation.startsWith("[SHARED")) {
        translationMap.set(s.id, {
          literal: s.referenceTranslation,
          natural: s.naturalTranslation,
        });
      }
    }
    console.log(`Resuming: ${translationMap.size} sentences already translated`);
  }

  const ai = new GoogleGenAI({ apiKey });
  let processed = 0;
  let errors = 0;

  // Process in batches
  for (let i = start; i < sentences.length; i += batchSize) {
    const batch = sentences.slice(i, i + batchSize);
    const batchIds = batch.map(s => s.id).slice(0, 3).join(", ") + (batch.length > 3 ? "..." : "");

    console.log(`\n[${i}/${sentences.length}] Processing: ${batchIds}`);

    try {
      const result = await processBatch(ai, batch);

      // Store translations
      for (const t of result) {
        translationMap.set(t.id, { literal: t.literal, natural: t.natural });
      }

      processed += batch.length;
      console.log(`  ✓ Translated ${result.length} sentences`);
      console.log(`  Total: ${translationMap.size} translations`);

      // Save progress periodically
      if (!dryRun && processed % 100 === 0) {
        saveCorpus(corpusPath, corpus, sentences, translationMap);
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
      if (!dryRun && translationMap.size > 0) {
        saveCorpus(corpusPath, corpus, sentences, translationMap);
        console.log(`  💾 Progress saved after error`);
      }

      // Continue to next batch
      await sleep(RATE_LIMIT_DELAY_MS * 2);
    }

    if (dryRun) {
      console.log("\n✓ Dry run complete - processed first batch only");
      console.log("\nSample translations:");
      const sample = Array.from(translationMap.entries()).slice(0, 2);
      for (const [id, t] of sample) {
        console.log(`\n${id}:`);
        console.log(`  Literal: ${t.literal}`);
        console.log(`  Natural: ${t.natural}`);
      }
      return;
    }
  }

  // Final save
  saveCorpus(corpusPath, corpus, sentences, translationMap);

  console.log(`\n${"=".repeat(50)}`);
  console.log(`✓ Translation complete!`);
  console.log(`  Sentences processed: ${processed}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Total translations: ${translationMap.size}`);
  console.log(`  Output: ${corpusPath}`);
}

function saveCorpus(
  corpusPath: string,
  corpus: { sentences: Sentence[]; metadata?: unknown },
  sentences: Sentence[],
  translationMap: Map<string, { literal: string; natural: string }>
) {
  const updatedSentences: UpdatedSentence[] = sentences.map(s => {
    const translation = translationMap.get(s.id);
    // Check if sentence already has a translation from a previous run
    const existingSentence = s as UpdatedSentence;
    const hasExistingTranslation = existingSentence.naturalTranslation && existingSentence.naturalTranslation !== "";

    if (translation) {
      return {
        ...s,
        originalMITTranslation: existingSentence.originalMITTranslation || s.referenceTranslation,
        referenceTranslation: translation.literal,
        naturalTranslation: translation.natural,
        alignmentConfidence: 1.0,
      };
    }

    // Preserve existing translation if present
    if (hasExistingTranslation) {
      return {
        ...s,
        originalMITTranslation: existingSentence.originalMITTranslation || s.referenceTranslation,
        naturalTranslation: existingSentence.naturalTranslation,
        alignmentConfidence: existingSentence.alignmentConfidence || 1.0,
      };
    }

    // Not yet translated - keep original but add placeholder
    return {
      ...s,
      originalMITTranslation: existingSentence.originalMITTranslation || s.referenceTranslation,
      naturalTranslation: "",
    };
  });

  const output = {
    ...corpus,
    sentences: updatedSentences,
  };

  fs.writeFileSync(corpusPath, JSON.stringify(output, null, 2));
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
