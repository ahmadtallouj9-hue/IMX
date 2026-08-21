# IMX — Full Project Context for Cursor

## What is IMX?
IMX is a real-time messaging app (like WhatsApp/Telegram) with a React web frontend, Fastify/Node.js backend, PostgreSQL database, and multi-platform distribution (web, Windows Electron, Android APK).

---

## Live URLs
- **Web app:** `https://imx-cbf0.onbelmo.uk` (Belmo.io hosting)
- **Server API:** same URL (serves both API + landing page)
- **Database:** Render PostgreSQL (`dpg-da3a84flk1mc73fianvg-a.ohio-postgres.render.com`)
- **Repo:** `https://github.com/ahmadtallouj9-hue/IMX.git`
- **Windows .exe:** `https://ahmadtallouj9-hue.itch.io/imx`
- **Android APK:** `https://files.catbox.moe/jx33kl.apk`

---

## Tech Stack
| Layer | Tech |
|-------|------|
| Frontend | React 18 + TypeScript + Vite (SPA in `web/`) |
| Backend | Fastify + TypeScript + Prisma ORM |
| Database | **PostgreSQL** on Render Ohio (NOT SQLite) |
| Realtime | Socket.IO (WebSocket) |
| Auth | JWT (access + refresh tokens, bcrypt) |
| Storage | DB driver (`STORAGE_DRIVER=db`) — uploads stored as BYTEA in Postgres |
| Desktop | Electron (portable .exe, bundled node.exe, SQLite locally) |
| Mobile | Capacitor (Android APK, connects to Belmo server) |
| Hosting | Belmo.io (Docker/Nixpacks) |

---

## Project Structure
```
chatter/
├── server/                          # Backend (Fastify + Prisma)
│   ├── prisma/schema.prisma         # PostgreSQL schema (MUST be provider="postgresql")
│   ├── src/
│   │   ├── app.ts                   # Fastify app, CORS, routes, landing page HTML
│   │   ├── config/env.ts            # Env vars (DATABASE_URL, JWT secrets, STORAGE_DRIVER)
│   │   ├── routes/                  # API routes (auth, messages, friends, uploads, etc.)
│   │   ├── controllers/             # Business logic
│   │   ├── middleware/              # Error handler, auth guard
│   │   ├── utils/
│   │   │   ├── storage.ts           # DB storage (uploads as BYTEA)
│   │   │   └── upload-security.ts   # File type validation
│   │   └── websocket/socket.ts      # Socket.IO (messages, typing, presence, read receipts)
│   ├── .env                         # DATABASE_URL, JWT secrets, STORAGE_DRIVER=db
│   └── package.json
│
├── web/                             # Frontend (React + Vite)
│   ├── src/
│   │   ├── lib/
│   │   │   ├── api.ts               # API client, DEFAULT_NATIVE_API for Android
│   │   │   ├── auth.ts              # Auth context/hook
│   │   │   ├── socket.ts            # Socket.IO client
│   │   │   ├── media.ts             # useMediaSrc for authenticated images
│   │   │   └── types.ts             # TypeScript types
│   │   ├── pages/
│   │   │   ├── Messenger.tsx        # Main chat UI (messages, search, pin, forward, reply, edit, delete)
│   │   │   ├── ChatDetails.tsx      # Chat settings (themes, pin toggle, members)
│   │   │   └── Auth.tsx             # Login/register
│   │   ├── components/              # Reusable UI components
│   │   └── styles.css               # Design tokens, dark/light themes, animations
│   ├── android/                     # Capacitor Android project
│   ├── capacitor.config.ts          # Capacitor config
│   └── package.json
│
├── electron-main.js                 # Electron desktop entry point
├── preload.js                       # Electron preload script
├── tools/node.exe                   # Bundled Node.js v20.18.3 for portable Electron
├── scripts/
│   ├── swap-db-provider.js          # Swaps Prisma between postgresql/sqlite for Electron
│   ├── after-pack.js                # Copies server + node.exe for Electron packaging
│   └── copy-web-dist.mjs           # Copies web/dist → server/web-dist
│
├── download-site/                   # Standalone landing page (also embedded in app.ts)
├── Dockerfile                       # Multi-stage Docker build
├── .dockerignore
├── render-build.sh                  # Render build (NODE_ENV=development)
├── start.sh                         # Server startup (migrate + run)
├── start.bat                        # Local dev launcher
├── package.json                     # Root package.json (Electron build config, Belmo scripts)
└── IMX-CURSOR-CONTEXT.md            # THIS FILE
```

---

## Database Schema (PostgreSQL)
Key models: `User`, `Conversation`, `Message`, `Attachment`, `FriendRequest`, `RefreshToken`
- Message has: replyToId, edited, pinned, forward
- Attachment stored as BYTEA (STORAGE_DRIVER=db)
- Conversations support: direct + group, themes, pinned messages, notification muted
- Run `npx prisma migrate dev --name <name>` to create migrations

---

## Environment Variables
### Server (.env)
```
DATABASE_URL=postgresql://imx:nTxZXe1KcXN9xvvbs9uA5u95PzyMGgZV@dpg-da3a84flk1mc73fianvg-a.ohio-postgres.render.com/imx?sslmode=require
JWT_SECRET=rdX7IsZX69Ke2vsd6cg2DP+2Hq49kaMu/FeoTzquUKzw9gIO/4O41RuwB648EwFz
JWT_REFRESH_SECRET=0kpVr9zA3PxlUGWnC53+t1m/fBVvOHbLOuY7kQPmxzskTQ778LhVOoZNlsDxumBR
STORAGE_DRIVER=db
NODE_ENV=production
```

### Web (api.ts)
- `DEFAULT_NATIVE_API` = `https://imx-cbf0.onbelmo.uk` (used by Android APK only)
- Web browser auto-detects API from current origin

---

## How Deployment Works

### Belmo.io (Primary — Web + API)
- Builds with Nixpacks (Docker)
- Build command: `cd web && npm install && npm run build && cd .. && node scripts/copy-web-dist.mjs && cd server && npm install && npx prisma generate && npx tsc`
- Start command: `npm start` (runs start.sh → prisma migrate deploy → node dist/src/server.js)
- **IMPORTANT:** Set `NODE_ENV=development` at **build time only** on Belmo (vite is a devDependency)
- Auto-deploys from GitHub `main` branch

### Render (Backup — Database only)
- PostgreSQL database still on Render (always running)
- Web service is DOWN (Google Cloud outage on free tier)
- Database is NOT affected by the outage

### Electron (Windows .exe)
- Built locally: `npm run electron:build`
- Uses SQLite (swapped via `scripts/swap-db-provider.js`)
- Bundles `tools/node.exe` (66MB) + server code → portable app
- **AFTER building Electron:** restore schema.prisma to `provider = "postgresql"`

### Android (APK)
- Build: `cd web && npm run build && npx cap sync android`
- Open in Android Studio or: `cd web/android && set JAVA_HOME="C:\Program Files\Microsoft\jdk-17.0.20.8-hotspot" && gradlew.bat clean assembleDebug`
- Output: `web/android/app/build/outputs/apk/debug/app-debug.apk`
- Upload to catbox.moe → update link in `server/src/app.ts` and `download-site/index.html`

---

## Features (All Implemented)
- 1-on-1 and group messaging
- Friend request system (send/accept/reject)
- Real-time typing indicators
- Read receipts
- Online/offline presence
- Message reply, edit, delete
- Message search
- Message pinning
- Message forwarding
- Notification system
- Image/file sending (stored as BYTEA in Postgres)
- Dark mode (default) + Light mode
- Multiple themes (set per conversation)
- Day separators in chat
- Typing dots animation
- Blur-up image loading
- Empty state illustrations
- Responsive design (mobile + desktop)
- Landing page with download buttons (Windows + Android)

---

## What Cursor Should Know
1. **PowerShell 5.1** — chain commands with `;` not `&&`
2. **schema.prisma must be `provider = "postgresql"`** for web/server builds
3. **`NODE_ENV=production` at build time breaks vite** — must be `development` during build
4. **Electron uses SQLite** — run `node scripts/swap-db-provider.js` before Electron builds, restore after
5. **Uploads are in Postgres** (STORAGE_DRIVER=db) — no local file storage on server
6. **The landing page HTML is embedded in `server/src/app.ts`** as a template string (also exists in `download-site/`)
7. **Don't add comments** unless asked
8. **Use existing patterns** — check neighboring files before adding new code

---

## Known Issues / TODO
1. **Render outage** — Google Cloud issue disabling free tier web services. Will auto-resolve.
2. **APK is debug build** — not signed for production. Should use `assembleRelease` + keystore for Play Store.
3. **No HTTPS redirect on Belmo** — should enforce HTTPS
4. **No rate limiting on auth** — could be brute-forced
5. **No email verification** — accounts created without verification
6. **Landing page not mobile-optimized** — could use responsive improvements
7. **Download-site and app.ts landing page are duplicated** — should consolidate

---

## Running Locally
```bash
# One-click (Windows):
start.bat

# Manual:
# Terminal 1 — Server
cd server
npx prisma migrate dev
npm run dev

# Terminal 2 — Web
cd web
npm run dev  # Vite on :5173
```

---

## Build Commands
```bash
# Web
cd web && npm run build

# Server
cd server && npx prisma generate && npx tsc

# Electron (Windows .exe)
node scripts/swap-db-provider.js swap    # → sqlite
npm run electron:build
node scripts/swap-db-provider.js restore  # → postgresql

# Android APK
cd web && npm run build && npx cap sync android
cd web/android && gradlew.bat clean assembleDebug
```
