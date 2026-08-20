# Backend — Chatter API

Node.js + TypeScript backend built with **Fastify**, **Prisma** (PostgreSQL),
**Socket.IO** and **Redis** (optional). Clean separation between routes,
controllers, services, repositories and the database layer.

## Structure

```
server/
├── prisma/
│   ├── schema.prisma          # relational schema
│   └── migrations/            # versioned SQL migrations
├── src/
│   ├── config/                # env validation (Zod)
│   ├── controllers/           # HTTP request handlers
│   ├── services/              # business logic
│   ├── repositories/          # data access layer
│   ├── routes/                # route registration
│   ├── middleware/            # auth, error handling
│   ├── websocket/             # Socket.IO server (Phase 4)
│   ├── database/              # Prisma client
│   ├── utils/                 # helpers
│   └── app.ts / server.ts     # Fastify bootstrap & entrypoint
├── tests/                     # Vitest test suites
├── .env.example               # example environment
└── package.json
```

## Setup

### 1. Install dependencies

```bash
cd server
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:

```env
DATABASE_URL=postgresql://chatter:chatter@localhost:5432/chatter?schema=public
JWT_SECRET=your-long-random-secret
JWT_REFRESH_SECRET=another-long-random-secret
STORAGE_DRIVER=local
```

The schema validates these at startup and fails fast if required values are
missing or too short.

### 3. Start PostgreSQL

Option A — Docker:

```bash
docker compose up -d db
```

Option B — portable local instance (no Docker/admin required):

```bash
powershell -File scripts/download-postgres.ps1   # one-time download (~350 MB)
powershell -File scripts/init-postgres.ps1        # initdb + start on port 5433
```

Option C — any existing PostgreSQL server (adjust `DATABASE_URL` in `.env`).

Create the database if needed:

```bash
createdb -h localhost -p 5433 -U chatter chatter
```

### 4. Apply the schema

```bash
npx prisma migrate dev   # creates tables and generates the client
```

For production:

```bash
npx prisma migrate deploy
```

### 5. Run

```bash
npm run dev        # dev server with watch mode (tsx)
npm run build      # compile TypeScript -> dist/
npm start          # run compiled build
```

## Checks

```bash
npm run typecheck   # tsc --noEmit
npm run test        # vitest
npx prisma validate  # schema validity
```

## Health checks

- `GET /health/live` — liveness probe (no dependencies)
- `GET /health` — readiness probe (checks PostgreSQL connection)

## API design

REST API following the planned layout (implemented in later phases):

```
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
GET  /users/me            PATCH /users/me
GET  /users/search
POST /friends/requests    GET /friends/requests
POST /friends/requests/:id/accept   .../reject
GET  /conversations       POST /conversations
GET  /conversations/:id/messages    POST /conversations/:id/messages
PATCH /messages/:id       DELETE /messages/:id
POST /uploads
```

Message history uses **cursor-based pagination** so a conversation is never
loaded into memory whole.
