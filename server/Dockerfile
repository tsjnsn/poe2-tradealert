# Use Node.js 20 (LTS)
FROM node:20-slim

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Create app directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy app source
COPY . .

# Set production environment
ENV NODE_ENV=production

# Expose port (Cloud Run will override PORT)
ENV PORT=8080
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
    CMD curl -f http://localhost:$PORT/_health || exit 1

# Start the server
CMD ["node", "src/index.js"] 