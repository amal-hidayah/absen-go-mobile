import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  ScanLine,
  Users,
  DollarSign,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Tv,
  UserX,
  ShieldAlert,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthProfile } from "@/hooks/use-auth-profile";

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  const { data: authProfile, isLoading: loadingProfile } = useAuthProfile();
  const isAdmin = authProfile?.isAdmin ?? false;
  const belumTerdaftar = !loadingProfile && !!authProfile?.user && !authProfile.isRegistered;

  // Navigasi Admin: Seluruh item menyatu rapi dalam satu daftar tanpa elemen terpisah
  const adminNav = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/kiosk", label: "Layar Kiosk Kantor", icon: Tv },
    { to: "/karyawan", label: "Data Karyawan", icon: Users },
    { to: "/gaji", label: "Penggajian (Payroll)", icon: DollarSign },
    { to: "/rekap", label: "Rekap Kehadiran", icon: BarChart3 },
    { to: "/pengaturan", label: "Pengaturan Kantor", icon: Settings },
  ];

  // Navigasi Karyawan
  const employeeNav = [
    { to: "/dashboard", label: "Dashboard Saya", icon: LayoutDashboard },
    { to: "/scan", label: "Scan Presensi", icon: ScanLine },
    { to: "/rekap", label: "Riwayat Presensi", icon: BarChart3 },
  ];

  const navItems = belumTerdaftar ? [] : isAdmin ? adminNav : employeeNav;

  // Halaman khusus admin — RLS sudah menolak data, ini hanya tampilan.
  // "/rekap" tidak dimasukkan karena karyawan memakai halaman ini untuk riwayat pribadi.
  const adminOnlyPaths = ["/karyawan", "/gaji", "/pengaturan"];
  const ditolakAdmin = belumTerdaftar || (!isAdmin && adminOnlyPaths.includes(pathname));

  async function keluar() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const userDisplayName =
    authProfile?.employee?.full_name ||
    authProfile?.user?.user_metadata?.["full_name"] ||
    authProfile?.user?.email?.split("@")[0] ||
    "User";

  const userEmail = authProfile?.user?.email || "";
  const initialLetter = userDisplayName.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-background md:flex">
      {/* Sidebar Navigasi */}
      <aside
        className={cn(
          "z-40 flex w-full shrink-0 flex-col border-b bg-card/95 backdrop-blur-md px-4 py-4 md:h-screen md:w-64 md:border-r md:border-b-0 md:py-6",
          "md:sticky md:top-0 shadow-xs",
        )}
      >
        {/* Brand Logo */}
        <div className="flex items-center justify-between pb-2">
          <Link to="/dashboard" className="flex items-center">
            <img src="/logo.webp" alt="AbsenGo" className="h-11 w-auto object-contain" />
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>

        {/* Unified Navigation List (Semua menu tampil sejajar dan rapi) */}
        <div className="mt-6 flex-1 flex flex-col">
          <div className="px-2 mb-2 text-[10px] font-semibold tracking-wider text-muted-foreground/80 uppercase">
            {isAdmin ? "Menu Utama" : "Portal Karyawan"}
          </div>

          <nav className={cn("flex flex-col gap-1", open ? "flex" : "hidden md:flex")}>
            {navItems.map((item) => {
              const active = pathname === item.to;
              const isKiosk = item.to === "/kiosk";

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  {...(isKiosk ? { target: "_blank" as const } : {})}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
                    active
                      ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                  )}
                >
                  <item.icon
                    className={cn(
                      "size-4",
                      active ? "text-primary-foreground" : "text-muted-foreground",
                    )}
                  />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Card di Bagian Bawah Sidebar */}
        <div className={cn("mt-auto pt-4 border-t", open ? "block" : "hidden md:block")}>
          <div className="flex items-center justify-between p-2 rounded-xl bg-muted/40 border">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                {initialLetter}
              </div>
              <div className="min-w-0 pr-1">
                <p className="text-xs font-semibold text-foreground truncate leading-tight">
                  {userDisplayName}
                </p>
                <p className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">
                  {userEmail}
                </p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={keluar}
              title="Keluar"
              className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Page Content */}
      <main className="min-w-0 flex-1 px-5 py-6 flex flex-col md:px-8 md:py-8">
        <div className="flex-1">
          {belumTerdaftar ? (
            <div className="mx-auto max-w-lg rounded-2xl border bg-card p-8 text-center shadow-[var(--shadow-soft)]">
              <UserX className="mx-auto size-10 text-muted-foreground" />
              <h1 className="mt-4 text-lg font-semibold">Akun belum terdaftar sebagai karyawan</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Login berhasil, tetapi email{" "}
                <span className="font-medium text-foreground">{userEmail}</span> belum terdaftar di
                data karyawan. Hubungi administrator kantor untuk mendaftarkan akun ini beserta hak
                aksesnya.
              </p>
              <Button variant="outline" className="mt-6" onClick={keluar}>
                <LogOut className="size-4" /> Keluar
              </Button>
            </div>
          ) : ditolakAdmin ? (
            <div className="mx-auto max-w-lg rounded-2xl border bg-card p-8 text-center shadow-[var(--shadow-soft)]">
              <ShieldAlert className="mx-auto size-10 text-muted-foreground" />
              <h1 className="mt-4 text-lg font-semibold">Halaman khusus administrator</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Akun ini tidak memiliki hak akses admin. Data workforce dan penggajian hanya bisa
                dibuka oleh administrator.
              </p>
              <Button variant="outline" className="mt-6" asChild>
                <Link to="/dashboard">Kembali ke Dashboard</Link>
              </Button>
            </div>
          ) : (
            children
          )}
        </div>

        <footer className="mt-auto border-t pt-8 mt-12 pb-2 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground print:hidden">
          <div className="flex items-center gap-2 text-xs">
            <span>AbsenGo Corporate · Sistem Presensi & Penggajian Harian</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
