# ---------- FRONTEND BUILD ----------
FROM node:18-alpine AS build

WORKDIR /app

# Copy only package files for caching
COPY package.json package-lock.json ./

# Install dependencies (cached unless dependencies change)
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build production bundle
RUN npm run build

# ---------- PRODUCTION NGINX ----------
FROM nginx:stable-alpine

# Remove default nginx page
RUN rm -rf /usr/share/nginx/html/*

# Copy build output from previous stage
COPY --from=build /app/build /usr/share/nginx/html

# Expose port
EXPOSE 80

# Start server
CMD ["nginx", "-g", "daemon off;"]
