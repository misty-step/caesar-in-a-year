import { mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";

export const deleteAllData = mutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }
    if (identity.subject !== userId) {
      throw new ConvexError("Can only delete your own data");
    }

    // Delete sentenceReviews for this user
    const reviews = await ctx.db
      .query("sentenceReviews")
      .withIndex("by_user_sentence", (q) => q.eq("userId", userId))
      .collect();

    await Promise.all(reviews.map((review) => ctx.db.delete(review._id)));

    // Delete userProgress (if exists)
    const progress = await ctx.db
      .query("userProgress")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (progress) {
      await ctx.db.delete(progress._id);
    }

    return {
      deleted: {
        reviews: reviews.length,
        progress: Boolean(progress),
      },
    };
  },
});
