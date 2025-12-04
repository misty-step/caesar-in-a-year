import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  sentences: defineTable({
    sentenceId: v.string(), // "bg.1.1.1"
    latin: v.string(),
    referenceTranslation: v.string(),
    difficulty: v.number(), // 1-100
    order: v.number(), // Reading sequence
    alignmentConfidence: v.optional(v.number()), // 0-1, null for legacy
  })
    .index("by_sentence_id", ["sentenceId"])
    .index("by_difficulty", ["difficulty"])
    .index("by_order", ["order"]),

  // User-level stats (streak, XP, content gating)
  userProgress: defineTable({
    userId: v.string(), // Clerk subject ID
    streak: v.number(), // Consecutive days with activity
    totalXp: v.number(), // Gamification points
    maxDifficulty: v.number(), // Content gating threshold
    lastSessionAt: v.number(), // Unix ms - for streak calculation
  }).index("by_user", ["userId"]),

  // Per-sentence SRS state (simple bucket intervals)
  sentenceReviews: defineTable({
    userId: v.string(),
    sentenceId: v.string(),
    bucket: v.number(), // 0-4 mapping to [1, 3, 7, 14, 30] day intervals
    nextReviewAt: v.number(), // Unix ms - when due
    lastReviewedAt: v.number(), // Unix ms
    timesCorrect: v.number(),
    timesIncorrect: v.number(),
  })
    .index("by_user_due", ["userId", "nextReviewAt"])
    .index("by_user_sentence", ["userId", "sentenceId"]),
});
