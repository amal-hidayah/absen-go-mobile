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

/** Ubah "HH:MM:SS" menjadi total menit sejak tengah malam */
export function clockToMinutes(waktu: string): number {
  const [jam = 0, menit = 0, detik = 0] = waktu.split(":").map(Number);
  return jam * 60 + menit + detik / 60;
}

/** Hitung status keterlambatan dan durasi telat dalam menit */
export function hitungKeterlambatan(
  waktuScan: string, // "HH:MM:SS"
  jamMasuk: string, // "08:00:00"
  toleransiMenit: number = 15,
): { status: "hadir" | "terlambat"; lateMinutes: number } {
  const scanTotalMinutes = clockToMinutes(waktuScan);
  const startTotalMinutes = clockToMinutes(jamMasuk);
  const batasToleransiMinutes = startTotalMinutes + toleransiMenit;

  if (scanTotalMinutes > batasToleransiMinutes) {
    const late = Math.round(scanTotalMinutes - startTotalMinutes);
    return { status: "terlambat", lateMinutes: Math.max(late, 1) };
  }

  return { status: "hadir", lateMinutes: 0 };
}

/** Hash sederhana untuk window dinamis QR 5 detik */
export function generateQrHash(secret: string, windowTime: number): string {
  const str = `${secret}-${windowTime}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
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

/** Verifikasi payload string dari scanner HP karyawan */
export function verifyQrPayload(
  payloadStr: string,
  secret: string = "absen-corp-secret-token",
): { valid: boolean; reason?: string } {
  try {
    const data = JSON.parse(payloadStr);
    if (data.app !== "ABSENGO-CORP" || typeof data.w !== "number" || !data.h) {
      return { valid: false, reason: "Bukan QR Code resmi presensi kantor." };
    }

    const currentWindow = Math.floor(Date.now() / 5000);
    // Toleransi hingga 3 window (sekitar 15-20 detik) untuk mengatasi jeda waktu scan & clock device
    if (Math.abs(currentWindow - data.w) > 3) {
      return {
        valid: false,
        reason:
          "QR Code sudah kadaluarsa (berubah setiap 5 detik). Silakan scan ulang layar kantor.",
      };
    }

    const expectedHash = generateQrHash(secret, data.w);
    if (data.h !== expectedHash) {
      return { valid: false, reason: "Kode QR tidak cocok dengan server kantor." };
    }

    return { valid: true };
  } catch (e) {
    return { valid: false, reason: "Format QR Code tidak dikenali." };
  }
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
