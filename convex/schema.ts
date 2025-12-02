import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  sentences: defineTable({
    sentenceId: v.string(), // "bg.1.1.1"
    latin: v.string(),
    referenceTranslation: v.string(),
    difficulty: v.number(), // 1-100
    order: v.number(), // Reading sequence
  })
    .index("by_sentence_id", ["sentenceId"])
    .index("by_difficulty", ["difficulty"])
    .index("by_order", ["order"]),
});
