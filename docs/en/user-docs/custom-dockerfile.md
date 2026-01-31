---
title: Custom Docker Images for Additional Runtimes
---

<!-- Describe how to extend the backend image for extra runtimes. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124 -->

HookCode runs tasks inside the **backend** and **worker** containers. The default Dockerfile is optimized for Node.js only, so projects that require Python/Java/Ruby/Go must use a custom image.

## When to use a custom image

Create a custom Docker image when your repository needs:

- Python packages (`pip`, `poetry`)
- Java builds (`mvn`, `gradle`)
- Ruby gems (`bundle`)
- Go modules (`go`)

## Recommended workflow

1. **Copy the backend Dockerfile** and extend it.
2. **Add runtime packages** in the `apk add --no-cache` block.
3. **Point Docker Compose** to the custom Dockerfile for **both** backend and worker.

## Step 1: Create a custom Dockerfile

Create `backend/Dockerfile.custom` and start by copying the existing `backend/Dockerfile`. Then add the packages you need.

### Example: add Python runtime

```dockerfile
FROM node:18-alpine

WORKDIR /repo

# Base dependencies + Python runtime for project installs.
RUN apk add --no-cache \
    git \
    openssh-client \
    openssl \
    ca-certificates \
    python3 \
    py3-pip \
    make \
    g++

# (Keep the remaining steps identical to backend/Dockerfile)
```

### Example: add Java runtime

```dockerfile
FROM node:18-alpine

WORKDIR /repo

# Base dependencies + Java runtime for Maven/Gradle.
RUN apk add --no-cache \
    git \
    openssh-client \
    openssl \
    ca-certificates \
    openjdk17-jre \
    maven \
    make \
    g++

# (Keep the remaining steps identical to backend/Dockerfile)
```

### Example: add Ruby runtime

```dockerfile
FROM node:18-alpine

WORKDIR /repo

# Base dependencies + Ruby runtime for bundler.
RUN apk add --no-cache \
    git \
    openssh-client \
    openssl \
    ca-certificates \
    ruby \
    ruby-bundler \
    make \
    g++

# (Keep the remaining steps identical to backend/Dockerfile)
```

### Example: add Go runtime

```dockerfile
FROM node:18-alpine

WORKDIR /repo

# Base dependencies + Go runtime.
RUN apk add --no-cache \
    git \
    openssh-client \
    openssl \
    ca-certificates \
    go \
    make \
    g++

# (Keep the remaining steps identical to backend/Dockerfile)
```

### Example: multi-language image

```dockerfile
FROM node:18-alpine

WORKDIR /repo

# Base dependencies + multiple runtimes.
RUN apk add --no-cache \
    git \
    openssh-client \
    openssl \
    ca-certificates \
    python3 \
    py3-pip \
    openjdk17-jre \
    maven \
    ruby \
    ruby-bundler \
    go \
    make \
    g++

# (Keep the remaining steps identical to backend/Dockerfile)
```

## Step 2: Update Docker Compose

Point both `backend` and `worker` to the custom Dockerfile:

```yaml
services:
  backend:
    build:
      context: ..
      dockerfile: backend/Dockerfile.custom
  worker:
    build:
      context: ..
      dockerfile: backend/Dockerfile.custom
```

## Step 3: Rebuild and restart

```bash
docker compose -f docker/docker-compose.yml up -d --build
```

## Notes

- The frontend container does not need these runtimes.
- Keep the image minimal: only install the languages you require.
