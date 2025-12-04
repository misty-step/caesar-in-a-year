import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";

const DEFAULT_LIMIT = 10;
const MASTERED_BUCKET = 4;

function assertAuthenticated(identity: { subject: string } | null, userId: string) {
  if (!identity) {
    throw new ConvexError("Authentication required");
  }
  if (identity.subject !== userId) {
    throw new ConvexError("Cannot access another user's reviews");
  }
}

export const getDue = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { userId, limit }) => {
    const identity = await ctx.auth.getUserIdentity();
    assertAuthenticated(identity, userId);

    const now = Date.now();
    const dueReviews = await ctx.db
      .query("sentenceReviews")
      .withIndex("by_user_due", (q) => q.eq("userId", userId).lte("nextReviewAt", now))
      .take(limit ?? DEFAULT_LIMIT);

    const results = [];

    for (const review of dueReviews) {
      const sentence = await ctx.db
        .query("sentences")
        .withIndex("by_sentence_id", (q) => q.eq("sentenceId", review.sentenceId))
        .first();

      if (!sentence) {
        throw new ConvexError(`Sentence not found: ${review.sentenceId}`);
      }

      results.push({
        id: sentence.sentenceId,
        latin: sentence.latin,
        referenceTranslation: sentence.referenceTranslation,
        reviewCount: review.timesCorrect + review.timesIncorrect,
      });
    }

    return results;
  },
});

export const getStats = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const identity = await ctx.auth.getUserIdentity();
    assertAuthenticated(identity, userId);

    const now = Date.now();

    const reviews = await ctx.db
      .query("sentenceReviews")
      .withIndex("by_user_sentence", (q) => q.eq("userId", userId))
      .collect();

    const totalReviewed = reviews.length;
    const dueCount = reviews.filter((r) => r.nextReviewAt <= now).length;
    const masteredCount = reviews.filter((r) => r.bucket >= MASTERED_BUCKET).length;

    return { dueCount, totalReviewed, masteredCount };
  },
});

export const record = mutation({
  args: {
    userId: v.string(),
    sentenceId: v.string(),
    bucket: v.number(),
    nextReviewAt: v.number(),
    lastReviewedAt: v.number(),
    timesCorrect: v.number(),
    timesIncorrect: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    assertAuthenticated(identity, args.userId);

    if (args.bucket < 0 || args.bucket > MASTERED_BUCKET) {
      throw new ConvexError("Bucket must be between 0 and 4");
    }

    const sentence = await ctx.db
      .query("sentences")
      .withIndex("by_sentence_id", (q) => q.eq("sentenceId", args.sentenceId))
      .first();

    if (!sentence) {
      throw new ConvexError(`Sentence not found: ${args.sentenceId}`);
    }

    const existing = await ctx.db
      .query("sentenceReviews")
      .withIndex("by_user_sentence", (q) =>
        q.eq("userId", args.userId).eq("sentenceId", args.sentenceId)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        bucket: args.bucket,
        nextReviewAt: args.nextReviewAt,
        lastReviewedAt: args.lastReviewedAt,
        timesCorrect: args.timesCorrect,
        timesIncorrect: args.timesIncorrect,
      });
      return;
    }

    await ctx.db.insert("sentenceReviews", {
      userId: args.userId,
      sentenceId: args.sentenceId,
      bucket: args.bucket,
      nextReviewAt: args.nextReviewAt,
      lastReviewedAt: args.lastReviewedAt,
      timesCorrect: args.timesCorrect,
      timesIncorrect: args.timesIncorrect,
    });
  },
});
