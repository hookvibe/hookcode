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

ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN pnpm --filter hookcode-frontend build

FROM nginx:alpine
COPY --from=build /repo/frontend/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
