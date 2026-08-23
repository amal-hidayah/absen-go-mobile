import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
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
import { downloadCsv, toCsv, todayJakarta, type AttendanceRow } from "@/lib/presensi";

export const Route = createFileRoute("/_authenticated/rekap")({
  head: () => ({
    meta: [
      { title: "Rekap Presensi — AbsenGo" },
      { name: "description", content: "Riwayat kehadiran siswa dengan filter kelas dan tanggal." },
      { property: "og:title", content: "Rekap Presensi — AbsenGo" },
      { property: "og:description", content: "Riwayat kehadiran siswa dan export CSV." },
    ],
  }),
  component: RekapPage,
});

function RekapPage() {
  const hariIni = todayJakarta();
  const [dari, setDari] = useState(hariIni);
  const [sampai, setSampai] = useState(hariIni);
  const [kelas, setKelas] = useState("semua");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["rekap", dari, sampai],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select(
          "id, student_id, attend_date, attend_time, status, note, students(nis, full_name, class_name)",
        )
        .gte("attend_date", dari)
        .lte("attend_date", sampai)
        .order("attend_date", { ascending: false })
        .order("attend_time", { ascending: false });
      if (error) throw error;
      return data as unknown as AttendanceRow[];
    },
  });

  const daftarKelas = useMemo(
    () => Array.from(new Set(rows.map((r) => r.students?.class_name ?? ""))).filter(Boolean).sort(),
    [rows],
  );

  const tersaring = rows.filter((r) => kelas === "semua" || r.students?.class_name === kelas);
  const hadir = tersaring.filter((r) => r.status === "hadir").length;
  const terlambat = tersaring.filter((r) => r.status === "terlambat").length;

  function exportCsv() {
    const csv = toCsv(
      tersaring.map((r) => ({
        Tanggal: r.attend_date,
        Jam: r.attend_time.slice(0, 5),
        NIS: r.students?.nis ?? "",
        Nama: r.students?.full_name ?? "",
        Kelas: r.students?.class_name ?? "",
        Status: r.status,
      })),
    );
    if (!csv) return;
    downloadCsv(`rekap-presensi-${dari}-sd-${sampai}.csv`, csv);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Rekap Presensi</h1>
          <p className="text-sm text-muted-foreground">
            {tersaring.length} catatan · {hadir} hadir · {terlambat} terlambat
          </p>
        </div>
        <Button onClick={exportCsv} disabled={tersaring.length === 0}>
          <Download className="size-4" /> Export CSV
        </Button>
      </header>

      <div className="grid gap-3 rounded-2xl border bg-card p-4 shadow-[var(--shadow-soft)] sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="dari">Dari tanggal</Label>
          <Input id="dari" type="date" value={dari} onChange={(e) => setDari(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sampai">Sampai tanggal</Label>
          <Input
            id="sampai"
            type="date"
            value={sampai}
            onChange={(e) => setSampai(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Kelas</Label>
          <Select value={kelas} onValueChange={setKelas}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="semua">Semua kelas</SelectItem>
              {daftarKelas.map((k) => (
                <SelectItem key={k} value={k}>
                  {k}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-card shadow-[var(--shadow-soft)]">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-5 py-3">Tanggal</th>
              <th className="px-5 py-3">Jam</th>
              <th className="px-5 py-3">Nama</th>
              <th className="px-5 py-3">Kelas</th>
              <th className="px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {tersaring.map((r) => (
              <tr key={r.id}>
                <td className="px-5 py-3 text-muted-foreground">{r.attend_date}</td>
                <td className="px-5 py-3">{r.attend_time.slice(0, 5)}</td>
                <td className="px-5 py-3 font-medium">{r.students?.full_name}</td>
                <td className="px-5 py-3 text-muted-foreground">{r.students?.class_name}</td>
                <td className="px-5 py-3">
                  <StatusBadge status={r.status} />
                </td>
              </tr>
            ))}
            {tersaring.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">
                  {isLoading ? "Memuat..." : "Tidak ada data pada rentang ini."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
