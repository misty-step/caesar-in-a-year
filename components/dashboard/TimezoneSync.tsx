'use client';

import { useEffect } from 'react';

const TZ_OFFSET_COOKIE_NAME = 'tzOffsetMin';
const MIN_TZ_OFFSET_MIN = -720;
const MAX_TZ_OFFSET_MIN = 720;

function getBrowserTimezoneOffsetMinutes(): number {
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
