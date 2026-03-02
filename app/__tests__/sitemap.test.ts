import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import sitemap from '@/app/sitemap';

describe('sitemap()', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('includes the landing page and pSEO pages', () => {
    const result = sitemap();

    // Landing + /latin index + chapters + vocab + phrases
    expect(result.length).toBeGreaterThan(100);
    expect(result[0]).toMatchObject({
      changeFrequency: 'monthly',
      priority: 1,
    });
    // /latin index page
    expect(result[1]).toMatchObject({
      changeFrequency: 'weekly',
      priority: 0.9,
    });
  });

  it('uses NEXT_PUBLIC_APP_URL for the URL', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';

    const result = sitemap();

    expect(result[0].url).toBe('https://example.com');
  });

  it('falls back to localhost when NEXT_PUBLIC_APP_URL is unset', () => {
    delete process.env.NEXT_PUBLIC_APP_URL;

    const result = sitemap();

    expect(result[0].url).toBe('http://localhost:3000');
  });
});
