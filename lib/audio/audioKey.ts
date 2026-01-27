import 'server-only';

import { createHash } from 'crypto';

/**
 * Generate a deterministic storage key for Latin audio.
 * Normalizes text (NFC, trim, collapse whitespace) and hashes.
 */
export function generateAudioKey(text: string): string {
  const normalized = text.normalize('NFC').trim().replace(/\s+/g, ' ');
  const hash = createHash('sha256').update(normalized).digest('hex');
  return `v1-${hash.slice(0, 16)}.mp3`;
}
