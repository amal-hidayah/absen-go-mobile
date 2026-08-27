import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ScanLine, Users, CheckCircle2, Clock, UserX, UserMinus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatTanggal, todayJakarta, type AttendanceRow } from "@/lib/presensi";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — AbsenGo" },
      { name: "description", content: "Ringkasan kehadiran siswa hari ini." },
      { property: "og:title", content: "Dashboard — AbsenGo" },
      { property: "og:description", content: "Ringkasan kehadiran siswa hari ini." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const tanggal = todayJakarta();

  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ student_id: "", status: "sakit" });
  const [filterKelas, setFilterKelas] = useState("semua");

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", tanggal],
    queryFn: async () => {
      const [siswa, presensi, settings] = await Promise.all([
        supabase.from("students").select("id, nis, full_name, class_name").eq("active", true).order("class_name").order("full_name"),
        supabase
          .from("attendance")
          .select("id, student_id, attend_date, attend_time, status, note, students(nis, full_name, class_name)")
          .eq("attend_date", tanggal)
          .order("attend_time", { ascending: false }),
        supabase.from("settings").select("school_name").maybeSingle(),
      ]);
      if (presensi.error) throw presensi.error;
      return {
        totalSiswa: siswa.data?.length ?? 0,
        siswaList: siswa.data ?? [],
        rows: (presensi.data ?? []) as unknown as AttendanceRow[],
        schoolName: settings.data?.school_name,
      };
    },
  });

  const rows = data?.rows ?? [];
  const sudahPresensiId = new Set(rows.map((r) => r.student_id));
  const siswaBelumPresensi = data?.siswaList.filter((s) => !sudahPresensiId.has(s.id)) || [];
  
  const daftarKelas = Array.from(new Set(siswaBelumPresensi.map((s) => s.class_name))).filter(Boolean).sort();
  const siswaTersaring = siswaBelumPresensi.filter((s) => filterKelas === "semua" || s.class_name === filterKelas);

  const hadir = rows.filter((r) => r.status === "hadir").length;
  const terlambat = rows.filter((r) => r.status === "terlambat").length;
  const tidakHadir = rows.filter((r) => ["sakit", "izin", "alfa"].includes(r.status)).length;
  const belum = Math.max((data?.totalSiswa ?? 0) - rows.length, 0);

  const stats = [
    { label: "Total siswa aktif", value: data?.totalSiswa ?? 0, icon: Users, tone: "text-primary" },
    { label: "Hadir", value: hadir, icon: CheckCircle2, tone: "text-success" },
    { label: "Terlambat", value: terlambat, icon: Clock, tone: "text-warning" },
    { label: "Tidak Hadir", value: tidakHadir, icon: UserMinus, tone: "text-secondary-foreground" },
    { label: "Belum presensi", value: belum, icon: UserX, tone: "text-destructive" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {data?.schoolName ? `Dashboard — ${data.schoolName}` : "Dashboard"}
          </h1>
          <p className="text-sm text-muted-foreground">{formatTanggal(tanggal)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setOpen(true)}>
            Presensi Manual
          </Button>
          <Button asChild>
            <Link to="/scan">
              <ScanLine className="size-4" /> Mulai scan
            </Link>
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:gap-4">
        {stats.map((s, i) => (
          <div key={s.label} className={`rounded-2xl border bg-card p-4 shadow-[var(--shadow-soft)] sm:p-5 ${i === 0 ? "col-span-2 lg:col-span-1" : ""}`}>
            <s.icon className={`size-5 ${s.tone}`} />
            <p className="mt-3 font-display text-3xl font-bold">{isLoading ? "–" : s.value}</p>
            <p className="text-xs text-muted-foreground sm:text-sm">{s.label}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border bg-card shadow-[var(--shadow-soft)]">
        <h2 className="border-b px-5 py-4 text-base font-semibold">Presensi terbaru hari ini</h2>
        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            {isLoading ? "Memuat..." : "Belum ada siswa yang presensi hari ini."}
          </p>
        ) : (
          <ul className="divide-y">
            {rows.slice(0, 10).map((r) => (
              <li key={r.id} className="flex items-center justify-between px-5 py-3.5">
                <div>
                  <p className="text-sm font-medium">{r.students?.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.students?.class_name} · NIS {r.students?.nis}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">{r.attend_time.slice(0, 5)}</span>
                  <StatusBadge status={r.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Input Presensi Manual</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!form.student_id) return toast.error("Pilih siswa terlebih dahulu");
              const now = new Date();
              const timeString = now.toLocaleTimeString("en-GB", { hour12: false });
              
              const { data: auth } = await supabase.auth.getUser();
              const { error } = await supabase.from("attendance").insert({
                student_id: form.student_id,
                attend_date: tanggal,
                attend_time: timeString,
                status: form.status,
                recorded_by: auth.user?.id ?? null,
              });
              
              if (error) {
                toast.error(error.message.includes("duplicate") ? "Siswa sudah presensi hari ini" : error.message);
                return;
              }
              
              toast.success("Presensi manual berhasil disimpan");
              setOpen(false);
              setForm({ student_id: "", status: "sakit" });
              queryClient.invalidateQueries({ queryKey: ["dashboard"] });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Filter Kelas</Label>
              <Select value={filterKelas} onValueChange={(v) => { setFilterKelas(v); setForm({ ...form, student_id: "" }); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Semua Kelas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="semua">Semua Kelas</SelectItem>
                  {daftarKelas.map((k) => (
                    <SelectItem key={k} value={k}>
                      {k}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Siswa</Label>
              <Select value={form.student_id} onValueChange={(v) => setForm({ ...form, student_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih siswa..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {siswaTersaring.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {filterKelas === "semua" ? `${s.class_name} - ` : ""}{s.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status Kehadiran</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sakit">Sakit</SelectItem>
                  <SelectItem value="izin">Izin</SelectItem>
                  <SelectItem value="alfa">Alfa</SelectItem>
                  <SelectItem value="hadir">Hadir</SelectItem>
                  <SelectItem value="terlambat">Terlambat</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <Button type="submit">Simpan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    hadir: "bg-success/15 text-success",
    terlambat: "bg-warning/20 text-warning-foreground",
    sakit: "bg-amber-100 text-amber-700",
    izin: "bg-sky-100 text-sky-700",
    alfa: "bg-destructive/15 text-destructive",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${map[status] ?? "bg-muted text-muted-foreground"}`}
    >
      {status}
    </span>
  );
}
