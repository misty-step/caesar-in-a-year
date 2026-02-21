import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

vi.mock('@clerk/nextjs/server', () => ({
  auth: () => ({ userId: null }),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

describe('HomePage (landing page)', () => {
  it('renders testimonials for social proof', async () => {
    const { default: HomePage } = await import('@/app/page');
    const tree = await HomePage();
    const html = renderToString(tree as React.ReactElement);

    // Social proof: at least one testimonial quote must be present
    expect(html).toContain('testimonial');
  });

  it('renders a credibility signal', async () => {
    const { default: HomePage } = await import('@/app/page');
    const tree = await HomePage();
    const html = renderToString(tree as React.ReactElement);

    // Credibility: attribution, affiliation, or "built by" signal
    expect(html).toContain('Latin');
  });
});
