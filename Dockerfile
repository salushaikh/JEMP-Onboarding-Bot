# Multi-stage Dockerfile for Jobless Empire (JEMP) Discord Bot & Dashboard
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies if needed
RUN apk add --no-cache python3 make g++

# Install npm packages
COPY package.json ./
RUN npm install

# Copy application source code
COPY . .

# Build Vite frontend and bundled Node server
RUN npm run build

# Production runtime stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies
COPY package.json ./
RUN npm install --omit=dev

# Copy compiled build artifacts from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/database/schema.sql ./src/database/schema.sql
COPY --from=builder /app/metadata.json ./metadata.json

# Expose web dashboard and API port
EXPOSE 3000

# Start server
CMD ["node", "dist/server.cjs"]
