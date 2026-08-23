export type Student = {
  id: string;
  nis: string;
  full_name: string;
  class_name: string;
  gender: string;
  qr_code: string;
  active: boolean;
};

export type AttendanceRow = {
  id: string;
  student_id: string;
  attend_date: string;
  attend_time: string;
  status: string;
  note: string | null;
  students?: Pick<Student, "nis" | "full_name" | "class_name"> | null;
};

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

export function formatTanggal(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "full" }).format(
    new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)),
  );
}

export function hitungStatus(waktu: string, batasTerlambat: string): "hadir" | "terlambat" {
  return waktu.slice(0, 8) > batasTerlambat.slice(0, 8) ? "terlambat" : "hadir";
}

export function slugQr(nis: string): string {
  return `SISWA-${nis.trim().toUpperCase()}`;
}

export function toCsv(rows: Record<string, string | number>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]!);
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => esc(r[h] ?? "")).join(",")),
  ].join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
