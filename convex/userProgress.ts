import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";

export const get = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
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
