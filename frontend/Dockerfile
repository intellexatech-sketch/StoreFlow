# ---- Stage 1: build ----
FROM node:20-alpine AS build

WORKDIR /app

# Install deps (leverage docker cache)
COPY package.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copy source
COPY . .

# Build-time API base URL (defaults to /api/v1 when served through nginx)
ARG VITE_API_BASE_URL=/api/v1
ARG VITE_WS_BASE_URL=/api/v1/ws
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_WS_BASE_URL=$VITE_WS_BASE_URL

RUN npm run build

# ---- Stage 2: nginx ----
FROM nginx:1.27-alpine AS runtime

# Static site
COPY --from=build /app/dist /usr/share/nginx/html

# Nginx config with SPA fallback + reverse proxy to backend
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --spider -q http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
