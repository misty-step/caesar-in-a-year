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

  it('includes the landing page with correct metadata', () => {
    const result = sitemap();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      changeFrequency: 'monthly',
      priority: 1,
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

  it('does not include lastModified', () => {
    const result = sitemap();

    expect(result[0]).not.toHaveProperty('lastModified');
  });
});
