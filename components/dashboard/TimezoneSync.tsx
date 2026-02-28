'use client';

import { useEffect } from 'react';

import { TZ_OFFSET_COOKIE_NAME, clampTzOffset } from '@/lib/timezone';

export function getBrowserTimezoneOffsetMinutes(): number {
  return clampTzOffset(new Date().getTimezoneOffset());
}

export function TimezoneSync() {
  useEffect(() => {
    const offsetMinutes = getBrowserTimezoneOffsetMinutes();
    document.cookie = `${TZ_OFFSET_COOKIE_NAME}=${offsetMinutes}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  }, []);

  return null;
}
