import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { QrCode, ScanLine, Users, BarChart3, Settings, LogOut, Menu, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { to: "/scan", label: "Scan QR", icon: ScanLine },
  { to: "/siswa", label: "Data Siswa", icon: Users },
  { to: "/rekap", label: "Rekap", icon: BarChart3 },
  { to: "/pengaturan", label: "Pengaturan", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  async function keluar() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background md:flex">
      <aside
        className={cn(
          "z-40 flex w-full shrink-0 flex-col border-b bg-sidebar px-4 py-4 md:h-screen md:w-64 md:border-r md:border-b-0 md:py-6",
          "md:sticky md:top-0",
        )}
      >
        <div className="flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2">
            <img src="/logo.webp" alt="Logo" className="h-12 w-auto object-contain" />
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

        <nav className={cn("mt-5 flex-1 flex-col gap-1", open ? "flex" : "hidden md:flex")}>
          {nav.map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <Button
          variant="ghost"
          onClick={keluar}
          className={cn("justify-start gap-3 text-muted-foreground", open ? "flex" : "hidden md:flex")}
        >
          <LogOut className="size-4" /> Keluar
        </Button>
      </aside>

      <main className="min-w-0 flex-1 px-5 py-6 flex flex-col md:px-8 md:py-8">
        <div className="flex-1">
          {children}
        </div>
        <footer className="mt-auto border-t pt-8 mt-12 pb-2 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground print:hidden">
          <div className="flex items-center gap-2">
            <span>Dibuat oleh</span>
            <img src="/kardigi.png" alt="Kardigi" className="h-5 w-auto object-contain" />
          </div>
        </footer>
      </main>
    </div>
  );
}
