# ---- Build stage ----
FROM node:20-slim AS build
WORKDIR /app
# OpenSSL is required by Prisma engines on slim images.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
RUN npx prisma generate
COPY . .
RUN npm run build
# Compile the seed scripts too (they live outside tsconfig.build). seed.prod.ts
# is the production-safe seed run by docker-compose.prod.yml.
RUN npx tsc prisma/seed.ts prisma/seed.prod.ts --outDir dist/prisma --module commonjs --target ES2021 \
    --esModuleInterop --skipLibCheck --experimentalDecorators --emitDecoratorMetadata || true

# ---- Runtime stage ----
FROM node:20-slim AS runtime
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate
COPY --from=build /app/dist ./dist
RUN mkdir -p uploads
EXPOSE 4000
CMD ["node", "dist/main.js"]
