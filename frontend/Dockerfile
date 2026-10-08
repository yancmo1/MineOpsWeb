# The Vite bundle in dist/ is architecture-independent, so build it once
# on the native runner platform ($BUILDPLATFORM) instead of running npm
# under QEMU emulation for arm64 (which hangs 20+ min on a cold cache).
# CI targets `production`, so the development stage is never built there.
# NOTE: frontend/package-lock.json is stale vs package.json (npm ci fails);
# the repo's synced lockfile is the root workspace one. Keep npm install.
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

# Local development image (docker compose target: development).
FROM node:22-alpine AS development
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

FROM nginx:1.27-alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
