'use server';

import { put, head } from '@vercel/blob';

const BLOB_PATH_PREFIX = 'latin/';

function getBlobBaseUrl(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN not configured');
  // Token format: vercel_blob_rw_XXXX_YYYYYYYY
  const parts = token.split('_');
  return `https://${parts[3]}.public.blob.vercel-storage.com`;
}

export const audioStore = {
  async exists(key: string): Promise<boolean> {
    try {
      await head(`${getBlobBaseUrl()}/${BLOB_PATH_PREFIX}${key}`);
      return true;
    } catch {
      return false;
    }
  },

  getPublicUrl(key: string): string {
    return `${getBlobBaseUrl()}/${BLOB_PATH_PREFIX}${key}`;
  },

  async put(key: string, bytes: Uint8Array): Promise<string> {
    const { url } = await put(`${BLOB_PATH_PREFIX}${key}`, bytes, {
      access: 'public',
      contentType: 'audio/mpeg',
      addRandomSuffix: false,
    });
    return url;
  },
};
