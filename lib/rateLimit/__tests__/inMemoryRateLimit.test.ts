import { describe, it, expect, beforeEach } from 'vitest';
import { consumeAiCall, _resetForTesting } from '../inMemoryRateLimit';

describe('inMemoryRateLimit', () => {
  beforeEach(() => {
    _resetForTesting();
  });

  it('allows first call and returns correct remaining count', () => {
    const result = consumeAiCall('user1', 1000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(99);
  });

  it('allows up to 100 calls', () => {
    const baseTime = 1000;
    for (let i = 0; i < 100; i++) {
      const result = consumeAiCall('user1', baseTime);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(99 - i);
    }
  });

  it('denies 101st call within window', () => {
    const baseTime = 1000;
    // Consume 100 calls
    for (let i = 0; i < 100; i++) {
      consumeAiCall('user1', baseTime);
    }
    // 101st should be denied
    const result = consumeAiCall('user1', baseTime);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('resets after 60 minutes', () => {
    const baseTime = 1000;
    // Consume 100 calls
    for (let i = 0; i < 100; i++) {
      consumeAiCall('user1', baseTime);
    }
    // 60 minutes later
    const laterTime = baseTime + 60 * 60 * 1000;
    const result = consumeAiCall('user1', laterTime);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(99);
  });

  it('tracks users independently', () => {
    const baseTime = 1000;
    // User1 consumes 100
    for (let i = 0; i < 100; i++) {
      consumeAiCall('user1', baseTime);
    }
    // User2 should still have quota
    const result = consumeAiCall('user2', baseTime);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(99);
  });

  it('returns correct resetAtMs', () => {
    const baseTime = 1000;
    const result = consumeAiCall('user1', baseTime);
    expect(result.resetAtMs).toBe(baseTime + 60 * 60 * 1000);
  });
});
