FROM node:18-alpine

WORKDIR /repo

# Install system dependencies including build tools for native modules (node-pty, tree-sitter-bash)
RUN apk add --no-cache \
    git \
    openssh-client \
    openssl \
    ca-certificates \
    python3 \
    make \
    g++

RUN corepack enable && corepack prepare pnpm@9.6.0 --activate

RUN npm install -g @openai/codex

# Prisma CLI may try to access checkpoint.prisma.io for version checks; on unstable networks it can hang.
ARG PRISMA_ENGINES_MIRROR
ENV CHECKPOINT_DISABLE=1 \
    PRISMA_HIDE_UPDATE_MESSAGE=1 \
    NO_UPDATE_NOTIFIER=1 \
    PRISMA_ENGINES_MIRROR=$PRISMA_ENGINES_MIRROR

# Workspace-aware install (keeps Docker builds reproducible by using the root lockfile).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN pnpm install --frozen-lockfile --filter hookcode-backend...

COPY backend/tsconfig.json backend/tsconfig.json
COPY backend/prisma backend/prisma
COPY backend/scripts backend/scripts
COPY backend/src backend/src

RUN pnpm --filter hookcode-backend build

WORKDIR /repo/backend

EXPOSE 4000

CMD ["node", "dist/main.js"]
