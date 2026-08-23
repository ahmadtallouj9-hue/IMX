import { useEffect, useState } from 'react';
import { mediaUrl } from './api';
import {
  decryptFileBytes,
  isEncryptedFileBytes,
  type EncryptContext,
} from './e2e';

export function useMediaSrc(url?: string | null): string | undefined {
  if (url?.startsWith('blob:')) return url;
  return mediaUrl(url);
}

/** Load a media URL and decrypt IMXE1 payloads when an E2E context is provided. */
export function useSecureMediaSrc(
  url: string | null | undefined,
  e2eCtx: EncryptContext | null,
): string | undefined {
  const plain = useMediaSrc(url);
  const [src, setSrc] = useState<string | undefined>(plain);

  useEffect(() => {
    let alive = true;
    let objectUrl: string | undefined;

    async function run() {
      if (!url) {
        if (alive) setSrc(undefined);
        return;
      }
      if (url.startsWith('blob:')) {
        if (alive) setSrc(url);
        return;
      }
      const href = mediaUrl(url);
      if (!href || !e2eCtx) {
        if (alive) setSrc(href);
        return;
      }
      try {
        const res = await fetch(href, { credentials: 'include' });
        if (!res.ok) throw new Error('fetch failed');
        const buf = await res.arrayBuffer();
        if (!isEncryptedFileBytes(buf)) {
          if (alive) setSrc(href);
          return;
        }
        const plainBuf = await decryptFileBytes(e2eCtx, buf);
        objectUrl = URL.createObjectURL(new Blob([plainBuf]));
        if (alive) setSrc(objectUrl);
      } catch {
        if (alive) setSrc(href);
      }
    }

    void run();
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, e2eCtx?.conversationId, e2eCtx?.userId, e2eCtx?.type, e2eCtx?.memberIds?.join(',')]);

  return src;
}
