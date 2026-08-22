import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import { existsSync, createReadStream, mkdirSync, readFileSync } from 'fs';
import { basename, extname, join } from 'path';
import { isSafeUploadName } from './utils/upload-security';
import { getUploadsDir, readStoredFile } from './utils/storage';
import { env, isAllowedOrigin } from './config';
import { logger } from './utils/logger';
import { registerRoutes } from './routes';
import { errorHandler } from './middleware/error-handler';
import { setupSocketIO } from './websocket/socket';

function loadDownloadPage(): string {
  const candidates = [
    join(process.cwd(), 'download-site', 'index.html'),
    join(process.cwd(), '..', 'download-site', 'index.html'),
    join(__dirname, '..', '..', '..', 'download-site', 'index.html'),
    join(process.cwd(), 'web-dist', 'download.html'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return readFileSync(p, 'utf8');
  }
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>IMX Download</title></head><body style="font-family:system-ui;background:#0f1419;color:#fff;padding:40px;text-align:center"><h1>IMX</h1><p><a href="/download/android" style="color:#e85d04">Android APK</a> · <a href="/download/windows" style="color:#e85d04">Windows</a></p><p><a href="/" style="color:#9aa3af">Open web app</a></p></body></html>';
}

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger,
    trustProxy: true,
    bodyLimit: env.MAX_UPLOAD_MB * 1024 * 1024,
  });

  app.setErrorHandler(errorHandler);

  if (env.NODE_ENV === 'production') {
    app.addHook('onRequest', async (req, reply) => {
      const raw = req.headers['x-forwarded-proto'];
      const proto = typeof raw === 'string' ? raw.split(',')[0].trim() : Array.isArray(raw) ? raw[0] : undefined;
      if (proto && proto !== 'https') {
        const code = req.method === 'GET' || req.method === 'HEAD' ? 301 : 308;
        return reply.redirect(code, `https://${req.hostname}${req.url}`);
      }
    });
  }

  app.addHook('onSend', async (_req, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');
    reply.header('X-DNS-Prefetch-Control', 'off');
    if (env.NODE_ENV === 'production') {
      reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    return payload;
  });

  void app.register(cors, {
    origin: (origin, cb) => cb(null, isAllowedOrigin(origin)),
    credentials: true,
  });

  void app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
    errorResponseBuilder: () => ({
      error: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests, please slow down' },
    }),
  });

  void app.register(multipart, {
    limits: {
      fileSize: env.MAX_UPLOAD_MB * 1024 * 1024,
    },
  });

  void app.register(registerRoutes);

  const uploadsDir = getUploadsDir();
  if (env.STORAGE_DRIVER === 'local') {
    mkdirSync(uploadsDir, { recursive: true });
  }

  const webDist = [
    join(process.cwd(), 'web-dist'),
    join(process.cwd(), '..', 'web', 'dist'),
  ].find((dir) => existsSync(join(dir, 'index.html'))) ?? join(process.cwd(), '..', 'web', 'dist');
  const spaIndex = join(webDist, 'index.html');
  const spaReady = existsSync(spaIndex);
  const apiPrefixes = [
    '/auth', '/users', '/conversations', '/groups', '/uploads',
    '/health', '/search', '/notifications', '/friends', '/download', '/get', '/apps', '/socket.io',
  ];

  if (spaReady) {
    app.get('/assets/:file', async (req, reply) => {
      const file = basename((req.params as { file: string }).file);
      const full = join(webDist, 'assets', file);
      if (!existsSync(full)) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } });
      }
      const types: Record<string, string> = {
        '.js': 'text/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.map': 'application/json; charset=utf-8',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.woff2': 'font/woff2',
      };
      return reply
        .header('Cache-Control', 'public, max-age=31536000, immutable')
        .type(types[extname(file)] ?? 'application/octet-stream')
        .send(createReadStream(full));
    });

    const publicFiles: Record<string, string> = {
      '/manifest.webmanifest': 'application/manifest+json',
      '/icon.svg': 'image/svg+xml',
      '/icon-192.png': 'image/png',
      '/icon-512.png': 'image/png',
      '/sw.js': 'text/javascript; charset=utf-8',
      '/download.html': 'text/html; charset=utf-8',
    };
    for (const [route, type] of Object.entries(publicFiles)) {
      app.get(route, async (_req, reply) => {
        const full = join(webDist, route.slice(1));
        if (!existsSync(full)) {
          return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } });
        }
        const cache = route === '/sw.js' ? 'no-cache, no-store, must-revalidate' : 'public, max-age=86400';
        return reply.header('Cache-Control', cache).type(type).send(createReadStream(full));
      });
    }
  }

  app.get('/', async (_req, reply) => {
    if (spaReady) {
      return reply
        .header('Cache-Control', 'no-cache, no-store, must-revalidate')
        .type('text/html')
        .send(readFileSync(spaIndex, 'utf8'));
    }
    reply.header('Cache-Control', 'no-cache').type('text/html').send(loadDownloadPage());
  });

  app.get('/get', async (_req, reply) => {
    reply.header('Cache-Control', 'no-cache').type('text/html').send(loadDownloadPage());
  });

  app.get('/apps', async (_req, reply) => {
    reply.header('Cache-Control', 'no-cache').type('text/html').send(loadDownloadPage());
  });

  app.get('/download.html', async (_req, reply) => {
    reply.header('Cache-Control', 'no-cache').type('text/html').send(loadDownloadPage());
  });

  // --- App downloads hosted on this website (not itch.io) ---
  const apkPath = [
    join(uploadsDir, 'imx.apk'),
    join(process.cwd(), 'uploads', 'imx.apk'),
    join(process.cwd(), 'downloads', 'imx.apk'),
    join(process.cwd(), '..', 'server', 'downloads', 'imx.apk'),
  ].find((p) => existsSync(p));
  const windowsPath = [
    join(uploadsDir, 'imx-windows.zip'),
    join(uploadsDir, 'imx-windows.exe'),
    join(uploadsDir, 'imx.zip'),
    join(process.cwd(), 'uploads', 'imx-windows.zip'),
    join(process.cwd(), 'uploads', 'imx-windows.exe'),
    join(process.cwd(), 'downloads', 'imx-windows.zip'),
    join(process.cwd(), 'downloads', 'imx-windows.exe'),
  ].find((p) => existsSync(p));

  async function sendFileDownload(
    reply: { code: (n: number) => any; type: (t: string) => any; header: (k: string, v: string) => any; send: (b: unknown) => unknown },
    filePath: string | undefined,
    fallbackName: string,
    mime: string,
  ) {
    if (!filePath || !existsSync(filePath)) {
      return reply.code(404).type('text/html').send(
        '<!DOCTYPE html><html><body style="font-family:system-ui;background:#0f1419;color:#fff;padding:40px;text-align:center"><h1>File not uploaded yet</h1><p style="color:#9aa3af">Place the build in server/downloads and try again.</p><p><a href="https://imx-cbf0.onbelmo.uk/download.html" style="color:#e85d04">Back to downloads</a></p></body></html>',
      );
    }
    const name = basename(filePath);
    reply.header('Content-Type', mime);
    reply.header('Content-Disposition', 'attachment; filename="' + (name || fallbackName) + '"');
    reply.header('Cache-Control', 'no-cache');
    return reply.send(createReadStream(filePath));
  }

  app.get('/download', async (_req, reply) =>
    sendFileDownload(reply, apkPath, 'imx.apk', 'application/vnd.android.package-archive'),
  );
  app.get('/download/android', async (_req, reply) =>
    sendFileDownload(reply, apkPath, 'imx.apk', 'application/vnd.android.package-archive'),
  );
  app.get('/download/windows', async (_req, reply) => {
    const mime = windowsPath && windowsPath.endsWith('.exe') ? 'application/octet-stream' : 'application/zip';
    return sendFileDownload(reply, windowsPath, 'imx-windows.zip', mime);
  });

  const uploadMime: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.webm': 'video/webm',
    '.ogg': 'audio/ogg',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.m4a': 'audio/mp4',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.mkv': 'video/x-matroska',
    '.avi': 'video/x-msvideo',
  };

  app.get('/uploads/:filename', async (req, reply) => {
    const { filename } = req.params as { filename: string };
    const safeName = basename(filename);
    if (!safeName || safeName !== filename || !isSafeUploadName(safeName)) {
      return reply.code(400).send({ error: 'Invalid filename' });
    }
    const type = uploadMime[extname(safeName).toLowerCase()] ?? 'application/octet-stream';
    reply.header('Content-Type', type);
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Content-Disposition', 'inline');
    reply.header('Cache-Control', 'public, max-age=31536000, immutable');

    const filePath = join(uploadsDir, safeName);
    if (existsSync(filePath)) {
      return reply.send(createReadStream(filePath));
    }

    const buf = await readStoredFile(safeName);
    if (buf) {
      return reply.send(buf);
    }

    return reply.code(404).send({ error: 'File not found' });
  });

  setupSocketIO(app as any);

  app.setNotFoundHandler((req, reply) => {
    const path = req.url.split('?')[0];
    if (spaReady && req.method === 'GET' && !apiPrefixes.some((prefix) => path.startsWith(prefix))) {
      return reply
        .header('Cache-Control', 'no-cache, no-store, must-revalidate')
        .type('text/html')
        .send(readFileSync(spaIndex, 'utf8'));
    }
    reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } });
  });

  return app as unknown as FastifyInstance;
}
