#!/bin/bash
set -e

cd server

# Retry migration up to 10 times with increasing delays (DB may be sleeping)
for i in 1 2 3 4 5 6 7 8 9 10; do
  echo "Attempt $i: Running prisma migrate deploy..."
  if npx prisma migrate deploy; then
    echo "Migration successful"
    break
  fi
  echo "Migration attempt $i failed, retrying in 10s..."
  sleep 10
done

exec node dist/src/server.js
