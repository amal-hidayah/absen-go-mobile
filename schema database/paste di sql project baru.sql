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

-- Edge Function manage-employee-account memakai service_role.
-- Tanpa GRANT ini fungsi gagal membaca login_accounts dan salah melaporkan 403.
GRANT ALL ON public.company_settings   TO service_role;
GRANT ALL ON public.employees          TO service_role;
GRANT ALL ON public.company_attendance TO service_role;
GRANT ALL ON public.login_accounts     TO service_role;

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

-- =============================================================================
-- 13. PENCATATAN PRESENSI DARI SERVER (record_attendance)
--
-- Aturan jam kerja ditegakkan di server, bukan di browser, supaya tidak bisa
-- dilewati: policy tulis untuk karyawan dihapus dan diganti oleh satu fungsi
-- yang membaca jam server + company_settings.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 13.1 Hash QR. Harus IDENTIK dengan generateQrHash() di src/lib/presensi.ts.
--       Modulus bilangan prima dipakai supaya tidak ada overflow integer
--       32-bit di JavaScript maupun 64-bit di PostgreSQL, jadi kedua sisi
--       pasti menghitung nilai yang sama tanpa perlu meniru semantik bit JS.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.absengo_qr_hash(_secret TEXT, _window BIGINT)
RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  v_str  TEXT := _secret || '-' || _window;
  v_hash BIGINT := 0;
  v_i    INT;
BEGIN
  FOR v_i IN 1..length(v_str) LOOP
    v_hash := (v_hash * 31 + ascii(substr(v_str, v_i, 1))) % 1000000007;
  END LOOP;
  RETURN v_hash::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.absengo_qr_hash(TEXT, BIGINT) FROM PUBLIC, anon;

-- ----------------------------------------------------------------------------
-- 13.2 Catat satu hasil pindai.
--
--   v_now < start - 60 menit            -> ditolak, presensi belum dibuka
--   clock_in kosong                     -> catat MASUK
--        (terlambat dihitung dari jam masuk + toleransi)
--   clock_in ada, clock_out kosong,
--     v_now < work_end_time             -> DITOLAK, belum waktunya pulang
--   clock_in ada, clock_out kosong      -> catat PULANG
--   keduanya sudah terisi              -> ditolak, sudah lengkap
--
--   Pengzyp: "clock_in kosong tapi sudah lewat jam pulang" (karyawan lupa
--   scan di pagi hari) tetap dicatat sebagai MASUK dengan status terlambat,
--   bukan diisi dengan jam kantor. Gaji baru dihitung kalau clock_in dan
--   clock_out keduanya ada, jadi hari itu butuh satu scan lagi.
--
--   QR diverifikasi di sini memakai qr_secret milik server, sehingga rahasia
--   tidak lagi perlu dikirim ke browser karyawan.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_attendance(p_qr_payload TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp     UUID;
  v_aktif   BOOLEAN;
  v_secret  TEXT;
  v_start   TIME;
  v_end     TIME;
  v_tol     INT;
  v_hari    DATE;
  v_jam     TIME;
  v_m_now   INT;
  v_m_start INT;
  v_m_end   INT;
  v_payload JSONB;
  v_w       BIGINT;
  v_h       TEXT;
  v_cur     RECORD;
  v_status  TEXT := 'hadir';
  v_late    INT := 0;
  v_aksi    TEXT;
BEGIN
  SELECT qr_secret, work_start_time, late_tolerance_minutes, work_end_time
    INTO v_secret, v_start, v_end, v_tol
    FROM public.company_settings WHERE id = 1;

  IF v_secret IS NULL OR v_start IS NULL OR v_end IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'kode', 'PENGATURAN',
      'pesan', 'Pengaturan kantor belum lengkap. Hubungi admin.');
  END IF;

  -- Verifikasi QR (toleransi 3 window, sekitar 15 detik)
  BEGIN
    v_payload := p_qr_payload::JSONB;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'kode', 'FORMAT',
      'pesan', 'Format QR Code tidak dikenali.');
  END;

  IF v_payload ->> 'app' IS DISTINCT FROM 'ABSENGO-CORP' THEN
    RETURN jsonb_build_object('ok', false, 'kode', 'BUKAN_QR',
      'pesan', 'Bukan QR Code resmi presensi kantor.');
  END IF;

  v_w := (v_payload ->> 'w')::BIGINT;
  v_h := v_payload ->> 'h';
  IF v_w IS NULL OR v_h IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'kode', 'FORMAT',
      'pesan', 'Format QR Code tidak dikenali.');
  END IF;

  IF abs(floor(extract(epoch FROM now()) / 5)::BIGINT - v_w) > 3 THEN
    RETURN jsonb_build_object('ok', false, 'kode', 'KADALUARSA',
      'pesan', 'QR Code sudah kadaluarsa (berubah tiap 5 detik). Scan ulang layar kantor.');
  END IF;

  IF v_h <> public.absengo_qr_hash(v_secret, v_w) THEN
    RETURN jsonb_build_object('ok', false, 'kode', 'TIDAK_COCOK',
      'pesan', 'Kode QR tidak cocok dengan server kantor.');
  END IF;

  -- Siapa yang memindai
  v_emp := public.current_employee_id();
  IF v_emp IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'kode', 'TANPA_PROFIL',
      'pesan', 'Data profil karyawan Anda belum terdaftar di sistem.');
  END IF;

  SELECT active INTO v_aktif FROM public.employees WHERE id = v_emp;
  IF v_aktif IS NULL OR NOT v_aktif THEN
    RETURN jsonb_build_object('ok', false, 'kode', 'NONAKTIF',
      'pesan', 'Akun karyawan Anda sedang tidak aktif. Hubungi admin.');
  END IF;

  v_hari    := (now() AT TIME ZONE 'Asia/Jakarta')::DATE;
  v_jam     := (now() AT TIME ZONE 'Asia/Jakarta')::TIME;
  v_m_start := EXTRACT(HOUR FROM v_start)::INT * 60 + EXTRACT(MINUTE FROM v_start)::INT;
  v_m_end   := EXTRACT(HOUR FROM v_end)::INT * 60 + EXTRACT(MINUTE FROM v_end)::INT;
  v_m_now   := EXTRACT(HOUR FROM v_jam)::INT * 60 + EXTRACT(MINUTE FROM v_jam)::INT;

  SELECT * INTO v_cur FROM public.company_attendance
   WHERE employee_id = v_emp AND attend_date = v_hari;

  -- MASUK
  IF v_cur IS NULL OR v_cur.clock_in IS NULL THEN
    IF v_m_now < v_m_start - 60 THEN
      RETURN jsonb_build_object('ok', false, 'kode', 'BELUM_BUKA',
        'pesan', 'Presensi belum dibuka. Jam masuk pukul ' || to_char(v_start, 'HH24:MI') || '.',
        'jam_masuk', to_char(v_start, 'HH24:MI'),
        'sekarang', to_char(v_jam, 'HH24:MI'));
    END IF;

    IF v_m_now > v_m_start + v_tol THEN
      v_status := 'terlambat';
      v_late   := v_m_now - v_m_start;
    END IF;

    INSERT INTO public.company_attendance
      (employee_id, attend_date, clock_in, status, late_minutes, recorded_by)
    VALUES
      (v_emp, v_hari, v_jam, v_status, v_late, auth.uid())
    ON CONFLICT (employee_id, attend_date) DO UPDATE
      SET clock_in    = EXCLUDED.clock_in,
          status      = EXCLUDED.status,
          late_minutes = EXCLUDED.late_minutes,
          updated_at  = now()
      WHERE company_attendance.clock_in IS NULL
        AND company_attendance.clock_out IS NULL
    RETURNING clock_in INTO v_jam;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'kode', 'SUDAH_TERCATAT',
        'pesan', 'Presensi Anda hari ini sudah tercatat. Silakan cek dasbor.');
    END IF;

    v_aksi := 'masuk';
    RETURN jsonb_build_object('ok', true, 'aksi', v_aksi,
      'jam', to_char(v_jam, 'HH24:MI'), 'status', v_status,
      'late_minutes', v_late, 'jam_pulang', to_char(v_end, 'HH24:MI'));

  -- PULANG
  ELSIF v_cur.clock_out IS NULL THEN
    IF v_m_now < v_m_end THEN
      RETURN jsonb_build_object('ok', false, 'kode', 'BELUM_WAKTU_PULANG',
        'pesan', 'Absen pulang belum bisa. Jam pulang pukul ' || to_char(v_end, 'HH24:MI') || '.',
        'jam_pulang', to_char(v_end, 'HH24:MI'),
        'sekarang', to_char(v_jam, 'HH24:MI'),
        'jam_masuk_tercatat', to_char(v_cur.clock_in, 'HH24:MI'));
    END IF;

    UPDATE public.company_attendance
       SET clock_out = v_jam, updated_at = now()
     WHERE employee_id = v_emp
       AND attend_date = v_hari
       AND clock_in IS NOT NULL
       AND clock_out IS NULL
    RETURNING clock_out INTO v_jam;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'kode', 'SUDAH_TERCATAT',
        'pesan', 'Presensi Anda hari ini sudah tercatat. Silakan cek dasbor.');
    END IF;

    v_aksi := 'pulang';
    RETURN jsonb_build_object('ok', true, 'aksi', v_aksi,
      'jam', to_char(v_jam, 'HH24:MI'), 'status', v_cur.status,
      'late_minutes', v_cur.late_minutes, 'jam_pulang', to_char(v_end, 'HH24:MI'));

  -- SUDAH LENGKAP
  ELSE
    RETURN jsonb_build_object('ok', false, 'kode', 'SUDAH_LENGKAP',
      'pesan', 'Presensi hari ini sudah lengkap.',
      'jam_masuk', to_char(v_cur.clock_in, 'HH24:MI'),
      'jam_pulang', to_char(v_cur.clock_out, 'HH24:MI'));
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.record_attendance(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_attendance(TEXT) TO authenticated;

-- ----------------------------------------------------------------------------
-- 13.3 Tutup jalanTulis langsung dari browser.
--         Karyawan tidak lagi boleh menulis company_attendance; satu-satunya
--         jalan adalah record_attendance() yang memvalidasi jam dan QR.
--         Admin tetap boleh menulis manual (form "Catat Presensi Manual").
--         Grant tidak dicabut: RLS dan GRANT adalah dua lapisan terpisah, dan
--         mencabut GRANT akan mematikan juga ability admin.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "attendance insert self or admin" ON public.company_attendance;
DROP POLICY IF EXISTS "attendance update self or admin" ON public.company_attendance;

CREATE POLICY "attendance insert admin only" ON public.company_attendance
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "attendance update admin only" ON public.company_attendance
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- =============================================================================
-- MIGRATION: AbsenGo Corporate Mobile (Geofence + Selfie Evidence)
-- =============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. PENGATURAN KANTOR (Tambahan Koordinat & Radius) & PERSETUJUAN
-- ----------------------------------------------------------------------------
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS office_lat NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS office_lng NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS office_radius_m INT NOT NULL DEFAULT 150,
  ADD COLUMN IF NOT EXISTS max_accuracy_m INT NOT NULL DEFAULT 100;

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS attendance_consent_at TIMESTAMPTZ;

-- ----------------------------------------------------------------------------
-- 2. FUNGSI JARAK (HAVERSINE DI LEVEL SQL)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.distance_m(
  lat1 DOUBLE PRECISION, lng1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION, lng2 DOUBLE PRECISION
) RETURNS DOUBLE PRECISION
LANGUAGE sql IMMUTABLE AS $$
  SELECT 6371000 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) *
    power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

GRANT EXECUTE ON FUNCTION public.distance_m(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated, anon;

-- ----------------------------------------------------------------------------
-- 3. TABEL BUKTI PRESENSI (attendance_evidence)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_evidence (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID NOT NULL REFERENCES public.company_attendance(id) ON DELETE CASCADE,
  employee_id   UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL CHECK (kind IN ('masuk', 'pulang')),
  lat           DOUBLE PRECISION NOT NULL,
  lng           DOUBLE PRECISION NOT NULL,
  accuracy_m    DOUBLE PRECISION,
  distance_m    INT NOT NULL,
  is_mocked     BOOLEAN NOT NULL DEFAULT false,
  photo_path    TEXT,
  captured_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS attendance_evidence_att_idx
  ON public.attendance_evidence (attendance_id);
CREATE INDEX IF NOT EXISTS attendance_evidence_emp_idx
  ON public.attendance_evidence (employee_id);

ALTER TABLE public.attendance_evidence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "evidence read self or admin" ON public.attendance_evidence;
CREATE POLICY "evidence read self or admin" ON public.attendance_evidence
  FOR SELECT TO authenticated
  USING (public.is_admin() OR employee_id = public.current_employee_id());

DROP POLICY IF EXISTS "evidence delete admin" ON public.attendance_evidence;
CREATE POLICY "evidence delete admin" ON public.attendance_evidence
  FOR DELETE TO authenticated USING (public.is_admin());

GRANT SELECT ON public.attendance_evidence TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.attendance_evidence FROM authenticated, anon;

-- ----------------------------------------------------------------------------
-- 4. HELPER JAM PRESENSI: absengo_record_clock
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.absengo_record_clock(p_emp UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_aktif   BOOLEAN;
  v_start   TIME;
  v_end     TIME;
  v_tol     INT;
  v_hari    DATE;
  v_jam     TIME;
  v_m_now   INT;
  v_m_start INT;
  v_m_end   INT;
  v_cur     RECORD;
  v_status  TEXT := 'hadir';
  v_late    INT := 0;
  v_aksi    TEXT;
  v_att_id  UUID;
BEGIN
  SELECT work_start_time, late_tolerance_minutes, work_end_time
    INTO v_start, v_tol, v_end
    FROM public.company_settings WHERE id = 1;

  IF v_start IS NULL OR v_end IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'kode', 'PENGATURAN',
      'pesan', 'Pengaturan jam kerja kantor belum lengkap. Hubungi administrator.');
  END IF;

  SELECT active INTO v_aktif FROM public.employees WHERE id = p_emp;
  IF v_aktif IS NULL OR NOT v_aktif THEN
    RETURN jsonb_build_object('ok', false, 'kode', 'NONAKTIF',
      'pesan', 'Akun karyawan Anda sedang tidak aktif. Hubungi administrator.');
  END IF;

  v_hari    := (now() AT TIME ZONE 'Asia/Jakarta')::DATE;
  v_jam     := (now() AT TIME ZONE 'Asia/Jakarta')::TIME;
  v_m_start := EXTRACT(HOUR FROM v_start)::INT * 60 + EXTRACT(MINUTE FROM v_start)::INT;
  v_m_end   := EXTRACT(HOUR FROM v_end)::INT * 60 + EXTRACT(MINUTE FROM v_end)::INT;
  v_m_now   := EXTRACT(HOUR FROM v_jam)::INT * 60 + EXTRACT(MINUTE FROM v_jam)::INT;

  SELECT * INTO v_cur FROM public.company_attendance
   WHERE employee_id = p_emp AND attend_date = v_hari;

  -- 4.1 ABSEN MASUK
  IF v_cur IS NULL OR v_cur.clock_in IS NULL THEN
    IF v_m_now < v_m_start - 60 THEN
      RETURN jsonb_build_object('ok', false, 'kode', 'BELUM_BUKA',
        'pesan', 'Presensi belum dibuka. Jam masuk pukul ' || to_char(v_start, 'HH24:MI') || '.',
        'jam_masuk', to_char(v_start, 'HH24:MI'),
        'sekarang', to_char(v_jam, 'HH24:MI'));
    END IF;

    IF v_m_now > v_m_start + coalesce(v_tol, 0) THEN
      v_status := 'terlambat';
      v_late   := v_m_now - v_m_start;
    END IF;

    INSERT INTO public.company_attendance
      (employee_id, attend_date, clock_in, status, late_minutes, recorded_by)
    VALUES
      (p_emp, v_hari, v_jam, v_status, v_late, auth.uid())
    ON CONFLICT (employee_id, attend_date) DO UPDATE
      SET clock_in     = EXCLUDED.clock_in,
          status       = EXCLUDED.status,
          late_minutes = EXCLUDED.late_minutes,
          updated_at   = now()
      WHERE company_attendance.clock_in IS NULL
        AND company_attendance.clock_out IS NULL
    RETURNING id, clock_in INTO v_att_id, v_jam;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'kode', 'SUDAH_TERCATAT',
        'pesan', 'Presensi Anda hari ini sudah tercatat. Silakan cek dasbor.');
    END IF;

    v_aksi := 'masuk';
    RETURN jsonb_build_object(
      'ok', true,
      'aksi', v_aksi,
      'jam', to_char(v_jam, 'HH24:MI'),
      'status', v_status,
      'late_minutes', v_late,
      'jam_pulang', to_char(v_end, 'HH24:MI'),
      'attendance_id', v_att_id
    );

  -- 4.2 ABSEN PULANG
  ELSIF v_cur.clock_out IS NULL THEN
    IF v_m_now < v_m_end THEN
      RETURN jsonb_build_object(
        'ok', false,
        'kode', 'BELUM_WAKTU_PULANG',
        'pesan', 'Belum waktunya pulang. Jam pulang pukul ' || to_char(v_end, 'HH24:MI') || '.',
        'jam_masuk', to_char(v_cur.clock_in, 'HH24:MI'),
        'jam_pulang', to_char(v_end, 'HH24:MI'),
        'sekarang', to_char(v_jam, 'HH24:MI')
      );
    END IF;

    UPDATE public.company_attendance
       SET clock_out  = v_jam,
           updated_at = now()
     WHERE id = v_cur.id
    RETURNING id, clock_out INTO v_att_id, v_jam;

    v_aksi := 'pulang';
    RETURN jsonb_build_object(
      'ok', true,
      'aksi', v_aksi,
      'jam', to_char(v_jam, 'HH24:MI'),
      'status', v_cur.status,
      'late_minutes', v_cur.late_minutes,
      'jam_masuk', to_char(v_cur.clock_in, 'HH24:MI'),
      'jam_pulang', to_char(v_end, 'HH24:MI'),
      'attendance_id', v_att_id
    );

  -- 4.3 SUDAH LENGKAP
  ELSE
    RETURN jsonb_build_object(
      'ok', false,
      'kode', 'SUDAH_LENGKAP',
      'pesan', 'Presensi hari ini sudah lengkap (masuk dan pulang sudah tercatat).',
      'jam_masuk', to_char(v_cur.clock_in, 'HH24:MI'),
      'jam_pulang', to_char(v_cur.clock_out, 'HH24:MI')
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.absengo_record_clock(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.absengo_record_clock(UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 5. RPC ABSEN GEOFENCE + BUKTI FOTO (record_attendance_geo)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_attendance_geo(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_accuracy_m DOUBLE PRECISION,
  p_is_mocked BOOLEAN,
  p_photo_path TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp        UUID;
  v_office_lat NUMERIC;
  v_office_lng NUMERIC;
  v_radius     INT;
  v_max_acc    INT;
  v_start      TIME;
  v_end        TIME;
  v_dist       INT;
  v_clock_res  JSONB;
  v_att_id     UUID;
  v_aksi       TEXT;
BEGIN
  -- 1. Baca company_settings
  SELECT office_lat, office_lng, office_radius_m, max_accuracy_m, work_start_time, work_end_time
    INTO v_office_lat, v_office_lng, v_radius, v_max_acc, v_start, v_end
    FROM public.company_settings WHERE id = 1;

  IF v_office_lat IS NULL OR v_office_lng IS NULL OR v_start IS NULL OR v_end IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'kode', 'PENGATURAN',
      'pesan', 'Pengaturan lokasi kantor belum ditentukan oleh administrator.');
  END IF;

  -- 2. Tentukan karyawan
  v_emp := public.current_employee_id();
  IF v_emp IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'kode', 'TANPA_PROFIL',
      'pesan', 'Data profil karyawan Anda belum terdaftar di sistem.');
  END IF;

  -- 3. Cek keaktifan akun
  IF NOT EXISTS (SELECT 1 FROM public.employees WHERE id = v_emp AND active = true) THEN
    RETURN jsonb_build_object('ok', false, 'kode', 'NONAKTIF',
      'pesan', 'Akun karyawan Anda sedang tidak aktif. Hubungi administrator.');
  END IF;

  -- 4. Deteksi lokasi palsu (Mock Location)
  IF p_is_mocked IS TRUE THEN
    RETURN jsonb_build_object('ok', false, 'kode', 'LOKASI_PALSU',
      'pesan', 'Lokasi palsu terdeteksi. Nonaktifkan aplikasi mock location pada perangkat Anda.');
  END IF;

  -- 5. Validasi akurasi GPS
  IF p_accuracy_m IS NULL OR p_accuracy_m <= 0 OR p_accuracy_m > v_max_acc THEN
    RETURN jsonb_build_object(
      'ok', false,
      'kode', 'LOKASI_TIDAK_AKURAT',
      'pesan', 'Sinyal GPS lemah atau tidak akurat (±' || round(coalesce(p_accuracy_m, 0))::text || ' m). Bergeserlah ke tempat terbuka.',
      'accuracy_m', p_accuracy_m,
      'max_accuracy_m', v_max_acc
    );
  END IF;

  -- 6. Validasi jarak ke radius kantor memakai distance_m
  v_dist := round(public.distance_m(v_office_lat::double precision, v_office_lng::double precision, p_lat, p_lng))::int;
  IF v_dist > v_radius THEN
    RETURN jsonb_build_object(
      'ok', false,
      'kode', 'DI_LUAR_RADIUS',
      'pesan', 'Anda berada di luar radius kantor (' || v_dist || ' m dari kantor, batas radius ' || v_radius || ' m).',
      'distance_m', v_dist,
      'radius_m', v_radius
    );
  END IF;

  -- 7. Validasi p_photo_path
  IF p_photo_path IS NULL OR trim(p_photo_path) = '' THEN
    RETURN jsonb_build_object('ok', false, 'kode', 'FOTO_TIDAK_ADA',
      'pesan', 'Foto selfie bukti kehadiran belum disertakan.');
  END IF;

  IF p_photo_path NOT LIKE (v_emp::text || '/%') THEN
    RETURN jsonb_build_object('ok', false, 'kode', 'FOTO_TIDAK_VALID',
      'pesan', 'Berkas foto tidak valid untuk karyawan ini.');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM storage.objects o
    WHERE o.bucket_id = 'attendance-photos'
      AND o.name = p_photo_path
  ) THEN
    RETURN jsonb_build_object('ok', false, 'kode', 'FOTO_TIDAK_ADA',
      'pesan', 'Foto absen tidak ditemukan di server penyimpanan. Ulangi pengambilan foto.');
  END IF;

  -- 8. Panggil absengo_record_clock
  v_clock_res := public.absengo_record_clock(v_emp);
  IF (v_clock_res ->> 'ok')::boolean IS NOT TRUE THEN
    RETURN v_clock_res;
  END IF;

  -- 9. Insert attendance_evidence
  v_att_id := (v_clock_res ->> 'attendance_id')::uuid;
  v_aksi   := v_clock_res ->> 'aksi';

  INSERT INTO public.attendance_evidence
    (attendance_id, employee_id, kind, lat, lng, accuracy_m, distance_m, is_mocked, photo_path)
  VALUES
    (v_att_id, v_emp, v_aksi, p_lat, p_lng, p_accuracy_m, v_dist, coalesce(p_is_mocked, false), p_photo_path);

  -- 10. Kembalikan respons sukses lengkap
  RETURN v_clock_res || jsonb_build_object(
    'distance_m', v_dist,
    'accuracy_m', round(p_accuracy_m)::int
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_attendance_geo(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_attendance_geo(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, BOOLEAN, TEXT) TO authenticated;

-- ----------------------------------------------------------------------------
-- 6. PENGATURAN PUBLIK (get_public_settings)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_settings()
RETURNS TABLE (
  company_name           TEXT,
  work_start_time        TIME,
  work_end_time          TIME,
  late_tolerance_minutes INT,
  office_lat             NUMERIC,
  office_lng             NUMERIC,
  office_radius_m        INT,
  max_accuracy_m         INT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_name, work_start_time, work_end_time, late_tolerance_minutes,
         office_lat, office_lng, office_radius_m, max_accuracy_m
  FROM public.company_settings WHERE id = 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_settings() TO authenticated, anon;

DROP POLICY IF EXISTS "settings read authenticated" ON public.company_settings;
DROP POLICY IF EXISTS "settings read admin" ON public.company_settings;
CREATE POLICY "settings read admin" ON public.company_settings
  FOR SELECT TO authenticated USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 7. PERSETUJUAN KARYAWAN (accept_attendance_consent)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_attendance_consent()
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_emp UUID := public.current_employee_id();
  v_at TIMESTAMPTZ;
BEGIN
  IF v_emp IS NULL THEN
    RAISE EXCEPTION 'Profil karyawan tidak ditemukan';
  END IF;

  UPDATE public.employees
     SET attendance_consent_at = coalesce(attendance_consent_at, now())
   WHERE id = v_emp
  RETURNING attendance_consent_at INTO v_at;

  RETURN v_at;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_attendance_consent() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_attendance_consent() TO authenticated;

-- ----------------------------------------------------------------------------
-- 8. STORAGE BUCKET: attendance-photos
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('attendance-photos', 'attendance-photos', false, 5242880, ARRAY['image/jpeg'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = 5242880,
      allowed_mime_types = ARRAY['image/jpeg'];

DROP POLICY IF EXISTS "attendance photo upload own" ON storage.objects;
CREATE POLICY "attendance photo upload own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'attendance-photos'
    AND (storage.foldername(name))[1] = public.current_employee_id()::text
  );

DROP POLICY IF EXISTS "attendance photo read own or admin" ON storage.objects;
CREATE POLICY "attendance photo read own or admin" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'attendance-photos'
    AND (public.is_admin() OR owner = auth.uid())
  );

DROP POLICY IF EXISTS "attendance photo delete own or admin" ON storage.objects;
CREATE POLICY "attendance photo delete own or admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'attendance-photos'
    AND (public.is_admin() OR owner = auth.uid())
  );

COMMIT;
