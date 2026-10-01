import { createFileRoute, Link } from "@tanstack/react-router";
import {
  QrCode,
  ScanLine,
  Users,
  DollarSign,
  Clock,
  Tv,
  CheckCircle2,
  ShieldCheck,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AbsenGo Corporate — Presensi Kantor & Penggajian Harian" },
      {
        name: "description",
        content:
          "Sistem presensi perusahaan dengan Dynamic QR 5 detik anti-kecurangan, pencatatan jam kerja masuk-pulang, dan penggajian skema harian otomatis.",
      },
    ],
  }),
  component: Landing,
});

const fitur = [
  {
    icon: Tv,
    title: "Layar Kiosk QR 5 Detik",
    desc: "Monitor kantor menampilkan QR code dinamis yang berganti tiap 5 detik. Mencegah foto QR dan titip absen.",
  },
  {
    icon: ScanLine,
    title: "Scan Langsung dari HP",
    desc: "Karyawan masuk ke akun di smartphone masing-masing, arahkan kamera ke layar kantor untuk Clock-In dan Clock-Out.",
  },
  {
    icon: Clock,
    title: "Jam Kerja & Toleransi",
    desc: "Admin mengatur jam masuk, batas toleransi, dan jam pulang. Keterlambatan dihitung otomatis per menit.",
  },
  {
    icon: DollarSign,
    title: "Penggajian Harian Otomatis",
    desc: "Akumulasi gaji berbasis kehadiran nyata: Hari Hadir × Tarif Harian, siap dihitung per 2 minggu atau bulanan.",
  },
  {
    icon: Users,
    title: "Manajemen Karyawan",
    desc: "Kelola data karyawan, departemen, jabatan, dan tentukan tarif gaji harian masing-masing staf.",
  },
  {
    icon: FileText,
    title: "Cetak Slip Gaji & CSV",
    desc: "Generate dan cetak slip gaji per karyawan langsung dari browser atau unduh laporan CSV untuk transfer bank.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-mesh">
      {/* Navigation Header */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
        <div className="flex items-center gap-3">
          <img src="/logo.webp" alt="Logo" className="h-12 w-auto object-contain" />
          <div>
            <span className="font-bold text-base text-foreground block">AbsenGo Corporate</span>
            <span className="text-[10px] text-muted-foreground block">Presensi & Penggajian Harian</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/kiosk" target="_blank">
              <Tv className="size-4 mr-1.5 text-primary" /> Layar Kiosk
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/auth">Masuk Panel</Link>
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="mx-auto max-w-6xl px-5">
        <section className="grid items-center gap-10 pt-6 pb-14 md:grid-cols-2 md:pt-10 md:pb-20">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-semibold mb-4">
              <ShieldCheck className="size-3.5" /> Dynamic QR Code Anti-Titip Absen
            </div>

            <h1 className="text-4xl leading-tight font-extrabold md:text-5xl">
              Presensi kantor cerdas, <span className="text-gradient">gaji harian</span> langsung terhitung.
            </h1>
            <p className="mt-4 max-w-lg text-base text-muted-foreground leading-relaxed">
              Kantor menyediakan layar monitor dengan QR code yang berganti tiap 5 detik. Karyawan scan dari HP akun masing-masing, sistem mencatat jam masuk, jam pulang, dan mengumpulkan gaji harian secara otomatis.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/auth">Mulai Sekarang</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/kiosk" target="_blank">
                  <Tv className="size-4 mr-2 text-primary" /> Buka Layar Kiosk Kantor
                </Link>
              </Button>
            </div>
          </div>

          <div className="relative flex justify-center">
            <div className="rounded-3xl border bg-card p-6 shadow-2xl max-w-md w-full space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <span className="size-3 rounded-full bg-red-500" />
                  <span className="size-3 rounded-full bg-amber-500" />
                  <span className="size-3 rounded-full bg-emerald-500" />
                </div>
                <span className="text-xs font-mono text-muted-foreground">Monitor Kantor Realtime</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 text-white text-center space-y-2">
                <p className="text-[11px] text-blue-400 font-semibold uppercase tracking-wider">
                  QR Dinamis (Berganti Tiap 5 Detik)
                </p>
                <div className="size-36 mx-auto bg-white p-2 rounded-xl flex items-center justify-center">
                  <QrCode className="size-28 text-slate-900" />
                </div>
                <p className="text-[11px] text-slate-400">
                  Scan via HP karyawan · Jam Masuk: 08:00 WIB
                </p>
              </div>

              <div className="p-3 rounded-xl bg-muted/40 text-xs flex justify-between items-center font-medium">
                <span>Skema Penggajian:</span>
                <span className="text-emerald-600 font-bold font-mono">Hari Hadir × Tarif Harian</span>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-20">
          {fitur.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-soft)] hover:shadow-md transition-shadow"
            >
              <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <f.icon className="size-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-foreground">{f.title}</h3>
              <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {f.desc}
              </p>
            </div>
          ))}
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 text-center text-xs text-muted-foreground">
        <p>AbsenGo Corporate · Solusi Presensi Perusahaan & Manajemen Penggajian Harian</p>
      </footer>
    </div>
  );
}
