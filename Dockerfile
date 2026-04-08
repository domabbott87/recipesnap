FROM node:22-slim

# Install libsqlite3 for better-sqlite3 native bindings + sharp deps
RUN apt-get update && apt-get install -y \
    libsqlite3-dev \
    libvips-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy everything (including pre-built dist/)
COPY . .

# Install only production dependencies
RUN npm install --omit=dev --ignore-scripts=false

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/index.cjs"]
