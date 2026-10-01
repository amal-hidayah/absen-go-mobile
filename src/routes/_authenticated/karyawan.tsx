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
import { DataList } from "@/components/data-list";
import { PageHeader } from "@/components/page-header";
import { PasswordInput } from "@/components/password-input";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
      { title: "Data Karyawan · AbsenGo" },
      {
        name: "description",
        content: "Kelola data karyawan, akun login, dan tarif gaji harian.",
      },
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

  const [resetTarget, setResetTarget] = useState<KaryawanDenganAkun | null>(null);
  const [resetPass, setResetPass] = useState("");
  const [savingReset, setSavingReset] = useState(false);

  const [hapusTarget, setHapusTarget] = useState<KaryawanDenganAkun | null>(null);
  const [menghapus, setMenghapus] = useState(false);

  const {
    data: karyawan = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<KaryawanDenganAkun[]>({
    queryKey: ["employees"],
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*, login_accounts(username, role, active)")
        .order("department")
        .order("full_name");
      if (error) throw error;
      return (data as unknown as KaryawanDenganAkun[]) || [];
    },
  });

  const daftarDept = useMemo(
    () => Array.from(new Set(karyawan.map((k) => k.department).filter(Boolean))).sort(),
    [karyawan],
  );

  const tersaring = useMemo(() => {
    const q = cari.toLowerCase().trim();
    return karyawan.filter((k) => {
      const cocok =
        k.full_name?.toLowerCase().includes(q) ||
        k.nik?.toLowerCase().includes(q) ||
        k.position?.toLowerCase().includes(q) ||
        (k.login_accounts?.username ?? "").toLowerCase().includes(q);
      return cocok && (deptFilter === "semua" || k.department === deptFilter);
    });
  }, [karyawan, cari, deptFilter]);

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
        // Akun login ikut dinonaktifkan lewat Edge Function.
        await kelolaAkunKaryawan({
          action: "set_active",
          employee_id: editId,
          active: form.active,
        });
      }
      if (error) {
        toast.error(error.message.includes("duplicate") ? "NIK sudah terdaftar" : error.message);
      } else {
        toast.success("Data karyawan diperbarui");
        setOpen(false);
        queryClient.invalidateQueries({ queryKey: ["employees"] });
      }
      setSaving(false);
      return;
    }

    // Karyawan baru: akun login dan data karyawan dibuat dalam satu langkah.
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

  async function hapus() {
    if (!hapusTarget) return;
    setMenghapus(true);
    const target = hapusTarget;
    const hasil = await kelolaAkunKaryawan({ action: "delete", employee_id: target.id });

    if (!hasil.ok) {
      // Fallback: hapus data karyawan saja bila Edge Function tidak tersedia.
      const { error } = await supabase.from("employees").delete().eq("id", target.id);
      setMenghapus(false);
      if (error) {
        toast.error(hasil.error || error.message);
        return;
      }
      toast.warning(
        "Data karyawan dihapus. Akun login di Supabase tidak terhapus karena fungsi kelola akun tidak tersedia.",
      );
      setHapusTarget(null);
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      return;
    }

    setMenghapus(false);
    setHapusTarget(null);
    toast.success(`${target.full_name} dan akun loginnya dihapus`);
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

  function renderAksi(k: KaryawanDenganAkun, ringkas: boolean) {
    return (
      <div className={ringkas ? "flex gap-2" : "flex justify-end gap-2"}>
        {k.login_accounts ? (
          <Button
            variant="outline"
            size={ringkas ? "icon" : "sm"}
            onClick={() => {
              setResetTarget(k);
              setResetPass("");
            }}
            title="Ganti kata sandi"
            aria-label={`Ganti kata sandi ${k.full_name}`}
          >
            <KeyRound className="size-4" aria-hidden />
          </Button>
        ) : null}
        <Button
          variant="outline"
          size={ringkas ? "icon" : "sm"}
          onClick={() => bukaEdit(k)}
          title="Edit data karyawan"
          aria-label={`Edit data ${k.full_name}`}
        >
          <Pencil className="size-4" aria-hidden />
        </Button>
        <Button
          variant="outline"
          size={ringkas ? "icon" : "sm"}
          onClick={() => setHapusTarget(k)}
          title="Hapus karyawan"
          aria-label={`Hapus ${k.full_name}`}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 sm:space-y-6">
      <PageHeader
        title="Data Karyawan & Tarif Gaji"
        icon={Briefcase}
        subtitle="Kelola data staf, jabatan, akun login, dan tarif gaji harian."
        actions={
          <Button onClick={bukaTambah} className="shrink-0">
            <Plus className="size-4" aria-hidden /> Tambah Karyawan
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari nama, NIK, posisi, atau username"
            aria-label="Cari karyawan"
            className="pl-9"
          />
        </div>

        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="sm:w-56" aria-label="Filter departemen">
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

      <DataList
        rows={tersaring}
        rowKey={(k) => k.id}
        loading={isLoading}
        loadingLabel="Memuat data karyawan..."
        error={isError ? "Daftar karyawan tidak bisa dimuat dari server." : null}
        onRetry={() => void refetch()}
        header={
          <p className="text-xs text-muted-foreground">
            Menampilkan {tersaring.length} dari {karyawan.length} karyawan
          </p>
        }
        columns={[
          {
            header: "NIK & Karyawan",
            render: (k) => (
              <>
                <p className="font-semibold text-foreground">{k.full_name}</p>
                <p className="font-mono text-xs text-muted-foreground">{k.nik}</p>
              </>
            ),
          },
          {
            header: "Akun Login",
            render: (k) =>
              k.login_accounts ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-xs">{k.login_accounts.username || "-"}</span>
                  {k.login_accounts.role === "admin" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-800 dark:bg-violet-950/60 dark:text-violet-300">
                      <ShieldCheck className="size-3" aria-hidden /> Admin
                    </span>
                  ) : (
                    <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      Karyawan
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Belum ada akun</span>
              ),
          },
          {
            header: "Departemen & Posisi",
            render: (k) => (
              <>
                <span className="inline-block rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                  {k.department}
                </span>
                <p className="mt-0.5 text-xs text-muted-foreground">{k.position}</p>
              </>
            ),
          },
          {
            header: "Gaji Harian",
            render: (k) => (
              <>
                <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                  {formatRupiah(Number(k.daily_salary))}
                </span>
                <span className="block text-xs font-normal text-muted-foreground">
                  per hari hadir
                </span>
              </>
            ),
          },
          {
            header: "Status",
            render: (k) =>
              k.active ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  <UserCheck className="size-3.5" aria-hidden /> Aktif
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <UserX className="size-3.5" aria-hidden /> Nonaktif
                </span>
              ),
          },
          { header: "Aksi", align: "right", render: (k) => renderAksi(k, false) },
        ]}
        renderCard={(k) => (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{k.full_name}</p>
                <p className="font-mono text-xs text-muted-foreground">{k.nik}</p>
              </div>
              {k.active ? (
                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  <UserCheck className="size-3.5" aria-hidden /> Aktif
                </span>
              ) : (
                <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  <UserX className="size-3.5" aria-hidden /> Nonaktif
                </span>
              )}
            </div>

            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <div className="min-w-0">
                <dt className="text-muted-foreground">Departemen</dt>
                <dd className="mt-0.5 truncate font-medium text-foreground">
                  {k.department} · {k.position}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-muted-foreground">Gaji harian</dt>
                <dd className="mt-0.5 font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                  {formatRupiah(Number(k.daily_salary))}
                </dd>
              </div>
              <div className="col-span-2 min-w-0">
                <dt className="text-muted-foreground">Akun login</dt>
                <dd className="mt-0.5 font-mono font-medium text-foreground">
                  {k.login_accounts?.username || "Belum ada akun"}
                  {k.login_accounts?.role === "admin" ? " · admin" : ""}
                </dd>
              </div>
            </dl>

            {renderAksi(k, true)}
          </div>
        )}
        empty={
          <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <UserX className="size-5" aria-hidden />
            </div>
            <p className="text-sm font-semibold text-foreground">
              {karyawan.length === 0 ? "Belum ada data karyawan" : "Tidak ada karyawan yang cocok"}
            </p>
            <p className="max-w-sm text-xs leading-relaxed text-muted-foreground text-pretty">
              {karyawan.length === 0
                ? "Tambahkan staf pertama beserta username dan kata sandi yang dipakai untuk scan presensi."
                : "Coba kata kunci lain atau pilih departemen yang berbeda."}
            </p>
          </div>
        }
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="pr-8">
              {editId ? "Edit Karyawan" : "Tambah Karyawan Baru"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={simpan} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="nik">NIK</Label>
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
              <div className="space-y-3 rounded-xl border bg-muted/40 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Akun login karyawan
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                    <PasswordInput
                      id="passBaru"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder="min. 6 karakter"
                      minLength={6}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="karyawan@kantor.com"
                  />
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Karyawan login dengan username. Email hanya identitas akun di Supabase.
                  </p>
                </div>
              </div>
            )}

            {editId && form.email ? (
              <p className="text-[11px] text-muted-foreground">
                Email akun: <span className="font-mono">{form.email}</span>
              </p>
            ) : null}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="dept">Departemen</Label>
                <Input
                  id="dept"
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  placeholder="Operasional / IT / Sales"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="posisi">Jabatan</Label>
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
                className="flex items-center gap-1.5 font-semibold text-foreground"
              >
                <DollarSign className="size-4 text-emerald-700 dark:text-emerald-400" aria-hidden />
                Tarif Gaji Harian
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
              <p className="text-xs text-muted-foreground">
                Setara{" "}
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                  {formatRupiah(form.daily_salary)}
                </span>{" "}
                per hari kehadiran.
              </p>
            </div>

            {editId ? (
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
            ) : null}

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

      <Dialog open={!!resetTarget} onOpenChange={(v) => !v && setResetTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="pr-8">Ganti Kata Sandi</DialogTitle>
          </DialogHeader>
          <form onSubmit={simpanReset} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="resetPass">Kata sandi baru untuk {resetTarget?.full_name}</Label>
              <PasswordInput
                id="resetPass"
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

      <AlertDialog open={!!hapusTarget} onOpenChange={(v) => !v && setHapusTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus {hapusTarget?.full_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Akun login dan seluruh riwayat absensinya ikut terhapus. Tindakan ini tidak bisa
              dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={menghapus}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={hapus} disabled={menghapus}>
              {menghapus ? "Menghapus..." : "Hapus Karyawan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
