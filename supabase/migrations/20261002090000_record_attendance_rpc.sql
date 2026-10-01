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
