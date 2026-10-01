import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Building2, Clock, ShieldCheck, Tv, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CompanySettings } from "@/lib/presensi";

export const Route = createFileRoute("/_authenticated/pengaturan")({
  head: () => ({
    meta: [
      { title: "Pengaturan Kantor — AbsenGo" },
      {
        name: "description",
        content: "Atur jam masuk, toleransi terlambat, jam pulang, dan nama kantor.",
      },
    ],
  }),
  component: PengaturanPage,
});

function PengaturanPage() {
  const queryClient = useQueryClient();
  const [namaPerusahaan, setNamaPerusahaan] = useState("");
  const [jamMasuk, setJamMasuk] = useState("08:00");
  const [toleransi, setToleransi] = useState(15);
  const [jamPulang, setJamPulang] = useState("17:00");
  const [qrSecret, setQrSecret] = useState("absen-corp-secret-token");
  const [profilNama, setProfilNama] = useState("");
  const [saving, setSaving] = useState(false);

  // Ambil pengaturan kantor dari database
  const { data: settings } = useQuery<CompanySettings | null>({
    queryKey: ["company_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error && error.code !== "PGRST116") console.warn(error);
      return (data as unknown as CompanySettings) || null;
    },
  });

  // Ambil profil user login
  const { data: me } = useQuery({
    queryKey: ["profil_user_me"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      return auth.user;
    },
  });

  useEffect(() => {
    if (settings) {
      setNamaPerusahaan(settings.company_name || "");
      setJamMasuk(settings.work_start_time?.slice(0, 5) || "08:00");
      setToleransi(settings.late_tolerance_minutes ?? 15);
      setJamPulang(settings.work_end_time?.slice(0, 5) || "17:00");
      setQrSecret(settings.qr_secret || "absen-corp-secret-token");
    }
  }, [settings]);

  useEffect(() => {
    if (me?.email) {
      setProfilNama(me.user_metadata?.["full_name"] || me.email.split("@")[0]);
    }
  }, [me]);

  async function simpanKantor(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const payload = {
      id: 1,
      company_name: namaPerusahaan.trim() || "Perusahaan",
      work_start_time: `${jamMasuk}:00`,
      late_tolerance_minutes: Number(toleransi) || 0,
      work_end_time: `${jamPulang}:00`,
      qr_secret: qrSecret.trim() || "absen-corp-secret-token",
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("company_settings").upsert(payload, { onConflict: "id" });

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Pengaturan kantor berhasil disimpan");
    queryClient.invalidateQueries({ queryKey: ["company_settings"] });
  }

  async function simpanProfil(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.auth.updateUser({
      data: { full_name: profilNama },
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profil akun berhasil diperbarui");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="size-6 text-primary" /> Pengaturan Kantor & Jam Kerja
          </h1>
          <p className="text-sm text-muted-foreground">
            Konfigurasi jam masuk, toleransi keterlambatan, jam pulang, dan identitas perusahaan.
          </p>
        </div>

        <Button variant="outline" size="sm" asChild>
          <Link to="/kiosk" target="_blank">
            <Tv className="size-4 mr-1.5 text-primary" /> Preview Layar Kiosk
          </Link>
        </Button>
      </header>

      {/* Form Konfigurasi Jam Kerja & Kantor */}
      <form
        onSubmit={simpanKantor}
        className="space-y-5 rounded-2xl border bg-card p-5 sm:p-6 shadow-[var(--shadow-soft)]"
      >
        <h2 className="text-base font-semibold border-b pb-3 flex items-center gap-2">
          <Clock className="size-4 text-primary" /> Kebijakan Waktu Kerja
        </h2>

        <div className="space-y-1.5">
          <Label htmlFor="perusahaan">Nama Perusahaan / Organisasi</Label>
          <Input
            id="perusahaan"
            value={namaPerusahaan}
            onChange={(e) => setNamaPerusahaan(e.target.value)}
            placeholder="PT Sukses Mandiri Abadi"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="jamMasuk">Jam Masuk Kerja</Label>
            <Input
              id="jamMasuk"
              type="time"
              value={jamMasuk}
              onChange={(e) => setJamMasuk(e.target.value)}
              required
            />
            <p className="text-[11px] text-muted-foreground">Waktu kerja dimulai</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="toleransi">Toleransi Keterlambatan</Label>
            <div className="relative">
              <Input
                id="toleransi"
                type="number"
                min={0}
                max={120}
                value={toleransi}
                onChange={(e) => setToleransi(Number(e.target.value))}
                required
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                menit
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Scan setelah {jamMasuk} + {toleransi} mnt dihitung terlambat
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="jamPulang">Jam Pulang Kerja</Label>
            <Input
              id="jamPulang"
              type="time"
              value={jamPulang}
              onChange={(e) => setJamPulang(e.target.value)}
              required
            />
            <p className="text-[11px] text-muted-foreground">Waktu clock-out pulang</p>
          </div>
        </div>

        <div className="space-y-1.5 pt-2">
          <Label htmlFor="qrSecret" className="flex items-center gap-1.5">
            <ShieldCheck className="size-4 text-emerald-600" /> Kunci Rahasia Dynamic QR (QR Secret)
          </Label>
          <Input
            id="qrSecret"
            value={qrSecret}
            onChange={(e) => setQrSecret(e.target.value)}
            placeholder="absen-corp-secret-token"
            required
          />
          <p className="text-[11px] text-muted-foreground">
            Kunci enkripsi untuk memvalidasi token QR 5 detik antara layar kantor dan HP karyawan.
          </p>
        </div>

        <div className="pt-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan Pengaturan Kantor"}
          </Button>
        </div>
      </form>

      {/* Form Profil User */}
      <form
        onSubmit={simpanProfil}
        className="space-y-4 rounded-2xl border bg-card p-5 sm:p-6 shadow-[var(--shadow-soft)]"
      >
        <h2 className="text-base font-semibold border-b pb-3 flex items-center gap-2">
          <User className="size-4 text-primary" /> Akun Login Anda
        </h2>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={me?.email || ""} disabled className="bg-muted/50" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="profilNama">Nama Pengguna</Label>
          <Input
            id="profilNama"
            value={profilNama}
            onChange={(e) => setProfilNama(e.target.value)}
          />
        </div>

        <Button type="submit" variant="secondary" disabled={saving}>
          {saving ? "Menyimpan..." : "Simpan Profil Akun"}
        </Button>
      </form>
    </div>
  );
}
