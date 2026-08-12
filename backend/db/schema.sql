-- HRMS PostgreSQL schema
-- Run via: node db/migrate.js

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
  suspended   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_jobs (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label            TEXT NOT NULL,
  type             TEXT NOT NULL DEFAULT 'standard', -- 'standard' | 'po'
  daily_target     INTEGER,
  monthly_target_idr BIGINT,
  client_type      TEXT,
  position         INTEGER NOT NULL DEFAULT 0,
  UNIQUE (user_id, position)
);

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
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  job_id       TEXT,
  job_label    TEXT,
  nominal_idr  BIGINT,
  customer_kind TEXT,                         -- 'baru' | 'lama'
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
