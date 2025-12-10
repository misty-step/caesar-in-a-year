import { describe, it, expect } from 'vitest';
import {
  generateSessionId,
  isValidSessionId,
  normalizeSessionId,
  parseSessionTimestamp,
} from '../id';

describe('generateSessionId', () => {
  it('generates URL-safe IDs with no special characters', () => {
    const id = generateSessionId();
    expect(id).toMatch(/^sess_\d{13}_[a-z0-9]{6}$/);
    // URL encoding should not change the ID
    expect(encodeURIComponent(id)).toBe(id);
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, generateSessionId));
    expect(ids.size).toBe(100);
  });

  it('starts with sess_ prefix', () => {
    expect(generateSessionId()).toMatch(/^sess_/);
  });

  it('contains 13-digit Unix timestamp', () => {
    const before = Date.now();
    const id = generateSessionId();
    const after = Date.now();

    const match = id.match(/^sess_(\d{13})_/);
    expect(match).toBeTruthy();

    const timestamp = parseInt(match![1], 10);
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });
});

describe('normalizeSessionId', () => {
  it('decodes URL-encoded colons', () => {
    const encoded = 'sess_2025-12-10T13%3A59%3A49.731Z_ukxtb6';
    const decoded = 'sess_2025-12-10T13:59:49.731Z_ukxtb6';
    expect(normalizeSessionId(encoded)).toBe(decoded);
  });

  it('handles double-encoding', () => {
    const doubleEncoded = 'sess_2025-12-10T13%253A59%253A49.731Z_ukxtb6';
    const decoded = 'sess_2025-12-10T13:59:49.731Z_ukxtb6';
    expect(normalizeSessionId(doubleEncoded)).toBe(decoded);
  });

  it('is idempotent on already-decoded IDs', () => {
    const id = 'sess_2025-12-10T13:59:49.731Z_ukxtb6';
    expect(normalizeSessionId(id)).toBe(id);
    expect(normalizeSessionId(normalizeSessionId(id))).toBe(id);
  });

  it('preserves new-format IDs unchanged', () => {
    const id = 'sess_1733912389731_ukxtb6';
    expect(normalizeSessionId(id)).toBe(id);
    expect(encodeURIComponent(normalizeSessionId(id))).toBe(id);
  });

  it('handles malformed URI gracefully', () => {
    // %ZZ is not a valid percent-encoded sequence
    const malformed = 'sess_%ZZinvalid';
    expect(normalizeSessionId(malformed)).toBe(malformed);
  });

  it('handles empty string', () => {
    expect(normalizeSessionId('')).toBe('');
  });
});

describe('isValidSessionId', () => {
  it('accepts new Unix timestamp format', () => {
    expect(isValidSessionId('sess_1733912389731_ukxtb6')).toBe(true);
  });

  it('accepts legacy ISO format', () => {
    expect(isValidSessionId('sess_2025-12-10T13:59:49.731Z_ukxtb6')).toBe(true);
  });

  it('rejects invalid formats', () => {
    expect(isValidSessionId('invalid')).toBe(false);
    expect(isValidSessionId('sess_')).toBe(false);
    expect(isValidSessionId('')).toBe(false);
    expect(isValidSessionId('user_123')).toBe(false);
  });

  it('rejects URL-encoded IDs (should normalize first)', () => {
    // %3A contains % which is not in [\w.:T-]
    expect(isValidSessionId('sess_2025-12-10T13%3A59%3A49.731Z_ukxtb6')).toBe(false);
  });
});

describe('parseSessionTimestamp', () => {
  it('parses Unix timestamp format', () => {
    const id = 'sess_1733912389731_ukxtb6';
    const date = parseSessionTimestamp(id);
    expect(date?.getTime()).toBe(1733912389731);
  });

  it('parses legacy ISO format', () => {
    const id = 'sess_2025-12-10T13:59:49.731Z_ukxtb6';
    const date = parseSessionTimestamp(id);
    expect(date?.toISOString()).toBe('2025-12-10T13:59:49.731Z');
  });

  it('returns null for invalid IDs', () => {
    expect(parseSessionTimestamp('invalid')).toBeNull();
    expect(parseSessionTimestamp('')).toBeNull();
    expect(parseSessionTimestamp('sess_')).toBeNull();
  });

  it('returns null for unparseable dates in legacy format', () => {
    expect(parseSessionTimestamp('sess_not-a-date_ukxtb6')).toBeNull();
  });
});

describe('URL encoding roundtrip', () => {
  it('new IDs survive URL encoding unchanged', () => {
    const id = generateSessionId();
    const urlEncoded = encodeURIComponent(id);
    expect(urlEncoded).toBe(id); // No change needed
    expect(normalizeSessionId(urlEncoded)).toBe(id);
  });

  it('legacy IDs survive URL encoding with normalization', () => {
    const legacy = 'sess_2025-12-10T13:59:49.731Z_ukxtb6';
    const urlEncoded = encodeURIComponent(legacy);
    expect(urlEncoded).not.toBe(legacy); // Contains %3A
    expect(urlEncoded).toContain('%3A');
    expect(normalizeSessionId(urlEncoded)).toBe(legacy);
  });

  it('normalized legacy IDs are valid', () => {
    const encoded = 'sess_2025-12-10T13%3A59%3A49.731Z_ukxtb6';
    const normalized = normalizeSessionId(encoded);
    expect(isValidSessionId(normalized)).toBe(true);
  });
});
