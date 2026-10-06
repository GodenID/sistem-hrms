-- ============================================================
-- Migrasi 2026-08-15 — hanya perubahan terbaru (aman dijalankan
-- berulang; semua statement idempotent).
--
-- Isi:
--   1. Kolom kontak di tabel users (phone, personal email,
--      kontak darurat)
--   2. Bootstrap superadmin pertama (username: goden)
--   3. Pastikan RLS nonaktif di audit_logs supaya worker
--      Cloudflare (anon key) bisa menulis riwayat aktivitas
--
-- Jalankan file INI SAJA di Supabase SQL editor — tidak perlu
-- menjalankan ulang setup.sql.
-- ============================================================

-- ---------- Kolom kontak & informasi tambahan ----------
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS personal_email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;

-- ---------- Superadmin pertama (anti-lockout) ----------
-- Promote 'goden' HANYA jika belum ada superadmin sama sekali,
-- supaya file ini aman dijalankan ulang tanpa mengembalikan role
-- yang sengaja diturunkan oleh superadmin lain.
UPDATE users SET role = 'superadmin', user_type = 'admin'
WHERE username = 'goden'
  AND NOT EXISTS (SELECT 1 FROM users WHERE role = 'superadmin');

-- ---------- Audit log: pastikan worker bisa menulis ----------
-- Supabase mengaktifkan RLS secara default untuk tabel yang dibuat
-- lewat SQL editor. Tanpa policy, insert/select via anon key gagal
-- diam-diam — aksi superadmin tidak pernah masuk riwayat aktivitas.
-- Sistem ini memang dirancang tanpa RLS (anon key full access,
-- sesuai catatan di setup.sql), jadi nonaktifkan untuk tabel audit.
ALTER TABLE IF EXISTS audit_logs DISABLE ROW LEVEL SECURITY;

