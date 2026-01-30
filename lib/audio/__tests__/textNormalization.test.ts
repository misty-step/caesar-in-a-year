import { describe, it, expect } from 'vitest';
import { normalizeLatinText } from '../textNormalization';

describe('normalizeLatinText', () => {
  it('preserves basic Latin text', () => {
    const input = 'Gallia est omnis divisa';
    expect(normalizeLatinText(input)).toBe(input);
  });

  it('normalizes to NFC', () => {
    const decomposed = 'e\u0301';
    expect(normalizeLatinText(decomposed)).toBe('\u00e9');
  });

  it('collapses internal whitespace', () => {
    const input = 'veni  \tvidi\nvici';
    expect(normalizeLatinText(input)).toBe('veni vidi vici');
  });

  it('trims leading and trailing whitespace', () => {
    const input = '  Salve mundo  ';
    expect(normalizeLatinText(input)).toBe('Salve mundo');
  });
});
