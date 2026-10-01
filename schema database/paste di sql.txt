-- ============================================================================
-- ABSENGO — SCHEMA DATABASE PRESENSI KARYAWAN & GAJI HARIAN
-- ----------------------------------------------------------------------------
-- CARA PAKAI:
--   1. Buka Supabase Dashboard > SQL Editor > New query
--   2. Paste SELURUH isi file ini, lalu klik Run
--   3. Deploy Edge Function "manage-employee-account" (lihat README.md)
--   4. NONAKTIFKAN signup publik di Supabase > Authentication > Sign In /
--      Providers > Email > matikan "Allow new users to sign up"  [PENTING]
--
-- Script aman dijalankan ulang (idempotent).
--
-- MODEL AKUN:
--   - Semua akun yang dibuat di Supabase Auth otomatis jadi ADMIN
--     (username = email lengkap akun tersebut).
--   - Karyawan dibuat dari PANEL ADMIN, bukan daftar sendiri.
--     Panel admin membuat akun Supabase Auth + baris employees-nya sekaligus
--     lewat Edge Function "manage-employee-account".
--   - Halaman login hanya minta Username + Kata Sandi (tanpa email).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 0. BERSIHKAN SISA SCHEMA VERSI SEKOLAH (tidak dipakai aplikasi lagi)
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.attendance CASCADE;
DROP TABLE IF EXISTS public.students CASCADE;
DROP TABLE IF EXISTS public.settings CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_link_employee ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.link_employee_to_auth_user();
DROP FUNCTION IF EXISTS public.set_updated_at();
DROP FUNCTION IF EXISTS public.has_role(uuid, text);
DROP TYPE IF EXISTS public.app_role CASCADE;

-- ----------------------------------------------------------------------------
-- 1. PENGATURAN KANTOR
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_settings (
  id                     INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  company_name           TEXT        NOT NULL DEFAULT 'PT Sukses Mandiri',
  work_start_time        TIME        NOT NULL DEFAULT '08:00',
  late_tolerance_minutes INT         NOT NULL DEFAULT 15 CHECK (late_tolerance_minutes >= 0),
  work_end_time          TIME        NOT NULL DEFAULT '17:00',
  qr_secret              TEXT        NOT NULL DEFAULT 'absen-corp-secret-token',
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.company_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. KARYAWAN
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employees (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  nik          TEXT UNIQUE NOT NULL,
  full_name    TEXT NOT NULL,
  email        TEXT UNIQUE,
  department   TEXT NOT NULL DEFAULT 'Operasional',
  position     TEXT NOT NULL DEFAULT 'Staff',
  daily_salary NUMERIC(14, 2) NOT NULL DEFAULT 100000 CHECK (daily_salary >= 0),
  role         TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'employee')),
  active       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS employees_department_idx ON public.employees (department);
CREATE INDEX IF NOT EXISTS employees_active_idx ON public.employees (active);

-- ----------------------------------------------------------------------------
-- 3. PRESENSI (clock in / clock out)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_attendance (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  attend_date  DATE NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')::date,
  clock_in     TIME,
  clock_out    TIME,
  status       TEXT NOT NULL DEFAULT 'hadir'
               CHECK (status IN ('hadir', 'terlambat', 'izin', 'sakit', 'alfa')),
  late_minutes INT NOT NULL DEFAULT 0 CHECK (late_minutes >= 0),
  note         TEXT,
  recorded_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, attend_date)
);

CREATE INDEX IF NOT EXISTS company_attendance_date_idx ON public.company_attendance (attend_date DESC);
CREATE INDEX IF NOT EXISTS company_attendance_emp_idx  ON public.company_attendance (employee_id);

-- ----------------------------------------------------------------------------
-- 4. AKUN LOGIN (username -> email, pemetaan ke auth.users & karyawan)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.login_accounts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username     TEXT UNIQUE NOT NULL,
  email        TEXT UNIQUE NOT NULL,
  user_id      UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'employee')),
  employee_id  UUID UNIQUE REFERENCES public.employees(id) ON DELETE CASCADE,
  active       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger: samakan username/email ke huruf kecil
CREATE OR REPLACE FUNCTION public.login_accounts_normalize()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.username := lower(btrim(NEW.username));
  NEW.email    := lower(btrim(NEW.email));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS login_accounts_normalize ON public.login_accounts;
CREATE TRIGGER login_accounts_normalize BEFORE INSERT OR UPDATE ON public.login_accounts
  FOR EACH ROW EXECUTE FUNCTION public.login_accounts_normalize();

-- ----------------------------------------------------------------------------
-- 5. TRIGGER: updated_at otomatis
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS employees_touch ON public.employees;
CREATE TRIGGER employees_touch BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS company_attendance_touch ON public.company_attendance;
CREATE TRIGGER company_attendance_touch BEFORE UPDATE ON public.company_attendance
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS login_accounts_touch ON public.login_accounts;
CREATE TRIGGER login_accounts_touch BEFORE UPDATE ON public.login_accounts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- 6. TRIGGER: akun Auth baru otomatis jadi ADMIN
--    Edge Function akan menurunkan role-nya menjadi 'employee' untuk karyawan
--    yang dibuat dari panel admin.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Akun auth baru = admin, username memakai email lengkap
  INSERT INTO public.login_accounts (username, email, user_id, role, active)
  VALUES (lower(NEW.email), lower(NEW.email), NEW.id, 'admin', true)
  ON CONFLICT (email) DO UPDATE
    SET user_id = NEW.id, updated_at = now();

  -- Tautkan ke data karyawan dengan email yang sama (jika sudah ada)
  UPDATE public.employees
     SET user_id = NEW.id
   WHERE user_id IS NULL
     AND NEW.email IS NOT NULL
     AND lower(email) = lower(NEW.email);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ----------------------------------------------------------------------------
-- 7. FUNGSI BANTUAN ROLE (dipakai oleh policy RLS)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_employee_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT la.employee_id
       FROM public.login_accounts la
      WHERE la.user_id = auth.uid()
      LIMIT 1),
    (SELECT e.id
       FROM public.employees e
      WHERE e.user_id = auth.uid()
         OR (e.email IS NOT NULL AND e.email = lower(auth.jwt() ->> 'email'))
      LIMIT 1)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT la.role = 'admin' AND la.active
       FROM public.login_accounts la
      WHERE la.user_id = auth.uid()
      LIMIT 1),
    (SELECT e.role = 'admin' AND e.active
       FROM public.employees e
      WHERE e.user_id = auth.uid()
         OR (e.email IS NOT NULL AND e.email = lower(auth.jwt() ->> 'email'))
      LIMIT 1)
  );
$$;

-- Dipakai halaman login: mengubah username -> email sebelum autentikasi.
-- Hanya mengembalikan email untuk akun yang aktif.
CREATE OR REPLACE FUNCTION public.resolve_login_email(_username TEXT)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT la.email
    FROM public.login_accounts la
   WHERE la.username = lower(btrim(_username))
     AND la.active
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_employee_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resolve_login_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_employee_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_login_email(text) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
ALTER TABLE public.company_settings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_accounts     ENABLE ROW LEVEL SECURITY;

-- company_settings: semua user login boleh baca (butuh qr_secret untuk
-- verifikasi QR di HP), hanya admin yang boleh mengubah.
DROP POLICY IF EXISTS "settings read authenticated" ON public.company_settings;
CREATE POLICY "settings read authenticated" ON public.company_settings
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "settings write admin" ON public.company_settings;
CREATE POLICY "settings write admin" ON public.company_settings
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- employees: karyawan hanya boleh melihat datanya sendiri.
DROP POLICY IF EXISTS "employees read self or admin" ON public.employees;
CREATE POLICY "employees read self or admin" ON public.employees
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR user_id = auth.uid()
    OR (email IS NOT NULL AND email = lower(auth.jwt() ->> 'email'))
  );

DROP POLICY IF EXISTS "employees insert admin" ON public.employees;
CREATE POLICY "employees insert admin" ON public.employees
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "employees update admin" ON public.employees;
CREATE POLICY "employees update admin" ON public.employees
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "employees delete admin" ON public.employees;
CREATE POLICY "employees delete admin" ON public.employees
  FOR DELETE TO authenticated USING (public.is_admin());

-- company_attendance: karyawan hanya boleh melihat & mengubah presensinya sendiri.
DROP POLICY IF EXISTS "attendance read self or admin" ON public.company_attendance;
CREATE POLICY "attendance read self or admin" ON public.company_attendance
  FOR SELECT TO authenticated
  USING (public.is_admin() OR employee_id = public.current_employee_id());

DROP POLICY IF EXISTS "attendance insert self or admin" ON public.company_attendance;
CREATE POLICY "attendance insert self or admin" ON public.company_attendance
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR employee_id = public.current_employee_id());

DROP POLICY IF EXISTS "attendance update self or admin" ON public.company_attendance;
CREATE POLICY "attendance update self or admin" ON public.company_attendance
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR employee_id = public.current_employee_id())
  WITH CHECK (public.is_admin() OR employee_id = public.current_employee_id());

DROP POLICY IF EXISTS "attendance delete admin" ON public.company_attendance;
CREATE POLICY "attendance delete admin" ON public.company_attendance
  FOR DELETE TO authenticated USING (public.is_admin());

-- login_accounts: pengguna hanya boleh membaca akunnya sendiri.
-- Penulisan HANYA lewat Edge Function (service role), tidak ada policy INSERT/UPDATE.
DROP POLICY IF EXISTS "login_accounts read self or admin" ON public.login_accounts;
CREATE POLICY "login_accounts read self or admin" ON public.login_accounts
  FOR SELECT TO authenticated
  USING (public.is_admin() OR user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 9. HAK AKSES (anon tidak boleh menyentuh data ini)
-- ----------------------------------------------------------------------------
REVOKE ALL ON public.company_settings   FROM anon;
REVOKE ALL ON public.employees          FROM anon;
REVOKE ALL ON public.company_attendance FROM anon;
REVOKE ALL ON public.login_accounts     FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_settings   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_attendance TO authenticated;
GRANT SELECT ON public.login_accounts TO authenticated;

COMMIT;

-- ============================================================================
-- 10. DATA CONTOH (hapus blok ini kalau mau mulai dari kosong)
--     Data contoh hanya mengisi tabel employees — BELUM punya akun login.
--     Akun loginny dibuat dari Panel Admin > Tambah Karyawan.
-- ============================================================================
INSERT INTO public.employees (nik, full_name, email, department, position, daily_salary)
VALUES
  ('EMP001', 'Budi Santoso',   'budi@kantor.com',  'Operasional', 'Staff Lapangan',   150000),
  ('EMP002', 'Siti Rahma',     'siti@kantor.com',  'Keuangan',    'Staff Accounting', 175000),
  ('EMP003', 'Ahmad Fauzi',    'ahmad@kantor.com', 'IT',          'Web Developer',    200000),
  ('EMP004', 'Dewi Anggraeni', 'dewi@kantor.com',  'Marketing',   'Sales Marketing',  150000)
ON CONFLICT (nik) DO NOTHING;

-- ============================================================================
-- 11. BACKFILL AKUN ADMIN
--     Trigger di bagian 6 otomatis menjadikan akun Auth BARU sebagai admin.
--     Akun yang SUDAH ADA sebelum script ini dijalankan (termasuk akun admin
--     kamu yang sudah login sebelumnya) perlu dibuatkan barisnya di sini.
--     Hanya akun dengan email terverifikasi -- jadi aman dijalankan.
-- ============================================================================
INSERT INTO public.login_accounts (username, email, user_id, role)
SELECT lower(email), lower(email), id, 'admin'
  FROM auth.users
 WHERE email_confirmed_at IS NOT NULL
ON CONFLICT (email) DO UPDATE SET user_id = EXCLUDED.user_id;

-- Verifikasi:
-- SELECT username, email, role, active FROM public.login_accounts;

-- ============================================================================
-- 12. CATATAN KEAMANAN
-- ----------------------------------------------------------------------------
-- [!] PENTING: karena setiap akun Supabase Auth otomatis menjadi admin, signup
--     publik WAJIB dimatikan:
--     Supabase > Authentication > Sign In / Providers > Email >
--     matikan "Allow new users to sign up".
--     Kalau tidak dimatikan, siapa pun bisa daftar dan langsung jadi admin.
--
-- a) qr_secret dibaca oleh semua user login karena verifikasi QR dilakukan di
--    browser (HP karyawan). Artinya karyawan secara teknis bisa membuat QR
--    sendiri di luar kantor. Kalau ini tidak bisa diterima, verifikasi QR
--    harus dipindah ke Supabase Edge Function (server-side).
-- b) RLS menutup akses tulis: hanya admin yang bisa mengubah karyawan,
--    pengaturan kantor, dan presensi orang lain.
-- c) Tabel login_accounts hanya bisa dibaca user sendiri (atau admin) dan
--    hanya bisa ditulis melalui Edge Function.
-- ============================================================================