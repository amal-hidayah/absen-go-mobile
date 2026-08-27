import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Plus, Pencil, Trash2, Printer, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { slugQr, type Student } from "@/lib/presensi";

export const Route = createFileRoute("/_authenticated/siswa")({
  head: () => ({
    meta: [
      { title: "Data Siswa — AbsenGo" },
      { name: "description", content: "Kelola data siswa dan cetak kartu QR presensi." },
      { property: "og:title", content: "Data Siswa — AbsenGo" },
      { property: "og:description", content: "Kelola data siswa dan cetak kartu QR presensi." },
    ],
  }),
  component: SiswaPage,
});

const kosong = { nis: "", full_name: "", class_name: "", active: true };

function SiswaPage() {
  const queryClient = useQueryClient();
  const [cari, setCari] = useState("");
  const [kelas, setKelas] = useState("semua");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(kosong);
  const [kartu, setKartu] = useState(false);

  const { data: siswa = [], isLoading } = useQuery({
    queryKey: ["siswa"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, nis, full_name, class_name, qr_code, active")
        .order("class_name")
        .order("full_name");
      if (error) throw error;
      return data as Student[];
    },
  });

  const daftarKelas = useMemo(
    () => Array.from(new Set(siswa.map((s) => s.class_name))).sort(),
    [siswa],
  );

  const tersaring = siswa.filter((s) => {
    const q = cari.toLowerCase();
    const cocok = s.full_name.toLowerCase().includes(q) || s.nis.includes(q);
    return cocok && (kelas === "semua" || s.class_name === kelas);
  });

  function bukaTambah() {
    setEditId(null);
    setForm(kosong);
    setOpen(true);
  }

  function bukaEdit(s: Student) {
    setEditId(s.id);
    setForm({
      nis: s.nis,
      full_name: s.full_name,
      class_name: s.class_name,
      active: s.active,
    });
    setOpen(true);
  }

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form, qr_code: slugQr(form.nis) };
    const res = editId
      ? await supabase.from("students").update(payload).eq("id", editId)
      : await supabase.from("students").insert(payload);
    if (res.error) {
      toast.error(
        res.error.message.includes("duplicate") ? "NIS sudah terdaftar" : res.error.message,
      );
      return;
    }
    toast.success(editId ? "Data siswa diperbarui" : "Siswa ditambahkan");
    setOpen(false);
    queryClient.invalidateQueries({ queryKey: ["siswa"] });
  }

  async function hapus(s: Student) {
    if (!confirm(`Hapus data ${s.full_name}? Riwayat presensinya ikut terhapus.`)) return;
    const { error } = await supabase.from("students").delete().eq("id", s.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Siswa dihapus");
    queryClient.invalidateQueries({ queryKey: ["siswa"] });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Data Siswa</h1>
          <p className="text-sm text-muted-foreground">{siswa.length} siswa terdaftar</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setKartu(true)} disabled={tersaring.length === 0}>
            <Printer className="size-4" /> Kartu QR
          </Button>
          <Button onClick={bukaTambah}>
            <Plus className="size-4" /> Tambah siswa
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Cari nama atau NIS"
            value={cari}
            onChange={(e) => setCari(e.target.value)}
          />
        </div>
        <Select value={kelas} onValueChange={setKelas}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Semua kelas" />
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

      <div className="overflow-x-auto rounded-2xl border bg-card shadow-[var(--shadow-soft)]">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="whitespace-nowrap px-5 py-3">NIS</th>
              <th className="whitespace-nowrap px-5 py-3">Nama</th>
              <th className="whitespace-nowrap px-5 py-3">Kelas</th>
              <th className="whitespace-nowrap px-5 py-3">Status</th>
              <th className="whitespace-nowrap px-5 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {tersaring.map((s) => (
              <tr key={s.id}>
                <td className="whitespace-nowrap px-5 py-3 font-mono text-xs">{s.nis}</td>
                <td className="whitespace-nowrap px-5 py-3 font-medium">{s.full_name}</td>
                <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">{s.class_name}</td>
                <td className="whitespace-nowrap px-5 py-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      s.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {s.active ? "Aktif" : "Non-aktif"}
                  </span>
                </td>
                <td className="whitespace-nowrap px-5 py-3">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => bukaEdit(s)} aria-label="Edit">
                      <Pencil className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => hapus(s)} aria-label="Hapus">
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {tersaring.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">
                  {isLoading ? "Memuat..." : "Tidak ada data siswa."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "Edit siswa" : "Tambah siswa"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={simpan} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nis">NIS</Label>
              <Input
                id="nis"
                required
                value={form.nis}
                onChange={(e) => setForm({ ...form, nis: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nama">Nama lengkap</Label>
              <Input
                id="nama"
                required
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="kelas">Kelas</Label>
                <Input
                  id="kelas"
                  required
                  value={form.class_name}
                  onChange={(e) => setForm({ ...form, class_name: e.target.value })}
                  placeholder="X IPA 1"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.active ? "aktif" : "nonaktif"}
                  onValueChange={(v) => setForm({ ...form, active: v === "aktif" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aktif">Aktif</SelectItem>
                    <SelectItem value="nonaktif">Non-aktif</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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

      <Dialog open={kartu} onOpenChange={setKartu}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between space-y-0 pr-8">
            <DialogTitle>Kartu QR ({tersaring.length})</DialogTitle>
            <Button onClick={() => window.print()} size="sm" className="gap-2">
              <Printer className="size-4" /> Cetak
            </Button>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 mt-4">
            {tersaring.map((s) => (
              <div key={s.id} className="rounded-xl border bg-card p-3 text-center">
                <QRCodeCanvas value={s.qr_code} size={112} className="mx-auto" />
                <p className="mt-2 text-sm font-semibold">{s.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  {s.class_name} · {s.nis}
                </p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Area Khusus Print (Tersembunyi di layar normal, muncul saat diprint) */}
      <div id="print-area" className="hidden">
        {tersaring.map((s) => (
          <div key={s.id} className="rounded-xl p-3 text-center flex flex-col items-center justify-center">
            <QRCodeCanvas value={s.qr_code} size={130} className="mx-auto" />
            <p className="mt-2 text-sm font-bold text-black">{s.full_name}</p>
            <p className="text-xs text-gray-600">
              {s.class_name} · {s.nis}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
