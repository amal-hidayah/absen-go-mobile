import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Camera,
  CameraOff,
  Tv,
  LogOut,
  LogIn,
  User,
  ShieldAlert,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  formatTanggal,
  todayJakarta,
  type CompanyAttendance,
  type CompanySettings,
  type HasilAbsen,
} from "@/lib/presensi";
import { useAuthProfile } from "@/hooks/use-auth-profile";

export const Route = createFileRoute("/_authenticated/scan")({
  head: () => ({
    meta: [
      { title: "Scan Presensi · AbsenGo" },
      {
        name: "description",
        content: "Arahkan kamera HP ke layar kantor untuk absen masuk atau pulang.",
      },
    ],
  }),
  component: ScanPage,
});

const REGION_ID = "qr-reader-region";

/**
 * Judul pendek untuk setiap penolakan dari server, supaya kalimat panjang yang
 * dikembalikan database tidak mendominasi overlay kamera.
 */
const JUDUL_KODE: Record<string, string> = {
  SUDAH_LENGKAP: "Presensi sudah lengkap",
  SUDAH_TERCATAT: "Presensi sudah tercatat",
  BELUM_WAKTU_PULANG: "Belum waktunya pulang",
  BELUM_BUKA: "Presensi belum dibuka",
  KADALUARSA: "QR sudah kadaluarsa",
  TIDAK_COCOK: "QR tidak dikenali",
  BUKAN_QR: "QR bukan milik kantor",
  FORMAT: "QR tidak terbaca",
  TANPA_PROFIL: "Profil belum terdaftar",
  NONAKTIF: "Akun sedang tidak aktif",
  PENGATURAN: "Pengaturan belum lengkap",
};

/** Penolakan ini tidak perlu diulang: menutup kamera dan mengarahkan ke kerjaan. */
const KODE_TERHENTI = new Set([
  "SUDAH_LENGKAP",
  "SUDAH_TERCATAT",
  "BELUM_WAKTU_PULANG",
  "BELUM_BUKA",
  "TANPA_PROFIL",
  "NONAKTIF",
  "PENGATURAN",
]);

function playBeep(success: boolean) {
  try {
    const AudioContextCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    const ctx = new AudioContextCtor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (success) {
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(250, ctx.currentTime);
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch {
    // Browser tidak mendukung Web Audio, beep dilewati saja
  }
}

function ScanPage() {
  const queryClient = useQueryClient();
  const tanggal = todayJakarta();
  const [aktif, setAktif] = useState(false);
  const [flash, setFlash] = useState<{
    status: "success" | "error" | "info";
    judul: string;
    pesan: string;
    detail?: string;
    lanjut?: boolean;
  } | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const busyRef = useRef(false);
  const lastScanTimeRef = useRef<number>(0);

  const { data: authProfile } = useAuthProfile();
  const isAdmin = authProfile?.isAdmin ?? false;
  const currentEmployee = authProfile?.employee;

  // Ambil pengaturan kantor
  const { data: settings } = useQuery<CompanySettings | null>({
    queryKey: ["company_settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("company_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      return (data as unknown as CompanySettings) || null;
    },
  });

  // Presensi saya hari ini
  const { data: presensiSaya } = useQuery<CompanyAttendance | null>({
    queryKey: ["presensi_saya_hari_ini", currentEmployee?.id, tanggal],
    enabled: !!currentEmployee?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("company_attendance")
        .select("*")
        .eq("employee_id", currentEmployee!.id)
        .eq("attend_date", tanggal)
        .maybeSingle();
      return (data as unknown as CompanyAttendance) || null;
    },
  });

  const prosesQrCode = useCallback(
    async (decodedText: string) => {
      // Throttle agar tidak scan berulang dalam 3 detik
      const now = Date.now();
      if (busyRef.current || now - lastScanTimeRef.current < 3000) return;
      busyRef.current = true;
      lastScanTimeRef.current = now;

      try {
        // Seluruh keputusan (verifikasi QR, jam masuk, jam pulang) diambil
        // server. Browser hanya menampilkan jawabannya.
        const { data, error } = await supabase.rpc("record_attendance", {
          p_qr_payload: decodedText,
        });
        if (error) throw error;

        const hasil = data as unknown as HasilAbsen;
        const nama = currentEmployee?.full_name || "Anda";

        if (hasil?.ok && hasil.aksi === "masuk") {
          playBeep(true);
          const terlambat = hasil.status === "terlambat";
          setFlash({
            status: "success",
            judul: `Masuk ${hasil.jam}`,
            pesan: `Masuk: ${nama}`,
            detail: terlambat
              ? `Terlambat ${hasil.late_minutes} menit. Pulang pukul ${hasil.jam_pulang}.`
              : `Tepat waktu. Pulang pukul ${hasil.jam_pulang}.`,
          });
          void stopKamera();
          toast.success(`Absen masuk tercatat ${hasil.jam}`);
        } else if (hasil?.ok && hasil.aksi === "pulang") {
          playBeep(true);
          setFlash({
            status: "success",
            judul: `Pulang ${hasil.jam}`,
            pesan: `Pulang: ${nama}`,
            detail: "Absen pulang tercatat. Terima kasih atas kerja keras Anda!",
          });
          void stopKamera();
          toast.success(`Absen pulang tercatat ${hasil.jam}`);
        } else {
          const kode = hasil?.kode || "FORMAT";
          const terminal = KODE_TERHENTI.has(kode);
          playBeep(false);

          const detail =
            kode === "SUDAH_LENGKAP"
              ? `Masuk ${hasil?.jam_masuk} · Pulang ${hasil?.jam_pulang}`
              : kode === "BELUM_WAKTU_PULANG"
                ? `Masuk Anda tercatat pukul ${hasil?.jam_masuk_tercatat}. Sekarang ${hasil?.sekarang}.`
                : kode === "BELUM_BUKA"
                  ? `Presensi dibuka pukul ${hasil?.jam_masuk}.`
                  : terminal
                    ? "Silakan cek dasbor Anda atau hubungi admin."
                    : "Arahkan kembali kamera ke layar kantor.";

          if (terminal) {
            setFlash({
              status: kode === "NONAKTIF" || kode === "PENGATURAN" ? "error" : "info",
              judul: JUDUL_KODE[kode] || "Presensi tidak tercatat",
              pesan: hasil?.pesan || "Presensi tidak dapat dicatat.",
              detail,
            });
            void stopKamera();
            toast.info(hasil?.pesan || "Presensi tidak tercatat.");
          } else {
            // QR rusak atau kadaluarsa: kamera tetap hidup supaya bisa langsung
            // dipindai ulang tanpa menekan tombol apa pun. Toast sengaja tidak
            // muncul supaya kode yang salah tidak memenuhi layar notifikasi.
            setFlash({
              status: "error",
              judul: JUDUL_KODE[kode] || "QR tidak terbaca",
              pesan: hasil?.pesan || "Format QR Code tidak dikenali.",
              detail,
              lanjut: true,
            });
          }
        }

        queryClient.invalidateQueries({ queryKey: ["presensi_saya_hari_ini"] });
        queryClient.invalidateQueries({ queryKey: ["recent_kiosk_attendance"] });
      } catch (err) {
        playBeep(false);
        const pesan = err instanceof Error ? err.message : "Gagal mencatat presensi";
        setFlash({
          status: "error",
          judul: "Gagal menghubungi server",
          pesan,
          detail: "Periksa koneksi internet, lalu pindai ulang.",
          lanjut: true,
        });
        toast.error(pesan);
      } finally {
        setTimeout(() => {
          busyRef.current = false;
        }, 1500);
      }
    },
    [currentEmployee, queryClient],
  );

  async function mulaiKamera() {
    setFlash(null);
    try {
      const scanner = new Html5Qrcode(REGION_ID);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          prosesQrCode(decodedText);
        },
        () => {},
      );

      setAktif(true);
    } catch (err) {
      toast.error("Tidak dapat mengakses kamera. Pastikan izin kamera telah diberikan.");
      setAktif(false);
    }
  }

  async function stopKamera() {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {
        // Kamera sudah berhenti atau tidak aktif, aman diabaikan
      }
      scannerRef.current = null;
    }
    setAktif(false);
  }

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // Overlay hasil scan menutup sendiri supaya tidak menutupi kamera
  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 4000);
    return () => clearTimeout(timer);
  }, [flash]);

  // JIKA YANG MEMBUKA ADALAH ADMIN:
  if (isAdmin) {
    return (
      <div className="mx-auto max-w-lg py-10 space-y-6 text-center">
        <div className="flex size-14 items-center justify-center rounded-3xl bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300">
          <ShieldAlert className="size-7" aria-hidden />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold sm:text-2xl">Halaman Khusus Karyawan</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Akun Anda terdaftar sebagai{" "}
            <span className="font-semibold text-foreground">Admin / HRD</span>. Fitur Scan Kamera
            ini digunakan oleh karyawan di smartphone masing-masing untuk absen di monitor kantor.
          </p>
        </div>

        <div className="p-4 rounded-2xl border bg-muted/30 text-xs text-muted-foreground text-left space-y-2">
          <p className="font-semibold text-foreground">Tugas Admin:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>
              Membuka <strong>Layar Monitor Kiosk</strong> di TV / PC lobi kantor.
            </li>
            <li>Mengelola data karyawan dan tarif gaji harian.</li>
            <li>Melihat rekap kehadiran dan menghitung payroll gaji harian.</li>
          </ul>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild variant="outline">
            <Link to="/dashboard">
              <ArrowLeft className="size-4 mr-1.5" /> Ke Dashboard Admin
            </Link>
          </Button>
          <Button asChild>
            <Link to="/kiosk" target="_blank">
              <Tv className="size-4 mr-1.5" /> Buka Layar Monitor Kiosk
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // TAMPILAN SCAN UNTUK KARYAWAN:
  return (
    <div className="mx-auto max-w-xl space-y-5 sm:space-y-6">
      <header className="space-y-1.5 text-center">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Scan Presensi Kantor</h1>
        <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
          Arahkan kamera ke{" "}
          <span className="font-semibold text-foreground">Layar Monitor Kantor</span> untuk absen
          masuk atau pulang.
        </p>
      </header>

      {/* Info Karyawan yang Sedang Login */}
      {currentEmployee && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-3.5 shadow-[var(--shadow-soft)]">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-bold text-primary">
              <User className="size-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{currentEmployee.full_name}</p>
              <p className="truncate text-xs text-muted-foreground">
                NIK <span className="font-mono">{currentEmployee.nik}</span> ·{" "}
                {currentEmployee.department}
              </p>
            </div>
          </div>

          <span
            className={`inline-block shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
              presensiSaya
                ? presensiSaya.clock_out
                  ? "bg-violet-100 text-violet-800"
                  : "bg-emerald-100 text-emerald-800"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            {presensiSaya
              ? presensiSaya.clock_out
                ? "Sudah Pulang"
                : "Sudah Masuk"
              : "Belum Masuk"}
          </span>
        </div>
      )}

      {/* Area Scanner Kamera */}
      <div className="relative overflow-hidden rounded-3xl border bg-slate-950 p-4 text-center shadow-[var(--shadow-lift)]">
        {/* Hasil scan: muncul sebentar lalu menutup sendiri (3 detik) */}
        {flash && (
          <div
            className={`absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 p-6 text-center text-white ${
              flash.status === "success"
                ? "bg-emerald-600/95"
                : flash.status === "info"
                  ? "bg-amber-500/95"
                  : "bg-rose-600/95"
            }`}
          >
            <div className="max-w-[18rem] space-y-2">
              {flash.status === "success" ? (
                <CheckCircle2 className="mx-auto size-11" aria-hidden />
              ) : flash.status === "info" ? (
                <Clock className="mx-auto size-11" aria-hidden />
              ) : (
                <AlertCircle className="mx-auto size-11" aria-hidden />
              )}

              <p className="text-lg font-bold leading-snug text-balance">{flash.judul}</p>
              <p className="text-sm font-medium leading-snug text-pretty text-white/90">
                {flash.pesan}
              </p>
              {flash.detail && (
                <p className="text-xs font-normal leading-relaxed text-pretty text-white/75">
                  {flash.detail}
                </p>
              )}
            </div>

            <Button
              size="sm"
              variant="secondary"
              onClick={() => setFlash(null)}
              className="bg-white text-slate-900 hover:bg-white/90"
            >
              {flash.lanjut ? "Lanjut" : "Tutup"}
            </Button>
          </div>
        )}

        {/* Viewfinder Target Container */}
        <div className="relative mx-auto aspect-square max-w-xs overflow-hidden rounded-2xl bg-black">
          <div id={REGION_ID} className="size-full" />

          {!aktif && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-slate-400 bg-slate-900/90">
              <Camera className="size-14 text-slate-500 mb-3" />
              <p className="text-sm font-semibold text-slate-200">Kamera Belum Aktif</p>
              <p className="text-xs text-slate-400 mt-1 max-w-[200px]">
                Tekan tombol "Buka Kamera" di bawah untuk memindai QR kantor.
              </p>
            </div>
          )}

          {/* Guide Overlay saat aktif */}
          {aktif && (
            <div className="pointer-events-none absolute inset-0 border-2 border-emerald-500/50 rounded-2xl flex items-center justify-center">
              <div className="size-48 border-2 border-dashed border-emerald-400 rounded-xl" />
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="mt-4 flex justify-center gap-3">
          {!aktif ? (
            <Button size="lg" onClick={mulaiKamera} className="w-full max-w-xs">
              <Camera className="size-4 mr-2" /> Buka Kamera
            </Button>
          ) : (
            <Button
              size="lg"
              variant="destructive"
              onClick={stopKamera}
              className="w-full max-w-xs"
            >
              <CameraOff className="size-4 mr-2" /> Matikan Kamera
            </Button>
          )}
        </div>
      </div>

      {/* Kartu Status Kehadiran Saya Hari Ini */}
      {presensiSaya && (
        <div className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-soft)] space-y-3">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
            Status Kehadiran Anda Hari Ini ({formatTanggal(tanggal)})
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 rounded-xl border bg-muted/40 p-3">
              <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                <LogIn className="size-4" aria-hidden /> Jam masuk
              </span>
              <p className="font-mono text-xl font-bold leading-tight">
                {presensiSaya.clock_in ? presensiSaya.clock_in.slice(0, 5) : "--:--"}
              </p>
              <span
                className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                  presensiSaya.status === "terlambat"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-emerald-100 text-emerald-800"
                }`}
              >
                {presensiSaya.status}
              </span>
            </div>

            <div className="space-y-1 rounded-xl border bg-muted/40 p-3">
              <span className="flex items-center gap-1.5 text-xs font-medium text-violet-700 dark:text-violet-400">
                <LogOut className="size-4" aria-hidden /> Jam pulang
              </span>
              <p className="font-mono text-xl font-bold leading-tight">
                {presensiSaya.clock_out ? presensiSaya.clock_out.slice(0, 5) : "--:--"}
              </p>
              <span className="block text-[11px] leading-snug text-muted-foreground">
                {presensiSaya.clock_out
                  ? "Selesai kerja"
                  : `Jadwal pulang ${settings?.work_end_time?.slice(0, 5) || "17:00"}`}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
