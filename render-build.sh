#!/bin/bash
set -e
export NODE_ENV=production
cd web
rm -rf node_modules
npm install --include=dev
npx vite build
cd ..
node scripts/copy-web-dist.mjs
cd server
rm -rf node_modules
npm install --include=dev
npx prisma generate
npx tsc
cd ..
