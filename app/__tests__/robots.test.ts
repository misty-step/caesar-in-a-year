import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import robots from '@/app/robots';

describe('robots()', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('disallows all auth-gated and low-value routes', () => {
    const result = robots();
    const disallow = (result.rules as { disallow: string[] }).disallow;

    expect(disallow).toContain('/dashboard');
    expect(disallow).toContain('/session');
    expect(disallow).toContain('/summary');
    expect(disallow).toContain('/api');
    expect(disallow).toContain('/subscribe');
    expect(disallow).toContain('/settings');
    expect(disallow).toContain('/sign-in');
    expect(disallow).toContain('/sign-up');
  });

  it('allows the landing page', () => {
    const result = robots();
    const allow = (result.rules as { allow: string }).allow;

    expect(allow).toBe('/');
  });

  it('references sitemap using NEXT_PUBLIC_APP_URL', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';

    const result = robots();

    expect(result.sitemap).toBe('https://example.com/sitemap.xml');
  });

  it('falls back to localhost when NEXT_PUBLIC_APP_URL is unset', () => {
    delete process.env.NEXT_PUBLIC_APP_URL;

    const result = robots();

    expect(result.sitemap).toBe('http://localhost:3000/sitemap.xml');
  });
});
