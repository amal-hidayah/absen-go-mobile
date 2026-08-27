import { createFileRoute, Link } from "@tanstack/react-router";
import { QrCode, ScanLine, Users, BarChart3, Clock, Download, CheckCircle2 } from "lucide-react";
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
                <a href="https://wa.me/6289509951772?text=Halo%20admin%20AbsenGo,%20saya%20tertarik%20mendaftar%20untuk%20sekolah%20saya" target="_blank" rel="noreferrer">
                  Daftar Sekarang
                </a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#harga">Lihat Harga</a>
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
        <section id="harga" className="py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold md:text-4xl">Pilih Paket Langganan</h2>
            <p className="mt-3 text-muted-foreground">Satu harga untuk seluruh siswa. Bebas batasan, tanpa ribet.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Paket 6 Bulan */}
            <div className="rounded-3xl border bg-card p-8 shadow-[var(--shadow-soft)] flex flex-col">
              <h3 className="text-xl font-semibold">Paket 6 Bulan</h3>
              <p className="text-sm text-muted-foreground mt-2">Cocok untuk mencoba di satu semester.</p>
              <div className="my-6">
                <span className="text-4xl font-bold">Rp 499rb</span>
                <span className="text-muted-foreground"> / 6 bulan</span>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                <li className="flex items-center gap-3 text-sm"><CheckCircle2 className="size-4 text-success" /> Akses penuh dashboard guru</li>
                <li className="flex items-center gap-3 text-sm"><CheckCircle2 className="size-4 text-success" /> Scanner QR super cepat</li>
                <li className="flex items-center gap-3 text-sm"><CheckCircle2 className="size-4 text-success" /> Unlimited data siswa</li>
                <li className="flex items-center gap-3 text-sm"><CheckCircle2 className="size-4 text-success" /> Cetak kartu otomatis</li>
                <li className="flex items-center gap-3 text-sm"><CheckCircle2 className="size-4 text-success" /> Support via WhatsApp</li>
              </ul>
              <Button asChild size="lg" variant="outline" className="w-full">
                <a href="https://wa.me/6289509951772?text=Halo%20admin,%20saya%20mau%20daftar%20Paket%206%20Bulan" target="_blank" rel="noreferrer">
                  Pilih Paket 6 Bulan
                </a>
              </Button>
            </div>

            {/* Paket 12 Bulan */}
            <div className="rounded-3xl border bg-primary/5 p-8 shadow-[var(--shadow-lift)] ring-2 ring-primary flex flex-col relative">
              <div className="absolute top-0 right-8 -translate-y-1/2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                Paling Hemat
              </div>
              <h3 className="text-xl font-semibold">Paket 1 Tahun</h3>
              <p className="text-sm text-muted-foreground mt-2">Pilihan hemat untuk sistem presensi jangka panjang.</p>
              <div className="my-6 flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-lg text-muted-foreground line-through">Rp 998rb</span>
                  <span className="rounded-md bg-success/15 px-2 py-0.5 text-xs font-bold text-success">Diskon 20%</span>
                </div>
                <div>
                  <span className="text-4xl font-bold">Rp 799rb</span>
                  <span className="text-muted-foreground"> / 12 bulan</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                <li className="flex items-center gap-3 text-sm"><CheckCircle2 className="size-4 text-success" /> Semua fitur Paket 6 Bulan</li>
                <li className="flex items-center gap-3 text-sm"><CheckCircle2 className="size-4 text-success" /> Hemat biaya berlangganan</li>
                <li className="flex items-center gap-3 text-sm"><CheckCircle2 className="size-4 text-success" /> Prioritas support 24/7</li>
                <li className="flex items-center gap-3 text-sm"><CheckCircle2 className="size-4 text-success" /> Gratis update fitur baru</li>
              </ul>
              <Button asChild size="lg" className="w-full">
                <a href="https://wa.me/6289509951772?text=Halo%20admin,%20saya%20mau%20daftar%20Paket%201%20Tahun%20(Diskon)" target="_blank" rel="noreferrer">
                  Pilih Paket 1 Tahun
                </a>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8 flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        <p>AbsenGo · Presensi siswa berbasis QR code</p>
        <div className="flex items-center gap-2">
          <span>Dibuat oleh</span>
          <a href="https://kardigi.tech" target="_blank" rel="noreferrer" className="hover:opacity-80 transition-opacity">
            <img src="/kardigi.png" alt="Kardigi" className="h-5 w-auto object-contain" />
          </a>
        </div>
      </footer>
    </div>
  );
}
