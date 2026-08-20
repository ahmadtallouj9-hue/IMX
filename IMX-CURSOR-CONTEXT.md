# IMX Project Context for Cursor

## Project Overview
IMX (formerly "Chatter") is a real-time messaging web app deployed on **Render.com** (free tier). It supports 1-on-1 and group chats, friend system, image sending, typing indicators, read receipts, online presence, themes, and chat backgrounds.

**Repo:** `https://github.com/ahmadtallouj9-hue/IMX.git`
**Live URL:** `https://imx-uex6.onrender.com`
**Branch:** `main` (auto-deploys to Render on push)

---

## Tech Stack
- **Frontend:** React 18 + TypeScript + Vite (SPA in `web/`)
- **Backend:** Fastify + TypeScript + Prisma ORM
- **Database:** SQLite (Prisma schema at `server/prisma/schema.prisma`, provider: `sqlite`)
- **Realtime:** Socket.IO
- **Auth:** JWT (access + refresh tokens, bcrypt password hashing)
- **Storage:** Local filesystem (`server/uploads/`)
- **Deployment:** Render.com free tier, auto-deploys from `main` branch

---

## Environment Variables (Render)
```
CORS_ORIGIN=https://imx-uex6.onrender.com
JWT_SECRET=rdX7IsZX69Ke2vsd6cg2DP+2Hq49kaMu/FeoTzquUKzw9gIO/4O41RuwB648EwFz
JWT_REFRESH_SECRET=0kpVr9zA3PxlUGWnC53+t1m/fBVvOHbLOuY7kQPmxzskTQ778LhVOoZNlsDxumBR
NODE_ENV=production
PORT=10000
STORAGE_DRIVER=local
STORAGE_LOCAL_DIR=./uploads
STORAGE_PUBLIC_BASE_URL=https://imx-uex6.onrender.com
DATABASE_URL=file:./dev.db
```

**Start command:** `npx prisma migrate deploy && node dist/index.js`
**Build script:** `render-build.sh` — does clean npm install with `NODE_ENV=development`, builds web, copies web-dist, builds server

---

## Key Files
```
chatter/
├── render-build.sh              # Render build script
├── server/
│   ├── prisma/schema.prisma     # SQLite schema (Message, Attachment, Conversation, User, etc.)
│   ├── src/
│   │   ├── app.ts               # Fastify app, CORS, multipart config, static file serving
│   │   ├── config/env.ts        # Env vars (MAX_UPLOAD_MB=9999, JWT, storage config)
│   │   ├── controllers/
│   │   │   ├── messages.controller.ts   # Message CRUD + attachments support
│   │   │   ├── uploads.controller.ts    # File upload (image sniffing, no size limit)
│   │   │   └── auth.controller.ts       # Login/register/profile
│   │   ├── utils/
│   │   │   ├── storage.ts       # Local file storage, storeFile()
│   │   │   └── upload-security.ts  # Image type sniffing (JPEG/PNG/GIF/WebP)
│   │   └── websocket/socket.ts  # Socket.IO events (message:new, typing, read, presence)
│   └── package.json
├── web/
│   ├── src/
│   │   ├── lib/
│   │   │   ├── api.ts           # API client (upload, sendMessage with attachments, etc.)
│   │   │   ├── media.ts         # useMediaSrc hook (authenticated image loading)
│   │   │   ├── auth.ts          # Auth context
│   │   │   ├── socket.ts        # Socket.IO client
│   │   │   └── types.ts         # ChatMessage (has attachments field), Conversation, etc.
│   │   ├── pages/
│   │   │   ├── Messenger.tsx    # Main chat UI (image upload button, MsgImage component)
│   │   │   ├── ChatDetails.tsx  # Chat settings (background upload, theme, members)
│   │   │   └── Auth.tsx         # Login/register
│   │   └── styles.css           # All styles (modern dark theme, animated bubbles)
│   └── package.json             # build script: "vite build" (tsc skipped)
└── .gitignore                   # Excludes dist/, node_modules/, *.apk, *.exe
```

---

## What Was Built / Changed

### 1. App Rebrand (Chatter → IMX)
All references updated across package.json, README, web/, server/, electron-main.js, docs/, download-site/.

### 2. Git Cleanup
Large binaries removed from history (Chatter-Windows.exe, Chatter.apk, dist-electron/, download-site.zip) via `git filter-branch`.

### 3. Render Deployment
- Created `render-build.sh` (handles clean npm install with NODE_ENV=development)
- Changed web build from `"tsc && vite build"` to `"vite build"` (skip tsc for Render)
- Configured all env vars on Render dashboard

### 4. Upload Size Limits Removed
- `upload-security.ts`: removed `IMAGE_MAX_BYTES` (was 5MB hardcoded)
- `uploads.controller.ts`: removed size check entirely
- `env.ts`: `MAX_UPLOAD_MB` default changed from 25 → 9999

### 5. Image Sending in Chat
- `api.ts`: `sendMessage()` now accepts optional `attachments` array
- `Messenger.tsx`: added ✎ image button in composer, `sendImage()` function (upload → send), `MsgImage` component for rendering
- `styles.css`: `.msg-image`, `.bubble.has-image`, rounded pill composer, message animations

### 6. Server Already Supported Attachments
`messages.controller.ts` already handles `attachments` in the send endpoint — creates Attachment records linked to Message. The `list` endpoint already returns attachments with messages.

---

## Known Issues / TODO
1. **SQLite on Render = ephemeral data** — database wipes on every restart/sleep. Need PostgreSQL for persistence.
2. **Uploaded files lost on restart** — Render Free tier has ephemeral disk. Need S3 or similar for permanent storage.
3. **No HTTPS enforcement** — should add redirect from HTTP to HTTPS.
4. **No rate limiting on auth endpoints** beyond basic config.
5. **No email verification** — accounts are created without verification.

---

## Running Locally
```bash
# Server
cd server
cp .env.example .env  # Fill in JWT secrets
npx prisma migrate dev
npm run dev

# Web (separate terminal)
cd web
npm run dev  # Vite dev server on :5173
```

---

## Build Commands
```bash
# Web only
cd web && npm run build

# Server only
cd server && npm run build

# Full deploy (what Render runs)
cd web && npm run build && cd ../server && npm run build
```
