import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { CheckCircle2, Clock, AlertCircle, Camera, CameraOff, Keyboard } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  formatTanggal,
  hitungStatus,
  nowTimeJakarta,
  todayJakarta,
  type Student,
} from "@/lib/presensi";

export const Route = createFileRoute("/_authenticated/scan")({
  head: () => ({
    meta: [
      { title: "Scan QR — AbsenGo" },
      { name: "description", content: "Pindai kartu QR siswa untuk mencatat kehadiran." },
      { property: "og:title", content: "Scan QR — AbsenGo" },
      { property: "og:description", content: "Pindai kartu QR siswa untuk mencatat kehadiran." },
    ],
  }),
  component: ScanPage,
});

type Hasil = {
  ok: boolean;
  nama: string;
  detail: string;
  status?: string;
  jam?: string;
};

const REGION_ID = "qr-reader-region";

function playBeep(success: boolean) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    if (success) {
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else {
      osc.type = "square";
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch (e) {
    // Abaikan jika browser memblokir audio (misal sebelum user berinteraksi)
  }
}

function ScanPage() {
  const queryClient = useQueryClient();
  const tanggal = todayJakarta();
  const [aktif, setAktif] = useState(false);
  const [hasil, setHasil] = useState<Hasil | null>(null);
  const [flash, setFlash] = useState<{ status: "success" | "error"; nama: string } | null>(null);
  const [manual, setManual] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const busyRef = useRef(false);
  const lastRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });

  const { data: setting } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: hariIni } = useQuery({
    queryKey: ["presensi-hari-ini", tanggal],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("id, attend_time, status, students(full_name, class_name)")
        .eq("attend_date", tanggal)
        .order("attend_time", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data;
    },
  });

  const batas = setting?.late_after ?? "07:00:00";

  const proses = useCallback(
    async (kode: string) => {
      const code = kode.trim();
      if (!code || busyRef.current) return;
      const now = Date.now();
      if (lastRef.current.code === code && now - lastRef.current.at < 4000) return;
      lastRef.current = { code, at: now };
      busyRef.current = true;

      try {
        const { data: siswa } = await supabase
          .from("students")
          .select("id, nis, full_name, class_name, active")
          .or(`qr_code.eq.${code},nis.eq.${code}`)
          .maybeSingle();

        if (!siswa) {
          playBeep(false);
          setFlash({ status: "error", nama: "QR Tidak Dikenali" });
          setTimeout(() => setFlash(null), 1500);
          setHasil({ ok: false, nama: "QR tidak dikenali", detail: `Kode: ${code}` });
          toast.error("Kartu QR tidak terdaftar");
          return;
        }
        if (!(siswa as Student).active) {
          playBeep(false);
          setFlash({ status: "error", nama: "Siswa Non-aktif" });
          setTimeout(() => setFlash(null), 1500);
          setHasil({ ok: false, nama: siswa.full_name, detail: "Siswa berstatus non-aktif" });
          toast.error("Siswa non-aktif");
          return;
        }

        const { data: sudah } = await supabase
          .from("attendance")
          .select("attend_time, status")
          .eq("student_id", siswa.id)
          .eq("attend_date", tanggal)
          .maybeSingle();

        if (sudah) {
          playBeep(false);
          setFlash({ status: "error", nama: "Sudah Presensi" });
          setTimeout(() => setFlash(null), 1500);
          setHasil({
            ok: false,
            nama: siswa.full_name,
            detail: `Sudah presensi pukul ${sudah.attend_time.slice(0, 5)}`,
            status: sudah.status,
          });
          toast.info("Siswa sudah presensi hari ini");
          return;
        }

        const jam = nowTimeJakarta();
        const status = hitungStatus(jam, batas);
        const { data: auth } = await supabase.auth.getUser();
        const { error } = await supabase.from("attendance").insert({
          student_id: siswa.id,
          attend_date: tanggal,
          attend_time: jam,
          status,
          recorded_by: auth.user?.id ?? null,
        });
        if (error) throw error;

        playBeep(true);
        setFlash({ status: "success", nama: siswa.full_name });
        setTimeout(() => setFlash(null), 1500);

        setHasil({
          ok: true,
          nama: siswa.full_name,
          detail: `${siswa.class_name} · NIS ${siswa.nis}`,
          status,
          jam: jam.slice(0, 5),
        });
        toast.success(`${siswa.full_name} — ${status}`);
        queryClient.invalidateQueries({ queryKey: ["presensi-hari-ini"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Gagal menyimpan presensi");
      } finally {
        setTimeout(() => {
          busyRef.current = false;
        }, 800);
      }
    },
    [batas, queryClient, tanggal],
  );

  useEffect(() => {
    if (!aktif) return;
    let cancelled = false;
    const scanner = new Html5Qrcode(REGION_ID);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (text) => void proses(text),
        () => {},
      )
      .catch(() => {
        if (!cancelled) {
          toast.error("Tidak bisa mengakses kamera. Izinkan akses kamera di browser.");
          setAktif(false);
        }
      });

    return () => {
      cancelled = true;
      scanner
        .stop()
        .then(() => scanner.clear())
        .catch(() => {});
      scannerRef.current = null;
    };
  }, [aktif, proses]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Scan Presensi</h1>
        <p className="text-sm text-muted-foreground">
          {formatTanggal(tanggal)} · batas terlambat {batas.slice(0, 5)}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-soft)]">
          <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-muted">
            <div id={REGION_ID} className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
            
            {!aktif && (
              <div className="absolute inset-0 grid place-items-center text-center text-sm text-muted-foreground bg-muted">
                <div className="space-y-2">
                  <Camera className="mx-auto size-8" />
                  <p>Kamera belum aktif</p>
                </div>
              </div>
            )}

            {flash && (
              <div
                className={`absolute inset-0 z-10 grid place-items-center p-6 text-center animate-in fade-in zoom-in duration-200 ${
                  flash.status === "success" ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"
                }`}
              >
                <div className="space-y-4">
                  {flash.status === "success" ? (
                    <CheckCircle2 className="mx-auto size-24" />
                  ) : (
                    <AlertCircle className="mx-auto size-24" />
                  )}
                  <h2 className="text-3xl font-bold leading-tight md:text-5xl">{flash.nama}</h2>
                </div>
              </div>
            )}
          </div>

          <Button className="mt-4 w-full" onClick={() => setAktif((v) => !v)} variant={aktif ? "outline" : "default"}>
            {aktif ? (
              <>
                <CameraOff className="size-4" /> Hentikan kamera
              </>
            ) : (
              <>
                <Camera className="size-4" /> Nyalakan kamera
              </>
            )}
          </Button>

          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void proses(manual);
              setManual("");
            }}
          >
            <Input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="Input manual: NIS atau kode QR"
            />
            <Button type="submit" variant="secondary">
              <Keyboard className="size-4" /> Catat
            </Button>
          </form>
        </div>

        <div className="space-y-4">
          <div
            className={`rounded-2xl border p-5 shadow-[var(--shadow-soft)] ${
              hasil ? (hasil.ok ? "border-success/40 bg-success/10" : "border-destructive/40 bg-destructive/10") : "bg-card"
            }`}
          >
            {!hasil ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Arahkan kamera ke kartu QR siswa.
              </p>
            ) : (
              <div className="flex items-start gap-3">
                {hasil.ok ? (
                  hasil.status === "terlambat" ? (
                    <Clock className="mt-0.5 size-6 text-warning" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 size-6 text-success" />
                  )
                ) : (
                  <AlertCircle className="mt-0.5 size-6 text-destructive" />
                )}
                <div>
                  <p className="font-display text-lg font-semibold">{hasil.nama}</p>
                  <p className="text-sm text-muted-foreground">{hasil.detail}</p>
                  {hasil.ok && (
                    <p className="mt-1 text-sm font-medium capitalize">
                      {hasil.status} · pukul {hasil.jam}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border bg-card shadow-[var(--shadow-soft)]">
            <h2 className="border-b px-5 py-3.5 text-sm font-semibold">Baru saja tercatat</h2>
            {!hariIni || hariIni.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">Belum ada data.</p>
            ) : (
              <ul className="divide-y">
                {hariIni.map((r) => (
                  <li key={r.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium">
                        {(r.students as { full_name: string } | null)?.full_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(r.students as { class_name: string } | null)?.class_name}
                      </p>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {r.attend_time.slice(0, 5)} · <span className="capitalize">{r.status}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
