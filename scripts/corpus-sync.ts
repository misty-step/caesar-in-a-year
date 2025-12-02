#!/usr/bin/env npx tsx
/**
 * Corpus Sync Script
 *
 * Syncs corpus.json to Convex database with Zod validation.
 *
 * Usage:
 *   pnpm corpus:sync                    # Sync content/corpus.json
 *   pnpm corpus:sync --file other.json  # Sync specific file
 *   pnpm corpus:sync --dry-run          # Validate without writing
 */

import { ConvexHttpClient } from "convex/browser";
import fs from "fs";
import { z } from "zod";

// Zod schema matching Python output
const SentenceSchema = z.object({
  id: z.string().regex(/^bg\.\d+\.\d+\.\d+$/),
  latin: z.string().min(1),
  referenceTranslation: z.string().min(1),
  difficulty: z.number().int().min(1).max(100),
  order: z.number().int().min(1),
  alignmentConfidence: z.number().min(0).max(1).nullable().optional(),
});

const CorpusSchema = z.object({
  sentences: z.array(SentenceSchema),
  metadata: z
    .object({
      version: z.string(),
      generated_at: z.string(),
      sentence_count: z.number(),
    })
    .optional(),
});

type Sentence = z.infer<typeof SentenceSchema>;

function parseArgs() {
  const args = process.argv.slice(2);
  let file = "content/corpus.json";
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--file" && args[i + 1]) {
      file = args[i + 1];
      i++;
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    } else if (args[i] === "--help" || args[i] === "-h") {
      console.log(`
Usage: corpus-sync.ts [options]

Options:
  --file <path>   Path to corpus.json (default: content/corpus.json)
  --dry-run       Validate without syncing to Convex
  --help, -h      Show this help message
`);
      process.exit(0);
    }
  }

  return { file, dryRun };
}

async function syncCorpus(filePath: string, dryRun: boolean): Promise<void> {
  // 1. Load file
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }

  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch (e) {
    console.error(`Error reading file: ${e}`);
    process.exit(1);
  }

  // 2. Parse JSON
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error(`Error parsing JSON: ${e}`);
    process.exit(1);
  }

  // 3. Validate with Zod
  const result = CorpusSchema.safeParse(data);
  if (!result.success) {
    console.error("Validation failed:");
    console.error(result.error.format());
    process.exit(1);
  }

  const corpus = result.data;
  const sentences = corpus.sentences;

  console.log(`✓ Validated ${sentences.length} sentences`);

  // Show sample
  if (sentences.length > 0) {
    const first = sentences[0];
    console.log(`  First: ${first.id} (difficulty: ${first.difficulty})`);
    const last = sentences[sentences.length - 1];
    console.log(`  Last:  ${last.id} (difficulty: ${last.difficulty})`);
  }

  if (dryRun) {
    console.log("\n✓ Dry run complete - no changes made");
    return;
  }

  // 4. Check for Convex URL
  const convexUrl = process.env.CONVEX_URL;
  if (!convexUrl) {
    console.error("\nError: CONVEX_URL environment variable not set");
    console.error("Run `npx convex dev` to configure Convex deployment");
    process.exit(1);
  }

  // 5. Connect to Convex and sync
  console.log("\nSyncing to Convex...");
  const client = new ConvexHttpClient(convexUrl);

  try {
    // Use string-based mutation call (works without generated types)
    const result = await client.mutation(
      "sentences:replaceAll" as unknown as never,
      {
        sentences: sentences.map((s: Sentence) => ({
          sentenceId: s.id,
          latin: s.latin,
          referenceTranslation: s.referenceTranslation,
          difficulty: s.difficulty,
          order: s.order,
        })),
      }
    );

    console.log(
      `✓ Synced ${(result as { count: number }).count} sentences to Convex`
    );
  } catch (e) {
    console.error(`Error syncing to Convex: ${e}`);
    process.exit(1);
  }
}

// Main
const { file, dryRun } = parseArgs();
syncCorpus(file, dryRun);
