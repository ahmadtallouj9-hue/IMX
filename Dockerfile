FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build:prod

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/web-dist ./web-dist
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./
RUN npm install --production
COPY .env .env
RUN npx prisma generate
EXPOSE 8080
CMD ["node", "dist/src/server.js"]