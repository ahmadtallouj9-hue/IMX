# Development Guide

This repository contains two parts:

| Directory | Description |
|-----------|-------------|
| `server/` | Node.js + TypeScript API & WebSocket backend |
| `client/` | Flutter app (Android + Windows) |

The recommended development workflow:

1. Start dependencies (PostgreSQL, Redis) and the backend.
2. Run the Flutter app on Windows or an Android device/emulator.
3. For real-time + database features, point the app at the backend
   (see `client/lib/core/constants/app_constants.dart`).

## Required tooling

- **Node.js** 18+ (backend)
- **npm** (backend)
- **Docker** + Docker Compose (optional, for PostgreSQL/Redis) — or a local PostgreSQL 14+
- **Flutter SDK** 3.x (client) with Windows or Android toolchain
- **Visual Studio 2022** with the "Desktop development with C++" workload (for Windows build)
- **Android Studio / Android SDK + JDK 17** (for Android build)

## First time setup

See [BACKEND.md](BACKEND.md) for the backend and [CLIENT.md](CLIENT.md) for the Flutter app.

## Running everything

```bash
# 1. Start databases
docker compose up -d db redis

# 2. Backend (in ./server)
cp .env.example .env   # then edit values
npm install
npx prisma migrate dev
npm run dev

# 3. Flutter (in ./client)
flutter pub get
flutter run -d windows   # or an Android device
```

## Development phases

1. **Foundation** (this phase) — structure, backend bootstrap, Prisma schema, health check, Flutter shell/theme/routing
2. **Authentication** — register/login/logout, JWT + refresh tokens, secure storage, profile
3. **Users + Friends** — search, friend requests, friend list, blocking
4. **Chat** — conversations, messages, pagination, real-time WebSockets, typing, read receipts
5. **Media** — image/file uploads, attachments, image viewer
6. **Groups** — group conversations and member management
7. **Notifications + Offline** — push/desktop notifications, offline cache, message queue
8. **Polish** — animations, states, responsiveness, accessibility, performance
9. **Security audit**
10. **Final build** — verify all platforms
