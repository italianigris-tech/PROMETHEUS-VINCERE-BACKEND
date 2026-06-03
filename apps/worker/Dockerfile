FROM nvidia/cuda:12.1.1-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    NODE_ENV=production \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome \
    REMOTION_CHROMIUM_HEADLESS_MODE=new \
    REMOTION_BROWSER_EXECUTABLE=/usr/bin/google-chrome

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      ffmpeg \
      fonts-liberation \
      gnupg \
      libasound2 \
      libatk-bridge2.0-0 \
      libatk1.0-0 \
      libcups2 \
      libdrm2 \
      libgbm1 \
      libgtk-3-0 \
      libnss3 \
      libx11-xcb1 \
      libxcomposite1 \
      libxdamage1 \
      libxrandr2 \
      xdg-utils \
    && curl -fsSL https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google-linux.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-linux.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends google-chrome-stable \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/shared-types/tsconfig.json packages/shared-types/tsconfig.json
COPY packages/shared-types/src packages/shared-types/src
COPY apps/worker/package.json apps/worker/package.json
COPY apps/worker/tsconfig.json apps/worker/tsconfig.json
COPY apps/worker/remotion.config.ts apps/worker/remotion.config.ts

WORKDIR /app/packages/shared-types
RUN npm install --include=dev
RUN npm run build

WORKDIR /app/apps/worker
RUN npm install --include=dev

COPY apps/worker/src src
COPY apps/worker/public public

RUN npm run build

CMD ["node", "dist/index.js"]
