# Build stage
FROM node:22-alpine AS builder
WORKDIR /app
# Indispensable pour Prisma sur Alpine
RUN apk add --no-cache libc6-compat
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

# Production stage
FROM node:22-alpine
WORKDIR /app
# libc6-compat est encore nécessaire ici pour le runtime Prisma
RUN apk add --no-cache libc6-compat openssl
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]