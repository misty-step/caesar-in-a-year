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
    const isAdmin = identity.email?.endsWith("@mistystep.com") ?? false;
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
