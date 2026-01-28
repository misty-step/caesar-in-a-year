import 'server-only';

import { BlobNotFoundError, head, put } from '@vercel/blob';

const BLOB_PATH_PREFIX = 'latin/';

function getBlobBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_BLOB_URL;
  if (envUrl) {
    return envUrl.endsWith('/') ? envUrl.slice(0, -1) : envUrl;
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN not configured');

  const parts = token.split('_');
  if (parts.length < 4 || !parts[3]) {
    throw new Error('Could not parse store ID from BLOB_READ_WRITE_TOKEN');
  }
  return `https://${parts[3]}.public.blob.vercel-storage.com`;
}

export const audioStore = {
  async exists(key: string): Promise<boolean> {
    try {
      await head(`${getBlobBaseUrl()}/${BLOB_PATH_PREFIX}${key}`);
      return true;
    } catch (error) {
      if (error instanceof BlobNotFoundError) return false;
      throw error;
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
