FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY db ./db

EXPOSE 3001

HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3001/api/health || exit 1

# Migrasi schema lalu start server
CMD ["sh", "-c", "node db/migrate.js && node src/server.js"]
