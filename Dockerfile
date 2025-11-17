# Production Dockerfile for CSV to Azure SQL Importer
FROM node:22-alpine

WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm@latest

# Copy all project files
COPY . .

# Install dependencies
RUN pnpm install

# Build the application
RUN pnpm run build

# Expose port
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Start the server
CMD ["node", "dist/index.js"]
