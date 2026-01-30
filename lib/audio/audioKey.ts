import 'server-only';

import { createHash } from 'crypto';
import { normalizeLatinText } from './textNormalization';

/**
 * Generate a deterministic storage key for Latin audio.
 * Normalizes text (NFC, trim, collapse whitespace) and hashes.
 */
export function generateAudioKey(text: string): string {
  const normalized = normalizeLatinText(text);
  const hash = createHash('sha256').update(normalized).digest('hex');
  return `v1-${hash.slice(0, 16)}.mp3`;
}

export { normalizeLatinText };
