# Use official lightweight Nginx image
FROM nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy our static assets (index.html, styles.css, app.js) to Nginx web root
COPY . /usr/share/nginx/html

# Expose port 80 to mapping
EXPOSE 80

# Start Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
