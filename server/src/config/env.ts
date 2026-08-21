import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8080),
  HOST: z.string().default('0.0.0.0'),
  CORS_ORIGIN: z.string().default('http://localhost:5173,http://localhost:3000'),
  DATABASE_URL: z.string().min(1).default('postgresql://chatter:chatter@localhost:5432/chatter?schema=public'),
  REDIS_URL: z.string().optional(),
  JWT_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  STORAGE_DRIVER: z.enum(['local', 's3', 'db']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('./uploads'),
  STORAGE_PUBLIC_BASE_URL: z.string().default('http://localhost:8080'),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  PASSWORD_MIN_LENGTH: z.coerce.number().int().positive().default(8),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(25),
});

export type Env = z.infer<typeof envSchema>;

const parseResult = envSchema.safeParse(process.env);
if (!parseResult.success) {
  console.error('Invalid environment configuration:', parseResult.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parseResult.data;
export const corsOrigins = env.CORS_ORIGIN.split(',').map(o => o.trim()).filter(Boolean);

const PRIVATE_HOST = /^(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})$/;

export function isAllowedOrigin(origin?: string): boolean {
  if (!origin) return true;
  if (corsOrigins.includes(origin)) return true;
  try {
    const host = new URL(origin).hostname;
    // Capacitor / Electron local origins
    if (origin.startsWith('capacitor://') || origin.startsWith('ionic://')) return true;
    if (host === 'localhost' || host === '127.0.0.1') return true;
    if (env.NODE_ENV !== 'production' && PRIVATE_HOST.test(host)) return true;
    return false;
  } catch {
    return false;
  }
}
