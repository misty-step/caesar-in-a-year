import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";

/**
 * Create a new vocabulary card (generated from repeated errors).
 * Card starts in 'new' state with immediate due date.
 */
export const create = mutation({
  args: {
    userId: v.string(),
    latinWord: v.string(),
    meaning: v.string(),
    questionType: v.string(),
    question: v.string(),
    answer: v.string(),
    sourceSentenceId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    if (identity.subject !== args.userId) {
      throw new ConvexError("Cannot create vocab card for another user");
    }

    // Check if this exact word already exists for this user
    const existing = await ctx.db
      .query("vocabCards")
      .withIndex("by_user_word", (q) =>
        q.eq("userId", args.userId).eq("latinWord", args.latinWord)
      )
      .first();

    if (existing) {
      // Don't duplicate - just return existing card ID
      return { cardId: existing._id, isNew: false };
    }

    // Create new card with FSRS initial state
    const cardId = await ctx.db.insert("vocabCards", {
      userId: args.userId,
      latinWord: args.latinWord,
      meaning: args.meaning,
      questionType: args.questionType,
      question: args.question,
      answer: args.answer,
      sourceSentenceId: args.sourceSentenceId,

      // FSRS initial state (same as sentenceReviews)
      state: "new",
      stability: 0,
      difficulty: 0,
      elapsedDays: 0,
      scheduledDays: 0,
      learningSteps: 0,
      reps: 0,
      lapses: 0,
      nextReviewAt: Date.now(), // Immediately due
    });

    return { cardId, isNew: true };
  },
});

/**
 * Get due vocabulary cards for a user.
 */
export const getDue = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { userId, limit = 10 }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    if (identity.subject !== userId) {
      throw new ConvexError("Cannot access another user's vocab cards");
    }

    const now = Date.now();
    const cards = await ctx.db
      .query("vocabCards")
      .withIndex("by_user_due", (q) => q.eq("userId", userId).lte("nextReviewAt", now))
      .take(limit);

    return cards.map(c => ({
      id: c._id,
      latinWord: c.latinWord,
      meaning: c.meaning,
      questionType: c.questionType,
      question: c.question,
      answer: c.answer,
      sourceSentenceId: c.sourceSentenceId,
    }));
  },
});

/**
 * Record a vocab card review and update FSRS state.
 */
export const recordReview = mutation({
  args: {
    userId: v.string(),
    cardId: v.id("vocabCards"),
    gradingStatus: v.string(), // CORRECT | PARTIAL | INCORRECT

    // FSRS card state after scheduling
    state: v.string(),
    stability: v.number(),
    difficulty: v.number(),
    elapsedDays: v.number(),
    scheduledDays: v.number(),
    learningSteps: v.number(),
    reps: v.number(),
    lapses: v.number(),
    nextReviewAt: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    if (identity.subject !== args.userId) {
      throw new ConvexError("Cannot update another user's vocab card");
    }

    const card = await ctx.db.get(args.cardId);
    if (!card || card.userId !== args.userId) {
      throw new ConvexError("Vocab card not found");
    }

    await ctx.db.patch(args.cardId, {
      state: args.state as "new" | "learning" | "review" | "relearning",
      stability: args.stability,
      difficulty: args.difficulty,
      elapsedDays: args.elapsedDays,
      scheduledDays: args.scheduledDays,
      learningSteps: args.learningSteps,
      reps: args.reps,
      lapses: args.lapses,
      lastReview: Date.now(),
      nextReviewAt: args.nextReviewAt,
    });
  },
});

/**
 * Get a single vocab card by ID.
 */
export const get = query({
  args: {
    userId: v.string(),
    cardId: v.id("vocabCards"),
  },
  handler: async (ctx, { userId, cardId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    if (identity.subject !== userId) {
      throw new ConvexError("Cannot access another user's vocab card");
    }

    const card = await ctx.db.get(cardId);
    if (!card || card.userId !== userId) {
      return null;
    }

    return {
      id: card._id,
      latinWord: card.latinWord,
      meaning: card.meaning,
      questionType: card.questionType,
      question: card.question,
      answer: card.answer,
      sourceSentenceId: card.sourceSentenceId,
      // Include FSRS state for scheduling
      state: card.state,
      stability: card.stability,
      difficulty: card.difficulty,
      elapsedDays: card.elapsedDays,
      scheduledDays: card.scheduledDays,
      learningSteps: card.learningSteps,
      reps: card.reps,
      lapses: card.lapses,
      nextReviewAt: card.nextReviewAt,
    };
  },
});
