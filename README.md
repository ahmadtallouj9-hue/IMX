# Chatter — Production-Ready Messaging App

A modern, real-time messaging application (inspired by Messenger/Discord-style apps)
with its own original brand. Supports **Android**, **Windows PC**, and **web**.

- **Web client (primary):** React + Vite (React Router, Socket.IO client, TypeScript)
- **Flutter client:** Material 3, Riverpod, GoRouter, Dio, WebSocket, SQLite offline cache (Android + Windows)
- **Backend:** Node.js + TypeScript (Fastify, Socket.IO, Prisma, PostgreSQL, Redis-ready, JWT)

```
chatter/
├── client/            # Flutter application (Android + Windows)
├── server/            # Node.js/TypeScript API + WebSocket backend
├── docs/              # Development documentation
├── scripts/           # Helper scripts
├── docker-compose.yml # PostgreSQL + Redis + backend (dev)
└── README.md
```

## Quick start

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md), [docs/BACKEND.md](docs/BACKEND.md)
and [docs/CLIENT.md](docs/CLIENT.md) for full setup instructions.

### Local development (React web + Node backend)

```bash
# 1. Backend
cd server
cp .env.example .env        # set DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, CORS_ORIGIN, NODE_ENV
npm install
npm run dev                 # starts API on http://localhost:8080

# 2. Frontend (second terminal)
cd web
npm install
npm run dev                 # starts Vite on http://localhost:5173

# 3. Open http://localhost:5173 → register → search users → start a chat → confirm realtime works
```

### Production build

```bash
# Build web app and copy dist to server
npm run build:prod          # from project root

# Deploy
npm run start --prefix server   # or use Railway/Docker
```

### Backend only

```bash
cd server
npm install
cp .env.example .env
npx prisma migrate dev      # creates schema in PostgreSQL
npm run dev                 # API on http://localhost:8080
```

### Docker (dev)

```bash
docker compose up --build   # PostgreSQL + Redis + backend
```

### Railway deployment (public)

1. Create Railway project, add PostgreSQL
2. Deploy from `server/` folder
3. Set env vars: `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGIN`, `NODE_ENV=production`
4. Run `npm run build:prod` and include `web-dist` in the deploy (Dockerfile expects it)
5. Point a domain (e.g. `chatter.example.com`) at Railway with HTTPS
6. Set `CORS_ORIGIN=https://your-domain.com` and rebuild

### PWA

- Icons: `web/public/icon-192.png`, `icon-512.png` (generated via `sharp` from `icon.svg`)
- Manifest: `web/public/manifest.webmanifest`
- Service worker: `web/public/sw.js`
- Run `npm run build:prod` then serve `server/web-dist/`

### Android APK (optional)

```bash
npm run build --prefix web
npm run app:sync --prefix web
cd web/android
.\gradlew assembleDebug
# Copy APK to server/uploads/chatter.apk for download at /download
```

### Tests

```bash
npm test --prefix server    # 43 tests, all pass
npm run typecheck           # TypeScript check (server + web)
```

## Environment vars (`.env` in server/)

```
NODE_ENV=development
PORT=8080
HOST=0.0.0.0
CORS_ORIGIN=http://localhost:5173,http://localhost:3000
DATABASE_URL=file:./dev.db          # PostgreSQL URL in production
JWT_SECRET=please-change-me-a-long-random-string
JWT_REFRESH_SECRET=please-change-me-another-long-random-string
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d
STORAGE_DRIVER=local
STORAGE_LOCAL_DIR=./uploads
STORAGE_PUBLIC_BASE_URL=http://localhost:8080
RATE_LIMIT_MAX=120
RATE_LIMIT_WINDOW_MS=60000
AUTH_RATE_LIMIT_MAX=10
PASSWORD_MIN_LENGTH=8
MAX_UPLOAD_MB=25
```

## Branding

The app brand ("Chatter") and colors are centralized so they can be changed in one place:
- React: `web/src/pages/ServerSetup.tsx`, `web/src/pages/ChatDetails.tsx`
- Flutter: `client/lib/core/theme/app_theme.dart`
- Icons: `web/public/icon.svg` → generated to `icon-192.png`, `icon-512.png`