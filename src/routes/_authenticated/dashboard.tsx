import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ScanLine,
  Users,
  CheckCircle2,
  Clock,
  UserX,
  Tv,
  LogIn,
  LogOut,
  Briefcase,
  User,
  Plus,
  FileSpreadsheet,
  Calendar,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatRupiah,
  formatTanggal,
  nowTimeJakarta,
  todayJakarta,
  type CompanyAttendance,
  type CompanySettings,
  type Employee,
} from "@/lib/presensi";
import { useAuthProfile } from "@/hooks/use-auth-profile";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — AbsenGo" },
      { name: "description", content: "Ringkasan kehadiran karyawan dan estimasi gaji harian." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const tanggal = todayJakarta();
  const queryClient = useQueryClient();
  const [openManual, setOpenManual] = useState(false);
  const [manualForm, setManualForm] = useState({ employee_id: "", status: "sakit", note: "" });
  const [loadingSeed, setLoadingSeed] = useState(false);

  const { data: authProfile } = useAuthProfile();
  const isAdmin = authProfile?.isAdmin ?? false;
  const currentEmployee = authProfile?.employee;

  // Ambil pengaturan perusahaan
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

  // Ambil data dashboard kehadiran kantor hari ini (untuk Admin)
  const { data: adminData, isLoading: loadingAdmin } = useQuery({
    queryKey: ["dashboard_corporate_admin", tanggal],
    enabled: isAdmin,
    queryFn: async () => {
      const [karyawanRes, presensiRes] = await Promise.all([
        supabase
          .from("employees")
          .select("id, nik, full_name, department, position, daily_salary, role, active")
          .eq("active", true)
          .order("full_name"),
        supabase
          .from("company_attendance")
          .select(
            "id, employee_id, attend_date, clock_in, clock_out, status, late_minutes, note, employees(nik, full_name, department, position, daily_salary)",
          )
          .eq("attend_date", tanggal)
          .order("created_at", { ascending: false }),
      ]);

      const karyawanList = (karyawanRes.data as unknown as Employee[]) || [];
      const presensiList = (presensiRes.data as unknown as CompanyAttendance[]) || [];

      return {
        totalKaryawan: karyawanList.length,
        karyawanList,
        rows: presensiList,
      };
    },
  });

  // Ambil data presensi pribadi (untuk Karyawan)
  const { data: employeeData, isLoading: loadingEmp } = useQuery({
    queryKey: ["dashboard_corporate_employee", currentEmployee?.id, tanggal],
    enabled: !isAdmin && !!currentEmployee?.id,
    queryFn: async () => {
      const now = new Date();
      const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

      const [hariIniRes, bulanIniRes] = await Promise.all([
        supabase
          .from("company_attendance")
          .select("*")
          .eq("employee_id", currentEmployee!.id)
          .eq("attend_date", tanggal)
          .maybeSingle(),
        supabase
          .from("company_attendance")
          .select("id, attend_date, clock_in, clock_out, status, late_minutes")
          .eq("employee_id", currentEmployee!.id)
          .gte("attend_date", firstDay)
          .lte("attend_date", tanggal)
          .order("attend_date", { ascending: false }),
      ]);

      const presensiHariIni = (hariIniRes.data as unknown as CompanyAttendance) || null;
      const riwayatBulanIni = (bulanIniRes.data as unknown as CompanyAttendance[]) || [];

      const totalHadirBulanIni = riwayatBulanIni.filter(
        (r) => r.status === "hadir" || r.status === "terlambat",
      ).length;

      const rate = Number(currentEmployee!.daily_salary) || 0;
      const estimasiGaji = totalHadirBulanIni * rate;

      return {
        presensiHariIni,
        riwayatBulanIni,
        totalHadirBulanIni,
        estimasiGaji,
      };
    },
  });

  async function simpanManual(e: React.FormEvent) {
    e.preventDefault();
    if (!manualForm.employee_id) {
      toast.error("Pilih karyawan terlebih dahulu");
      return;
    }

    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("company_attendance").insert({
      employee_id: manualForm.employee_id,
      attend_date: tanggal,
      clock_in:
        manualForm.status === "hadir" || manualForm.status === "terlambat"
          ? nowTimeJakarta()
          : null,
      status: manualForm.status,
      note: manualForm.note || null,
      recorded_by: auth.user?.id || null,
    });

    if (error) {
      toast.error(
        error.message.includes("duplicate")
          ? "Karyawan sudah tercatat presensi hari ini"
          : error.message,
      );
      return;
    }

    toast.success("Presensi manual berhasil dicatat");
    setOpenManual(false);
    setManualForm({ employee_id: "", status: "sakit", note: "" });
    queryClient.invalidateQueries({ queryKey: ["dashboard_corporate_admin"] });
  }

  async function muatContohData() {
    setLoadingSeed(true);
    const contoh = [
      {
        nik: "EMP001",
        full_name: "Budi Santoso",
        email: "budi@kantor.com",
        department: "Operasional",
        position: "Staff Lapangan",
        daily_salary: 150000,
        role: "employee",
      },
      {
        nik: "EMP002",
        full_name: "Siti Rahma",
        email: "siti@kantor.com",
        department: "Keuangan",
        position: "Staff Accounting",
        daily_salary: 175000,
        role: "employee",
      },
      {
        nik: "EMP003",
        full_name: "Ahmad Fauzi",
        email: "ahmad@kantor.com",
        department: "IT",
        position: "Web Developer",
        daily_salary: 200000,
        role: "admin",
      },
      {
        nik: "EMP004",
        full_name: "Dewi Anggraeni",
        email: "dewi@kantor.com",
        department: "Marketing",
        position: "Sales Marketing",
        daily_salary: 150000,
        role: "employee",
      },
    ];
    const { error } = await supabase.from("employees").insert(contoh);
    setLoadingSeed(false);
    if (error) {
      toast.error("Gagal muat data: " + error.message);
      return;
    }
    toast.success("4 contoh karyawan berhasil ditambahkan!");
    queryClient.invalidateQueries({ queryKey: ["dashboard_corporate_admin"] });
    queryClient.invalidateQueries({ queryKey: ["employees"] });
  }

  // ==========================================
  // TAMPILAN KHUSUS ADMIN / HRD
  // ==========================================
  if (isAdmin) {
    const rows = adminData?.rows ?? [];
    const hadir = rows.filter((r) => r.status === "hadir").length;
    const terlambat = rows.filter((r) => r.status === "terlambat").length;
    const tidakHadir = rows.filter((r) => ["sakit", "izin", "alfa"].includes(r.status)).length;
    const totalMasuk = hadir + terlambat;
    const totalKaryawan = adminData?.totalKaryawan ?? 0;
    const belum = Math.max(totalKaryawan - rows.length, 0);

    const stats = [
      {
        label: "Total Karyawan Aktif",
        value: totalKaryawan,
        icon: Users,
        iconBg: "bg-primary/10 text-primary",
      },
      {
        label: "Sudah Masuk Kerja",
        value: totalMasuk,
        icon: CheckCircle2,
        iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      },
      {
        label: "Terlambat",
        value: terlambat,
        icon: Clock,
        iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      },
      {
        label: "Izin / Sakit / Alfa",
        value: tidakHadir,
        icon: Briefcase,
        iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      },
      {
        label: "Belum Presensi",
        value: belum,
        icon: UserX,
        iconBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
      },
    ];

    return (
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header Admin Terpadu & Rapi */}
        <header className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Dashboard Presensi
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-2 mt-0.5">
              <Calendar className="size-3.5 text-primary" />
              <span>{formatTanggal(tanggal)}</span>
              <span>·</span>
              <span className="font-medium text-foreground">
                {settings?.company_name || "Perusahaan"}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button variant="outline" size="sm" asChild className="h-9">
              <Link to="/kiosk" target="_blank">
                <Tv className="size-4 mr-2" /> Layar Monitor Kiosk
              </Link>
            </Button>
            <Button size="sm" onClick={() => setOpenManual(true)} className="h-9">
              <Plus className="size-4 mr-1.5" /> Input Izin / Cuti
            </Button>
          </div>
        </header>

        {/* Banner Quick Onboarding jika belum ada karyawan */}
        {totalKaryawan === 0 && !loadingAdmin && (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Sparkles className="size-4 text-primary" /> Mulai Siapkan Data Karyawan Anda
              </h2>
              <p className="text-xs text-muted-foreground max-w-xl leading-relaxed">
                Belum ada data karyawan terdaftar. Tambahkan data karyawan atau klik tombol di
                sebelah kanan untuk mengisi contoh data agar sistem siap digunakan.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={muatContohData} disabled={loadingSeed}>
                {loadingSeed ? "Memuat..." : "Muat Data Contoh"}
              </Button>
              <Button size="sm" asChild>
                <Link to="/karyawan">
                  Kelola Karyawan <ArrowRight className="size-3.5 ml-1.5" />
                </Link>
              </Button>
            </div>
          </div>
        )}

        {/* Grid Kartu Statistik Modern & Proporsional */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={`rounded-2xl border bg-card p-4 sm:p-5 shadow-xs transition-shadow hover:shadow-md ${
                i === 0 ? "col-span-2 sm:col-span-1" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`p-2 rounded-xl ${s.iconBg}`}>
                  <s.icon className="size-4 sm:size-5" />
                </span>
              </div>
              <p className="mt-3 text-3xl font-extrabold tracking-tight font-sans text-foreground">
                {loadingAdmin ? "–" : s.value}
              </p>
              <p className="text-xs text-muted-foreground font-medium mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabel Presensi Karyawan Hari Ini */}
        <section className="rounded-2xl border bg-card shadow-xs overflow-hidden">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Presensi Karyawan Hari Ini
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {rows.length} karyawan sudah tercatat presensi
              </p>
            </div>
            <Button variant="ghost" size="sm" asChild className="text-xs">
              <Link to="/rekap">
                <FileSpreadsheet className="size-3.5 mr-1.5" /> Lihat Semua Rekap
              </Link>
            </Button>
          </div>

          {rows.length === 0 ? (
            <div className="px-5 py-14 text-center space-y-2">
              <div className="size-12 rounded-2xl bg-muted/60 text-muted-foreground mx-auto flex items-center justify-center">
                <Clock className="size-6 opacity-60" />
              </div>
              <p className="font-semibold text-sm text-foreground">Belum Ada Presensi Hari Ini</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Aktivitas presensi karyawan akan muncul otomatis begitu karyawan memindai QR code di
                Layar Monitor Kiosk.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/30 text-xs font-semibold uppercase text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3.5">Nama Karyawan</th>
                    <th className="px-5 py-3.5">Departemen</th>
                    <th className="px-5 py-3.5">Jam Masuk</th>
                    <th className="px-5 py-3.5">Jam Pulang</th>
                    <th className="px-5 py-3.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.slice(0, 10).map((r) => (
                    <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-foreground">{r.employees?.full_name}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          NIK: {r.employees?.nik}
                        </p>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground">
                        {r.employees?.department} - {r.employees?.position}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs">
                        {r.clock_in ? (
                          <span className="flex items-center gap-1.5 text-emerald-600 font-semibold">
                            <LogIn className="size-3.5" /> {r.clock_in.slice(0, 5)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs">
                        {r.clock_out ? (
                          <span className="flex items-center gap-1.5 text-purple-600 font-semibold">
                            <LogOut className="size-3.5" /> {r.clock_out.slice(0, 5)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">Belum pulang</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <StatusBadge status={r.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Modal Input Presensi Manual */}
        <Dialog open={openManual} onOpenChange={setOpenManual}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Input Presensi / Izin Manual</DialogTitle>
            </DialogHeader>
            <form onSubmit={simpanManual} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Pilih Karyawan</Label>
                <Select
                  value={manualForm.employee_id}
                  onValueChange={(v) => setManualForm({ ...manualForm, employee_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih nama karyawan..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {adminData?.karyawanList.map((k) => (
                      <SelectItem key={k.id} value={k.id}>
                        {k.full_name} ({k.department})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Status Kehadiran</Label>
                <Select
                  value={manualForm.status}
                  onValueChange={(v) => setManualForm({ ...manualForm, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sakit">Sakit</SelectItem>
                    <SelectItem value="izin">Izin</SelectItem>
                    <SelectItem value="alfa">Alfa (Mangkir)</SelectItem>
                    <SelectItem value="hadir">Hadir (Manual)</SelectItem>
                    <SelectItem value="terlambat">Terlambat (Manual)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="note">Keterangan / Alasan (Opsional)</Label>
                <input
                  id="note"
                  value={manualForm.note}
                  onChange={(e) => setManualForm({ ...manualForm, note: e.target.value })}
                  placeholder="Contoh: Sakit demam, surat dokter menyusul"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpenManual(false)}>
                  Batal
                </Button>
                <Button type="submit">Simpan Presensi</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ==========================================
  // TAMPILAN KHUSUS KARYAWAN
  // ==========================================
  const p = employeeData?.presensiHariIni;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header Karyawan */}
      <header className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Portal Presensi Karyawan
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
            <Calendar className="size-3.5 text-primary" /> {formatTanggal(tanggal)}
          </p>
        </div>

        <Button size="lg" asChild className="shadow-xs">
          <Link to="/scan">
            <ScanLine className="size-5 mr-2" /> Mulai Scan Absen
          </Link>
        </Button>
      </header>

      {/* Kartu Profil & Estimasi Gaji Karyawan */}
      <div className="rounded-3xl border bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-6 shadow-md space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center font-bold">
              <User className="size-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">{currentEmployee?.full_name || "Karyawan"}</h2>
              <p className="text-xs text-emerald-100">
                NIK: <span className="font-mono">{currentEmployee?.nik}</span> ·{" "}
                {currentEmployee?.department} ({currentEmployee?.position})
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs text-emerald-200 block">Tarif Harian</span>
            <span className="font-mono font-bold text-lg">
              {formatRupiah(Number(currentEmployee?.daily_salary) || 0)}
              <span className="text-xs font-normal"> / hari</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/20">
          <div>
            <p className="text-xs text-emerald-200">Kehadiran Bulan Ini</p>
            <p className="text-3xl font-extrabold font-mono mt-1">
              {employeeData?.totalHadirBulanIni ?? 0}{" "}
              <span className="text-sm font-normal text-emerald-200">hari</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-emerald-200">Estimasi Gaji Terkumpul</p>
            <p className="text-3xl font-extrabold font-mono mt-1 text-white">
              {formatRupiah(employeeData?.estimasiGaji ?? 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Kartu Status Hari Ini */}
      <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Clock className="size-4 text-primary" /> Status Absensi Anda Hari Ini
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-muted/40 border space-y-1">
            <span className="text-xs text-emerald-600 font-medium flex items-center gap-1.5">
              <LogIn className="size-4" /> Jam Masuk (Clock In)
            </span>
            <p className="text-2xl font-mono font-bold text-foreground">
              {p?.clock_in ? p.clock_in.slice(0, 5) : "-"}
            </p>
            {p?.status && <StatusBadge status={p.status} />}
          </div>

          <div className="p-4 rounded-xl bg-muted/40 border space-y-1">
            <span className="text-xs text-purple-600 font-medium flex items-center gap-1.5">
              <LogOut className="size-4" /> Jam Pulang (Clock Out)
            </span>
            <p className="text-2xl font-mono font-bold text-foreground">
              {p?.clock_out ? p.clock_out.slice(0, 5) : "Belum Absen"}
            </p>
            <span className="text-[11px] text-muted-foreground block">
              {p?.clock_out ? "Presensi hari ini selesai" : "Scan di monitor sebelum pulang"}
            </span>
          </div>
        </div>
      </div>

      {/* Riwayat Kehadiran Karyawan Bulan Ini */}
      <div className="rounded-2xl border bg-card shadow-xs overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="text-sm font-semibold">Riwayat Kehadiran Anda Bulan Ini</h3>
        </div>

        {employeeData?.riwayatBulanIni.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Belum ada catatan presensi di bulan ini.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Tanggal</th>
                  <th className="px-5 py-3">Jam Masuk</th>
                  <th className="px-5 py-3">Jam Pulang</th>
                  <th className="px-5 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {employeeData?.riwayatBulanIni.slice(0, 10).map((r) => (
                  <tr key={r.id}>
                    <td className="px-5 py-3 text-xs font-medium">
                      {formatTanggal(r.attend_date)}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs">
                      {r.clock_in ? r.clock_in.slice(0, 5) : "-"}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs">
                      {r.clock_out ? r.clock_out.slice(0, 5) : "-"}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    hadir: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    terlambat: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
    sakit: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
    izin: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
    alfa: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
        map[status] ?? "bg-muted text-muted-foreground"
      }`}
    >
      {status}
    </span>
  );
}
