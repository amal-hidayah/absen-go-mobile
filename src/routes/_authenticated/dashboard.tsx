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
  CalendarOff,
  User,
  Plus,
  FileSpreadsheet,
  Calendar,
  Sparkles,
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
import { DataList } from "@/components/data-list";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import {
  formatRupiah,
  formatTanggal,
  hariIniDihitung,
  selisihMenit,
  todayJakarta,
  type CompanyAttendance,
  type CompanySettings,
  type Employee,
} from "@/lib/presensi";
import { useAuthProfile } from "@/hooks/use-auth-profile";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · AbsenGo" },
      {
        name: "description",
        content: "Ringkasan kehadiran karyawan dan estimasi gaji harian.",
      },
    ],
  }),
  component: Dashboard,
});

interface FormManual {
  employee_id: string;
  status: string;
  note: string;
  jam_masuk: string;
  jam_pulang: string;
}

/**
 * Entri manual harus memuat jam masuk dan jam pulang, karena gaji hanya
 * dihitung kalau keduanya tercatat. Default diambil dari jam kerja kantor.
 */
function formManualKosong(settings: CompanySettings | null | undefined): FormManual {
  return {
    employee_id: "",
    status: "sakit",
    note: "",
    jam_masuk: settings?.work_start_time?.slice(0, 5) || "08:00",
    jam_pulang: settings?.work_end_time?.slice(0, 5) || "17:00",
  };
}

function Dashboard() {
  const tanggal = todayJakarta();
  const queryClient = useQueryClient();
  const [openManual, setOpenManual] = useState(false);
  const [manualForm, setManualForm] = useState<FormManual>(() => formManualKosong(null));
  const [loadingSeed, setLoadingSeed] = useState(false);

  const { data: authProfile } = useAuthProfile();
  const isAdmin = authProfile?.isAdmin ?? false;
  const currentEmployee = authProfile?.employee;

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

  const jamMasukKantor = settings?.work_start_time?.slice(0, 5) || "08:00";
  const jamPulangKantor = settings?.work_end_time?.slice(0, 5) || "17:00";
  // Status "hadir" dan "terlambat" dihitung gaji, jadi keduanya butuh jam
  // masuk dan jam pulang yang tercatat.
  const manualBekerja = manualForm.status === "hadir" || manualForm.status === "terlambat";
  const manualTelat = manualBekerja
    ? Math.max(0, selisihMenit(manualForm.jam_masuk, jamMasukKantor))
    : 0;

  const {
    data: adminData,
    isLoading: loadingAdmin,
    isError: adminGagal,
    refetch: refetchAdmin,
  } = useQuery({
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

  const {
    data: employeeData,
    isLoading: loadingEmp,
    isError: empGagal,
    refetch: refetchEmp,
  } = useQuery({
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

      // Gaji hanya masuk kalau absen masuk dan absen pulang keduanya tercatat,
      // jadi angka di bawah ini harus sama dengan rekap gaji.
      const hadir = (r: CompanyAttendance) => r.status === "hadir" || r.status === "terlambat";
      const totalHadirBulanIni = riwayatBulanIni.filter(
        (r) => hadir(r) && hariIniDihitung(r),
      ).length;
      const belumLengkapBulanIni = riwayatBulanIni.filter(
        (r) => hadir(r) && !hariIniDihitung(r),
      ).length;

      const rate = Number(currentEmployee!.daily_salary) || 0;

      return {
        presensiHariIni,
        riwayatBulanIni,
        totalHadirBulanIni,
        belumLengkapBulanIni,
        estimasiGaji: totalHadirBulanIni * rate,
      };
    },
  });

  async function simpanManual(e: React.FormEvent) {
    e.preventDefault();
    if (!manualForm.employee_id) {
      toast.error("Pilih karyawan terlebih dahulu");
      return;
    }

    const bekerja = manualForm.status === "hadir" || manualForm.status === "terlambat";
    if (bekerja && (!manualForm.jam_masuk || !manualForm.jam_pulang)) {
      toast.error("Jam masuk dan jam pulang wajib diisi untuk status hadir atau terlambat");
      return;
    }
    if (bekerja && manualForm.jam_pulang < manualForm.jam_masuk) {
      toast.error("Jam pulang tidak boleh lebih awal dari jam masuk");
      return;
    }

    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("company_attendance").insert({
      employee_id: manualForm.employee_id,
      attend_date: tanggal,
      clock_in: bekerja ? `${manualForm.jam_masuk}:00` : null,
      clock_out: bekerja ? `${manualForm.jam_pulang}:00` : null,
      status: manualForm.status,
      late_minutes: manualTelat,
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
    setManualForm(formManualKosong(settings));
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
        role: "employee",
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

    // Warna hanya untuk status (masuk / terlambat); angka lain netral agar
    // lima kartu ini tidak berlomba menjadi fokus.
    const stats = [
      {
        label: "Karyawan Aktif",
        value: totalKaryawan,
        icon: Users,
        tone: "bg-primary/10 text-primary",
      },
      {
        label: "Sudah Masuk Kerja",
        value: totalMasuk,
        icon: CheckCircle2,
        tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
      },
      {
        label: "Terlambat",
        value: terlambat,
        icon: Clock,
        tone: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
      },
      {
        label: "Izin / Sakit / Alfa",
        value: tidakHadir,
        icon: CalendarOff,
        tone: "bg-muted text-muted-foreground",
      },
      {
        label: "Belum Presensi",
        value: belum,
        icon: UserX,
        tone: "bg-muted text-muted-foreground",
      },
    ];

    const displayed = rows.slice(0, 10);

    return (
      <div className="mx-auto max-w-6xl space-y-5 sm:space-y-6">
        <PageHeader
          title="Dashboard Presensi"
          subtitle={
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Calendar className="size-3.5 text-primary" aria-hidden />
              {formatTanggal(tanggal)}
              <span aria-hidden>·</span>
              <span className="font-medium text-foreground">
                {settings?.company_name || "Perusahaan"}
              </span>
            </span>
          }
          actions={
            <>
              <Button variant="outline" asChild>
                <Link to="/kiosk" target="_blank">
                  <Tv className="size-4" aria-hidden /> Layar Monitor Kiosk
                </Link>
              </Button>
              <Button
                onClick={() => {
                  setManualForm(formManualKosong(settings));
                  setOpenManual(true);
                }}
              >
                <Plus className="size-4" aria-hidden /> Input Izin / Cuti
              </Button>
            </>
          }
        />

        {totalKaryawan === 0 && !loadingAdmin && !adminGagal && (
          <div className="flex flex-col gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="space-y-1.5">
              <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
                <Sparkles className="size-4 text-primary" aria-hidden /> Mulai siapkan data karyawan
              </h2>
              <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
                Belum ada karyawan terdaftar. Tambahkan satu per satu, atau muat data contoh agar
                alur presensi bisa langsung dicoba.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                onClick={muatContohData}
                disabled={loadingSeed}
                className="shrink-0"
              >
                {loadingSeed ? "Memuat..." : "Muat Data Contoh"}
              </Button>
              <Button asChild className="shrink-0">
                <Link to="/karyawan">Kelola Karyawan</Link>
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={`rounded-2xl border bg-card p-3.5 sm:p-5 ${
                i === 0 ? "col-span-2 sm:col-span-1" : ""
              }`}
            >
              <span
                className={`inline-grid size-9 place-items-center rounded-xl sm:size-10 ${s.tone}`}
              >
                <s.icon className="size-4.5 sm:size-5" aria-hidden />
              </span>
              <p className="mt-2.5 font-sans text-2xl font-extrabold leading-none tracking-tight text-foreground sm:mt-3 sm:text-3xl">
                {loadingAdmin ? "–" : s.value}
              </p>
              <p className="mt-1.5 text-xs font-medium leading-snug text-muted-foreground text-pretty">
                {s.label}
              </p>
            </div>
          ))}
        </div>

        <DataList
          rows={displayed}
          rowKey={(r) => r.id}
          loading={loadingAdmin}
          loadingLabel="Memuat presensi hari ini..."
          error={adminGagal ? "Presensi hari ini tidak bisa dimuat dari server." : null}
          onRetry={() => void refetchAdmin()}
          header={
            <>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-foreground">
                  Presensi Karyawan Hari Ini
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {rows.length} dari {totalKaryawan} karyawan sudah tercatat
                </p>
              </div>
              <Button variant="ghost" size="sm" asChild className="shrink-0 text-xs">
                <Link to="/rekap">
                  <FileSpreadsheet className="size-3.5" aria-hidden /> Rekap lengkap
                </Link>
              </Button>
            </>
          }
          columns={[
            {
              header: "Karyawan",
              render: (r) => (
                <>
                  <p className="font-semibold text-foreground">{r.employees?.full_name}</p>
                  <p className="font-mono text-xs text-muted-foreground">NIK: {r.employees?.nik}</p>
                </>
              ),
            },
            {
              header: "Departemen",
              render: (r) => (
                <span className="text-xs text-muted-foreground">
                  {r.employees?.department} · {r.employees?.position}
                </span>
              ),
            },
            {
              header: "Jam Masuk",
              render: (r) =>
                r.clock_in ? (
                  <span className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    {r.clock_in.slice(0, 5)}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">-</span>
                ),
            },
            {
              header: "Jam Pulang",
              render: (r) =>
                r.clock_out ? (
                  <span className="font-mono text-xs font-semibold text-violet-700 dark:text-violet-400">
                    {r.clock_out.slice(0, 5)}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Belum pulang</span>
                ),
            },
            { header: "Status", align: "right", render: (r) => <StatusBadge status={r.status} /> },
          ]}
          renderCard={(r) => (
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{r.employees?.full_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.employees?.department} · {r.employees?.position}
                  </p>
                </div>
                <StatusBadge status={r.status} />
              </div>
              <div className="flex items-center gap-4 font-mono text-sm">
                <span className="text-muted-foreground">
                  <LogIn
                    className="mr-1.5 inline size-3.5 text-emerald-700 dark:text-emerald-400"
                    aria-hidden
                  />
                  {r.clock_in ? r.clock_in.slice(0, 5) : "--:--"}
                </span>
                <span className="text-muted-foreground">
                  <LogOut
                    className="mr-1.5 inline size-3.5 text-violet-700 dark:text-violet-400"
                    aria-hidden
                  />
                  {r.clock_out ? r.clock_out.slice(0, 5) : "--:--"}
                </span>
              </div>
            </div>
          )}
          empty={
            <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <Clock className="size-5" aria-hidden />
              </div>
              <p className="text-sm font-semibold text-foreground">Belum ada presensi hari ini</p>
              <p className="max-w-sm text-xs leading-relaxed text-muted-foreground text-pretty">
                Catatan muncul otomatis begitu karyawan memindai QR code di Layar Monitor Kiosk.
              </p>
            </div>
          }
        />

        <Dialog open={openManual} onOpenChange={setOpenManual}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="pr-8">Input Presensi / Izin Manual</DialogTitle>
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

              {manualBekerja && (
                <div className="space-y-1.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="jam_masuk">Jam Masuk</Label>
                      <Input
                        id="jam_masuk"
                        type="time"
                        value={manualForm.jam_masuk}
                        onChange={(e) =>
                          setManualForm({ ...manualForm, jam_masuk: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="jam_pulang">Jam Pulang</Label>
                      <Input
                        id="jam_pulang"
                        type="time"
                        value={manualForm.jam_pulang}
                        onChange={(e) =>
                          setManualForm({ ...manualForm, jam_pulang: e.target.value })
                        }
                        required
                      />
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Gaji hanya dihitung kalau jam masuk dan jam pulang keduanya terisi. Jam kerja
                    kantor {jamMasukKantor} to {jamPulangKantor}.
                    {manualTelat > 0 && (
                      <>
                        {" "}
                        Jam masuk ini {manualTelat} menit lebih lambat dari {jamMasukKantor}, jadi
                        pilih status Terlambat.
                      </>
                    )}
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="note">Keterangan / Alasan (opsional)</Label>
                <Input
                  id="note"
                  value={manualForm.note}
                  onChange={(e) => setManualForm({ ...manualForm, note: e.target.value })}
                  placeholder="Contoh: sakit demam, surat dokter menyusul"
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
    <div className="mx-auto max-w-4xl space-y-5 sm:space-y-6">
      <PageHeader
        title="Portal Presensi Karyawan"
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Calendar className="size-3.5 text-primary" aria-hidden />
            {formatTanggal(tanggal)}
          </span>
        }
        actions={
          <Button asChild>
            <Link to="/scan">
              <ScanLine className="size-4" aria-hidden /> Scan Absen
            </Link>
          </Button>
        }
      />

      {/* Kartu profil: satu-satunya bidang bergradasi di halaman ini, dipakai sebagai
          focal point karena berisi angka yang paling ingin dilihat karyawan. */}
      <div className="space-y-5 rounded-3xl bg-gradient-to-br from-emerald-700 to-teal-800 p-5 text-white shadow-[var(--shadow-lift)] sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">
              <User className="size-6" aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold">
                {currentEmployee?.full_name || "Karyawan"}
              </h2>
              <p className="mt-0.5 text-xs leading-relaxed text-emerald-50/90">
                NIK <span className="font-mono">{currentEmployee?.nik}</span> ·{" "}
                {currentEmployee?.department} ({currentEmployee?.position})
              </p>
            </div>
          </div>

          <div className="shrink-0 sm:text-right">
            <span className="block text-xs text-emerald-50/90">Tarif harian</span>
            <span className="font-mono text-lg font-bold">
              {formatRupiah(Number(currentEmployee?.daily_salary) || 0)}
              <span className="text-xs font-normal text-emerald-50/90"> / hari</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 border-t border-white/20 pt-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-emerald-50/90">Kehadiran bulan ini</p>
            <p className="mt-1 font-mono text-2xl font-extrabold sm:text-3xl">
              {loadingEmp ? "–" : (employeeData?.totalHadirBulanIni ?? 0)}{" "}
              <span className="font-sans text-sm font-normal text-emerald-50/90">hari</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-emerald-50/90">Estimasi gaji terkumpul</p>
            <p className="mt-1 break-words font-mono text-2xl font-extrabold sm:text-3xl">
              {loadingEmp ? "–" : formatRupiah(employeeData?.estimasiGaji ?? 0)}
            </p>
          </div>
        </div>

        {(employeeData?.belumLengkapBulanIni ?? 0) > 0 && (
          <p className="mt-3 border-t border-white/20 pt-3 text-xs leading-relaxed text-emerald-50/85">
            <span className="font-semibold text-white">
              {employeeData?.belumLengkapBulanIni} hari
            </span>{" "}
            belum masuk hitungan gaji karena absen masuk atau pulangnya belum lengkap. Selesaikan
            dengan memindai layar monitor.
          </p>
        )}
      </div>

      <div className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-soft)] sm:p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Clock className="size-4 text-primary" aria-hidden /> Absensi Anda Hari Ini
        </h3>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="space-y-1 rounded-xl border bg-muted/40 p-3">
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <LogIn className="size-4" aria-hidden /> Jam masuk
            </span>
            <p className="font-mono text-xl font-bold leading-tight text-foreground">
              {p?.clock_in ? p.clock_in.slice(0, 5) : "--:--"}
            </p>
            {p?.status ? <StatusBadge status={p.status} /> : null}
          </div>

          <div className="space-y-1 rounded-xl border bg-muted/40 p-3">
            <span className="flex items-center gap-1.5 text-xs font-medium text-violet-700 dark:text-violet-400">
              <LogOut className="size-4" aria-hidden /> Jam pulang
            </span>
            <p className="font-mono text-xl font-bold leading-tight text-foreground">
              {p?.clock_out ? p.clock_out.slice(0, 5) : "--:--"}
            </p>
            <span className="block text-[11px] leading-snug text-muted-foreground">
              {p?.clock_out
                ? "Presensi hari ini selesai"
                : `Absen pulang dibuka pukul ${jamPulangKantor}`}
            </span>
          </div>
        </div>
      </div>

      <DataList
        rows={employeeData?.riwayatBulanIni.slice(0, 10) ?? []}
        rowKey={(r) => r.id}
        loading={loadingEmp}
        loadingLabel="Memuat riwayat kehadiran..."
        error={empGagal ? "Riwayat kehadiran tidak bisa dimuat dari server." : null}
        onRetry={() => void refetchEmp()}
        header={<h3 className="text-sm font-semibold">Riwayat Kehadiran Bulan Ini</h3>}
        columns={[
          {
            header: "Tanggal",
            render: (r) => (
              <span className="text-xs font-medium">{formatTanggal(r.attend_date)}</span>
            ),
          },
          {
            header: "Masuk",
            render: (r) => (
              <span className="font-mono text-xs">{r.clock_in ? r.clock_in.slice(0, 5) : "-"}</span>
            ),
          },
          {
            header: "Pulang",
            render: (r) => (
              <span className="font-mono text-xs">
                {r.clock_out ? r.clock_out.slice(0, 5) : "-"}
              </span>
            ),
          },
          { header: "Status", align: "right", render: (r) => <StatusBadge status={r.status} /> },
        ]}
        renderCard={(r) => (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{formatTanggal(r.attend_date)}</p>
              <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                {r.clock_in ? r.clock_in.slice(0, 5) : "--:--"} ·{" "}
                {r.clock_out ? r.clock_out.slice(0, 5) : "--:--"}
              </p>
            </div>
            <StatusBadge status={r.status} />
          </div>
        )}
        empty={
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            Belum ada catatan presensi di bulan ini.
          </p>
        }
      />
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  // Lencana status: bentuk pil dipakai karena memang penanda keadaan, bukan hiasan.
  const map: Record<string, string> = {
    hadir: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
    terlambat: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
    sakit: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
    izin: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300",
    alfa: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
  };
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
        map[status] ?? "bg-muted text-muted-foreground"
      }`}
    >
      {status}
    </span>
  );
}
