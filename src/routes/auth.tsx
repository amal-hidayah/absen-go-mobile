import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Masuk · AbsenGo Corporate" },
      { name: "description", content: "Masuk ke sistem presensi karyawan." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function masuk(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      // Supabase hanya menerima email + password, jadi username dicocokkan
      // lebih dulu ke tabel login_accounts.
      const { data: email, error: rpcError } = await supabase.rpc("resolve_login_email", {
        _username: username.trim(),
      });

      if (rpcError) {
        toast.error("Gagal menghubungi server. Coba beberapa saat lagi.");
        return;
      }

      if (!email) {
        toast.error("Username tidak ditemukan atau akun sudah dinonaktifkan.");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error(
          error.message === "Invalid login credentials"
            ? "Username atau kata sandi salah."
            : error.message,
        );
        return;
      }

      // Role menentukan panel yang dibuka: admin atau karyawan.
      const { data: userData } = await supabase.auth.getUser();
      const { data: akun } = await supabase
        .from("login_accounts")
        .select("role, active")
        .eq("user_id", userData.user?.id ?? "")
        .maybeSingle();

      if (!akun || !akun.active) {
        await supabase.auth.signOut();
        toast.error("Akun ini belum aktif. Hubungi administrator kantor.");
        return;
      }

      toast.success(akun.role === "admin" ? "Berhasil masuk sebagai Admin" : "Berhasil masuk");
      navigate({ to: "/dashboard", replace: true });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-mesh px-5 py-8 sm:py-12">
      <div className="w-full max-w-sm sm:max-w-md">
        <div className="mb-6 text-center">
          <Link to="/" className="inline-block">
            <img
              src="/logo.webp"
              alt="Logo AbsenGo"
              className="mx-auto h-14 w-auto object-contain"
            />
          </Link>
          <h1 className="mt-3 text-lg font-bold text-foreground sm:text-xl">AbsenGo Corporate</h1>
          <p className="mt-1 text-xs text-muted-foreground text-pretty">
            Presensi karyawan dan penggajian harian
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-lift)] sm:p-7">
          <form onSubmit={masuk} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username" className="flex items-center gap-1.5">
                <UserRound className="size-4" aria-hidden /> Username
              </Label>
              <Input
                id="username"
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pass" className="flex items-center gap-1.5">
                <Lock className="size-4" aria-hidden /> Kata Sandi
              </Label>
              <Input
                id="pass"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Kata sandi"
              />
            </div>

            <Button type="submit" className="w-full md:h-11" disabled={loading}>
              {loading ? "Memproses..." : "Masuk"}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Belum punya akun? Hubungi administrator kantor.
        </p>
      </div>
    </div>
  );
}
