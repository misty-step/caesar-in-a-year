import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { hasAccess } from "./billing";

function assertAuthenticated(identity: { subject: string } | null, userId: string) {
  if (!identity) {
    throw new ConvexError("Authentication required");
  }
  if (identity.subject !== userId) {
    throw new ConvexError("Cannot access another user's sessions");
  }
}

// Error codes for session lookup failures
export type SessionError = 'AUTH_REQUIRED' | 'USER_MISMATCH' | 'NOT_FOUND' | 'OWNERSHIP_MISMATCH';

export const get = query({
  args: {
    sessionId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, { sessionId, userId }) => {
    const identity = await ctx.auth.getUserIdentity();

    // Return explicit error states for observability
    if (!identity) {
      return { error: 'AUTH_REQUIRED' as SessionError, session: null };
    }
    if (identity.subject !== userId) {
      return { error: 'USER_MISMATCH' as SessionError, session: null };
    }

    const session = await ctx.db
      .query("sessions")
      .withIndex("by_session_id", (q) => q.eq("sessionId", sessionId))
      .first();

    if (!session) {
      return { error: 'NOT_FOUND' as SessionError, session: null };
    }
    if (session.userId !== userId) {
      return { error: 'OWNERSHIP_MISMATCH' as SessionError, session: null };
    }

    return { error: null, session };
  },
});

export const create = mutation({
  args: {
    sessionId: v.string(),
    userId: v.string(),
    items: v.array(v.any()),
    currentIndex: v.number(),
    status: v.union(v.literal("active"), v.literal("complete")),
    startedAt: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    assertAuthenticated(identity, args.userId);

    // Security gate: check subscription/trial status before creating session
    const userProgress = await ctx.db
      .query("userProgress")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (userProgress && !hasAccess(userProgress)) {
      throw new ConvexError("SUBSCRIPTION_REQUIRED");
    }

    await ctx.db.insert("sessions", args);
  },
});

export const advance = mutation({
  args: {
    sessionId: v.string(),
    userId: v.string(),
    currentIndex: v.number(),
    status: v.union(v.literal("active"), v.literal("complete")),
    completedAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    assertAuthenticated(identity, args.userId);

    const session = await ctx.db
      .query("sessions")
      .withIndex("by_session_id", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (!session || session.userId !== args.userId) {
      throw new ConvexError("Session not found");
    }

    await ctx.db.patch(session._id, {
      currentIndex: args.currentIndex,
      status: args.status,
      completedAt: args.completedAt,
    });
  },
});
