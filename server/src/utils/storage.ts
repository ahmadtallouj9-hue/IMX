import { createWriteStream, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { env } from '../config';
import { logger } from './logger';

export interface UploadResult {
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function generateFileName(originalName: string): string {
  const raw = originalName.includes('.') ? '.' + originalName.split('.').pop() : '';
  const ext = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(raw.toLowerCase())
    ? raw.toLowerCase()
    : '.bin';
  return `${Date.now()}-${randomBytes(16).toString('hex')}${ext}`;
}

export async function storeFile(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
): Promise<UploadResult> {
  if (env.STORAGE_DRIVER === 's3') {
    return storeToS3(buffer, originalName, mimeType);
  }
  return storeLocal(buffer, originalName, mimeType);
}

async function storeLocal(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
): Promise<UploadResult> {
  const uploadsDir = join(process.cwd(), env.STORAGE_LOCAL_DIR);
  ensureDir(uploadsDir);

  const fileName = generateFileName(originalName);
  const filePath = join(uploadsDir, fileName);

  await new Promise<void>((resolve, reject) => {
    const ws = createWriteStream(filePath);
    ws.on('error', reject);
    ws.on('finish', resolve);
    ws.end(buffer);
  });

  const baseUrl = env.STORAGE_PUBLIC_BASE_URL.replace(/\/$/, '');
  const path = `/uploads/${fileName}`;
  const url = `${baseUrl}${path}`;

  return { url, fileName, mimeType, size: buffer.length };
}

async function storeToS3(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
): Promise<UploadResult> {
  // S3 upload would require @aws-sdk/client-s3
  // For now, fall back to local storage
  logger.warn('S3 storage not implemented, falling back to local');
  return storeLocal(buffer, originalName, mimeType);
}
