import { useEffect, useState } from 'react';
import { getAccessToken, mediaUrl } from './api';

export function useMediaSrc(url?: string | null): string | undefined {
  const [src, setSrc] = useState<string | undefined>(() => {
    const resolved = mediaUrl(url);
    return resolved?.startsWith('/') ? resolved : undefined;
  });

  useEffect(() => {
    const resolved = mediaUrl(url);
    if (!resolved) {
      setSrc(undefined);
      return;
    }
    if (resolved.startsWith('/') || resolved.startsWith('blob:')) {
      setSrc(resolved);
      return;
    }

    const ctrl = new AbortController();
    let objectUrl: string | undefined;
    const headers: HeadersInit = {};
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    fetch(resolved, { signal: ctrl.signal, headers })
      .then((res) => {
        if (!res.ok) throw new Error('image fetch failed');
        return res.blob();
      })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setSrc(resolved);
      });

    return () => {
      ctrl.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  return src;
}
