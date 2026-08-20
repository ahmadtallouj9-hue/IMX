#!/bin/bash
set -e
cd web
rm -rf node_modules
NODE_ENV=development npm install
NODE_ENV=production npx vite build
cd ..
node scripts/copy-web-dist.mjs
cd server
rm -rf node_modules
NODE_ENV=development npm install
npx prisma generate
npx tsc
cd ..
