import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/pengaturan")({
  head: () => ({
    meta: [
      { title: "Pengaturan — AbsenGo" },
      { name: "description", content: "Atur nama sekolah dan jam batas keterlambatan." },
      { property: "og:title", content: "Pengaturan — AbsenGo" },
      { property: "og:description", content: "Atur nama sekolah dan jam batas keterlambatan." },
    ],
  }),
  component: PengaturanPage,
});

function PengaturanPage() {
  const queryClient = useQueryClient();
  const [nama, setNama] = useState("");
  const [batas, setBatas] = useState("07:00");
  const [profil, setProfil] = useState("");

  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("*").maybeSingle();
      if (error && error.code !== 'PGRST116') throw error; // Abaikan error tidak ada data
      return data;
    },
  });

  const { data: me } = useQuery({
    queryKey: ["profil"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (error) throw error;
      return { ...data, email: auth.user.email };
    },
  });

  useEffect(() => {
    if (data) {
      setNama(data.school_name);
      setBatas(data.late_after.slice(0, 5));
    }
  }, [data]);

  useEffect(() => {
    if (me?.full_name) setProfil(me.full_name);
  }, [me]);

  async function simpanSekolah(e: React.FormEvent) {
    e.preventDefault();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    
    const { error } = await supabase
      .from("settings")
      .upsert({ 
        user_id: auth.user.id,
        school_name: nama, 
        late_after: `${batas}:00`, 
        updated_at: new Date().toISOString() 
      }, { onConflict: "user_id" });
      
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Pengaturan disimpan");
    queryClient.invalidateQueries({ queryKey: ["settings"] });
  }

  async function simpanProfil(e: React.FormEvent) {
    e.preventDefault();
    if (!me?.id) return;
    const { error } = await supabase.from("profiles").update({ full_name: profil }).eq("id", me.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profil disimpan");
    queryClient.invalidateQueries({ queryKey: ["profil"] });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Pengaturan</h1>
        <p className="text-sm text-muted-foreground">Konfigurasi sekolah dan akun Anda.</p>
      </header>

      <form
        onSubmit={simpanSekolah}
        className="space-y-4 rounded-2xl border bg-card p-5 shadow-[var(--shadow-soft)]"
      >
        <h2 className="text-base font-semibold">Sekolah</h2>
        <div className="space-y-2">
          <Label htmlFor="sekolah">Nama sekolah</Label>
          <Input id="sekolah" value={nama} onChange={(e) => setNama(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="batas">Batas jam masuk (lewat jam ini = terlambat)</Label>
          <Input
            id="batas"
            type="time"
            value={batas}
            onChange={(e) => setBatas(e.target.value)}
            required
          />
        </div>
        <Button type="submit">Simpan pengaturan</Button>
      </form>

      <form
        onSubmit={simpanProfil}
        className="space-y-4 rounded-2xl border bg-card p-5 shadow-[var(--shadow-soft)]"
      >
        <h2 className="text-base font-semibold">Akun saya</h2>
        <div className="space-y-2">
          <Label htmlFor="profil">Nama lengkap</Label>
          <Input id="profil" value={profil} onChange={(e) => setProfil(e.target.value)} />
        </div>
        <p className="text-sm text-muted-foreground">{me?.email}</p>
        <Button type="submit" variant="secondary">
          Simpan profil
        </Button>
      </form>
    </div>
  );
}
