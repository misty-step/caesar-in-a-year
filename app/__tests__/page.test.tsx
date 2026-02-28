import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

const mockRedirect = vi.fn();

vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => {
    mockRedirect(...args);
    throw new Error('NEXT_REDIRECT');
  },
}));

// Default: unauthenticated visitor
const mockAuth = vi.fn().mockResolvedValue({ userId: null });

vi.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
}));

describe('HomePage (landing page)', () => {
  it('renders testimonial section for unauthenticated visitors', async () => {
    mockAuth.mockResolvedValueOnce({ userId: null });

    const { default: HomePage } = await import('@/app/page');
    const tree = await HomePage();
    const html = renderToString(tree as React.ReactElement);

    expect(html).toContain('Early Readers');
    expect(html).toContain('Sarah M.');
    expect(html).toContain('Beta tester, 90-day streak');
    expect(html).toContain('classics enthusiast');
  });

  it('renders core landing page sections', async () => {
    mockAuth.mockResolvedValueOnce({ userId: null });

    const { default: HomePage } = await import('@/app/page');
    const tree = await HomePage();
    const html = renderToString(tree as React.ReactElement);

    expect(html).toContain('Read Caesar');
    expect(html).toContain('The Method');
    expect(html).toContain('Start reading');
  });

  it('routes CTA buttons to /sign-up, not /sign-in', async () => {
    mockAuth.mockResolvedValueOnce({ userId: null });

    const { default: HomePage } = await import('@/app/page');
    const tree = await HomePage();
    const html = renderToString(tree as React.ReactElement);

    // Both CTAs ("Start reading" and "Start for free") should link to sign-up
    const signUpMatches = html.match(/href="\/sign-up"/g);
    expect(signUpMatches?.length).toBeGreaterThanOrEqual(2);

    // Nav "Sign in" should still link to /sign-in
    expect(html).toContain('href="/sign-in"');
    expect(html).toContain('Sign in');
  });

  it('does not nest <button> inside <a> (invalid HTML)', async () => {
    mockAuth.mockResolvedValueOnce({ userId: null });

    const { default: HomePage } = await import('@/app/page');
    const tree = await HomePage();
    const html = renderToString(tree as React.ReactElement);

    // CTA links should not contain nested <button> elements
    const linkButtonPattern = /<a[^>]*href="\/sign-up"[^>]*>[\s\S]*?<button/g;
    expect(html.match(linkButtonPattern)).toBeNull();
  });

  it('redirects authenticated users to dashboard', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user-1' });

    const { default: HomePage } = await import('@/app/page');
    await expect(HomePage()).rejects.toThrow('NEXT_REDIRECT');
    expect(mockRedirect).toHaveBeenCalledWith('/dashboard');
  });
});
