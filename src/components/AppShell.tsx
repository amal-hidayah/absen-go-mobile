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
  Tv,
  UserX,
  ShieldAlert,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthProfile } from "@/hooks/use-auth-profile";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Menu yang dibuka di tab terpisah (layar monitor di ruang tunggu). */
  newTab?: boolean;
}

// NavLinks dan UserCard berada di luar AppShell supaya identitas komponennya
// tetap. Kalau didefinisikan di dalam body, tiap render membuat fungsi baru
// dan React akan melepas-sambung ulang seluruh isi laci menu.
function NavLinks({
  items,
  pathname,
  onPilih,
}: {
  items: NavItem[];
  pathname: string;
  onPilih?: () => void;
}) {
  return (
    <nav className="flex flex-col gap-1" aria-label="Menu utama">
      {items.map((item) => {
        const active = pathname === item.to;
        return (
          <Link
            key={item.to}
            to={item.to}
            {...(item.newTab ? { target: "_blank" as const } : {})}
            onClick={onPilih}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary font-semibold text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <item.icon className="size-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1">{item.label}</span>
            {item.newTab ? (
              <ExternalLink className="size-3.5 shrink-0 opacity-70" aria-hidden />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function UserCard({
  nama,
  email,
  onKeluar,
}: {
  nama: string;
  email: string;
  onKeluar?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-2.5">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
        {nama.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold leading-tight text-foreground">{nama}</p>
        <p className="mt-0.5 truncate text-[11px] leading-tight text-muted-foreground">{email}</p>
      </div>
      {onKeluar ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={onKeluar}
          title="Keluar"
          aria-label="Keluar dari akun"
          className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="size-4" aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [menuTerbuka, setMenuTerbuka] = useState(false);

  const { data: authProfile, isLoading: loadingProfile } = useAuthProfile();
  const isAdmin = authProfile?.isAdmin ?? false;
  const belumTerdaftar = !loadingProfile && !!authProfile?.user && !authProfile.isRegistered;

  const adminNav: NavItem[] = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/karyawan", label: "Data Karyawan", icon: Users },
    { to: "/gaji", label: "Penggajian", icon: DollarSign },
    { to: "/rekap", label: "Rekap Kehadiran", icon: BarChart3 },
    { to: "/pengaturan", label: "Pengaturan Kantor", icon: Settings },
    { to: "/kiosk", label: "Layar Kiosk", icon: Tv, newTab: true },
  ];

  const employeeNav: NavItem[] = [
    { to: "/dashboard", label: "Dashboard Saya", icon: LayoutDashboard },
    { to: "/scan", label: "Scan Presensi", icon: ScanLine },
    { to: "/rekap", label: "Riwayat Presensi", icon: BarChart3 },
  ];

  const navItems = belumTerdaftar ? [] : isAdmin ? adminNav : employeeNav;

  // Halaman khusus admin. RLS sudah menolak data, ini hanya tampilan.
  // "/rekap" tidak masuk daftar karena karyawan memakai halaman ini untuk riwayat pribadi.
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
    "Pengguna";

  const userEmail = authProfile?.user?.email || "";

  return (
    <div className="min-h-dvh bg-background md:flex">
      {/* Sidebar: hanya layar lebar (>= 768px) */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r bg-sidebar px-4 py-6 md:flex">
        <Link to="/dashboard" className="flex items-center px-2">
          <img src="/logo.webp" alt="AbsenGo" className="h-10 w-auto object-contain" />
        </Link>

        <div className="mt-7 flex-1 overflow-y-auto">
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {isAdmin ? "Menu Utama" : "Portal Karyawan"}
          </p>
          <NavLinks items={navItems} pathname={pathname} />
        </div>

        <div className="mt-4 border-t pt-4">
          <UserCard nama={userDisplayName} email={userEmail} onKeluar={keluar} />
        </div>
      </aside>

      {/* Bilah atas + laci menu: hanya layar sempit */}
      <div className="md:hidden">
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b bg-card/95 px-4 backdrop-blur-md">
          <Link to="/dashboard" className="flex min-w-0 items-center gap-2">
            <img src="/logo.webp" alt="AbsenGo" className="h-8 w-auto shrink-0 object-contain" />
            <span className="truncate text-sm font-bold">AbsenGo</span>
          </Link>

          <Sheet open={menuTerbuka} onOpenChange={setMenuTerbuka}>
            <SheetTrigger asChild>
              <Button variant="outline" className="shrink-0 px-3">
                <Menu className="size-5" aria-hidden /> Menu
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="flex w-[85%] max-w-xs flex-col gap-0 border-r bg-sidebar p-4"
            >
              <SheetTitle className="sr-only">Menu navigasi AbsenGo</SheetTitle>

              <div className="flex items-center gap-2 px-1 pb-5 pr-12">
                <img src="/logo.webp" alt="" className="h-9 w-auto object-contain" />
                <span className="truncate text-sm font-bold">AbsenGo</span>
              </div>

              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {isAdmin ? "Menu Utama" : "Portal Karyawan"}
              </p>
              <div className="flex-1 overflow-y-auto">
                <NavLinks
                  items={navItems}
                  pathname={pathname}
                  onPilih={() => setMenuTerbuka(false)}
                />
              </div>

              <div className="mt-4 space-y-3 border-t pt-4">
                <UserCard nama={userDisplayName} email={userEmail} />
                <Button variant="outline" className="w-full" onClick={keluar}>
                  <LogOut className="size-4" aria-hidden /> Keluar dari akun
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </header>
      </div>

      {/* Konten halaman */}
      <main className="flex min-w-0 flex-1 flex-col px-4 py-5 sm:px-6 md:px-8 md:py-8">
        <div className="flex-1">
          {belumTerdaftar ? (
            <div className="mx-auto max-w-lg rounded-2xl border bg-card p-6 text-center shadow-[var(--shadow-soft)] sm:p-8">
              <UserX className="mx-auto size-10 text-muted-foreground" aria-hidden />
              <h1 className="mt-4 text-lg font-semibold">Akun belum terdaftar sebagai karyawan</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Login berhasil, tetapi email{" "}
                <span className="font-medium break-all text-foreground">{userEmail}</span> belum
                terdaftar di data karyawan. Hubungi administrator kantor untuk mendaftarkan akun ini
                beserta hak aksesnya.
              </p>
              <Button variant="outline" className="mt-6" onClick={keluar}>
                <LogOut className="size-4" aria-hidden /> Keluar
              </Button>
            </div>
          ) : ditolakAdmin ? (
            <div className="mx-auto max-w-lg rounded-2xl border bg-card p-6 text-center shadow-[var(--shadow-soft)] sm:p-8">
              <ShieldAlert className="mx-auto size-10 text-muted-foreground" aria-hidden />
              <h1 className="mt-4 text-lg font-semibold">Halaman khusus administrator</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Akun ini tidak memiliki hak akses admin. Data karyawan dan penggajian hanya bisa
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

        <footer className="mt-10 border-t pt-4 text-xs text-muted-foreground print:hidden">
          AbsenGo Corporate · Sistem presensi dan penggajian harian
        </footer>
      </main>
    </div>
  );
}
