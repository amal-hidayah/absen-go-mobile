import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download, CalendarX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { DataList } from "@/components/data-list";
import { PageHeader } from "@/components/page-header";
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
  hariIniDihitung,
  toCsv,
  todayJakarta,
  type CompanyAttendance,
} from "@/lib/presensi";

export const Route = createFileRoute("/_authenticated/rekap")({
  head: () => ({
    meta: [
      { title: "Rekap Presensi · AbsenGo" },
      {
        name: "description",
        content: "Riwayat kehadiran karyawan, jam masuk, jam pulang, dan export CSV.",
      },
    ],
  }),
  component: RekapPage,
});

function RekapPage() {
  const hariIni = todayJakarta();
  const [dari, setDari] = useState(hariIni);
  const [sampai, setSampai] = useState(hariIni);
  const [deptFilter, setDeptFilter] = useState("semua");

  const {
    data: rows = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<CompanyAttendance[]>({
    queryKey: ["rekap_corporate_attendance", dari, sampai],
    retry: 1,
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
      if (error) throw error;
      return (data as unknown as CompanyAttendance[]) || [];
    },
  });

  const daftarDept = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => r.employees?.department ?? "").filter(Boolean))).sort(),
    [rows],
  );

  const tersaring = useMemo(
    () => rows.filter((r) => deptFilter === "semua" || r.employees?.department === deptFilter),
    [rows, deptFilter],
  );

  const totalHadir = tersaring.filter((r) => r.status === "hadir").length;
  const totalTerlambat = tersaring.filter((r) => r.status === "terlambat").length;
  const totalTidakHadir = tersaring.filter((r) =>
    ["sakit", "izin", "alfa"].includes(r.status),
  ).length;
  // Hari yang absennya masih setengah jadi: dihitung hadir di rekap ini, tapi
  // belum dibayar karena gaji butuh masuk dan pulang sekaligus.
  const totalBelumLengkap = tersaring.filter(
    (r) => (r.status === "hadir" || r.status === "terlambat") && !hariIniDihitung(r),
  ).length;

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
        "Dihitung Gaji": hariIniDihitung(r) ? "Ya" : "Belum",
        Keterangan: r.note ?? "",
      })),
    );
    if (!csv) return;
    downloadCsv(`rekap-presensi-karyawan-${dari}-sd-${sampai}.csv`, csv);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 sm:space-y-6">
      <PageHeader
        title="Rekap Presensi"
        subtitle={
          <>
            {tersaring.length} catatan · {totalHadir} hadir tepat · {totalTerlambat} terlambat ·{" "}
            {totalTidakHadir} izin/sakit
            {totalBelumLengkap > 0 ? ` · ${totalBelumLengkap} belum lengkap` : ""}
          </>
        }
        actions={
          <Button onClick={exportCsv} disabled={tersaring.length === 0} className="shrink-0">
            <Download className="size-4" aria-hidden /> Export Rekap CSV
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 rounded-2xl border bg-card p-4 shadow-[var(--shadow-soft)] sm:grid-cols-3">
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
        <div className="space-y-1.5">
          <Label htmlFor="dept">Filter Departemen</Label>
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger id="dept">
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

      <DataList
        rows={tersaring}
        rowKey={(r) => r.id}
        loading={isLoading}
        loadingLabel="Memuat rekap presensi..."
        error={isError ? "Rekap presensi tidak bisa dimuat dari server." : null}
        onRetry={() => void refetch()}
        header={
          <p className="text-xs text-muted-foreground">
            {formatTanggal(dari)} s/d {formatTanggal(sampai)}
          </p>
        }
        columns={[
          {
            header: "Tanggal",
            render: (r) => (
              <span className="whitespace-nowrap text-xs font-medium">
                {formatTanggal(r.attend_date)}
              </span>
            ),
          },
          {
            header: "Karyawan",
            render: (r) => (
              <>
                <p className="font-semibold text-foreground">{r.employees?.full_name}</p>
                <p className="font-mono text-xs text-muted-foreground">{r.employees?.nik}</p>
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
          {
            header: "Keterlambatan",
            render: (r) =>
              r.late_minutes > 0 ? (
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                  +{r.late_minutes} menit
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Tepat waktu</span>
              ),
          },
          {
            header: "Gaji",
            render: (r) =>
              r.status === "izin" || r.status === "sakit" || r.status === "alfa" ? (
                <span className="text-xs text-muted-foreground">Tidak dibayar</span>
              ) : hariIniDihitung(r) ? (
                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  Dihitung
                </span>
              ) : (
                <span className="text-xs font-medium text-rose-700 dark:text-rose-400">
                  Belum lengkap
                </span>
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
                  {formatTanggal(r.attend_date)} · {r.employees?.department}
                </p>
              </div>
              <StatusBadge status={r.status} />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-sm">
              <span className="text-muted-foreground">
                Masuk{" "}
                <span className="text-foreground">
                  {r.clock_in ? r.clock_in.slice(0, 5) : "--:--"}
                </span>
              </span>
              <span className="text-muted-foreground">
                Pulang{" "}
                <span className="text-foreground">
                  {r.clock_out ? r.clock_out.slice(0, 5) : "--:--"}
                </span>
              </span>
              {r.late_minutes > 0 ? (
                <span className="font-sans text-xs font-semibold text-amber-700 dark:text-amber-400">
                  +{r.late_minutes} menit
                </span>
              ) : null}
            </div>
            {(r.status === "hadir" || r.status === "terlambat") && !hariIniDihitung(r) ? (
              <p className="text-xs leading-relaxed text-rose-700 dark:text-rose-400">
                Belum absen {r.clock_in ? "pulang" : "masuk"}, belum dihitung gaji.
              </p>
            ) : null}
          </div>
        )}
        empty={
          <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <CalendarX className="size-5" aria-hidden />
            </div>
            <p className="text-sm font-semibold text-foreground">Tidak ada catatan presensi</p>
            <p className="max-w-sm text-xs leading-relaxed text-muted-foreground text-pretty">
              Belum ada presensi pada rentang {formatTanggal(dari)} sampai {formatTanggal(sampai)}.
              Ubah rentang tanggal atau pilih departemen lain.
            </p>
          </div>
        }
      />
    </div>
  );
}
