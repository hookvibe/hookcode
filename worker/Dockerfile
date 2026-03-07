FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache \
    bash \
    git \
    openssh-client \
    ca-certificates \
    python3 \
    make \
    g++

RUN corepack enable && corepack prepare pnpm@9.6.0 --activate

COPY package.json ./package.json
COPY tsconfig.json ./tsconfig.json
COPY tsconfig.jest.json ./tsconfig.jest.json
COPY jest.config.cjs ./jest.config.cjs
COPY src ./src

# Build the standalone worker image without copying backend sources so remote deployment stays self-contained. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
RUN pnpm install --no-frozen-lockfile && pnpm build

CMD ["node", "dist/main.js"]
