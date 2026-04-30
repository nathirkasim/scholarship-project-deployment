FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY apps/api/package*.json ./
RUN npm ci --only=production

FROM base AS builder
COPY apps/api/package*.json ./
RUN npm ci
COPY apps/api/ .
COPY prisma/ ./prisma/
COPY --from=deps /app/node_modules ./node_modules
RUN npx prisma generate
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
RUN apk add --no-cache openssl
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src

RUN mkdir -p logs

EXPOSE 4000
CMD ["node", "dist/index.js"]
