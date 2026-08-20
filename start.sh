#!/bin/bash

cd server

echo "Running prisma migrate deploy..."
npx prisma migrate deploy || {
  echo "ERROR: Migration failed. Trying to generate and migrate..."
  npx prisma generate
  npx prisma migrate deploy
}

exec node dist/src/server.js
