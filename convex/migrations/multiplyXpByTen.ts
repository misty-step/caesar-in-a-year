import { internalMutation } from '../_generated/server';

/**
 * One-time migration to fix XP values.
 *
 * Previously XP was persisted at 1 per item but displayed at 10 per item.
 * This multiplies all existing totalXp by 10 to match the intended scale.
 *
 * Run via: npx convex run migrations/multiplyXpByTen:run
 */
export const run = internalMutation({
  handler: async (ctx) => {
    const allProgress = await ctx.db.query('userProgress').collect();

    let updated = 0;
    for (const progress of allProgress) {
      if (progress.totalXp && progress.totalXp > 0) {
        await ctx.db.patch(progress._id, {
          totalXp: progress.totalXp * 10,
        });
        updated++;
      }
    }

    return { updated, total: allProgress.length };
  },
});
