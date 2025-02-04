# Use Node.js LTS
FROM node:20-slim

# Install pnpm with specific version
RUN corepack enable && corepack prepare pnpm@9.14.2 --activate

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy app source
COPY . .

# Set environment variables
ENV NODE_ENV=production

# The port that your application listens to
ENV PORT=8080

# Cloud Run will use PORT environment variable
EXPOSE ${PORT}

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
    CMD curl -f http://localhost:$PORT/_health || exit 1

# Start the server
CMD [ "node", "src/index.js" ] 