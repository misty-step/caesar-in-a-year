import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import type { MutationCtx } from "./_generated/server";

// Sentence schema for validation
const sentenceArg = v.object({
  sentenceId: v.string(),
  latin: v.string(),
  referenceTranslation: v.string(),
  difficulty: v.number(),
  order: v.number(),
  alignmentConfidence: v.optional(v.number()),
});

type SentenceInput = {
  sentenceId: string;
  latin: string;
  referenceTranslation: string;
  difficulty: number;
  order: number;
  alignmentConfidence?: number;
};

export const replaceAll = mutation({
  args: {
    sentences: v.array(sentenceArg),
  },
  handler: async (ctx, args) => {
    // Require authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    // Check for admin role (via Clerk public metadata or custom claim)
    // For now, restrict to specific email domain as admin check
    // TODO: Replace with proper role-based check when Clerk roles are configured
    const isAdmin = identity.email?.endsWith("@mistystep.io") ?? false;
    if (!isAdmin) {
      throw new ConvexError("Admin access required");
    }

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
      .withIndex("by_difficulty", (q) => q.lte("difficulty", args.maxDifficulty))
      .collect();
  },
});

export const getAll = query({
  handler: async (ctx) => {
    return ctx.db.query("sentences").withIndex("by_order").collect();
  },
});

// Internal mutation for admin scripts (no auth required, callable via deploy key)
export const syncCorpusInternal = internalMutation({
  args: {
    sentences: v.array(sentenceArg),
  },
  handler: async (ctx, args) => {
    return syncCorpusHandler(ctx, args.sentences);
  },
});

// Public mutation with auth (for authenticated admin users)
// In dev mode, also accepts ADMIN_KEY for scripts
export const syncCorpus = mutation({
  args: {
    sentences: v.array(sentenceArg),
    adminKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check for admin key first (for scripts)
    const validAdminKey = process.env.CORPUS_ADMIN_KEY;
    if (args.adminKey && validAdminKey && args.adminKey === validAdminKey) {
      return syncCorpusHandler(ctx, args.sentences);
    }

    // Require authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    // Admin check (same pattern as replaceAll)
    const isAdmin = identity.email?.endsWith("@mistystep.io") ?? false;
    if (!isAdmin) {
      throw new ConvexError("Admin access required");
    }

    return syncCorpusHandler(ctx, args.sentences);
  },
});

// Shared handler for sync logic
async function syncCorpusHandler(ctx: MutationCtx, sentences: SentenceInput[]) {
  // 1. Build incoming ID set
  const incomingIds = new Set(sentences.map((s) => s.sentenceId));

  // 2. Check for orphaned reviews BEFORE any changes
  const allReviews = await ctx.db.query("sentenceReviews").collect();
  const orphaned = allReviews.filter((r) => !incomingIds.has(r.sentenceId));

  if (orphaned.length > 0) {
    const affectedUsers = new Set(orphaned.map((r) => r.userId));
    const sampleIds = orphaned.slice(0, 5).map((r) => r.sentenceId);
    throw new ConvexError(
      `Would orphan ${orphaned.length} reviews for ${affectedUsers.size} users. ` +
        `Sentence IDs: ${sampleIds.join(", ")}${orphaned.length > 5 ? "..." : ""}`
    );
  }

  // 3. Fetch ALL existing sentences once (instead of per-sentence queries)
  const existingSentences = await ctx.db.query("sentences").collect();
  const existingBySentenceId = new Map(
    existingSentences.map((doc) => [doc.sentenceId, doc])
  );

  // 4. Upsert each sentence using the pre-fetched map
  let updated = 0;
  let inserted = 0;

  for (const sentence of sentences) {
    const existing = existingBySentenceId.get(sentence.sentenceId);

    if (existing) {
      await ctx.db.patch(existing._id, {
        latin: sentence.latin,
        referenceTranslation: sentence.referenceTranslation,
        difficulty: sentence.difficulty,
        order: sentence.order,
        alignmentConfidence: sentence.alignmentConfidence,
      });
      updated++;
    } else {
      await ctx.db.insert("sentences", sentence);
      inserted++;
    }
  }

  // 5. Delete stale sentences (not in incoming - already verified no reviews)
  let deleted = 0;

  for (const doc of existingSentences) {
    if (!incomingIds.has(doc.sentenceId)) {
      await ctx.db.delete(doc._id);
      deleted++;
    }
  }

  return { synced: sentences.length, updated, inserted, deleted };
}
