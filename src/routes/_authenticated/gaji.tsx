import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DollarSign, Download, Printer, Calendar, FileText, UserX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { DataList } from "@/components/data-list";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formatRupiah,
  formatTanggal,
  toCsv,
  downloadCsv,
  type Employee,
  type CompanyAttendance,
  type CompanySettings,
} from "@/lib/presensi";

export const Route = createFileRoute("/_authenticated/gaji")({
  head: () => ({
    meta: [
      { title: "Penggajian · AbsenGo" },
      { name: "description", content: "Kalkulasi dan rekapitulasi gaji harian karyawan." },
    ],
  }),
  component: GajiPage,
});

function getBiweeklyPeriod(): { dari: string; sampai: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = now.getDate();

  if (day <= 15) {
    return { dari: `${year}-${month}-01`, sampai: `${year}-${month}-15` };
  }
  const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
  return { dari: `${year}-${month}-16`, sampai: `${year}-${month}-${lastDay}` };
}

function getMonthlyPeriod(): { dari: string; sampai: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
  return { dari: `${year}-${month}-01`, sampai: `${year}-${month}-${lastDay}` };
}

interface RekapGajiRow {
  employee: Employee;
  totalHadir: number;
  tepatWaktu: number;
  terlambat: number;
  izin: number;
  sakit: number;
  alfa: number;
  totalGaji: number;
}

function GajiPage() {
  const defaultPeriod = getBiweeklyPeriod();
  const [dari, setDari] = useState(defaultPeriod.dari);
  const [sampai, setSampai] = useState(defaultPeriod.sampai);
  const [slipModal, setSlipModal] = useState<RekapGajiRow | null>(null);

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

  const {
    data: employees = [],
    isLoading: loadEmp,
    isError: empGagal,
    refetch: refetchEmp,
  } = useQuery<Employee[]>({
    queryKey: ["employees"],
    retry: 1,
    queryFn: async () => {
      const { data } = await supabase
        .from("employees")
        .select("*")
        .eq("active", true)
        .order("department")
        .order("full_name");
      return (data as unknown as Employee[]) || [];
    },
  });

  const {
    data: attendances = [],
    isLoading: loadAtt,
    isError: attGagal,
    refetch: refetchAtt,
  } = useQuery<CompanyAttendance[]>({
    queryKey: ["payroll_attendance", dari, sampai],
    retry: 1,
    queryFn: async () => {
      const { data } = await supabase
        .from("company_attendance")
        .select("id, employee_id, attend_date, clock_in, clock_out, status, late_minutes")
        .gte("attend_date", dari)
        .lte("attend_date", sampai);
      return (data as unknown as CompanyAttendance[]) || [];
    },
  });

  const payrollData: RekapGajiRow[] = useMemo(() => {
    const attMap = new Map<string, CompanyAttendance[]>();
    for (const att of attendances) {
      const list = attMap.get(att.employee_id) || [];
      list.push(att);
      attMap.set(att.employee_id, list);
    }

    return employees.map((emp) => {
      const list = attMap.get(emp.id) || [];
      const tepatWaktu = list.filter((a) => a.status === "hadir").length;
      const terlambat = list.filter((a) => a.status === "terlambat").length;
      const izin = list.filter((a) => a.status === "izin").length;
      const sakit = list.filter((a) => a.status === "sakit").length;
      const alfa = list.filter((a) => a.status === "alfa").length;

      // Kehadiran kerja dihitung hanya dari hadir tepat waktu dan terlambat.
      const totalHadir = tepatWaktu + terlambat;
      const dailySalary = Number(emp.daily_salary) || 0;

      return {
        employee: emp,
        totalHadir,
        tepatWaktu,
        terlambat,
        izin,
        sakit,
        alfa,
        totalGaji: totalHadir * dailySalary,
      };
    });
  }, [employees, attendances]);

  const totalPengeluaran = payrollData.reduce((acc, row) => acc + row.totalGaji, 0);
  const totalHariKerja = payrollData.reduce((acc, row) => acc + row.totalHadir, 0);
  const sedangMemuat = loadEmp || loadAtt;

  function setPreset(tipe: "biweekly" | "monthly") {
    const p = tipe === "biweekly" ? getBiweeklyPeriod() : getMonthlyPeriod();
    setDari(p.dari);
    setSampai(p.sampai);
  }

  function exportPayrollCsv() {
    const csvData = payrollData.map((row) => ({
      NIK: row.employee.nik,
      Nama: row.employee.full_name,
      Departemen: row.employee.department,
      Jabatan: row.employee.position,
      "Tarif Gaji Harian": Number(row.employee.daily_salary),
      "Total Hari Hadir": row.totalHadir,
      "Tepat Waktu": row.tepatWaktu,
      Terlambat: row.terlambat,
      Izin: row.izin,
      Sakit: row.sakit,
      Alfa: row.alfa,
      "Total Gaji Diterima": row.totalGaji,
    }));
    const csv = toCsv(csvData);
    if (!csv) return;
    downloadCsv(`rekap-gaji-${dari}-sd-${sampai}.csv`, csv);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 sm:space-y-6">
      <PageHeader
        title="Penggajian Harian"
        icon={DollarSign}
        subtitle={
          <>
            Gaji dihitung dari kehadiran riil:{" "}
            <span className="font-semibold text-foreground">hari hadir × tarif harian</span>.
          </>
        }
        actions={
          <Button
            variant="outline"
            onClick={exportPayrollCsv}
            disabled={payrollData.length === 0}
            className="shrink-0"
          >
            <Download className="size-4" aria-hidden /> Export Rekap CSV
          </Button>
        }
      />

      <div className="space-y-4 rounded-2xl border bg-card p-4 shadow-[var(--shadow-soft)] sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Calendar className="size-4 text-primary" aria-hidden /> Periode penggajian
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="secondary" onClick={() => setPreset("biweekly")} className="shrink-0">
              2 Minggu Ini
            </Button>
            <Button variant="secondary" onClick={() => setPreset("monthly")} className="shrink-0">
              1 Bulan Penuh
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="dari">Dari Tanggal</Label>
            <Input id="dari" type="date" value={dari} onChange={(e) => setDari(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sampai">Sampai Tanggal</Label>
            <Input
              id="sampai"
              type="date"
              value={sampai}
              onChange={(e) => setSampai(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total pengeluaran periode ini</p>
          <p className="mt-1.5 font-mono text-xl font-bold text-emerald-700 sm:text-2xl dark:text-emerald-400">
            {sedangMemuat ? "–" : formatRupiah(totalPengeluaran)}
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total hari masuk</p>
          <p className="mt-1.5 font-mono text-xl font-bold text-foreground sm:text-2xl">
            {sedangMemuat ? "–" : totalHariKerja}{" "}
            <span className="font-sans text-sm font-normal text-muted-foreground">hari</span>
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Karyawan aktif berhak gaji</p>
          <p className="mt-1.5 font-mono text-xl font-bold text-foreground sm:text-2xl">
            {sedangMemuat ? "–" : employees.length}{" "}
            <span className="font-sans text-sm font-normal text-muted-foreground">orang</span>
          </p>
        </div>
      </div>

      <DataList
        rows={payrollData}
        rowKey={(row) => row.employee.id}
        loading={sedangMemuat}
        loadingLabel="Menghitung kalkulasi penggajian..."
        error={empGagal || attGagal ? "Data penggajian tidak bisa dimuat dari server." : null}
        onRetry={() => {
          void refetchEmp();
          void refetchAtt();
        }}
        header={
          <p className="text-xs text-muted-foreground">
            Rincian gaji {payrollData.length} karyawan aktif · {formatTanggal(dari)} s/d{" "}
            {formatTanggal(sampai)}
          </p>
        }
        columns={[
          {
            header: "Karyawan",
            render: (row) => (
              <>
                <p className="font-semibold text-foreground">{row.employee.full_name}</p>
                <p className="font-mono text-xs text-muted-foreground">{row.employee.nik}</p>
              </>
            ),
          },
          {
            header: "Tarif Harian",
            render: (row) => (
              <>
                <span className="font-mono text-sm">
                  {formatRupiah(Number(row.employee.daily_salary))}
                </span>
                <span className="block text-xs text-muted-foreground">/ hari</span>
              </>
            ),
          },
          {
            header: "Hari Hadir",
            align: "center",
            render: (row) => (
              <span className="inline-flex items-center justify-center rounded-full bg-primary/10 px-3 py-1 font-mono text-sm font-bold text-primary">
                {row.totalHadir}
              </span>
            ),
          },
          {
            header: "Rincian Status",
            render: (row) => (
              <div className="space-y-0.5 text-xs">
                <p className="text-emerald-700 dark:text-emerald-400">
                  Tepat waktu: {row.tepatWaktu}
                </p>
                <p className="text-amber-700 dark:text-amber-400">Terlambat: {row.terlambat}</p>
                {row.izin + row.sakit + row.alfa > 0 ? (
                  <p className="text-muted-foreground">
                    Izin {row.izin} · Sakit {row.sakit} · Alfa {row.alfa}
                  </p>
                ) : null}
              </div>
            ),
          },
          {
            header: "Total Gaji",
            align: "right",
            render: (row) => (
              <span className="font-mono text-base font-bold text-emerald-700 dark:text-emerald-400">
                {formatRupiah(row.totalGaji)}
              </span>
            ),
          },
          {
            header: "Slip",
            align: "right",
            render: (row) => (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSlipModal(row)}
                aria-label={`Lihat slip gaji ${row.employee.full_name}`}
              >
                <FileText className="size-3.5" aria-hidden /> Slip
              </Button>
            ),
          },
        ]}
        renderCard={(row) => (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{row.employee.full_name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {row.employee.department} · {row.employee.position}
                </p>
              </div>
              <span className="shrink-0 font-mono text-base font-bold text-emerald-700 dark:text-emerald-400">
                {formatRupiah(row.totalGaji)}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-muted-foreground">
              <span>{formatRupiah(Number(row.employee.daily_salary))} / hari</span>
              <span aria-hidden>·</span>
              <span className="font-semibold text-foreground">{row.totalHadir} hari hadir</span>
            </div>

            <Button
              variant="outline"
              onClick={() => setSlipModal(row)}
              className="w-full sm:w-auto"
              aria-label={`Lihat slip gaji ${row.employee.full_name}`}
            >
              <FileText className="size-4" aria-hidden /> Lihat slip gaji
            </Button>
          </div>
        )}
        empty={
          <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <UserX className="size-5" aria-hidden />
            </div>
            <p className="text-sm font-semibold text-foreground">Belum ada karyawan aktif</p>
            <p className="max-w-sm text-xs leading-relaxed text-muted-foreground text-pretty">
              Tambahkan karyawan di halaman Data Karyawan agar penggajian bisa dihitung.
            </p>
          </div>
        }
      />

      <Dialog open={!!slipModal} onOpenChange={(open) => !open && setSlipModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="pr-8">Slip Gaji Karyawan</DialogTitle>
          </DialogHeader>

          {slipModal ? (
            <div id="slip-area" className="space-y-4 rounded-xl border bg-card p-4 text-sm">
              <div className="border-b pb-3 text-center">
                <h3 className="text-base font-bold uppercase text-foreground">
                  {settings?.company_name || "PT PERUSAHAAN"}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Slip penggajian harian · {formatTanggal(dari)} s/d {formatTanggal(sampai)}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                <div className="min-w-0">
                  <span className="block text-muted-foreground">NIK / Nama</span>
                  <span className="font-semibold text-foreground">
                    {slipModal.employee.nik} / {slipModal.employee.full_name}
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="block text-muted-foreground">Departemen / Jabatan</span>
                  <span className="font-semibold text-foreground">
                    {slipModal.employee.department} - {slipModal.employee.position}
                  </span>
                </div>
              </div>

              <div className="space-y-2 border-y py-3 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <span>Tarif gaji harian</span>
                  <span className="font-mono">
                    {formatRupiah(Number(slipModal.employee.daily_salary))}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Total kehadiran kerja</span>
                  <span className="font-semibold">{slipModal.totalHadir} hari</span>
                </div>
                <div className="flex items-center justify-between gap-3 pl-2 text-[11px] text-muted-foreground">
                  <span>Hadir tepat waktu</span>
                  <span>{slipModal.tepatWaktu} hari</span>
                </div>
                <div className="flex items-center justify-between gap-3 pl-2 text-[11px] text-muted-foreground">
                  <span>Hadir terlambat</span>
                  <span>{slipModal.terlambat} hari</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-1 text-base font-bold">
                <span>Total gaji diterima</span>
                <span className="font-mono text-emerald-700 dark:text-emerald-400">
                  {formatRupiah(slipModal.totalGaji)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t pt-8 text-center text-xs text-muted-foreground">
                <div>
                  <p>Diterima oleh</p>
                  <p className="mt-10 font-semibold text-foreground">
                    {slipModal.employee.full_name}
                  </p>
                </div>
                <div>
                  <p>Disetujui oleh (HRD)</p>
                  <p className="mt-10 font-semibold text-foreground">Finance &amp; HRD</p>
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter className="print:hidden">
            <Button variant="outline" onClick={() => setSlipModal(null)}>
              Tutup
            </Button>
            <Button onClick={() => window.print()}>
              <Printer className="size-4" aria-hidden /> Cetak / PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
