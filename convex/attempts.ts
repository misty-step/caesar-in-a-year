import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";

/**
 * Record a grading attempt for history tracking.
 * Called after each translation/gist grading.
 */
export const record = mutation({
  args: {
    userId: v.string(),
    sentenceId: v.string(),
    sessionId: v.string(),
    userInput: v.string(),
    gradingStatus: v.string(), // CORRECT | PARTIAL | INCORRECT
    errorTypes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    if (identity.subject !== args.userId) {
      throw new ConvexError("Cannot record attempt for another user");
    }

    await ctx.db.insert("attempts", {
      userId: args.userId,
      sentenceId: args.sentenceId,
      sessionId: args.sessionId,
      userInput: args.userInput,
      gradingStatus: args.gradingStatus,
      errorTypes: args.errorTypes,
      createdAt: Date.now(),
    });
  },
});

/**
 * Get attempt history for a specific sentence.
 * Used for history-aware AI grading and UI display.
 */
export const getHistory = query({
  args: {
    userId: v.string(),
    sentenceId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { userId, sentenceId, limit = 10 }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    if (identity.subject !== userId) {
      throw new ConvexError("Cannot access another user's history");
    }

    const attempts = await ctx.db
      .query("attempts")
      .withIndex("by_user_sentence", (q) =>
        q.eq("userId", userId).eq("sentenceId", sentenceId)
      )
      .order("desc") // Most recent first
      .take(limit);

    return attempts;
  },
});

/**
 * Get total attempt count for a sentence (for "Attempt X" display).
 */
export const getCount = query({
  args: {
    userId: v.string(),
    sentenceId: v.string(),
  },
  handler: async (ctx, { userId, sentenceId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    if (identity.subject !== userId) {
      throw new ConvexError("Cannot access another user's history");
    }

    const attempts = await ctx.db
      .query("attempts")
      .withIndex("by_user_sentence", (q) =>
        q.eq("userId", userId).eq("sentenceId", sentenceId)
      )
      .collect();

    return attempts.length;
  },
});
