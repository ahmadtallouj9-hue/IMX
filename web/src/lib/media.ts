import { mediaUrl } from './api';

export function useMediaSrc(url?: string | null): string | undefined {
  if (url?.startsWith('blob:')) return url;
  return mediaUrl(url);
}
