#!/bin/bash

cd server

echo "Waiting 30s for database to wake up..."
sleep 30

echo "Pushing schema to database..."
for i in 1 2 3 4 5 6 7 8; do
  echo "Attempt $i: prisma db push..."
  if npx prisma db push --accept-data-loss 2>&1; then
    echo "Schema push successful"
    break
  fi
  echo "Attempt $i failed, waiting 15s..."
  sleep 15
done

exec node dist/src/server.js
