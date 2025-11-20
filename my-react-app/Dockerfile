# Multi-stage Dockerfile for React frontend: build with Node, serve with nginx
FROM node:18-alpine as build
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
# Use --legacy-peer-deps to avoid peer dependency conflicts (react-scripts v5 vs TypeScript v5)
RUN npm install --legacy-peer-deps

# Copy source and build
COPY . .
RUN npm run build

FROM nginx:stable-alpine
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
