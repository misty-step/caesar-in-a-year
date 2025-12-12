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

  // Learning sessions (persisted for cross-request survival)
  sessions: defineTable({
    sessionId: v.string(), // "sess_2025-12-09T20:40:30.677Z_abc123"
    userId: v.string(), // Clerk user ID
    items: v.array(v.any()), // SessionItem[] (polymorphic REVIEW/NEW_READING)
    currentIndex: v.number(),
    status: v.union(v.literal("active"), v.literal("complete")),
    startedAt: v.string(), // ISO timestamp
    completedAt: v.optional(v.string()),
  })
    .index("by_session_id", ["sessionId"])
    .index("by_user", ["userId"]),

  // Per-sentence SRS state (FSRS algorithm)
  sentenceReviews: defineTable({
    userId: v.string(),
    sentenceId: v.string(),

    // FSRS card state
    state: v.union(
      v.literal("new"),
      v.literal("learning"),
      v.literal("review"),
      v.literal("relearning")
    ),
    stability: v.number(), // Days until 90% forgetting
    difficulty: v.number(), // 1-10 scale
    elapsedDays: v.number(), // Days since last review
    scheduledDays: v.number(), // Days until next review
    learningSteps: v.number(), // Current step in learning phase
    reps: v.number(), // Total review count
    lapses: v.number(), // Times forgotten (Again count)
    lastReview: v.optional(v.number()), // Unix ms, optional for new cards

    // Indexed for due queries
    nextReviewAt: v.number(), // Unix ms (from card.due)
  })
    .index("by_user_due", ["userId", "nextReviewAt"])
    .index("by_user_sentence", ["userId", "sentenceId"])
    .index("by_user_state_stability", ["userId", "state", "stability"]),
});
