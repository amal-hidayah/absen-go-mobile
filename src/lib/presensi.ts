export interface Employee {
  id: string;
  user_id?: string | null;
  nik: string;
  full_name: string;
  email?: string | null;
  department: string;
  position: string;
  daily_salary: number;
  role: "admin" | "employee";
  active: boolean;
  created_at?: string;
}

export interface CompanyAttendance {
  id: string;
  employee_id: string;
  attend_date: string;
  clock_in: string | null;
  clock_out: string | null;
  status: "hadir" | "terlambat" | "izin" | "sakit" | "alfa";
  late_minutes: number;
  note: string | null;
  created_at?: string;
  employees?: Pick<
    Employee,
    "nik" | "full_name" | "department" | "position" | "daily_salary"
  > | null;
}

export interface CompanySettings {
  id: number;
  company_name: string;
  work_start_time: string; // e.g. "08:00:00"
  late_tolerance_minutes: number; // e.g. 15
  work_end_time: string; // e.g. "17:00:00"
  qr_secret: string;
  updated_at?: string;
}

/** Tanggal hari ini (zona Asia/Jakarta) dalam format YYYY-MM-DD */
export function todayJakarta(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Jam sekarang (zona Asia/Jakarta) dalam format HH:MM:SS */
export function nowTimeJakarta(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
}

/** Format tanggal ke bahasa Indonesia (contoh: Senin, 1 Oktober 2026) */
export function formatTanggal(iso: string): string {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "full" }).format(
    new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)),
  );
}

/** Format mata uang Rupiah */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

/**
 * Hash payload QR untuk window dinamis 5 detik.
 *
 * WAJIB IDENTIK dengan absengo_qr_hash() di
 * supabase/migrations/*_record_attendance_rpc.sql. Karena scan diverifikasi
 * di server, kedua sisi harus menghasilkan angka yang sama persis.
 *
 * Modulus bilangan prima dipakai supaya tidak ada overflow integer 32-bit
 * di JavaScript maupun 64-bit di PostgreSQL. Versi lama memakai bitshift JS
 * yang tidak ada padanannya yang persis di SQL.
 */
export function generateQrHash(secret: string, windowTime: number): string {
  const str = `${secret}-${windowTime}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) % 1000000007;
  }
  return String(hash);
}

/** Membuat payload string untuk QR code di layar kantor (berganti tiap 5 detik) */
export function createQrPayload(secret: string = "absen-corp-secret-token"): string {
  const windowTime = Math.floor(Date.now() / 5000); // 5 second window
  const hash = generateQrHash(secret, windowTime);
  return JSON.stringify({
    app: "ABSENGO-CORP",
    w: windowTime,
    h: hash,
  });
}

/** Bentuk hasil record_attendance() di server */
export interface HasilAbsen {
  ok: boolean;
  kode?: string;
  pesan?: string;
  aksi?: "masuk" | "pulang";
  jam?: string;
  jam_masuk?: string;
  jam_pulang?: string;
  jam_masuk_tercatat?: string;
  sekarang?: string;
  status?: string;
  late_minutes?: number;
}

/** Satu hari baru dihitung gaji kalau absen masuk DAN absen pulang keduanya ada. */
export function hariIniDihitung(att: Pick<CompanyAttendance, "clock_in" | "clock_out">): boolean {
  return Boolean(att.clock_in && att.clock_out);
}

/** Selisih menit antara dua waktu "HH:MM" atau "HH:MM:SS" (nilai a dikurangi b). */
export function selisihMenit(a: string, b: string): number {
  const keMenit = (waktu: string) => {
    const [jam = 0, menit = 0] = waktu.split(":").map(Number);
    return jam * 60 + menit;
  };
  return keMenit(a) - keMenit(b);
}

/** Konversi object list ke string CSV */
export function toCsv(rows: Record<string, string | number>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]!);
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => esc(r[h] ?? "")).join(",")),
  ].join("\n");
}

/** Trigger download CSV file */
export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
