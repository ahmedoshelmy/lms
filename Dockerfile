# Stage 1: build the app. Node 22, as CI uses.
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
# No browser download for Playwright: the end-to-end tests do not run here.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm ci

COPY . .
RUN npm run build -- --configuration production

# Stage 2: serve it with nginx.
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx-security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist/lms-platform/browser /usr/share/nginx/html

EXPOSE 80

# Up when nginx answers with the app. 127.0.0.1, not localhost: that can
# resolve to ::1 first, where nginx (listen 80) is not listening.
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1/index.html || exit 1

CMD ["nginx", "-g", "daemon off;"]
