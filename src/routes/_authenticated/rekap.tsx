import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download, Calendar, Filter, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "./dashboard";
import {
  downloadCsv,
  formatTanggal,
  toCsv,
  todayJakarta,
  type CompanyAttendance,
} from "@/lib/presensi";

export const Route = createFileRoute("/_authenticated/rekap")({
  head: () => ({
    meta: [
      { title: "Rekap Presensi — AbsenGo" },
      { name: "description", content: "Riwayat kehadiran karyawan, jam masuk, jam pulang, dan export CSV." },
    ],
  }),
  component: RekapPage,
});

function RekapPage() {
  const hariIni = todayJakarta();
  const [dari, setDari] = useState(hariIni);
  const [sampai, setSampai] = useState(hariIni);
  const [deptFilter, setDeptFilter] = useState("semua");

  const { data: rows = [], isLoading } = useQuery<CompanyAttendance[]>({
    queryKey: ["rekap_corporate_attendance", dari, sampai],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_attendance")
        .select(
          "id, employee_id, attend_date, clock_in, clock_out, status, late_minutes, note, employees(nik, full_name, department, position, daily_salary)",
        )
        .gte("attend_date", dari)
        .lte("attend_date", sampai)
        .order("attend_date", { ascending: false })
        .order("clock_in", { ascending: false });
      if (error) {
        console.warn("Gagal load rekap presensi:", error);
        return [];
      }
      return (data as unknown as CompanyAttendance[]) || [];
    },
  });

  const daftarDept = useMemo(
    () => Array.from(new Set(rows.map((r) => r.employees?.department ?? "").filter(Boolean))).sort(),
    [rows],
  );

  const tersaring = rows.filter(
    (r) => deptFilter === "semua" || r.employees?.department === deptFilter,
  );

  const totalHadir = tersaring.filter((r) => r.status === "hadir").length;
  const totalTerlambat = tersaring.filter((r) => r.status === "terlambat").length;
  const totalTidakHadir = tersaring.filter((r) => ["sakit", "izin", "alfa"].includes(r.status)).length;

  function exportCsv() {
    const csv = toCsv(
      tersaring.map((r) => ({
        Tanggal: r.attend_date,
        NIK: r.employees?.nik ?? "",
        Nama: r.employees?.full_name ?? "",
        Departemen: r.employees?.department ?? "",
        Jabatan: r.employees?.position ?? "",
        "Jam Masuk": r.clock_in ? r.clock_in.slice(0, 5) : "-",
        "Jam Pulang": r.clock_out ? r.clock_out.slice(0, 5) : "-",
        "Terlambat (Menit)": r.late_minutes || 0,
        Status: r.status,
        Keterangan: r.note ?? "",
      })),
    );
    if (!csv) return;
    downloadCsv(`rekap-presensi-karyawan-${dari}-sd-${sampai}.csv`, csv);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Rekap Presensi Karyawan</h1>
          <p className="text-sm text-muted-foreground">
            {tersaring.length} catatan · {totalHadir} hadir tepat · {totalTerlambat} terlambat · {totalTidakHadir} izin/sakit
          </p>
        </div>
        <Button onClick={exportCsv} disabled={tersaring.length === 0}>
          <Download className="size-4 mr-1.5" /> Export Rekap CSV
        </Button>
      </header>

      {/* Filter Tanggal & Departemen */}
      <div className="grid gap-4 rounded-2xl border bg-card p-4 shadow-[var(--shadow-soft)] sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="dari">Dari Tanggal</Label>
          <Input id="dari" type="date" value={dari} onChange={(e) => setDari(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sampai">Sampai Tanggal</Label>
          <Input id="sampai" type="date" value={sampai} onChange={(e) => setSampai(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Filter Departemen</Label>
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Semua Departemen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="semua">Semua Departemen</SelectItem>
              {daftarDept.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabel Data Rekap */}
      <div className="rounded-2xl border bg-card shadow-[var(--shadow-soft)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
              <tr>
                <th className="px-5 py-3.5">Tanggal</th>
                <th className="px-5 py-3.5">Karyawan</th>
                <th className="px-5 py-3.5">Departemen</th>
                <th className="px-5 py-3.5">Jam Masuk</th>
                <th className="px-5 py-3.5">Jam Pulang</th>
                <th className="px-5 py-3.5">Keterlambatan</th>
                <th className="px-5 py-3.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">
                    Memuat data presensi...
                  </td>
                </tr>
              ) : tersaring.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-muted-foreground">
                    Tidak ada catatan presensi pada rentang tanggal ini.
                  </td>
                </tr>
              ) : (
                tersaring.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3.5 whitespace-nowrap text-xs font-medium">
                      {formatTanggal(r.attend_date)}
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-foreground">{r.employees?.full_name}</p>
                      <p className="text-xs text-muted-foreground font-mono">NIK: {r.employees?.nik}</p>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-muted-foreground">
                      {r.employees?.department} - {r.employees?.position}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs">
                      {r.clock_in ? r.clock_in.slice(0, 5) : "-"}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs">
                      {r.clock_out ? r.clock_out.slice(0, 5) : "-"}
                    </td>
                    <td className="px-5 py-3.5 text-xs">
                      {r.late_minutes > 0 ? (
                        <span className="text-amber-600 font-semibold">
                          +{r.late_minutes} menit
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Tepat waktu</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
