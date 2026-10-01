import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { AlertTriangle, ArrowLeft, Maximize2, Minimize2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  createQrPayload,
  formatTanggal,
  nowTimeJakarta,
  todayJakarta,
  type CompanyAttendance,
  type CompanySettings,
} from "@/lib/presensi";

export const Route = createFileRoute("/kiosk")({
  ssr: false,
  // Layar kiosk menampilkan qr_secret, jadi hanya admin yang boleh membukanya.
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // Sumber role: login_accounts (lihat use-auth-profile). Admin dibuat di
    // Supabase Auth dan tidak selalu punya baris di tabel employees.
    const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");
    if (adminError || !isAdmin) throw redirect({ to: "/dashboard" });

    return { user: data.user };
  },
  head: () => ({
    meta: [
      { title: "Layar Presensi Kantor · AbsenGo" },
      { name: "description", content: "Layar monitor display QR presensi dinamis kantor." },
    ],
  }),
  component: KioskPage,
});

/** Dipakai hanya bila tabel company_settings belum terkonfigurasi. */
const PENGATURAN_AWAL: CompanySettings = {
  id: 1,
  company_name: "PT Perusahaan Mandiri",
  work_start_time: "08:00:00",
  late_tolerance_minutes: 15,
  work_end_time: "17:00:00",
  qr_secret: "absen-corp-secret-token",
};

const DETIK_PER_GANTAR = 5;

function KioskPage() {
  const [jam, setJam] = useState(nowTimeJakarta());
  const [tanggal, setTanggal] = useState(todayJakarta());
  const [detikTersisa, setDetikTersisa] = useState(DETIK_PER_GANTAR);
  const [qrValue, setQrValue] = useState(() => createQrPayload(PENGATURAN_AWAL.qr_secret));
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Ambil pengaturan kantor
  const { data: settings, isError: settingsGagal } = useQuery<CompanySettings | null>({
    queryKey: ["company_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error && error.code !== "PGRST116") {
        console.warn("Gagal load company_settings, menggunakan default:", error);
      }
      return (data as unknown as CompanySettings) || PENGATURAN_AWAL;
    },
    refetchInterval: 30000,
  });

  // Secret yang dipakai di layar ini harus sama persis dengan yang-held server,
  // kalau tidak semua pindai akan ditolak. Jadi kegagalan load tidak boleh
  // diam-diam diganti secret bawaan.
  const secretValid = !settingsGagal && Boolean(settings?.qr_secret);

  // Ambil presensi terbaru hari ini
  const { data: recentAttendances = [] } = useQuery<CompanyAttendance[]>({
    queryKey: ["recent_kiosk_attendance", tanggal],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_attendance")
        .select(
          "id, attend_date, clock_in, clock_out, status, late_minutes, employees(full_name, department, position)",
        )
        .eq("attend_date", tanggal)
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) {
        console.warn("Gagal load presensi terbaru:", error);
        return [];
      }
      return (data as unknown as CompanyAttendance[]) || [];
    },
    refetchInterval: 3000, // Feed aktivitas harus ikut denyut nadi meja resepsionis
  });

  const secret = settings?.qr_secret || PENGATURAN_AWAL.qr_secret;
  const jamMasuk = settings?.work_start_time?.slice(0, 5) || "08:00";
  const jamPulang = settings?.work_end_time?.slice(0, 5) || "17:00";
  const toleransi = settings?.late_tolerance_minutes ?? 15;

  // Real-time jam Jakarta & pergantian QR tiap 5 detik
  useEffect(() => {
    // Generate ulang begitu secret asli dari server sudah masuk
    setQrValue(createQrPayload(secret));

    const clockInterval = setInterval(() => {
      setJam(nowTimeJakarta());
      setTanggal(todayJakarta());
    }, 1000);

    const qrInterval = setInterval(() => {
      setDetikTersisa((prev) => {
        if (prev <= 1) {
          setQrValue(createQrPayload(secret));
          return DETIK_PER_GANTAR;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(clockInterval);
      clearInterval(qrInterval);
    };
  }, [secret]);

  // Ukur kotak QR agar tetap tajam di layar 5" HP maupun monitor 4K.
  const qrRef = useRef<HTMLDivElement>(null);
  const [qrSize, setQrSize] = useState(0);

  useEffect(() => {
    const el = qrRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const lebar = entries[0]?.contentRect.width ?? 0;
      if (lebar <= 0) return;
      // Bulatkan ke kelipatan 4px supaya tepi modul QR tetap rata
      setQrSize(Math.min(Math.max(Math.round(lebar / 4) * 4, 160), 560));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Status fullscreen bisa berubah dari luar (tombol F11, Esc)
  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  return (
    <div className="bg-kiosk min-h-dvh select-none text-slate-100">
      <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-5 py-5 sm:px-8 sm:py-7">
        <header className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <Button
              asChild
              variant="ghost"
              className="-ml-3 text-slate-300 hover:bg-white/10 hover:text-white"
            >
              <Link to="/dashboard" title="Kembali ke dashboard">
                <ArrowLeft aria-hidden />
                Kembali
              </Link>
            </Button>

            <Button
              variant="outline"
              onClick={toggleFullscreen}
              className="border-white/15 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
            >
              {isFullscreen ? <Minimize2 aria-hidden /> : <Maximize2 aria-hidden />}
              {isFullscreen ? "Keluar Layar Penuh" : "Layar Penuh"}
            </Button>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 border-t border-white/10 pt-5">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold sm:text-2xl">
                {settings?.company_name || PENGATURAN_AWAL.company_name}
              </h1>
              <p className="mt-1 text-xs text-slate-400 sm:text-sm">
                Jam masuk {jamMasuk} · toleransi {toleransi} menit · jam pulang {jamPulang}
              </p>
            </div>

            <div className="shrink-0 sm:text-right">
              {/* Monospasi di sini bukan gaya: angka detik harus tidak bergeser
                  setiap detik, dan jam harus terbaca dari kursi resepsionis. */}
              <p className="font-mono text-2xl leading-none sm:text-3xl">{jam}</p>
              <p className="mt-1.5 text-xs text-slate-400">{formatTanggal(tanggal)} · WIB</p>
            </div>
          </div>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center gap-7 py-8 sm:py-10">
          <div className="w-[min(78vw,30rem,44dvh)]">
            <div className="rounded-3xl bg-white px-5 py-6 shadow-kiosk sm:px-7 sm:py-7">
              <div ref={qrRef} className="aspect-square w-full">
                {secretValid ? (
                  <QRCodeCanvas
                    value={qrValue}
                    size={qrSize}
                    // Level M (bukan H): kode lebih jarang modulnya sehingga
                    // lebih tahan discan dari jarak 1-2 meter di ruang tamu.
                    level="M"
                    marginSize={2}
                    aria-label="Kode presensi yang berganti tiap 5 detik"
                  />
                ) : (
                  <div className="flex size-full flex-col items-center justify-center gap-2 rounded-2xl bg-rose-50 px-6 text-center">
                    <AlertTriangle className="size-7 text-rose-700" aria-hidden />
                    <p className="text-sm font-semibold text-rose-900">
                      Pengaturan kantor tidak terbaca
                    </p>
                    <p className="text-xs leading-relaxed text-rose-800">
                      Kode presensi tidak ditampilkan karena kunci QR tidak bisa dimuat. Muat ulang
                      halaman ini.
                    </p>
                  </div>
                )}
              </div>

              {secretValid ? (
                <>
                  <div className="mt-6 flex items-baseline justify-between gap-4 text-xs font-medium text-slate-600">
                    <span>Kode berganti dalam</span>
                    <span className="font-mono text-sm font-semibold text-slate-700">
                      {detikTersisa} detik
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                    {/* key={qrValue} memutar ulang sapuan setiap kode berganti.
                        QR-nya sendiri tidak dianimasikan: scan yang sedang jalan
                        tidak boleh gagal karena kodenya berkedip. */}
                    <div
                      key={qrValue}
                      className="h-full w-full origin-left rounded-full bg-teal-600 animate-qr-sweep"
                    />
                  </div>
                </>
              ) : null}
            </div>
          </div>

          <p className="max-w-sm text-center text-pretty text-sm text-slate-300 sm:text-base">
            Arahkan kamera HP ke layar ini dari menu{" "}
            <span className="font-semibold text-white">Scan Presensi</span>.
          </p>
        </main>

        <section className="border-t border-white/10 pt-5">
          <h2 className="text-xs font-semibold text-slate-400">
            Presensi hari ini
            {recentAttendances.length > 0 && (
              <span className="font-normal"> · {recentAttendances.length} catatan terakhir</span>
            )}
          </h2>

          {recentAttendances.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">
              Belum ada karyawan yang absen hari ini. Kode di layar sudah aktif dan siap dipindai.
            </p>
          ) : (
            <ul className="mt-3 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              {recentAttendances.map((item) => {
                const sudahPulang = Boolean(item.clock_out);
                const jamAbsen = (sudahPulang ? item.clock_out : item.clock_in)?.slice(0, 5);
                const terlambat = !sudahPulang && item.status === "terlambat";

                return (
                  <li key={item.id} className="flex items-baseline justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {item.employees?.full_name || "Karyawan"}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {item.employees?.department || "-"} · {item.employees?.position || "-"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-sm text-slate-200">{jamAbsen || "--:--"}</p>
                      {/* Amber hanya untuk kondisi yang benar-benar perlu
                          dicari: karyawan yang datang lewat toleransi. */}
                      <p className={`text-xs ${terlambat ? "text-amber-300" : "text-slate-400"}`}>
                        {sudahPulang
                          ? "Pulang"
                          : terlambat
                            ? `Telat ${item.late_minutes} mnt`
                            : "Masuk"}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
