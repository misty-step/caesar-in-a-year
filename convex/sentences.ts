import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const replaceAll = mutation({
  args: {
    sentences: v.array(
      v.object({
        sentenceId: v.string(),
        latin: v.string(),
        referenceTranslation: v.string(),
        difficulty: v.number(),
        order: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
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
