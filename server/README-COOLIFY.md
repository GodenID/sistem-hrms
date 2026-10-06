# Migrasi HRMS → API sendiri di Coolify (lepas Supabase total)

Frontend tetap di Cloudflare Pages. Yang pindah ke Coolify: **Postgres + API Node**
(`server/`). Kontrak JSON `/api/*` tidak berubah, jadi frontend hanya perlu
menunjuk ke base URL baru.

## Arsitektur

```
Cloudflare Pages (frontend Vite) ──HTTPS──> Coolify: hrms-api ──> Coolify: Postgres
                                          /api/*  (Hono + pg)
```

- Logic bisnis = `functions/lib/*` (satu sumber kebenaran). Saat container
  API di-build, `npm run sync` meng-copy file itu ke `server/src/gen/`
  (hanya import `./core.js` → `./core-pg.js` yang di-rewrite).
- `server/src/core-pg.js` = primitif DB via Postgres langsung (API & error
  shape sama persis dengan versi PostgREST, termasuk JWT, audit, rate-limit,
  S3 avatar, OneSignal, Didit).

## Langkah 1 — Database Postgres di Coolify

1. Coolify → New Resource → Database → PostgreSQL 16. Catat **connection string**
   (pakai yang internal, mis. `postgres://…@postgres-xxx:5432/hrms`).
2. Terapkan skema (dari laptop/VPS yang bisa akses DB):
   ```
   psql "$DATABASE_URL" -f server/db/schema.sql
   ```

## Langkah 2 — Migrasi DATA dari Supabase lama

Butuh connection string Postgres Supabase lama (dashboard Supabase →
Database → Connection string, mode **Session** / port 5432).

```
# 1) Dump dari Supabase lama (data saja, tanpa RLS/policies Supabase)
pg_dump --data-only --no-owner --no-acl \
  "postgres://postgres.[ref]:[password]@db.[ref].supabase.co:5432/postgres" \
  -t users -t user_jobs -t leave_balances -t leave_adjustments \
  -t clock_records -t pending_clocks -t pengajuan -t announcements \
  -t announcement_reads -t events -t vouchers -t notifications \
  -t push_subscriptions -t locations -t holidays -t okr_inputs \
  -t settings -t didit_webhooks -t login_attempts -t audit_logs \
  -f hrms-data.sql

# 2) Restore ke Postgres Coolify (ON CONFLICT DO NOTHING agar idempotent)
psql "$DATABASE_URL" -f hrms-data.sql
```

> Catatan: kalau dump mengandung `SET row_security ...` / policy Supabase,
> hapus baris itu. Skema baru tidak memakai RLS — Postgres murni, akses
> hanya lewat API (AUTH_SECRET + JWT), tidak ada anon key lagi.

Alternatif tanpa pg_dump: export per-tabel CSV dari Supabase SQL editor lalu
`\copy` ke DB baru. Untuk tabel kecil (< 10rb baris) ini cukup.

## Langkah 3 — Deploy API di Coolify

1. Coolify → New Resource → Application → pilih repo ini.
2. **Build**: tipe `Dockerfile`, Dockerfile location = `server/Dockerfile`,
   Build Context = **root repo** (`.`).
3. **Domain**: pasang domain mis. `https://api-hrms.prasastigroup.id`.
4. **Environment** (isi dari `server/.env.example`):
   - `DATABASE_URL` (connection string Postgres Coolify)
   - `AUTH_SECRET` — **wajib sama** dengan secret Pages lama supaya token
     user yang sedang login tidak langsung invalid.
   - `CORS_ORIGIN=https://hrms.prasastigroup.id` (domain Pages kamu)
   - `S3_*`, `DIDIT_*`, `ONESIGNAL_*` — pindahkan dari secrets Pages.
5. Deploy. Cek `GET https://api-hrms.prasastigroup.id/health` → `{"status":"ok"}`.

## Langkah 4 — Arahkan frontend (Cloudflare Pages)

Set environment Pages: `VITE_API_URL=https://api-hrms.prasastigroup.id`
lalu rebuild. Selama `VITE_API_URL` belum di-set, frontend tetap memanggil
`/api/*` relatif (Pages Functions lama) — jadi migrasi bisa bertahap dan
rollback = hapus env + rebuild.

## Langkah 5 — Webhook Didit

Update URL webhook di console Didit ke:
`https://api-hrms.prasastigroup.id/webhooks/didit`

## Setiap ada perubahan functions/lib

Tidak perlu port manual: rebuild API di Coolify (otomatis `npm run sync`
saat build). Untuk dev lokal: `cd server && npm run sync`.

## Rollback

1. Hapus `VITE_API_URL` di Pages → rebuild (kembali ke Pages Functions +
   Supabase lama). Pastikan `SUPABASE_URL`/`SUPABASE_ANON_KEY` lama masih ada.
2. Data yang masuk ke Postgres Coolify selama masa migrasi perlu di-backup/
   di-replay bila rollback dilakukan setelah go-live.
