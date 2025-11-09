# Multi-stage build for CSV to Azure SQL Importer

# Stage 1: Build the client
FROM node:22-alpine AS client-builder
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY client/package.json ./client/

# Install pnpm and dependencies
RUN npm install -g pnpm@latest
RUN pnpm install --frozen-lockfile

# Copy client source
COPY client ./client
COPY shared ./shared

# Build client
RUN pnpm --filter client build

# Stage 2: Build the server
FROM node:22-alpine AS server-builder
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY server/package.json ./server/

# Install pnpm and dependencies
RUN npm install -g pnpm@latest
RUN pnpm install --frozen-lockfile --prod

# Copy server source
COPY server ./server
COPY shared ./shared
COPY drizzle ./drizzle

# Stage 3: Production image
FROM node:22-alpine
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@latest

# Copy dependencies and built files
COPY --from=server-builder /app/node_modules ./node_modules
COPY --from=server-builder /app/package.json ./package.json
COPY --from=server-builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=client-builder /app/client/dist ./client/dist
COPY --from=server-builder /app/server ./server
COPY --from=server-builder /app/shared ./shared
COPY --from=server-builder /app/drizzle ./drizzle

# Expose port
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Start the server
CMD ["node", "server/index.js"]
