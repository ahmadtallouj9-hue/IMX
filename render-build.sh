#!/bin/bash
set -e
export NODE_ENV=development
cd web
rm -rf node_modules
npm install
npx vite build
cd ..
node scripts/copy-web-dist.mjs
cd server
rm -rf node_modules
npm install
npx prisma generate
npx tsc
cd ..
