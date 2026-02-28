/**
 * Shared timezone constants used by both the client-side TimezoneSync component
 * and the server-side dashboard cookie parser.
 *
 * Convention: uses JavaScript's Date.getTimezoneOffset() sign convention,
 * where positive values are west of UTC (e.g., UTC-8 PST = 480).
 * See ADR 0006 for rationale.
 */

export const TZ_OFFSET_COOKIE_NAME = 'tzOffsetMin';
export const MIN_TZ_OFFSET_MIN = -720;
export const MAX_TZ_OFFSET_MIN = 720;
