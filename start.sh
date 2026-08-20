#!/bin/bash
set -e

cd server

# Retry migration up to 5 times (PostgreSQL may need a moment)
for i in 1 2 3 4 5; do
  echo "Attempt $i: Running prisma migrate deploy..."
  if npx prisma migrate deploy; then
    echo "Migration successful"
    break
  fi
  echo "Migration attempt $i failed, retrying in 5s..."
  sleep 5
done

exec node dist/src/server.js
