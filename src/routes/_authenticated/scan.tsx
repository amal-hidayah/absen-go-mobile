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
  ShieldCheck,
  User,
  ShieldAlert,
  ArrowLeft,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  formatTanggal,
  hitungKeterlambatan,
  nowTimeJakarta,
  todayJakarta,
  verifyQrPayload,
  type CompanyAttendance,
  type CompanySettings,
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
    nama: string;
    detail?: string;
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
        const secret = settings?.qr_secret || "absen-corp-secret-token";
        const verif = verifyQrPayload(decodedText, secret);

        if (!verif.valid) {
          playBeep(false);
          const pesanError = verif.reason || "QR Code tidak valid!";
          setFlash({ status: "error", nama: pesanError });
          toast.error(pesanError);
          return;
        }

        if (!currentEmployee) {
          toast.error("Data profil karyawan Anda belum terdaftar di sistem.");
          return;
        }

        const jamSekarang = nowTimeJakarta();
        const jamMasukSetting = settings?.work_start_time || "08:00:00";
        const toleransi = settings?.late_tolerance_minutes ?? 15;

        // Cek status presensi hari ini
        const { data: existing } = await supabase
          .from("company_attendance")
          .select("*")
          .eq("employee_id", currentEmployee.id)
          .eq("attend_date", tanggal)
          .maybeSingle();

        if (!existing) {
          // CLOCK IN (MASUK)
          const { status, lateMinutes } = hitungKeterlambatan(
            jamSekarang,
            jamMasukSetting,
            toleransi,
          );
          const { error: insErr } = await supabase.from("company_attendance").insert({
            employee_id: currentEmployee.id,
            attend_date: tanggal,
            clock_in: jamSekarang,
            status,
            late_minutes: lateMinutes,
            recorded_by: authProfile?.user?.id || null,
          });

          if (insErr) throw insErr;

          playBeep(true);
          const keterangan =
            status === "terlambat"
              ? `Terlambat ${lateMinutes} menit (Batas toleransi: ${jamMasukSetting.slice(0, 5)})`
              : "Tepat Waktu. Selamat bekerja!";

          setFlash({
            status: "success",
            nama: `Masuk: ${currentEmployee.full_name}`,
            detail: keterangan,
          });
          void stopKamera();
          toast.success(`Absen Masuk Berhasil (${jamSekarang.slice(0, 5)})`);
        } else if (!existing.clock_out) {
          // CLOCK OUT (PULANG)
          const { error: updErr } = await supabase
            .from("company_attendance")
            .update({
              clock_out: jamSekarang,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);

          if (updErr) throw updErr;

          playBeep(true);
          setFlash({
            status: "success",
            nama: `Pulang: ${currentEmployee.full_name}`,
            detail: "Absen pulang tercatat. Terima kasih atas kerja keras Anda!",
          });
          void stopKamera();
          toast.success(`Absen Pulang Berhasil (${jamSekarang.slice(0, 5)})`);
        } else {
          // SUDAH LENGKAP KEDUANYA
          playBeep(false);
          setFlash({
            status: "info",
            nama: "Presensi hari ini sudah lengkap",
            detail: `Anda sudah absen masuk (${existing.clock_in?.slice(0, 5)}) dan pulang (${existing.clock_out?.slice(0, 5)}).`,
          });
          void stopKamera();
          toast.info("Anda sudah menyelesaikan presensi masuk dan pulang hari ini.");
        }

        queryClient.invalidateQueries({ queryKey: ["presensi_saya_hari_ini"] });
        queryClient.invalidateQueries({ queryKey: ["recent_kiosk_attendance"] });
      } catch (err) {
        playBeep(false);
        toast.error(err instanceof Error ? err.message : "Gagal mencatat presensi");
      } finally {
        setTimeout(() => {
          busyRef.current = false;
        }, 1500);
      }
    },
    [currentEmployee, authProfile, settings, tanggal, queryClient],
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
    const timer = setTimeout(() => setFlash(null), 3000);
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
            className={`absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 p-6 text-white font-bold text-center transition-opacity duration-500 ${
              flash.status === "success"
                ? "bg-emerald-600/90"
                : flash.status === "info"
                  ? "bg-amber-500/90"
                  : "bg-rose-600/90"
            }`}
          >
            <div>
              {flash.status === "error" ? (
                <AlertCircle className="size-12 mx-auto mb-2 text-white" />
              ) : flash.status === "info" ? (
                <Info className="size-12 mx-auto mb-2 text-white" />
              ) : (
                <CheckCircle2 className="size-12 mx-auto mb-2 text-white" />
              )}
              <p className="text-lg">{flash.nama}</p>

              <p className="text-xs font-normal text-white/80 mt-1">
                {flash.detail ||
                  (flash.status === "success" ? "Presensi tersimpan" : "Silakan coba lagi")}
              </p>
            </div>

            <Button
              size="sm"
              variant="secondary"
              onClick={() => setFlash(null)}
              className="bg-white text-slate-900 hover:bg-white/90"
            >
              Lanjut
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
