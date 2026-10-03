FROM node:22-bookworm-slim AS base
RUN apt-get -o Acquire::http::No-Cache=true update && apt-get -o Acquire::http::No-Cache=true -o Acquire::Retries=3 install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
FROM base AS deps
COPY package*.json ./
COPY prisma ./prisma
COPY scripts/sync-map-assets.mjs ./scripts/sync-map-assets.mjs
RUN npm ci
FROM deps AS builder
COPY . .
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV APP_URL=http://localhost:3000
RUN npm run build
FROM base AS runner
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 UPLOAD_DIR=/data/uploads
RUN groupadd -g 1001 meetmap && useradd -u 1001 -g meetmap -s /usr/sbin/nologin meetmap && mkdir -p /data/uploads && chown -R meetmap:meetmap /data
COPY --from=builder --chown=meetmap:meetmap /app/.next/standalone ./
COPY --from=builder --chown=meetmap:meetmap /app/.next/static ./.next/static
COPY --from=builder --chown=meetmap:meetmap /app/public ./public
COPY --from=builder --chown=meetmap:meetmap /app/assets ./assets
USER meetmap
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://localhost:3000/api/readyz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
