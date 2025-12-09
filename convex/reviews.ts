import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";

const DEFAULT_LIMIT = 10;
// Stability threshold for "mastered" — ~21 days = ~3 weeks retention
const MASTERED_STABILITY_THRESHOLD = 21;

function assertAuthenticated(identity: { subject: string } | null, userId: string) {
  if (!identity) {
    throw new ConvexError("Authentication required");
  }
  if (identity.subject !== userId) {
    throw new ConvexError("Cannot access another user's reviews");
  }
}

export const getOne = query({
  args: {
    userId: v.string(),
    sentenceId: v.string(),
  },
  handler: async (ctx, { userId, sentenceId }) => {
    const identity = await ctx.auth.getUserIdentity();
    assertAuthenticated(identity, userId);

    return ctx.db
      .query("sentenceReviews")
      .withIndex("by_user_sentence", (q) => q.eq("userId", userId).eq("sentenceId", sentenceId))
      .unique();
  },
});

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

    // Batch fetch all sentences in parallel
    const sentencePromises = dueReviews.map((review) =>
      ctx.db
        .query("sentences")
        .withIndex("by_sentence_id", (q) => q.eq("sentenceId", review.sentenceId))
        .first()
    );

    const sentences = await Promise.all(sentencePromises);

    // Build map for efficient lookup
    const sentenceMap = new Map();
    for (const sentence of sentences) {
      if (sentence) {
        sentenceMap.set(sentence.sentenceId, sentence);
      }
    }

    // Build results using the map
    const results = [];
    for (const review of dueReviews) {
      const sentence = sentenceMap.get(review.sentenceId);

      if (!sentence) {
        throw new ConvexError(`Sentence not found: ${review.sentenceId}`);
      }

      results.push({
        id: sentence.sentenceId,
        latin: sentence.latin,
        referenceTranslation: sentence.referenceTranslation,
        reviewCount: review.reps ?? 0,
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

    // Use by_user_due index to efficiently fetch only due reviews
    const dueReviews = await ctx.db
      .query("sentenceReviews")
      .withIndex("by_user_due", (q) => q.eq("userId", userId).lte("nextReviewAt", now))
      .collect();

    const dueCount = dueReviews.length;

    // For total and mastered counts, we still need all reviews
    // Use by_user_sentence index which starts with userId
    const allReviews = await ctx.db
      .query("sentenceReviews")
      .withIndex("by_user_sentence", (q) => q.eq("userId", userId))
      .collect();

    const totalReviewed = allReviews.length;
    const masteredCount = allReviews.filter((r) =>
      r.state === "review" && r.stability >= MASTERED_STABILITY_THRESHOLD
    ).length;

    return { dueCount, totalReviewed, masteredCount };
  },
});

export const record = mutation({
  args: {
    userId: v.string(),
    sentenceId: v.string(),
    // FSRS card state
    state: v.union(
      v.literal("new"),
      v.literal("learning"),
      v.literal("review"),
      v.literal("relearning")
    ),
    stability: v.number(),
    difficulty: v.number(),
    elapsedDays: v.number(),
    scheduledDays: v.number(),
    learningSteps: v.number(),
    reps: v.number(),
    lapses: v.number(),
    lastReview: v.optional(v.number()),
    nextReviewAt: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    assertAuthenticated(identity, args.userId);

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

    const reviewData = {
      state: args.state,
      stability: args.stability,
      difficulty: args.difficulty,
      elapsedDays: args.elapsedDays,
      scheduledDays: args.scheduledDays,
      learningSteps: args.learningSteps,
      reps: args.reps,
      lapses: args.lapses,
      lastReview: args.lastReview,
      nextReviewAt: args.nextReviewAt,
    };

    if (existing) {
      await ctx.db.patch(existing._id, reviewData);
      return;
    }

    await ctx.db.insert("sentenceReviews", {
      userId: args.userId,
      sentenceId: args.sentenceId,
      ...reviewData,
    });
  },
});

export const getSentenceIds = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const identity = await ctx.auth.getUserIdentity();
    assertAuthenticated(identity, userId);

    const reviews = await ctx.db
      .query("sentenceReviews")
      .withIndex("by_user_sentence", (q) => q.eq("userId", userId))
      .collect();

    return reviews.map((r) => r.sentenceId);
  },
});
