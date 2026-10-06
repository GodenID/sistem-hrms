<div align="center">

# 🏢 Prasasti Connect — Sistem HRMS

**Absensi • Pengajuan Cuti • Event & Voucher • OKR • Pengumuman • Notifikasi**

[![Frontend](https://img.shields.io/badge/frontend-React%20%2B%20Vite-61dafb?style=flat-square&logo=react)](https://react.dev)
[![API](https://img.shields.io/badge/api-Node.js%20%2B%20Hono-000000?style=flat-square&logo=nodedotjs)](./server)
[![Database](https://img.shields.io/badge/database-PostgreSQL-4169e1?style=flat-square&logo=postgresql)](./server/db/schema.sql)
[![Deploy API](https://img.shields.io/badge/deploy%20api-Coolify-6d28d9?style=flat-square)](./server/README-COOLIFY.md)
[![Deploy Web](https://img.shields.io/badge/deploy%20web-Cloudflare%20Pages-f68204?style=flat-square)](https://pages.cloudflare.com)

_Aplikasi HR mobile-first untuk karyawan & admin: clock-in/out berbasis lokasi, pengajuan cuti/sakit/lembur, manajemen event, OKR harian, dan push notification._

</div>

---

## ✨ Fitur

| Modul | Keterangan |
|---|---|
| 🕒 **Absensi** | Clock-in/out dengan validasi GPS (radius kantor), jam server WIB anti-manipulasi, riwayat & koreksi manual via approval admin |
| 📝 **Pengajuan** | Cuti, sakit, lembur, koreksi absen — alur approve/reject + potong saldo cuti otomatis |
| 🏖️ **Cuti** | Kuota tahunan, penyesuaian saldo (cuti bersama), riwayat per karyawan |
| 📢 **Pengumuman** | Broadcast + tanda baca per user (siapa sudah/belum baca) |
| 🎪 **Event & Voucher** | Manajemen event, kategori PO otomatis, voucher per event |
| 🎯 **OKR** | Job utama per user + input harian, rekap tim |
| 🔔 **Notifikasi** | In-app + push (OneSignal), realtime per aksi |
| 👥 **Admin** | Kelola user/role (admin, superadmin), lokasi kantor, audit log, reset password |
| 🪪 **Verifikasi KTP** | OCR via Didit.me + webhook async |

## 🏗️ Arsitektur

```
┌─────────────────────┐      HTTPS       ┌──────────────────────┐      ┌────────────┐
│  Cloudflare Pages   │  ─────────────▶  │  Coolify: hrms-api   │ ───▶ │  Postgres  │
│  React + Vite (web) │   /api/* (JSON)  │  Node.js + Hono + pg │      │  (Coolify) │
└─────────────────────┘                  └──────────────────────┘      └────────────┘
```

- **Satu sumber kebenaran logic:** `functions/lib/*` (dipakai Cloudflare Pages Functions maupun API Coolify — di-sync otomatis via `npm run sync`, lihat [`server/`](./server)).
- **Kontrak API stabil:** frontend hanya memanggil `/api/*`; pindah backend tidak mengubah frontend selain `VITE_API_URL`.
- **Auth:** JWT HS256 (30 hari) + bcrypt, role `employee` / `admin` / `superadmin`, rate-limit login anti brute-force.
- **Avatar:** object storage S3-compatible (Onidel).

## 📁 Struktur Repo

```
├── src/                    # Frontend React (Pages, Context, Services, Components)
│   └── services/api.js     # Client API → pakai VITE_API_URL bila di-set
├── functions/lib/          # 🧠 Logic bisnis (sumber kebenaran, dipakai 2 backend)
├── functions/api/          # Backend lama: Cloudflare Pages Functions (PostgREST)
├── server/                 # Backend baru: API Node + Postgres untuk Coolify ⭐
│   ├── src/                # index.js (Hono), core-pg.js (DB pg), webhook
│   ├── db/schema.sql       # Skema Postgres murni
│   ├── Dockerfile          # Image Coolify
│   └── README-COOLIFY.md   # 📖 Panduan migrasi & deploy Coolify
├── supabase/               # Skema/seed era Supabase (arsip)
└── public/ dist/           # Aset statis & hasil build
```

## 🚀 Quick Start (Lokal)

**Frontend:**
```bash
npm install
npm run dev        # → http://localhost:5173
```

**API + Postgres (butuh Docker):**
```bash
cd server
cp .env.example .env        # isi AUTH_SECRET & DATABASE_URL
docker compose up --build   # API → http://localhost:3000
psql "$DATABASE_URL" -f db/schema.sql   # skema (cukup sekali)
```

**Frontend ↔ API lokal:** buat `.env` di root berisi
```
VITE_API_URL=http://localhost:3000
```
lalu `npm run dev` lagi. Kosongkan = frontend pakai `/api/*` relatif (mode Pages).

## ☁️ Deploy

| Layanan | Cara | Detail |
|---|---|---|
| API + DB | **Coolify** | Ikuti [`server/README-COOLIFY.md`](./server/README-COOLIFY.md) — Postgres → restore data → Application (Dockerfile `server/Dockerfile`, context root repo) → isi env |
| Web | **Cloudflare Pages** | Build `npm run build` (output `dist/`), env `VITE_API_URL=https://api-hrms….` |

Env penting API: `DATABASE_URL`, `AUTH_SECRET` (harus sama dengan secret lama agar token user tetap valid), `CORS_ORIGIN`, `S3_*`, `DIDIT_*`, `ONESIGNAL_*` — lihat [`server/.env.example`](./server/.env.example).

## 🔄 Migrasi Supabase → API Sendiri (ringkas)

1. Buat Postgres di Coolify → `psql -f server/db/schema.sql`
2. `pg_dump --data-only` 19 tabel dari Supabase lama → restore ke Postgres baru
3. Deploy `server/Dockerfile` di Coolify + isi env → cek `/health`
4. Set `VITE_API_URL` di Pages → rebuild. Rollback = hapus env → rebuild.

Panduan penuh: [`server/README-COOLIFY.md`](./server/README-COOLIFY.md).

## 🛠️ Tech Stack

**Frontend:** React 18 · Vite 5 · TailwindCSS · React Router · Recharts · Leaflet · PWA
**Backend:** Node.js 20 · Hono · `pg` · bcryptjs · Web Crypto JWT
**Infra:** Coolify (API + Postgres) · Cloudflare Pages (web) · S3 Onidel (avatar) · OneSignal (push) · Didit.me (OCR KTP)

## 📜 Scripts

| Perintah | Fungsi |
|---|---|
| `npm run dev` / `build` / `preview` | Frontend (root) |
| `cd server && npm run sync` | Sync `functions/lib` → `server/src/gen` (otomatis saat `npm start`/build Docker) |
| `cd server && npm start` | Jalankan API (`PORT` default 3000) |

---

<div align="center">
<em>Dibuat untuk Prasasti Group • Internal use</em>
</div>
