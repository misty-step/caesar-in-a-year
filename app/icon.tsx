import { createBrandIconResponse } from '@/app/_lib/brandIcon';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return createBrandIconResponse({
    size,
    borderRadius: '6px',
    swordSize: 20,
  });
}
