import { createFileRoute, Link } from "@tanstack/react-router";
import { QrCode, ScanLine, Users, BarChart3, Clock, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AbsenGo — Absensi Siswa Sekali Scan" },
      {
        name: "description",
        content:
          "Catat kehadiran siswa hanya dengan memindai kartu QR. Database siswa, status terlambat otomatis, rekap harian, dan export CSV.",
      },
      { property: "og:title", content: "AbsenGo — Absensi Siswa Sekali Scan" },
      {
        property: "og:description",
        content: "Presensi sekolah berbasis QR code: cepat, akurat, dan langsung terekap.",
      },
    ],
  }),
  component: Landing,
});

const fitur = [
  {
    icon: ScanLine,
    title: "Scan kartu QR",
    desc: "Petugas cukup mengarahkan kamera ke kartu siswa. Kehadiran tercatat seketika.",
  },
  {
    icon: Users,
    title: "Database siswa",
    desc: "Kelola NIS, nama, dan kelas. Kartu QR digenerate otomatis dan siap dicetak.",
  },
  {
    icon: Clock,
    title: "Terlambat otomatis",
    desc: "Tentukan jam masuk sekolah, sistem menandai hadir atau terlambat sendiri.",
  },
  {
    icon: BarChart3,
    title: "Rekap & statistik",
    desc: "Pantau kehadiran per hari, filter berdasarkan kelas dan tanggal.",
  },
  {
    icon: Download,
    title: "Export CSV",
    desc: "Unduh rekap presensi untuk laporan wali kelas atau kepala sekolah.",
  },
  {
    icon: QrCode,
    title: "Kartu siap cetak",
    desc: "Cetak lembar kartu QR satu kelas sekaligus langsung dari browser.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-mesh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
        <div className="flex items-center">
          <img src="/logo.webp" alt="Logo" className="h-14 w-auto object-contain" />
        </div>
        <Button asChild size="sm">
          <Link to="/auth">Masuk</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-6xl px-5">
        <section className="grid items-center gap-10 py-14 md:grid-cols-2 md:py-20">
          <div>

            <h1 className="text-4xl leading-tight font-bold md:text-5xl">
              Absensi siswa <span className="text-gradient">sekali scan</span>, rekap langsung
              beres.
            </h1>
            <p className="mt-5 max-w-lg text-base text-muted-foreground">
              Berbasis data siswa sekolah Anda. Setiap siswa punya kartu QR unik — petugas tinggal
              memindai, sistem mencatat jam masuk dan menandai keterlambatan otomatis.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/auth">Mulai sekarang</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/auth">Lihat demo data</Link>
              </Button>
            </div>
          </div>

          <div className="relative">
            <div className="rounded-3xl border bg-card p-6 shadow-[var(--shadow-lift)]">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <p className="text-xs text-muted-foreground">Kartu Presensi Siswa</p>
                  <p className="font-display text-lg font-semibold">Andi Pratama</p>
                  <p className="text-sm text-muted-foreground">X IPA 1 · NIS 2024001</p>
                </div>
                <div className="grid size-20 place-items-center rounded-xl bg-secondary">
                  <QrCode className="size-12 text-secondary-foreground" />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {[
                  ["Siti Nurhaliza", "06:48", "Hadir"],
                  ["Budi Santoso", "07:12", "Terlambat"],
                  ["Dewi Lestari", "06:55", "Hadir"],
                ].map(([nama, jam, status]) => (
                  <div
                    key={nama}
                    className="flex items-center justify-between rounded-xl bg-muted px-4 py-3 text-sm"
                  >
                    <span className="font-medium">{nama}</span>
                    <span className="flex items-center gap-3">
                      <span className="text-muted-foreground">{jam}</span>
                      <span
                        className={
                          status === "Hadir"
                            ? "rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success"
                            : "rounded-full bg-warning/20 px-2 py-0.5 text-xs font-semibold text-warning-foreground"
                        }
                      >
                        {status}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 pb-20 sm:grid-cols-2 lg:grid-cols-3">
          {fitur.map((f) => (
            <div key={f.title} className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-soft)]">
              <span className="grid size-10 place-items-center rounded-xl bg-secondary text-secondary-foreground">
                <f.icon className="size-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        AbsenGo · Presensi siswa berbasis QR code
      </footer>
    </div>
  );
}
