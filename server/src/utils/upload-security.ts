import { badRequest } from './errors';

const AVATAR_PATH = /^\/uploads\/[A-Za-z0-9._-]+\.(jpg|jpeg|png|gif|webp)$/i;
const FILE_NAME = /^[A-Za-z0-9._-]+\.(jpg|jpeg|png|gif|webp|webm|ogg|mp3|wav|m4a|mp4|mov|mkv|avi)$/i;

export type SniffedImage = { mime: string; ext: string };

export function sniffImage(buf: Buffer): SniffedImage | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { mime: 'image/jpeg', ext: '.jpg' };
  }
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { mime: 'image/png', ext: '.png' };
  }
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    return { mime: 'image/gif', ext: '.gif' };
  }
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return { mime: 'image/webp', ext: '.webp' };
  }
  return null;
}

export function sniffAudio(buf: Buffer): SniffedImage | null {
  if (buf.length < 4) return null;
  if (buf.toString('ascii', 0, 4) === 'OggS') {
    return { mime: 'audio/ogg', ext: '.ogg' };
  }
  if (buf.toString('ascii', 0, 3) === 'ID3' || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) {
    return { mime: 'audio/mpeg', ext: '.mp3' };
  }
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.length > 12 && buf.toString('ascii', 8, 12) === 'WAVE') {
    return { mime: 'audio/wav', ext: '.wav' };
  }
  if (buf.length >= 12 && buf.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buf.toString('ascii', 8, 12);
    if (/^(M4A |mp4a)/i.test(brand)) {
      return { mime: 'audio/mp4', ext: '.m4a' };
    }
  }
  // EBML WebM — treat audio-only (Opus/Vorbis, no video codec) as audio
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
    const head = buf.toString('latin1', 0, Math.min(buf.length, 2048));
    if (head.includes('webm')) {
      const hasVideo = /V_VP8|V_VP9|V_AV1|V_MPEG/.test(head);
      const hasAudio = /A_OPUS|A_VORBIS|OpusHead|vorbis/i.test(head);
      if (hasAudio && !hasVideo) {
        return { mime: 'audio/webm', ext: '.webm' };
      }
      if (!hasVideo) {
        return { mime: 'audio/webm', ext: '.webm' };
      }
    }
  }
  return null;
}

export function sniffVideo(buf: Buffer): SniffedImage | null {
  if (buf.length < 12) return null;
  if (buf.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buf.toString('ascii', 8, 12);
    if (/^(heic|heif|mif1|M4A |mp4a)/i.test(brand)) {
      return null;
    }
    if (/^(qt|mp4|M4V|isom|avc1)/i.test(brand) || brand.trim().length > 0) {
      return { mime: 'video/mp4', ext: '.mp4' };
    }
  }
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
    const str = buf.toString('latin1', 0, Math.min(buf.length, 512));
    if (str.includes('webm')) return { mime: 'video/webm', ext: '.webm' };
    return { mime: 'video/x-matroska', ext: '.mkv' };
  }
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'AVI ') {
    return { mime: 'video/x-msvideo', ext: '.avi' };
  }
  return null;
}

export function isSafeUploadName(filename: string): boolean {
  return FILE_NAME.test(filename);
}

export function parseAvatarUrl(input: string | null | undefined): string | null | undefined {
  if (input === undefined) return undefined;
  if (input === null || input.trim() === '') return null;
  const trimmed = input.trim();
  const path = trimmed.includes('/uploads/') ? trimmed.slice(trimmed.indexOf('/uploads/')) : trimmed;
  const clean = path.split('?')[0].split('#')[0];
  if (!AVATAR_PATH.test(clean)) {
    throw badRequest('Avatar must be an uploaded JPEG, PNG, GIF, or WebP image');
  }
  return clean;
}
