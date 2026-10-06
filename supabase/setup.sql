-- ============================================================
-- HRMS — Setup schema untuk Supabase self-hosted
-- Jalankan sekali via psql / Supabase SQL editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  username    TEXT NOT NULL UNIQUE,
  password    TEXT NOT NULL,
  full_name   TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'employee',      -- HRMS: 'admin' | 'employee'
  user_type   TEXT NOT NULL DEFAULT 'karyawan',      -- OKR: 'admin' | 'karyawan'
  ktp         TEXT,
  nik         TEXT,
  division    TEXT,
  birth_place TEXT,
  birth_date  TEXT,
  sex         TEXT,
  address     TEXT,
  ktp_verified BOOLEAN NOT NULL DEFAULT FALSE,
  avatar_color TEXT,
  avatar_url TEXT,
  phone       TEXT,
  personal_email TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  suspended   BOOLEAN NOT NULL DEFAULT FALSE,
  primary_jobs JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{label, target, unit: 'qty'|'nominal'}, ...] maks 3, diset admin
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migrasi tambahan (idempotent — aman dijalankan ulang di Supabase SQL editor)
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS personal_email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS primary_jobs JSONB NOT NULL DEFAULT '[]'::jsonb;
-- Tabel user_jobs lama sudah digantikan oleh kolom users.primary_jobs (JSONB).

CREATE TABLE IF NOT EXISTS leave_balances (
  id          SERIAL PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year        INTEGER NOT NULL,
  total_quota INTEGER NOT NULL DEFAULT 12,
  used        INTEGER NOT NULL DEFAULT 0,
  UNIQUE (user_id, year)
);

CREATE TABLE IF NOT EXISTS leave_adjustments (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year        INTEGER NOT NULL,
  start_date  DATE,
  end_date    DATE,
  days        INTEGER NOT NULL DEFAULT 0,
  reason      TEXT,
  adjusted_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clock_records (
  id        SERIAL PRIMARY KEY,
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date      DATE NOT NULL,
  clock_in  TIME,
  clock_out TIME,
  UNIQUE (user_id, date)
);

CREATE TABLE IF NOT EXISTS pending_clocks (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username    TEXT NOT NULL,
  full_name   TEXT NOT NULL,
  date        DATE NOT NULL,
  type        TEXT NOT NULL,                -- 'clockIn' | 'clockOut'
  time        TIME NOT NULL,
  reason      TEXT,
  status      TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pengajuan (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username         TEXT NOT NULL,
  full_name        TEXT NOT NULL,
  type             TEXT NOT NULL,           -- 'cuti' | 'sakit' | 'lembur' | 'koreksi' | 'lainnya'
  start_date       DATE NOT NULL,
  end_date         DATE NOT NULL,
  reason           TEXT,
  clock_in_time    TIME,
  clock_out_time   TIME,
  status           TEXT NOT NULL DEFAULT 'pending',
  reviewed_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by_name TEXT,
  reviewed_at      TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS announcements (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  type       TEXT NOT NULL DEFAULT 'info',  -- 'info' | 'important' | 'urgent'
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS announcement_reads (
  id              TEXT PRIMARY KEY,
  announcement_id TEXT NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (announcement_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_announcement_reads_announcement ON announcement_reads (announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_reads_user ON announcement_reads (user_id);

CREATE TABLE IF NOT EXISTS events (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  start_date      DATE NOT NULL,
  end_date        DATE,
  location        TEXT,
  created_by      TEXT,
  status          TEXT NOT NULL DEFAULT 'approved',
  po_amount       BIGINT NOT NULL DEFAULT 0,
  po_category     TEXT,
  manpower        JSONB NOT NULL DEFAULT '[]',
  additional_costs JSONB NOT NULL DEFAULT '[]',
  reviewed_by_name TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS vouchers (
  id         TEXT PRIMARY KEY,
  event_id   TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  roles      JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL DEFAULT '',
  ref_id     TEXT,
  ref_type   TEXT,
  link       TEXT,
  read       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL UNIQUE,
  auth       TEXT NOT NULL,
  p256dh     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions (user_id);

CREATE TABLE IF NOT EXISTS locations (
  id     TEXT PRIMARY KEY,
  name   TEXT NOT NULL,
  lat    DOUBLE PRECISION NOT NULL,
  lng    DOUBLE PRECISION NOT NULL,
  radius INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS holidays (
  id         TEXT PRIMARY KEY,
  date       DATE NOT NULL,
  name       TEXT NOT NULL,
  category   TEXT NOT NULL DEFAULT 'nasional',
  source     TEXT NOT NULL DEFAULT 'custom',  -- 'api' | 'custom' | 'fallback'
  is_custom  BOOLEAN NOT NULL DEFAULT TRUE,
  is_global  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (date, source)
);

CREATE TABLE IF NOT EXISTS okr_inputs (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  work_date    DATE NOT NULL,
  category     TEXT NOT NULL DEFAULT 'lainnya',  -- 'utama' (pilih dari primary_jobs) | 'lainnya' (input bebas)
  job_label    TEXT,                            -- label job utama yang dipilih; NULL untuk 'lainnya'
  title        TEXT NOT NULL,                   -- judul bebas atau nama pekerjaan
  description  TEXT NOT NULL DEFAULT '',
  timestamp    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_okr_inputs_user_date ON okr_inputs (user_id, work_date DESC);
CREATE INDEX IF NOT EXISTS idx_okr_inputs_date ON okr_inputs (work_date);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

INSERT INTO settings (key, value) VALUES ('po_thresholds', '{"kecilMax": 50000000, "menengahMax": 200000000}')
  ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- Seed admin awal (username: admin, password: admin123)
-- Ganti password setelah login pertama.
-- ============================================================
INSERT INTO users (id, username, password, full_name, role, user_type, ktp_verified)
VALUES (
  'usr_admin_seed',
  'admin',
  '$2b$10$09P727Lv2pKMAHonyDTftu0Fbcw7S87fiHDGFS/Z8qKhpJMO0ZxDC',
  'Administrator',
  'admin',
  'admin',
  TRUE
)
ON CONFLICT (username) DO NOTHING;

-- ============================================================
-- CATATAN PENTING:
-- Karena frontend berjalan tanpa backend, anon key (yang terpasang
-- di bundle browser) berhak baca/tulis semua tabel. Pastikan:
--  1. RLS di tabel-tabel ini dalam keadaan NONAKTIF
--     (bawaan Supabase saat tabel dibuat via SQL — sudah otomatis).
--  2. Jangan pernah menyimpan data yang sangat sensitif di sini
--     selama belum ada kebijakan RLS yang membatasi akses.
-- ============================================================

-- ============================================================
-- Audit webhook Didit (verifikasi KTP async)
-- ============================================================
CREATE TABLE IF NOT EXISTS didit_webhooks (
  event_id      TEXT PRIMARY KEY,
  webhook_type  TEXT NOT NULL,
  session_id    TEXT,
  status        TEXT,
  environment   TEXT,
  workflow_id   TEXT,
  vendor_data   TEXT,
  payload       JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Brute-force protection (login rate limiting)
-- ============================================================
CREATE TABLE IF NOT EXISTS login_attempts (
  id         BIGSERIAL PRIMARY KEY,
  username   TEXT NOT NULL,
  ip         TEXT,
  success    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_lookup
  ON login_attempts (username, ip, created_at DESC);

-- ============================================================
-- Audit log — riwayat aksi admin
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id            TEXT PRIMARY KEY,
  actor_id      TEXT REFERENCES users(id) ON DELETE SET NULL,
  actor_name    TEXT,
  action        TEXT NOT NULL,
  target_type   TEXT,
  target_id     TEXT,
  detail        JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs (created_at DESC);

-- Supabase mengaktifkan RLS default untuk tabel buatan SQL editor.
-- Sistem ini dirancang tanpa RLS (anon key full access), dan tanpa
-- policy insert/select via anon key gagal diam-diam — aksi admin/
-- superadmin tidak pernah masuk riwayat aktivitas.
ALTER TABLE IF EXISTS audit_logs DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- Superadmin pertama — bootstrap anti-lockout.
-- Promote 'goden' HANYA jika belum ada superadmin sama sekali,
-- supaya restart/migrasi ulang tidak mengembalikan role yang
-- sengaja diturunkan oleh superadmin lain.
-- ============================================================
UPDATE users SET role = 'superadmin', user_type = 'admin'
WHERE username = 'goden'
  AND NOT EXISTS (SELECT 1 FROM users WHERE role = 'superadmin');
