import { describe, it, expect } from 'vitest';
import { clampTzOffset, parseTzOffset } from '../timezone';

describe('clampTzOffset', () => {
  it('passes through values within range', () => {
    expect(clampTzOffset(0)).toBe(0);
    expect(clampTzOffset(480)).toBe(480);
    expect(clampTzOffset(-330)).toBe(-330);
  });

  it('clamps above 720 to 720', () => {
    expect(clampTzOffset(900)).toBe(720);
  });

  it('clamps below -720 to -720', () => {
    expect(clampTzOffset(-900)).toBe(-720);
  });

  it('preserves boundary values exactly', () => {
    expect(clampTzOffset(720)).toBe(720);
    expect(clampTzOffset(-720)).toBe(-720);
  });
});

describe('parseTzOffset', () => {
  it('returns 0 for undefined', () => {
    expect(parseTzOffset(undefined)).toBe(0);
  });

  it('returns 0 for empty string', () => {
    expect(parseTzOffset('')).toBe(0);
  });

  it('returns 0 for non-numeric string', () => {
    expect(parseTzOffset('not-a-number')).toBe(0);
  });

  it('parses valid positive offset', () => {
    expect(parseTzOffset('480')).toBe(480);
  });

  it('parses valid negative offset', () => {
    expect(parseTzOffset('-330')).toBe(-330);
  });

  it('clamps out-of-range positive value', () => {
    expect(parseTzOffset('999')).toBe(720);
  });

  it('clamps out-of-range negative value', () => {
    expect(parseTzOffset('-999')).toBe(-720);
  });
});
