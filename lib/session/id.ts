/**
 * Session ID generation and normalization.
 *
 * Format: sess_{timestamp}_{random}
 * - timestamp: Unix milliseconds (Date.now())
 * - random: 6 chars base36
 *
 * URL-safe by construction: no characters requiring encoding.
 * Legacy ISO format (with colons) handled via normalization.
 */

const SESSION_PREFIX = 'sess_';

/**
 * Generate a new URL-safe session ID.
 *
 * @returns ID like "sess_1733912389731_ukxtb6"
 */
export function generateSessionId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `${SESSION_PREFIX}${timestamp}_${random}`;
}

/**
 * Normalize a session ID by URL-decoding it.
 *
 * Handles:
 * - URL-encoded IDs from route params (%3A -> :)
 * - Double-encoded IDs
 * - Already-decoded IDs (idempotent)
 * - Malformed URIs (returns as-is)
 *
 * @param id - Raw session ID from URL params or other source
 * @returns Normalized session ID suitable for database lookup
 */
export function normalizeSessionId(id: string): string {
  try {
    let result = id;
    // Decode until stable (handles double-encoding)
    while (result !== decodeURIComponent(result)) {
      result = decodeURIComponent(result);
    }
    return result;
  } catch {
    // Malformed URI - return as-is, let DB return NOT_FOUND
    return id;
  }
}

/**
 * Validate session ID format.
 *
 * Accepts both:
 * - New Unix format: sess_1733912389731_ukxtb6
 * - Legacy ISO format: sess_2025-12-10T13:59:49.731Z_ukxtb6
 */
export function isValidSessionId(id: string): boolean {
  return /^sess_[\w.:T-]+$/.test(id);
}

/**
 * Parse the timestamp from a session ID.
 *
 * @param id - Session ID
 * @returns Date if parseable, null otherwise
 */
export function parseSessionTimestamp(id: string): Date | null {
  // New format: sess_1733912389731_ukxtb6
  const unixMatch = id.match(/^sess_(\d{13})_/);
  if (unixMatch) {
    return new Date(parseInt(unixMatch[1], 10));
  }

  // Legacy ISO format: sess_2025-12-10T13:59:49.731Z_ukxtb6
  const isoMatch = id.match(/^sess_(.+?)_[a-z0-9]+$/i);
  if (isoMatch) {
    const parsed = new Date(isoMatch[1]);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}
