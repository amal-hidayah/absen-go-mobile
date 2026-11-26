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
