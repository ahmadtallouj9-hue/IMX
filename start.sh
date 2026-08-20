#!/bin/bash

cd server

echo "Waiting 10s for database to wake up..."
sleep 10

echo "Running prisma migrate deploy..."
for i in 1 2 3 4 5 6; do
  echo "Attempt $i: prisma migrate deploy..."
  if npx prisma migrate deploy 2>&1; then
    echo "Migration successful"
    break
  fi
  echo "Attempt $i failed, waiting 15s..."
  sleep 15
done

exec node dist/src/server.js