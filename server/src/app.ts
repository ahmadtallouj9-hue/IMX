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

const DOWNLOAD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>IMX — Download</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',system-ui,-apple-system,sans-serif;background:#09090b;color:#fff;min-height:100vh;overflow-x:hidden}
.bg-glow{position:fixed;top:-200px;left:50%;transform:translateX(-50%);width:600px;height:600px;border-radius:50%;background:radial-gradient(circle,rgba(99,102,241,0.15) 0%,transparent 70%);pointer-events:none;z-index:0}
.container{max-width:520px;margin:0 auto;padding:clamp(32px,8vw,60px) 20px;position:relative;z-index:1;text-align:center}
.badge{display:inline-flex;align-items:center;gap:6px;background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.2);padding:6px 14px;border-radius:100px;font-size:0.8rem;font-weight:500;color:#818cf8;margin-bottom:28px}
.badge .dot{width:6px;height:6px;background:#34d399;border-radius:50%;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
.logo{width:100px;height:100px;border-radius:28px;margin:0 auto 28px;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;box-shadow:0 20px 60px rgba(99,102,241,0.3)}
.logo svg{width:54px;height:54px;fill:#fff}
h1{font-size:clamp(2rem,8vw,2.8rem);font-weight:900;line-height:1.1;margin-bottom:12px;letter-spacing:-0.03em}
h1 span{background:linear-gradient(135deg,#818cf8,#c084fc);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.subtitle{font-size:1.05rem;color:#71717a;margin-bottom:40px;line-height:1.5}
.features{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:40px}
.feature{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:20px 12px}
.feature .icon{font-size:24px;margin-bottom:8px}
.feature h3{font-size:0.8rem;font-weight:600;margin-bottom:4px}
.feature p{font-size:0.7rem;color:#71717a;line-height:1.3}
.download-btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;background:linear-gradient(135deg,#6366f1,#7c3aed);color:#fff;text-decoration:none;padding:16px 28px;border-radius:16px;font-size:0.95rem;font-weight:700;transition:all 0.2s;box-shadow:0 8px 32px rgba(99,102,241,0.35);border:none;cursor:pointer;min-height:52px;flex:1 1 200px}
.download-btn:hover{transform:translateY(-2px);box-shadow:0 12px 40px rgba(99,102,241,0.5)}
.download-btn:active{transform:translateY(0)}
.download-btn svg{width:22px;height:22px;fill:#fff;flex-shrink:0}
.download-btn.android{background:linear-gradient(135deg,#34d399,#059669);box-shadow:0 8px 32px rgba(52,211,153,0.35)}
.download-btn.android:hover{box-shadow:0 12px 40px rgba(52,211,153,0.5)}
.download-buttons{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
.meta{display:flex;align-items:center;justify-content:center;gap:20px;margin-top:20px;color:#52525b;font-size:0.8rem;flex-wrap:wrap}
.meta span{display:flex;align-items:center;gap:5px}
.screenshots{display:flex;gap:12px;margin-top:48px;justify-content:center;overflow-x:auto;padding-bottom:8px;-webkit-overflow-scrolling:touch}
.phone{width:140px;height:280px;background:#18181b;border-radius:20px;border:2px solid #27272a;overflow:hidden;position:relative;flex:0 0 auto}
.phone .notch{width:50px;height:6px;background:#27272a;border-radius:10px;margin:8px auto 0}
.phone .screen{margin:12px 8px;border-radius:12px;height:calc(100% - 30px);display:flex;flex-direction:column;overflow:hidden}
.phone:nth-child(1) .screen{background:linear-gradient(180deg,#1e1b4b,#0f0f0f)}
.phone:nth-child(2) .screen{background:linear-gradient(180deg,#0f0f0f,#1e1b4b)}
.phone:nth-child(3) .screen{background:#18181b}
.screen-header{padding:10px 10px 6px;font-size:0.55rem;font-weight:700;color:#a1a1aa}
.screen-bubble{margin:4px 10px;padding:6px 10px;border-radius:10px;font-size:0.45rem;color:#d4d4d8;line-height:1.3;max-width:80%}
.screen-bubble.sent{background:#6366f1;margin-left:auto;color:#fff}
.screen-bubble.received{background:#27272a}
.footer{margin-top:60px;color:#3f3f46;font-size:0.75rem}
@media(max-width:520px){
.features{grid-template-columns:1fr;gap:8px}
.feature{display:flex;align-items:center;gap:12px;text-align:left;padding:14px 16px}
.feature .icon{margin:0;font-size:22px}
.phone{width:120px;height:240px}
}
</style>
</head>
<body>
<div class="bg-glow"></div>
<div class="container">
<div class="badge"><span class="dot"></span> Free &amp; open for everyone</div>
<div class="logo">
<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>
</div>
<h1>Chat with <span>anyone</span></h1>
<p class="subtitle">Real-time messaging, friend requests, and private conversations — all in one beautiful app.</p>
<div class="features">
<div class="feature"><div class="icon">&#x1F4AC;</div><h3>Live Chat</h3><p>Instant messages with typing indicators</p></div>
<div class="feature"><div class="icon">&#x1F465;</div><h3>Friends</h3><p>Find &amp; connect with people</p></div>
<div class="feature"><div class="icon">&#x1F512;</div><h3>Secure</h3><p>Private &amp; encrypted sessions</p></div>
</div>
<div class="download-buttons">
<a href="https://ahmadtallouj9-hue.itch.io/imx" class="download-btn" target="_blank">
<svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
Download for Windows
</a>
<a href="https://files.catbox.moe/6yubr5.apk" class="download-btn android" download>
<svg viewBox="0 0 24 24"><path d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8C2.67 8 2 8.67 2 9.5v7c0 .83.67 1.5 1.5 1.5S5 17.33 5 16.5v-7C5 8.67 4.33 8 3.5 8zm17 0c-.83 0-1.5.67-1.5 1.5v7c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-7c0-.83-.67-1.5-1.5-1.5zm-4.97-5.84l1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48A5.84 5.84 0 0012 1c-.96 0-1.86.23-2.66.63L7.85.15c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.31 1.31A5.983 5.983 0 006 7h12c0-2.12-1.06-3.99-2.47-5.17zM10 5H9V4h1v1zm5 0h-1V4h1v1z"/></svg>
Download for Android
</a>
</div>
<div class="meta"><span>&#x2B50; v1.0</span><span>&#x1F512; HTTPS Secured</span></div>
<div class="screenshots">
<div class="phone"><div class="notch"></div><div class="screen"><div class="screen-header">Messages</div><div class="screen-bubble received">Hey, are you free tonight?</div><div class="screen-bubble sent">Yeah! What's the plan?</div><div class="screen-bubble received">Let's grab dinner at 7</div><div class="screen-bubble sent">Sounds great!</div></div></div>
<div class="phone"><div class="notch"></div><div class="screen"><div class="screen-header">Friends</div><div class="screen-bubble received" style="background:#6366f1;color:#fff;max-width:100%;margin:6px 8px;border-radius:8px;">+ Ahmad</div><div class="screen-bubble received" style="background:#27272a;max-width:100%;margin:4px 8px;border-radius:8px;">+ Sarah</div><div class="screen-bubble received" style="background:#27272a;max-width:100%;margin:4px 8px;border-radius:8px;">+ Mike</div></div></div>
<div class="phone"><div class="notch"></div><div class="screen"><div class="screen-header">Login</div><div class="screen-bubble received" style="background:#27272a;max-width:100%;margin:16px 10px;border-radius:6px;font-size:0.4rem;">Email</div><div class="screen-bubble received" style="background:#27272a;max-width:100%;margin:4px 10px;border-radius:6px;font-size:0.4rem;">Password</div><div class="screen-bubble sent" style="max-width:100%;margin:10px 10px 0;border-radius:6px;font-size:0.45rem;text-align:center;">Sign In</div></div></div>
</div>
<p class="footer">IMX &copy; 2026 &middot; Built with React + Node.js</p>
</div>
</body>
</html>`;

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
    '/health', '/search', '/notifications', '/friends', '/download', '/socket.io',
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
      return reply.type(types[extname(file)] ?? 'application/octet-stream').send(createReadStream(full));
    });

    const publicFiles: Record<string, string> = {
      '/manifest.webmanifest': 'application/manifest+json',
      '/icon.svg': 'image/svg+xml',
      '/icon-192.png': 'image/png',
      '/icon-512.png': 'image/png',
      '/sw.js': 'text/javascript; charset=utf-8',
    };
    for (const [route, type] of Object.entries(publicFiles)) {
      app.get(route, async (_req, reply) => {
        const full = join(webDist, route.slice(1));
        if (!existsSync(full)) {
          return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } });
        }
        return reply.type(type).send(createReadStream(full));
      });
    }
  }

  app.get('/', async (_req, reply) => {
    if (spaReady) {
      return reply.type('text/html').send(readFileSync(spaIndex, 'utf8'));
    }
    reply.type('text/html').send(DOWNLOAD_HTML);
  });

  app.get('/get', async (_req, reply) => {
    reply.type('text/html').send(DOWNLOAD_HTML);
  });

  // --- APK download ---
  const apkPath = join(uploadsDir, 'chatter.apk');
  app.get('/download', async (_req, reply) => {
    if (!existsSync(apkPath)) {
      return reply.code(404).send({ error: 'APK not found' });
    }
    reply.header('Content-Type', 'application/vnd.android.package-archive');
    reply.header('Content-Disposition', 'attachment; filename="chatter.apk"');
    return reply.send(createReadStream(apkPath));
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
      return reply.type('text/html').send(readFileSync(spaIndex, 'utf8'));
    }
    reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } });
  });

  return app as unknown as FastifyInstance;
}
