import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getBrowserTimezoneOffsetMinutes } from '../TimezoneSync';

describe('getBrowserTimezoneOffsetMinutes', () => {
  let originalGetTimezoneOffset: () => number;

  beforeEach(() => {
    originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;
  });

  afterEach(() => {
    Date.prototype.getTimezoneOffset = originalGetTimezoneOffset;
  });

  function mockTimezoneOffset(minutes: number) {
    Date.prototype.getTimezoneOffset = vi.fn(() => minutes);
  }

  it('returns 0 for UTC', () => {
    mockTimezoneOffset(0);
    expect(getBrowserTimezoneOffsetMinutes()).toBe(0);
  });

  it('returns 480 for UTC-8 (PST)', () => {
    mockTimezoneOffset(480);
    expect(getBrowserTimezoneOffsetMinutes()).toBe(480);
  });

  it('returns -330 for UTC+5:30 (IST)', () => {
    mockTimezoneOffset(-330);
    expect(getBrowserTimezoneOffsetMinutes()).toBe(-330);
  });

  it('clamps values above 720 to 720', () => {
    mockTimezoneOffset(900);
    expect(getBrowserTimezoneOffsetMinutes()).toBe(720);
  });

  it('clamps values below -720 to -720', () => {
    mockTimezoneOffset(-900);
    expect(getBrowserTimezoneOffsetMinutes()).toBe(-720);
  });

  it('handles boundary value 720 (UTC-12)', () => {
    mockTimezoneOffset(720);
    expect(getBrowserTimezoneOffsetMinutes()).toBe(720);
  });

  it('handles boundary value -720 (UTC+12)', () => {
    mockTimezoneOffset(-720);
    expect(getBrowserTimezoneOffsetMinutes()).toBe(-720);
  });
});
