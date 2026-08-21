#!/bin/bash

cd server

echo "Waiting 10s for database to wake up..."
sleep 10

echo "Generating Prisma client..."
npx prisma generate

echo "Starting server..."
exec node dist/src/server.js
