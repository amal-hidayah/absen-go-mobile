import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Maximize2, Minimize2, ArrowLeft, Clock, ShieldCheck, CheckCircle2 } from "lucide-react";
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
      { title: "Layar Presensi Kantor — AbsenGo" },
      { name: "description", content: "Layar monitor display QR presensi dinamis kantor." },
    ],
  }),
  component: KioskPage,
});

function KioskPage() {
  const [jam, setJam] = useState(nowTimeJakarta());
  const [tanggal, setTanggal] = useState(todayJakarta());
  const [secondsLeft, setSecondsLeft] = useState(5);
  const [qrValue, setQrValue] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Ambil pengaturan kantor
  const { data: settings } = useQuery<CompanySettings | null>({
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
      return (
        (data as unknown as CompanySettings) || {
          id: 1,
          company_name: "PT Perusahaan Mandiri",
          work_start_time: "08:00:00",
          late_tolerance_minutes: 15,
          work_end_time: "17:00:00",
          qr_secret: "absen-corp-secret-token",
        }
      );
    },
    refetchInterval: 30000,
  });

  // Ambil presensi terbaru hari ini
  const { data: recentAttendances = [] } = useQuery<CompanyAttendance[]>({
    queryKey: ["recent_kiosk_attendance", tanggal],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_attendance")
        .select(
          "id, attend_date, clock_in, clock_out, status, employees(full_name, department, position)",
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
    refetchInterval: 3000, // Real-time feed update
  });

  const secret = settings?.qr_secret || "absen-corp-secret-token";

  // Real-time jam Jakarta & pergantian QR setiap 5 detik
  useEffect(() => {
    // Generate initial QR
    setQrValue(createQrPayload(secret));

    const clockInterval = setInterval(() => {
      setJam(nowTimeJakarta());
      setTanggal(todayJakarta());
    }, 1000);

    const qrInterval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setQrValue(createQrPayload(secret));
          return 5;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(clockInterval);
      clearInterval(qrInterval);
    };
  }, [secret]);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement
        .requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(() => {});
    } else {
      document
        .exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch(() => {});
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-6 sm:p-10 select-none">
      {/* Header Kiosk */}
      <header className="flex items-center justify-between border-b border-slate-800 pb-5">
        <div className="flex items-center gap-4">
          <Link to="/dashboard">
            <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
              <ArrowLeft className="size-4 mr-2" /> Kembali ke Dashboard
            </Button>
          </Link>
          <div className="h-6 w-[1px] bg-slate-800 hidden sm:block" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              {settings?.company_name || "Perusahaan"}
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Layar Presensi Kantor
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Jam Masuk: {settings?.work_start_time?.slice(0, 5) || "08:00"} (Toleransi{" "}
              {settings?.late_tolerance_minutes || 15} mnt) · Jam Pulang:{" "}
              {settings?.work_end_time?.slice(0, 5) || "17:00"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleFullscreen}
            className="border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            {isFullscreen ? (
              <Minimize2 className="size-4 mr-2" />
            ) : (
              <Maximize2 className="size-4 mr-2" />
            )}
            {isFullscreen ? "Keluar Layar Penuh" : "Layar Penuh"}
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="my-auto py-8 grid lg:grid-cols-12 gap-8 items-center max-w-7xl mx-auto w-full">
        {/* Kolom Kiri: Jam Besar & Informasi */}
        <div className="lg:col-span-4 space-y-6 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium">
            <Clock className="size-3.5" /> Waktu Indonesia Barat
          </div>

          <div>
            <div className="text-5xl sm:text-6xl lg:text-7xl font-mono font-extrabold tracking-wider text-slate-100 drop-shadow-md">
              {jam}
            </div>
            <p className="mt-2 text-base sm:text-lg text-slate-400 font-medium capitalize">
              {formatTanggal(tanggal)}
            </p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-start gap-3">
              <ShieldCheck className="size-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs sm:text-sm text-slate-300">
                <p className="font-semibold text-white">QR Code Berubah Otomatis Tiap 5 Detik</p>
                <p className="text-slate-400 mt-0.5">
                  Anti-titip absen & anti-foto QR. Scan langsung menggunakan kamera HP dari akun
                  Anda.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Kolom Tengah: Dynamic QR Display */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center">
          <div className="relative group">
            {/* Glowing Backdrop */}
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl blur-xl opacity-50 group-hover:opacity-75 transition duration-500" />

            <div className="relative bg-white p-6 sm:p-8 rounded-3xl shadow-2xl flex flex-col items-center">
              {qrValue ? (
                <QRCodeCanvas
                  value={qrValue}
                  size={280}
                  level="H"
                  marginSize={2}
                  className="rounded-xl"
                />
              ) : (
                <div className="size-[280px] flex items-center justify-center bg-slate-100 rounded-xl text-slate-400">
                  Memuat QR...
                </div>
              )}

              {/* Countdown Progress Bar */}
              <div className="w-full mt-5">
                <div className="flex justify-between items-center text-xs font-semibold text-slate-600 mb-1.5">
                  <span>Memperbarui dalam</span>
                  <span className="font-mono text-blue-600 font-bold">{secondsLeft}s</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all duration-1000 ease-linear rounded-full"
                    style={{ width: `${(secondsLeft / 5) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <p className="mt-5 text-center text-sm text-slate-400 max-w-xs">
            Buka menu <span className="text-white font-semibold">"Scan Presensi"</span> di HP Anda
            dan arahkan kamera ke QR ini.
          </p>
        </div>

        {/* Kolom Kanan: Live Feed Presensi Terkini */}
        <div className="lg:col-span-3 bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-3 pb-2 border-b border-slate-800">
            <CheckCircle2 className="size-4 text-emerald-400" />
            Aktivitas Terkini Hari Ini
          </h2>

          {recentAttendances.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-500">
              Belum ada karyawan yang presensi hari ini.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {recentAttendances.map((item) => (
                <li
                  key={item.id}
                  className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs"
                >
                  <div className="min-w-0 pr-2">
                    <p className="font-semibold text-white truncate">
                      {item.employees?.full_name || "Karyawan"}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {item.employees?.department || "-"} · {item.employees?.position || "-"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        item.clock_out
                          ? "bg-purple-500/20 text-purple-300"
                          : item.status === "terlambat"
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-emerald-500/20 text-emerald-300"
                      }`}
                    >
                      {item.clock_out
                        ? `Pulang ${item.clock_out.slice(0, 5)}`
                        : `Masuk ${item.clock_in?.slice(0, 5)}`}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      {/* Footer Kiosk */}
      <footer className="border-t border-slate-900 pt-4 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
        <span>Sistem Presensi Kiosk — Dynamic QR Anti-Fraud</span>
        <div className="flex items-center gap-2">
          <span>Powered by</span>
          <span className="text-slate-300 font-semibold">AbsenGo Perusahaan</span>
        </div>
      </footer>
    </div>
  );
}
