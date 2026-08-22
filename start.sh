#!/bin/bash
set -e
cd server
echo "Waiting for database..."
sleep 8
npx prisma migrate deploy || true
echo "Starting IMX server..."
exec node dist/src/server.js
