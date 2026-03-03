import { createBrandIconResponse } from '@/app/_lib/brandIcon';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return createBrandIconResponse({
    size,
    borderRadius: '36px',
    swordSize: 140,
  });
}
