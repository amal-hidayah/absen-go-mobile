import { createFileRoute, Link } from "@tanstack/react-router";
import {
  QrCode,
  ScanLine,
  Users,
  DollarSign,
  Clock,
  Tv,
  ShieldCheck,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AbsenGo Corporate · Presensi Kantor dan Penggajian Harian" },
      {
        name: "description",
        content:
          "Sistem presensi perusahaan dengan Dynamic QR 5 detik anti-kecurangan, pencatatan jam kerja masuk-pulang, dan penggajian harian otomatis.",
      },
    ],
  }),
  component: Landing,
});

// Dua layar yang jadi satu alur: layar kantor di TV, kamera karyawan di HP.
const alur = [
  {
    icon: Tv,
    title: "Layar kiosk di monitor kantor",
    desc: "QR code dinamis yang berganti tiap 5 detik, jadi foto layar atau titip absen tidak berlaku.",
  },
  {
    icon: ScanLine,
    title: "Scan dari HP masing-masing",
    desc: "Karyawan memindai dari akun sendiri. Sistem mencatat jam masuk, jam pulang, dan keterlambatan per menit.",
  },
];

const lain = [
  {
    icon: Clock,
    title: "Jam kerja dan toleransi diatur admin",
    desc: "Jam masuk, batas toleransi, dan jam pulang ditetapkan sekali, berlaku untuk semua karyawan.",
  },
  {
    icon: DollarSign,
    title: "Gaji harian dihitung otomatis",
    desc: "Akumulasi dari kehadiran nyata, siap dihitung per dua minggu atau satu bulan penuh.",
  },
  {
    icon: Users,
    title: "Data karyawan dan tarif harian",
    desc: "Kelola jabatan, departemen, username login, dan tarif gaji harian per staf.",
  },
  {
    icon: FileText,
    title: "Slip gaji dan rekap CSV",
    desc: "Cetak slip gaji per karyawan atau unduh rekap CSV untuk keperluan transfer.",
  },
];

function Landing() {
  return (
    <div className="min-h-dvh bg-mesh">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-5 sm:px-6 sm:py-6">
        <Link to="/" className="flex min-w-0 items-center gap-3">
          <img src="/logo.webp" alt="Logo AbsenGo" className="h-10 w-auto object-contain sm:h-12" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold text-foreground sm:text-base">
              AbsenGo Corporate
            </span>
            <span className="block truncate text-[10px] text-muted-foreground">
              Presensi &amp; Penggajian Harian
            </span>
          </span>
        </Link>

        <Button asChild size="sm" className="shrink-0">
          <Link to="/auth">Masuk Panel</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-6xl px-5 sm:px-6">
        <section className="grid items-center gap-8 pt-4 pb-12 md:grid-cols-2 md:gap-10 md:pt-10 md:pb-16">
          <div>
            <h1 className="text-3xl font-extrabold leading-[1.15] tracking-tight text-pretty sm:text-4xl md:text-5xl">
              Presensi kantor sederhana, <span className="text-gradient">gaji harian</span> langsung
              terhitung.
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground text-pretty sm:text-base">
              Kantor menyalakan satu monitor berisi QR yang berganti tiap 5 detik. Karyawan memindai
              dari akun masing-masing, lalu sistem merangkai catatan kehadiran sekaligus menghitung
              gaji hari itu.
            </p>

            <div className="mt-7 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:gap-3">
              <Button asChild size="lg">
                <Link to="/auth">Masuk ke Panel</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/kiosk" target="_blank">
                  <Tv className="size-4" aria-hidden /> Buka Layar Kiosk
                </Link>
              </Button>
            </div>
          </div>

          {/* Pratinjau tampilan layar kiosk, diberi label supaya jelas ini ilustrasi,
              bukan tangkapan layar sungguhan. */}
          <div className="rounded-3xl border bg-card p-4 shadow-[var(--shadow-lift)] sm:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Pratinjau layar kiosk
            </p>

            <div className="mt-3 rounded-2xl bg-slate-950 p-5 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
                QR berganti tiap 5 detik
              </p>
              <div className="mx-auto mt-3 flex size-32 items-center justify-center rounded-xl bg-white p-3 sm:size-36">
                <QrCode className="size-full text-slate-900" aria-hidden />
              </div>
              <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div className="h-full w-1/5 rounded-full bg-emerald-400" />
              </div>
              <p className="mt-2 text-[11px] text-slate-400">Arahkan kamera HP ke layar ini</p>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground">Skema penggajian</span>
              <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                hari hadir × tarif harian
              </span>
            </div>
          </div>
        </section>

        <section className="border-t pt-10 pb-14 md:pt-12">
          <h2 className="text-lg font-bold text-foreground sm:text-xl">Alur presensi harian</h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground text-pretty">
            Dua layar ini saja yang dipakai setiap hari di kantor. Selebihnya diatur admin.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            {alur.map((a) => (
              <div
                key={a.title}
                className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-soft)]"
              >
                <span className="inline-grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <a.icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-3.5 text-base font-semibold text-foreground">{a.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground text-pretty">
                  {a.desc}
                </p>
              </div>
            ))}
          </div>

          <ul className="mt-8 divide-y border-y">
            {lain.map((f) => (
              <li key={f.title} className="flex gap-4 py-4">
                <span className="mt-0.5 shrink-0 text-muted-foreground">
                  <f.icon className="size-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-foreground">{f.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground text-pretty">
                    {f.desc}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="border-t py-7 text-center text-xs text-muted-foreground">
        <p>AbsenGo Corporate · Solusi presensi perusahaan dan penggajian harian</p>
      </footer>
    </div>
  );
}
