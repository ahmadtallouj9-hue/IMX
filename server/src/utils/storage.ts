import { createWriteStream, mkdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { randomBytes } from 'crypto';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { env } from '../config';
import { logger } from './logger';

export interface UploadResult {
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
}

const AUDIO_EXTS = ['.webm', '.ogg', '.mp3', '.wav', '.m4a'];
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

export function getUploadsDir(): string {
  return resolve(process.cwd(), env.STORAGE_LOCAL_DIR);
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function generateFileName(originalName: string): string {
  const raw = originalName.includes('.') ? '.' + originalName.split('.').pop() : '';
  const lower = raw.toLowerCase();
  const ext = [...IMAGE_EXTS, ...AUDIO_EXTS].includes(lower) ? lower : '.bin';
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
  if (env.STORAGE_DRIVER === 'db') {
    return storeToDb(buffer, originalName, mimeType);
  }
  return storeLocal(buffer, originalName, mimeType);
}

async function storeLocal(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
): Promise<UploadResult> {
  const uploadsDir = getUploadsDir();
  ensureDir(uploadsDir);

  const fileName = generateFileName(originalName);
  const filePath = join(uploadsDir, fileName);

  await new Promise<void>((resolveWrite, reject) => {
    const ws = createWriteStream(filePath);
    ws.on('error', reject);
    ws.on('finish', resolveWrite);
    ws.end(buffer);
  });

  const baseUrl = env.STORAGE_PUBLIC_BASE_URL.replace(/\/$/, '');
  const path = `/uploads/${fileName}`;
  const url = `${baseUrl}${path}`;

  return { url, fileName, mimeType, size: buffer.length };
}

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (s3Client) return s3Client;
  s3Client = new S3Client({
    region: env.S3_REGION ?? 'us-east-1',
    endpoint: env.S3_ENDPOINT || undefined,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY ?? '',
      secretAccessKey: env.S3_SECRET_KEY ?? '',
    },
  });
  return s3Client;
}

async function storeToS3(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
): Promise<UploadResult> {
  const fileName = generateFileName(originalName);
  const client = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: fileName,
      Body: buffer,
      ContentType: mimeType,
    }),
  );

  const baseUrl = env.STORAGE_PUBLIC_BASE_URL.replace(/\/$/, '');
  const path = `/uploads/${fileName}`;
  const url = `${baseUrl}${path}`;

  return { url, fileName, mimeType, size: buffer.length };
}

export async function readStoredFile(fileName: string): Promise<Buffer | null> {
  if (env.STORAGE_DRIVER === 's3') {
    try {
      const res = await getS3Client().send(
        new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: fileName }),
      );
      const chunks: Buffer[] = [];
      for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
        chunks.push(Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    } catch (err: any) {
      if (err?.name === 'NoSuchKey') return null;
      logger.warn({ err: err?.message }, 'Failed to read from S3');
      return null;
    }
  }
  if (env.STORAGE_DRIVER === 'db') {
    return readFromDb(fileName);
  }
  return null;
}

async function storeToDb(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
): Promise<UploadResult> {
  const fileName = generateFileName(originalName);
  const { prisma } = await import('../database/prisma');
  await prisma.storedUpload.create({
    data: { fileName, mimeType, size: buffer.length, data: buffer },
  });

  const baseUrl = env.STORAGE_PUBLIC_BASE_URL.replace(/\/$/, '');
  const path = `/uploads/${fileName}`;
  const url = `${baseUrl}${path}`;

  return { url, fileName, mimeType, size: buffer.length };
}

async function readFromDb(fileName: string): Promise<Buffer | null> {
  const { prisma } = await import('../database/prisma');
  const rec = await prisma.storedUpload.findUnique({ where: { fileName } });
  return rec ? Buffer.from(rec.data) : null;
}
