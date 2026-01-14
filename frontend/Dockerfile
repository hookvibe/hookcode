FROM node:18-alpine AS build

WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@9.6.0 --activate

# Workspace-aware install (keeps Docker builds reproducible by using the root lockfile).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
RUN pnpm install --frozen-lockfile --filter hookcode-frontend...

COPY frontend/tsconfig.json frontend/tsconfig.json
COPY frontend/vite.config.ts frontend/vite.config.ts
COPY frontend/index.html frontend/index.html
COPY frontend/src frontend/src
COPY logo logo

# Build-time API base URL for the frontend bundle (Vite injects `VITE_*` vars at build time).
# Change record:
# - 2026-01-14: Default to `/api` so Docker builds work behind Cloudflare (single public port via Nginx reverse proxy).
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN pnpm --filter hookcode-frontend build

FROM nginx:alpine

# Copy built frontend files
COPY --from=build /repo/frontend/dist /usr/share/nginx/html

# Copy custom Nginx configuration with API reverse proxy support.
# Change record:
# - 2026-01-14: Move Nginx config under `docker/nginx/` to keep deployment assets centralized.
# - 2026-01-14: Use `/etc/nginx/conf.d/default.conf` (not templated) to guarantee the proxy config is always loaded.
COPY docker/nginx/frontend.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
