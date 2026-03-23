FROM m.daocloud.io/docker.io/library/node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

FROM m.daocloud.io/docker.io/library/node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p /app/public /app/storage
RUN npm run build

FROM m.daocloud.io/docker.io/library/node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=20261
ENV DATA_DIR=/app/data/app
ENV NODE_OPTIONS=--max-old-space-size=1536
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/src ./src
RUN mkdir -p /app/storage /app/data/app
EXPOSE 20261
CMD ["node", "server.js"]
