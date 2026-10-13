# syntax=docker/dockerfile:1.7
#
# Single-container PM-SETU Saathi build (alternative to Render). The Express server in server/src/index.js
# already serves /api/* AND the built SPA from web/dist when NODE_ENV is
# production (see server/src/index.js lines ~104+), so a single Node
# process behind Cloudflare tunnel is all we need — no separate nginx
# container, no CORS plumbing.
#
# Stages:
#   build  — install deps + prisma generate + vite build the SPA
#   runtime — alpine + node + the built workspace (no dev tooling)

FROM node:20-alpine AS build
WORKDIR /repo
RUN apk add --no-cache openssl

# Root package files first so npm install layer is cached when only
# application code changes.
COPY package.json package-lock.json* ./
COPY server/package.json ./server/
COPY web/package.json    ./web/

# Install across both workspaces. We use npm here (not pnpm) because
# the repo already uses npm — keeping migration scope tight.
RUN cd server && npm install --include=dev --no-audit --no-fund && cd ..
RUN cd web    && npm install --include=dev --no-audit --no-fund && cd ..

# Copy the rest of the workspace.
COPY server ./server
COPY web    ./web
COPY start.cjs ./

# Generate Prisma client + build the SPA. start.cjs would do these at
# boot otherwise; doing them at build time means a faster container
# start and a hard failure here (not in prod) if anything is broken.
RUN cd server && node scripts/postgres-schema.cjs && npx prisma generate --schema prisma/schema.postgres.prisma
RUN cd web    && npm run build && test -f dist/index.html


FROM node:20-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production
RUN apk add --no-cache openssl tini

# Copy the full built workspace. We keep server/node_modules (Prisma
# runtime needs it) but drop web/node_modules (the built SPA is just
# static files now).
COPY --from=build /repo/server      ./server
COPY --from=build /repo/web/dist    ./web/dist
COPY --from=build /repo/start.cjs   ./start.cjs
COPY --from=build /repo/package.json ./

EXPOSE 8787

# tini reaps zombie children (e.g. Prisma's optional spawned helpers)
# and forwards SIGTERM so `docker stop` is instant instead of 10s.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "start.cjs"]
