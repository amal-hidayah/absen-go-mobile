import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  UserCheck,
  UserX,
  Briefcase,
  DollarSign,
  KeyRound,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { kelolaAkunKaryawan } from "@/lib/supabase-functions";
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
import { formatRupiah, type Employee } from "@/lib/presensi";

export const Route = createFileRoute("/_authenticated/karyawan")({
  head: () => ({
    meta: [
      { title: "Data Karyawan — AbsenGo" },
      { name: "description", content: "Kelola data karyawan, akun login, dan tarif gaji harian." },
    ],
  }),
  component: KaryawanPage,
});

interface AkunLoginLain {
  username: string | null;
  role: string;
  active: boolean;
}

type KaryawanDenganAkun = Employee & { login_accounts?: AkunLoginLain | null };

const formKosong = {
  nik: "",
  full_name: "",
  email: "",
  department: "Operasional",
  position: "Staff",
  daily_salary: 150000,
  active: true,
  // Khusus mode tambah:
  username: "",
  password: "",
};

function KaryawanPage() {
  const queryClient = useQueryClient();
  const [cari, setCari] = useState("");
  const [deptFilter, setDeptFilter] = useState("semua");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(formKosong);
  const [saving, setSaving] = useState(false);

  // Dialog ganti kata sandi
  const [resetTarget, setResetTarget] = useState<KaryawanDenganAkun | null>(null);
  const [resetPass, setResetPass] = useState("");
  const [savingReset, setSavingReset] = useState(false);

  const { data: karyawan = [], isLoading } = useQuery<KaryawanDenganAkun[]>({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*, login_accounts(username, role, active)")
        .order("department")
        .order("full_name");
      if (error) {
        console.warn("Gagal load employees:", error);
        return [];
      }
      return (data as unknown as KaryawanDenganAkun[]) || [];
    },
  });

  const daftarDept = useMemo(
    () => Array.from(new Set(karyawan.map((k) => k.department).filter(Boolean))).sort(),
    [karyawan],
  );

  const tersaring = karyawan.filter((k) => {
    const q = cari.toLowerCase();
    const cocok =
      k.full_name?.toLowerCase().includes(q) ||
      k.nik?.toLowerCase().includes(q) ||
      k.position?.toLowerCase().includes(q) ||
      (k.login_accounts?.username ?? "").toLowerCase().includes(q);
    return cocok && (deptFilter === "semua" || k.department === deptFilter);
  });

  function bukaTambah() {
    setEditId(null);
    setForm({
      ...formKosong,
      nik: `EMP${String(karyawan.length + 1).padStart(3, "0")}`,
    });
    setOpen(true);
  }

  function bukaEdit(k: KaryawanDenganAkun) {
    setEditId(k.id);
    setForm({
      nik: k.nik,
      full_name: k.full_name,
      email: k.email || "",
      department: k.department || "Operasional",
      position: k.position || "Staff",
      daily_salary: Number(k.daily_salary) || 150000,
      active: k.active ?? true,
      username: k.login_accounts?.username || "",
      password: "",
    });
    setOpen(true);
  }

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nik || !form.full_name) {
      toast.error("NIK dan Nama Lengkap wajib diisi");
      return;
    }

    setSaving(true);

    if (editId) {
      // Edit data karyawan biasa
      const payload = {
        nik: form.nik.trim().toUpperCase(),
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase() || null,
        department: form.department.trim(),
        position: form.position.trim(),
        daily_salary: Number(form.daily_salary),
        active: form.active,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("employees").update(payload).eq("id", editId);
      if (!error && form.active !== true) {
        // Kalau dinonaktifkan, akun login ikut dinonaktifkan lewat Edge Function
        await kelolaAkunKaryawan({
          action: "set_active",
          employee_id: editId,
          active: form.active,
        });
      }
      if (!error) {
        toast.success("Data karyawan diperbarui");
        setOpen(false);
        queryClient.invalidateQueries({ queryKey: ["employees"] });
      } else {
        toast.error(error.message.includes("duplicate") ? "NIK sudah terdaftar" : error.message);
      }
      setSaving(false);
      return;
    }

    // Tambah karyawan BARU: buat akun login + data karyawan sekaligus
    if (!form.username || !form.password) {
      toast.error("Username dan kata sandi wajib diisi untuk karyawan baru");
      setSaving(false);
      return;
    }

    const hasil = await kelolaAkunKaryawan({
      action: "create",
      username: form.username,
      password: form.password,
      email: form.email,
      nik: form.nik.trim().toUpperCase(),
      full_name: form.full_name.trim(),
      department: form.department.trim(),
      position: form.position.trim(),
      daily_salary: Number(form.daily_salary),
    });

    setSaving(false);
    if (!hasil.ok) {
      toast.error(hasil.error || "Gagal menambahkan karyawan");
      return;
    }

    toast.success(`Karyawan ditambahkan. Username: ${hasil.username ?? form.username}`);
    setOpen(false);
    queryClient.invalidateQueries({ queryKey: ["employees"] });
  }

  async function hapus(k: KaryawanDenganAkun) {
    if (
      !confirm(
        `Hapus karyawan ${k.full_name}? Akun login dan riwayat absensinya juga akan terhapus.`,
      )
    ) {
      return;
    }

    const hasil = await kelolaAkunKaryawan({ action: "delete", employee_id: k.id });
    if (!hasil.ok) {
      // Fallback: hapus data karyawan saja (akun auth jadi yatim tapi tidak
      // bisa login karena baris login_accounts ikut terhapus via cascade).
      const { error } = await supabase.from("employees").delete().eq("id", k.id);
      if (error) {
        toast.error(hasil.error || error.message);
        return;
      }
      toast.warning(
        "Data karyawan dihapus (akun login Supabase tidak ikut terhapus karena fungsi tidak tersedia).",
      );
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      return;
    }
    toast.success("Karyawan dan akun loginnya dihapus");
    queryClient.invalidateQueries({ queryKey: ["employees"] });
  }

  async function simpanReset(e: React.FormEvent) {
    e.preventDefault();
    if (!resetTarget) return;
    if (resetPass.length < 6) {
      toast.error("Kata sandi minimal 6 karakter");
      return;
    }

    setSavingReset(true);
    const hasil = await kelolaAkunKaryawan({
      action: "reset_password",
      employee_id: resetTarget.id,
      password: resetPass,
    });
    setSavingReset(false);

    if (!hasil.ok) {
      toast.error(hasil.error || "Gagal mengganti kata sandi");
      return;
    }
    toast.success("Kata sandi berhasil diganti");
    setResetTarget(null);
    setResetPass("");
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Briefcase className="size-6 text-primary" /> Data Karyawan & Skema Gaji
          </h1>
          <p className="text-sm text-muted-foreground">
            Kelola data staf, jabatan, akun login, dan tarif gaji harian.
          </p>
        </div>
        <div>
          <Button onClick={bukaTambah}>
            <Plus className="size-4 mr-1.5" /> Tambah Karyawan
          </Button>
        </div>
      </header>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari nama, NIK, posisi, atau username..."
            className="pl-9"
          />
        </div>

        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-[180px]">
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

      {/* Tabel Karyawan */}
      <div className="rounded-2xl border bg-card shadow-[var(--shadow-soft)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
              <tr>
                <th className="px-5 py-3.5">NIK & Karyawan</th>
                <th className="px-5 py-3.5">Akun Login</th>
                <th className="px-5 py-3.5">Departemen & Posisi</th>
                <th className="px-5 py-3.5">Gaji Harian</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">
                    Memuat data karyawan...
                  </td>
                </tr>
              ) : tersaring.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">
                    <p className="font-semibold text-foreground">Belum ada data karyawan</p>
                    <p className="text-xs mt-1">
                      Klik tombol "Tambah Karyawan" untuk mulai menambahkan staf.
                    </p>
                  </td>
                </tr>
              ) : (
                tersaring.map((k) => (
                  <tr key={k.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-foreground">{k.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        NIK: <span className="font-mono">{k.nik}</span>
                      </p>
                    </td>
                    <td className="px-5 py-3.5">
                      {k.login_accounts ? (
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs">
                            {k.login_accounts.username || "-"}
                          </span>
                          {k.login_accounts.role === "admin" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 text-[10px] font-semibold">
                              <ShieldCheck className="size-3" /> Admin
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 text-[10px] font-semibold">
                              Karyawan
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">— belum ada akun</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-block px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground text-xs font-medium">
                        {k.department}
                      </span>
                      <p className="text-xs text-muted-foreground mt-0.5">{k.position}</p>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-foreground">
                      <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                        {formatRupiah(Number(k.daily_salary))}
                      </span>
                      <span className="text-xs text-muted-foreground block font-normal">
                        per hari hadir
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {k.active ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                          <UserCheck className="size-3.5" /> Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <UserX className="size-3.5" /> Nonaktif
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {k.login_accounts && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setResetTarget(k);
                              setResetPass("");
                            }}
                            title="Ganti kata sandi"
                            className="hover:text-amber-600"
                          >
                            <KeyRound className="size-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => bukaEdit(k)}
                          title="Edit"
                        >
                          <Pencil className="size-4 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => hapus(k)}
                          title="Hapus"
                          className="hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form Tambah / Edit Karyawan */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Karyawan" : "Tambah Karyawan Baru"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={simpan} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="nik">NIK (Nomor Induk)</Label>
                <Input
                  id="nik"
                  value={form.nik}
                  onChange={(e) => setForm({ ...form, nik: e.target.value })}
                  placeholder="EMP001"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nama">Nama Lengkap</Label>
                <Input
                  id="nama"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Budi Santoso"
                  required
                />
              </div>
            </div>

            {!editId && (
              <div className="rounded-xl border bg-muted/40 p-3 space-y-3">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Akun Login Karyawan
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      value={form.username}
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                      placeholder="budi.santoso"
                      pattern="[a-zA-Z0-9._-]{3,32}"
                      title="Huruf, angka, titik, garis, atau strip (3-32 karakter)"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="passBaru">Kata Sandi</Label>
                    <Input
                      id="passBaru"
                      type="text"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder="min. 6 karakter"
                      minLength={6}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="karyawan@kantor.com"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Username dipakai untuk login. Email hanya untuk identitas akun Supabase.
                  </p>
                </div>
              </div>
            )}

            {editId && form.email && (
              <p className="text-[11px] text-muted-foreground">
                Email login: <span className="font-mono">{form.email}</span>
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="dept">Departemen / Divisi</Label>
                <Input
                  id="dept"
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  placeholder="Operasional / IT / Sales"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="posisi">Jabatan / Posisi</Label>
                <Input
                  id="posisi"
                  value={form.position}
                  onChange={(e) => setForm({ ...form, position: e.target.value })}
                  placeholder="Staff / Supervisor"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="gaji"
                className="flex items-center gap-1.5 text-foreground font-semibold"
              >
                <DollarSign className="size-4 text-emerald-600" /> Tarif Gaji Harian (Rp / Hari
                Hadir)
              </Label>
              <Input
                id="gaji"
                type="number"
                min={0}
                step={5000}
                value={form.daily_salary}
                onChange={(e) => setForm({ ...form, daily_salary: Number(e.target.value) })}
                required
              />
              <p className="text-xs text-muted-foreground font-medium">
                Setara:{" "}
                <span className="text-emerald-600 font-semibold">
                  {formatRupiah(form.daily_salary)}
                </span>{" "}
                per hari kehadiran.
              </p>
            </div>

            {editId && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Status Karyawan</Label>
                  <Select
                    value={form.active ? "true" : "false"}
                    onValueChange={(v) => setForm({ ...form, active: v === "true" })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Aktif</SelectItem>
                      <SelectItem value="false">Nonaktif (akun login ikut nonaktif)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Menyimpan..." : editId ? "Simpan Perubahan" : "Simpan Karyawan & Akun"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Ganti Kata Sandi */}
      <Dialog open={!!resetTarget} onOpenChange={(v) => !v && setResetTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Ganti Kata Sandi</DialogTitle>
          </DialogHeader>
          <form onSubmit={simpanReset} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="resetPass">Kata Sandi Baru untuk {resetTarget?.full_name}</Label>
              <Input
                id="resetPass"
                type="text"
                minLength={6}
                value={resetPass}
                onChange={(e) => setResetPass(e.target.value)}
                placeholder="min. 6 karakter"
                autoFocus
                required
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setResetTarget(null)}>
                Batal
              </Button>
              <Button type="submit" disabled={savingReset}>
                {savingReset ? "Menyimpan..." : "Simpan Kata Sandi"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
