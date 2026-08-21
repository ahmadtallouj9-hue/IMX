FROM node:20-alpine AS web-builder
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY server/ ./server/
RUN cd server && npm ci && npx prisma generate && npm run build
COPY --from=web-builder /app/web/dist ./server/web-dist
WORKDIR /app/server
EXPOSE 8080
CMD ["node", "dist/src/server.js"]
