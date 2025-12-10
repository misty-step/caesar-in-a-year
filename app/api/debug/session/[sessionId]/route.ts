import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { fetchQuery } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';
import { normalizeSessionId } from '@/lib/session/id';

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

/**
 * Debug endpoint for session state inspection.
 * Only available in development mode.
 *
 * GET /api/debug/session/[sessionId]
 */
export async function GET(_req: Request, { params }: RouteParams) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
  }

  const { sessionId: rawSessionId } = await params;
  const sessionId = normalizeSessionId(rawSessionId);
  const { userId, getToken } = await auth();
  const token = await getToken({ template: 'convex' });

  const debugInfo: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    sessionId,
    userId: userId ? userId.slice(0, 8) + '...' : null,
    tokenPresent: !!token,
    adapterType: token ? 'convex' : 'memory',
  };

  // If we have auth, try to fetch the session
  if (token && userId) {
    try {
      const result = await fetchQuery(
        api.sessions.get,
        { sessionId, userId },
        { token }
      );
      debugInfo.convexResult = {
        error: result.error,
        sessionFound: !!result.session,
        sessionStatus: result.session?.status,
        sessionCurrentIndex: result.session?.currentIndex,
        sessionItemCount: result.session?.items?.length,
      };
    } catch (error) {
      debugInfo.convexError = error instanceof Error ? error.message : String(error);
    }
  }

  return NextResponse.json(debugInfo, { status: 200 });
}
