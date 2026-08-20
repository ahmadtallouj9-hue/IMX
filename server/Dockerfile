FROM node:20-slim

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY prisma ./prisma
RUN sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma \
  && npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npx tsc

RUN mkdir -p public uploads web-dist
COPY start.sh ./
COPY uploads ./uploads
COPY web-dist ./web-dist
RUN chmod +x start.sh

EXPOSE 8080

CMD ["./start.sh"]
