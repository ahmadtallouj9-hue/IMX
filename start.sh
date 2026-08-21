#!/bin/bash

cd server

echo "Waiting 10s for database to wake up..."
sleep 10

echo "Syncing database schema..."
npx prisma db push --skip-generate 2>&1 || echo "db push failed, trying anyway..."

exec node dist/src/server.js