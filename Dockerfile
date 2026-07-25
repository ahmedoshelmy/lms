# Stage 1: Build the Angular application
FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy codebase and build
COPY . .
RUN npm run build -- --configuration production

# Stage 2: Serve the application using Nginx
FROM nginx:alpine

# Copy nginx fallback routing configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy build artifacts to Nginx doc root
COPY --from=build /app/dist/lms-platform/browser /usr/share/nginx/html

# Ensure index.html exists if Angular SSR generated index.csr.html
RUN if [ -f /usr/share/nginx/html/index.csr.html ]; then cp /usr/share/nginx/html/index.csr.html /usr/share/nginx/html/index.html; fi

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
