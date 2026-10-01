import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DollarSign, Download, Printer, Calendar, FileText, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formatRupiah,
  formatTanggal,
  todayJakarta,
  toCsv,
  downloadCsv,
  type Employee,
  type CompanyAttendance,
  type CompanySettings,
} from "@/lib/presensi";

export const Route = createFileRoute("/_authenticated/gaji")({
  head: () => ({
    meta: [
      { title: "Penggajian — AbsenGo" },
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
    return {
      dari: `${year}-${month}-01`,
      sampai: `${year}-${month}-15`,
    };
  } else {
    const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
    return {
      dari: `${year}-${month}-16`,
      sampai: `${year}-${month}-${lastDay}`,
    };
  }
}

function getMonthlyPeriod(): { dari: string; sampai: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
  return {
    dari: `${year}-${month}-01`,
    sampai: `${year}-${month}-${lastDay}`,
  };
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

  // Ambil pengaturan kantor
  const { data: settings } = useQuery<CompanySettings | null>({
    queryKey: ["company_settings"],
    queryFn: async () => {
      const { data } = await supabase.from("company_settings").select("*").eq("id", 1).maybeSingle();
      return (data as unknown as CompanySettings) || null;
    },
  });

  // Ambil daftar karyawan
  const { data: employees = [], isLoading: loadEmp } = useQuery<Employee[]>({
    queryKey: ["employees"],
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

  // Ambil presensi pada rentang tanggal
  const { data: attendances = [], isLoading: loadAtt } = useQuery<CompanyAttendance[]>({
    queryKey: ["payroll_attendance", dari, sampai],
    queryFn: async () => {
      const { data } = await supabase
        .from("company_attendance")
        .select("id, employee_id, attend_date, clock_in, clock_out, status, late_minutes")
        .gte("attend_date", dari)
        .lte("attend_date", sampai);
      return (data as unknown as CompanyAttendance[]) || [];
    },
  });

  // Hitung akumulasi gaji harian per karyawan
  const payrollData: RekapGajiRow[] = useMemo(() => {
    // Kelompokkan presensi per employee_id
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

      // Kehadiran kerja = hadir tepat waktu + hadir terlambat
      const totalHadir = tepatWaktu + terlambat;
      const dailySalary = Number(emp.daily_salary) || 0;
      const totalGaji = totalHadir * dailySalary;

      return {
        employee: emp,
        totalHadir,
        tepatWaktu,
        terlambat,
        izin,
        sakit,
        alfa,
        totalGaji,
      };
    });
  }, [employees, attendances]);

  const totalPengeluaran = payrollData.reduce((acc, row) => acc + row.totalGaji, 0);
  const totalHariKerja = payrollData.reduce((acc, row) => acc + row.totalHadir, 0);

  function setPreset(tipe: "biweekly" | "monthly") {
    if (tipe === "biweekly") {
      const p = getBiweeklyPeriod();
      setDari(p.dari);
      setSampai(p.sampai);
    } else {
      const p = getMonthlyPeriod();
      setDari(p.dari);
      setSampai(p.sampai);
    }
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

  function printSlip() {
    window.print();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="size-6 text-emerald-600" /> Penggajian (Skema Gaji Harian)
          </h1>
          <p className="text-sm text-muted-foreground">
            Akumulasi gaji berdasarkan jumlah kehadiran riil: <span className="font-semibold text-foreground">Hari Hadir × Tarif Harian</span>.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportPayrollCsv} disabled={payrollData.length === 0}>
            <Download className="size-4 mr-1.5" /> Export Rekap CSV
          </Button>
        </div>
      </header>

      {/* Filter Periode & Presets */}
      <div className="rounded-2xl border bg-card p-4 sm:p-5 shadow-[var(--shadow-soft)] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-primary" />
            <span className="text-sm font-semibold">Tentukan Periode Penggajian:</span>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => setPreset("biweekly")}>
              Periode 2 Minggu Ini
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setPreset("monthly")}>
              1 Bulan Penuh Ini
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="dari">Dari Tanggal</Label>
            <Input id="dari" type="date" value={dari} onChange={(e) => setDari(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sampai">Sampai Tanggal</Label>
            <Input id="sampai" type="date" value={sampai} onChange={(e) => setSampai(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Ringkasan Biaya Payroll */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-soft)]">
          <p className="text-xs text-muted-foreground">Total Pengeluaran Gaji Periode Ini</p>
          <p className="mt-2 text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {formatRupiah(totalPengeluaran)}
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-soft)]">
          <p className="text-xs text-muted-foreground">Total Hari Masuk Karyawan</p>
          <p className="mt-2 text-2xl font-bold font-mono text-foreground">
            {totalHariKerja} <span className="text-sm font-normal text-muted-foreground">hari kehadiran</span>
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-soft)]">
          <p className="text-xs text-muted-foreground">Karyawan Aktif Berhak Gaji</p>
          <p className="mt-2 text-2xl font-bold font-mono text-foreground">
            {employees.length} <span className="text-sm font-normal text-muted-foreground">orang</span>
          </p>
        </div>
      </div>

      {/* Tabel Rincian Gaji Karyawan */}
      <div className="rounded-2xl border bg-card shadow-[var(--shadow-soft)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
              <tr>
                <th className="px-5 py-3.5">Karyawan & Posisi</th>
                <th className="px-5 py-3.5">Tarif Harian</th>
                <th className="px-5 py-3.5 text-center">Hari Hadir</th>
                <th className="px-5 py-3.5">Rincian Status</th>
                <th className="px-5 py-3.5 text-right">Total Gaji</th>
                <th className="px-5 py-3.5 text-right">Slip</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loadEmp || loadAtt ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">
                    Menghitung kalkulasi penggajian...
                  </td>
                </tr>
              ) : payrollData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">
                    Belum ada data karyawan aktif.
                  </td>
                </tr>
              ) : (
                payrollData.map((row) => (
                  <tr key={row.employee.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-foreground">{row.employee.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        NIK: <span className="font-mono">{row.employee.nik}</span> · {row.employee.department} ({row.employee.position})
                      </p>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-sm text-foreground">
                      {formatRupiah(Number(row.employee.daily_salary))}
                      <span className="text-xs text-muted-foreground block font-sans">/ hari</span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-primary/10 text-primary font-bold text-sm">
                        {row.totalHadir} Hari
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-muted-foreground">
                      <p>Hadir Tepat: <span className="text-emerald-600 font-semibold">{row.tepatWaktu}</span></p>
                      <p>Terlambat: <span className="text-amber-600 font-semibold">{row.terlambat}</span></p>
                      {(row.izin > 0 || row.sakit > 0 || row.alfa > 0) && (
                        <p className="text-[11px] text-slate-400">
                          (Izin: {row.izin}, Sakit: {row.sakit}, Alfa: {row.alfa})
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-bold text-base text-emerald-600 dark:text-emerald-400">
                      {formatRupiah(row.totalGaji)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSlipModal(row)}
                        className="text-xs"
                      >
                        <FileText className="size-3.5 mr-1" /> Slip Gaji
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal / Dialog Cetak Slip Gaji */}
      <Dialog open={!!slipModal} onOpenChange={(open) => !open && setSlipModal(null)}>
        <DialogContent className="sm:max-w-md print:shadow-none print:border-none">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Slip Gaji Karyawan</span>
              <Button size="sm" variant="outline" onClick={printSlip} className="print:hidden">
                <Printer className="size-4 mr-1.5" /> Cetak / PDF
              </Button>
            </DialogTitle>
          </DialogHeader>

          {slipModal && (
            <div id="slip-gaji-content" className="p-4 border rounded-xl bg-card space-y-4 text-sm">
              <div className="text-center border-b pb-3">
                <h3 className="font-bold text-base uppercase text-foreground">
                  {settings?.company_name || "PT PERUSAHAAN"}
                </h3>
                <p className="text-xs text-muted-foreground">SLIP PENGGAJIAN HARIAN KARYAWAN</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Periode: {formatTanggal(dari)} s/d {formatTanggal(sampai)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground block">NIK / Nama:</span>
                  <span className="font-semibold text-foreground">
                    {slipModal.employee.nik} / {slipModal.employee.full_name}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Departemen / Posisi:</span>
                  <span className="font-semibold text-foreground">
                    {slipModal.employee.department} - {slipModal.employee.position}
                  </span>
                </div>
              </div>

              <div className="border-t border-b py-3 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span>Tarif Gaji Harian</span>
                  <span className="font-mono">{formatRupiah(Number(slipModal.employee.daily_salary))}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Total Kehadiran Kerja</span>
                  <span className="font-semibold">{slipModal.totalHadir} Hari</span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground pl-2 text-[11px]">
                  <span>· Hadir Tepat Waktu</span>
                  <span>{slipModal.tepatWaktu} hari</span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground pl-2 text-[11px]">
                  <span>· Hadir Terlambat</span>
                  <span>{slipModal.terlambat} hari</span>
                </div>
              </div>

              <div className="flex justify-between items-center pt-1 font-bold text-base">
                <span>TOTAL GAJI DITERIMA:</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400">
                  {formatRupiah(slipModal.totalGaji)}
                </span>
              </div>

              <div className="pt-6 grid grid-cols-2 text-center text-xs text-muted-foreground border-t">
                <div>
                  <p>Diterima Oleh,</p>
                  <p className="mt-12 font-semibold text-foreground underline">
                    {slipModal.employee.full_name}
                  </p>
                </div>
                <div>
                  <p>Disetujui Oleh (HRD),</p>
                  <p className="mt-12 font-semibold text-foreground underline">
                    Finance & HRD
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
