import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";

export const get = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    if (identity.subject !== userId) {
      throw new ConvexError("Cannot access another user's progress");
    }

    return ctx.db
      .query("userProgress")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
  },
});

export const upsert = mutation({
  args: {
    userId: v.string(),
    streak: v.number(),
    totalXp: v.number(),
    maxDifficulty: v.number(),
    lastSessionAt: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    if (identity.subject !== args.userId) {
      throw new ConvexError("Cannot modify another user's progress");
    }

    const existing = await ctx.db
      .query("userProgress")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        streak: args.streak,
        totalXp: args.totalXp,
        maxDifficulty: args.maxDifficulty,
        lastSessionAt: args.lastSessionAt,
      });
      return;
    }

    await ctx.db.insert("userProgress", {
      userId: args.userId,
      streak: args.streak,
      totalXp: args.totalXp,
      maxDifficulty: args.maxDifficulty,
      lastSessionAt: args.lastSessionAt,
    });
  },
});

const DEFAULT_START_DIFFICULTY = 10;
const MAX_DIFFICULTY = 100;

export const incrementDifficulty = mutation({
  args: {
    userId: v.string(),
    increment: v.optional(v.number()),
  },
  handler: async (ctx, { userId, increment = 5 }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    if (identity.subject !== userId) {
      throw new ConvexError("Cannot modify another user's progress");
    }

    const existing = await ctx.db
      .query("userProgress")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      const newDifficulty = Math.min(existing.maxDifficulty + increment, MAX_DIFFICULTY);
      await ctx.db.patch(existing._id, { maxDifficulty: newDifficulty });
      return { maxDifficulty: newDifficulty };
    }

    // Create progress with default + increment
    const newDifficulty = Math.min(DEFAULT_START_DIFFICULTY + increment, MAX_DIFFICULTY);
    await ctx.db.insert("userProgress", {
      userId,
      streak: 0,
      totalXp: 0,
      maxDifficulty: newDifficulty,
      lastSessionAt: Date.now(),
    });

    return { maxDifficulty: newDifficulty };
  },
});
