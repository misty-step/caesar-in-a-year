/**
 * Shared timezone constants and helpers used by both the client-side
 * TimezoneSync component and the server-side dashboard cookie parser.
 *
 * Convention: uses JavaScript's Date.getTimezoneOffset() sign convention,
 * where positive values are west of UTC (e.g., UTC-8 PST = 480).
 * See ADR 0006 for rationale.
 */

export const TZ_OFFSET_COOKIE_NAME = 'tzOffsetMin';
export const MIN_TZ_OFFSET_MIN = -720;
export const MAX_TZ_OFFSET_MIN = 720;

/** Clamp an offset to the valid ±720 minute range. */
export function clampTzOffset(offset: number): number {
  return Math.max(MIN_TZ_OFFSET_MIN, Math.min(MAX_TZ_OFFSET_MIN, offset));
}

/** Parse a raw cookie string into a clamped offset (defaults to 0). */
export function parseTzOffset(raw: string | undefined): number {
  if (!raw) return 0;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) return 0;
  return clampTzOffset(parsed);
}
