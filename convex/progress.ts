import { query } from "./_generated/server";
import { v, ConvexError } from "convex/values";

// === Stability Tier Thresholds (days) ===
const TIER = {
  TIRO: 0,      // < 1 day
  MILES: 1,     // 1-7 days
  VETERANUS: 7, // 7-21 days
  DECURIO: 21,  // 21+ days (true mastery)
} as const;

// === XP Level Curve ===
// Level n requires 100 * 1.5^(n-1) cumulative XP
function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

function levelFromXp(totalXp: number): { level: number; currentLevelXp: number; toNextLevel: number } {
  let level = 1;
  let xpAccum = 0;

  while (true) {
    const needed = xpForLevel(level);
    if (xpAccum + needed > totalXp) {
      return {
        level,
        currentLevelXp: totalXp - xpAccum,
        toNextLevel: needed - (totalXp - xpAccum),
      };
    }
    xpAccum += needed;
    level++;
    if (level > 100) break; // Safety cap
  }

  return { level: 100, currentLevelXp: 0, toNextLevel: 0 };
}

// === Date Helpers ===
function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function getDateRange(daysBack: number): string[] {
  const dates: string[] = [];
  const now = Date.now();
  for (let i = daysBack - 1; i >= 0; i--) {
    dates.push(formatDate(now - i * 24 * 60 * 60 * 1000));
  }
  return dates;
}

/**
 * Deep module: Returns ALL progress metrics in one query.
 * UI components just render slices, no calculation needed.
 */
export const getMetrics = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }
    if (identity.subject !== userId) {
      throw new ConvexError("Cannot access another user's progress");
    }

    // Parallel queries for efficiency
    const [userProgress, allReviews, totalSentences, sessions] = await Promise.all([
      ctx.db.query("userProgress").withIndex("by_user", (q) => q.eq("userId", userId)).first(),
      ctx.db.query("sentenceReviews").withIndex("by_user_sentence", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("sentences").collect().then((s) => s.length),
      ctx.db.query("sessions").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    ]);

    // === Legion Tiers (stability-based) ===
    const legion = { tirones: 0, milites: 0, veterani: 0, decuriones: 0 };
    for (const review of allReviews) {
      const stability = review.stability ?? 0;
      if (stability >= TIER.DECURIO) {
        legion.decuriones++;
      } else if (stability >= TIER.VETERANUS) {
        legion.veterani++;
      } else if (stability >= TIER.MILES) {
        legion.milites++;
      } else {
        legion.tirones++;
      }
    }

    // === Journey Progress (sentences encountered) ===
    const sentencesEncountered = allReviews.length;
    const percentComplete = totalSentences > 0
      ? Math.round((sentencesEncountered / totalSentences) * 1000) / 10
      : 0;

    // === Activity Heatmap (last 84 days = 12 weeks) ===
    const HEATMAP_DAYS = 84;
    const dateRange = getDateRange(HEATMAP_DAYS);
    const activityMap = new Map<string, number>();

    // Initialize all dates to 0
    for (const date of dateRange) {
      activityMap.set(date, 0);
    }

    // Count reviews per day from lastReview timestamps
    for (const review of allReviews) {
      if (review.lastReview) {
        const date = formatDate(review.lastReview);
        if (activityMap.has(date)) {
          activityMap.set(date, (activityMap.get(date) ?? 0) + 1);
        }
      }
    }

    // Also count session completions
    for (const session of sessions) {
      if (session.completedAt) {
        const date = formatDate(new Date(session.completedAt).getTime());
        if (activityMap.has(date)) {
          activityMap.set(date, (activityMap.get(date) ?? 0) + session.items.length);
        }
      }
    }

    const activity = dateRange.map((date) => ({
      date,
      count: activityMap.get(date) ?? 0,
    }));

    // === XP & Level ===
    const totalXp = userProgress?.totalXp ?? 0;
    const xpData = levelFromXp(totalXp);

    // === Streak ===
    const streak = userProgress?.streak ?? 0;

    return {
      legion,
      iter: {
        sentencesEncountered,
        totalSentences,
        percentComplete,
      },
      activity,
      xp: {
        total: totalXp,
        ...xpData,
      },
      streak,
    };
  },
});
