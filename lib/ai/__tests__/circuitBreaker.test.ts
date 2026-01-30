import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('server-only', () => ({}));

describe('CircuitBreaker', () => {
  let CircuitBreaker: typeof import('@/lib/ai/circuitBreaker').CircuitBreaker;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));
  });

  beforeEach(async () => {
    const circuitModule = await import('@/lib/ai/circuitBreaker');
    CircuitBreaker = circuitModule.CircuitBreaker;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts closed', () => {
    const breaker = new CircuitBreaker({ name: 'test' });
    expect(breaker.isOpen()).toBe(false);
  });

  it('opens after threshold failures', () => {
    const breaker = new CircuitBreaker({ name: 'test', threshold: 2 });
    breaker.recordFailure();
    expect(breaker.isOpen()).toBe(false);
    breaker.recordFailure();
    expect(breaker.isOpen()).toBe(true);
  });

  it('auto-resets after resetMs', () => {
    const breaker = new CircuitBreaker({ name: 'test', threshold: 2, resetMs: 1000 });
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.isOpen()).toBe(true);
    vi.setSystemTime(new Date(1001));
    expect(breaker.isOpen()).toBe(false);
  });

  it('recordSuccess resets failure count', () => {
    const breaker = new CircuitBreaker({ name: 'test', threshold: 2 });
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.isOpen()).toBe(true);
    breaker.recordSuccess();
    expect(breaker.isOpen()).toBe(false);
  });

  it('keeps instances independent', () => {
    const one = new CircuitBreaker({ name: 'one', threshold: 1 });
    const two = new CircuitBreaker({ name: 'two', threshold: 1 });
    one.recordFailure();
    expect(one.isOpen()).toBe(true);
    expect(two.isOpen()).toBe(false);
  });
});
