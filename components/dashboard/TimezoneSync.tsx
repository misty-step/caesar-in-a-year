'use client';

import { useEffect } from 'react';

import { TZ_OFFSET_COOKIE_NAME, MIN_TZ_OFFSET_MIN, MAX_TZ_OFFSET_MIN } from '@/lib/timezone';

export function getBrowserTimezoneOffsetMinutes(): number {
  const offsetMinutes = new Date().getTimezoneOffset();
  return Math.max(MIN_TZ_OFFSET_MIN, Math.min(MAX_TZ_OFFSET_MIN, offsetMinutes));
}

export function TimezoneSync() {
  useEffect(() => {
    const offsetMinutes = getBrowserTimezoneOffsetMinutes();
    document.cookie = `${TZ_OFFSET_COOKIE_NAME}=${offsetMinutes}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  }, []);

  return null;
}
