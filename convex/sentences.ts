import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

export const replaceAll = mutation({
  args: {
    sentences: v.array(
      v.object({
        sentenceId: v.string(),
        latin: v.string(),
        referenceTranslation: v.string(),
        difficulty: v.number(),
        order: v.number(),
        alignmentConfidence: v.optional(v.number()),
      })
    ),
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

export const syncCorpus = mutation({
  args: {
    sentences: v.array(
      v.object({
        sentenceId: v.string(),
        latin: v.string(),
        referenceTranslation: v.string(),
        difficulty: v.number(),
        order: v.number(),
        alignmentConfidence: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
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

    // 1. Build incoming ID set
    const incomingIds = new Set(args.sentences.map((s) => s.sentenceId));

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

    // 3. Upsert each sentence (patch existing, insert new)
    let updated = 0;
    let inserted = 0;

    for (const sentence of args.sentences) {
      const existing = await ctx.db
        .query("sentences")
        .withIndex("by_sentence_id", (q) =>
          q.eq("sentenceId", sentence.sentenceId)
        )
        .unique();

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

    // 4. Delete stale sentences (not in incoming - already verified no reviews)
    const existingSentences = await ctx.db.query("sentences").collect();
    let deleted = 0;

    for (const doc of existingSentences) {
      if (!incomingIds.has(doc.sentenceId)) {
        await ctx.db.delete(doc._id);
        deleted++;
      }
    }

    return { synced: args.sentences.length, updated, inserted, deleted };
  },
});
