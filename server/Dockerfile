# HRMS API — image untuk Coolify (tipe deployment: Dockerfile).
# Konteks build = ROOT repo (bukan folder server/), karena logic
# bisnis di-sync dari functions/lib. Lihat server/README-COOLIFY.md.
# Layout di image (/app/server + /app/functions) disamakan dengan repo
# agar scripts/sync-lib.mjs menulis ke folder yang benar.
FROM node:20-alpine

WORKDIR /app/server

# 1) Dependencies server
COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

# 2) Source server + logic bisnis (sumber kebenaran)
COPY server/src ./src
COPY server/scripts ./scripts
COPY functions /app/functions

# 3) Generate src/gen dari functions/lib (gagal keras kalau path salah)
RUN npm run sync && test -f ./src/gen/router.js

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health | grep -q '"status":"ok"'

CMD ["node", "./src/index.js"]
