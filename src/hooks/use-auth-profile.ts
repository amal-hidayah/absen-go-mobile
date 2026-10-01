import { useQuery } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Employee } from "@/lib/presensi";

export interface AuthProfileResult {
  user: User | null;
  employee: Employee | null;
  /** Akun ini punya akun login yang aktif */
  isRegistered: boolean;
  isAdmin: boolean;
  isEmployee: boolean;
  role: "admin" | "employee";
  username: string | null;
}

const KOSONG: AuthProfileResult = {
  user: null,
  employee: null,
  isRegistered: false,
  isAdmin: false,
  isEmployee: false,
  role: "employee",
  username: null,
};

export function useAuthProfile() {
  return useQuery<AuthProfileResult>({
    queryKey: ["auth_profile_current"],
    queryFn: async () => {
      const { data: auth, error } = await supabase.auth.getUser();
      if (error || !auth.user) return KOSONG;

      // Sumber kebenaran role: tabel login_accounts (diisi oleh trigger saat
      // akun dibuat di Supabase Auth, atau oleh Edge Function dari panel admin).
      const { data: akun } = await supabase
        .from("login_accounts")
        .select("role, active, username, employee_id")
        .eq("user_id", auth.user.id)
        .maybeSingle();

      if (!akun || !akun.active) return { ...KOSONG, user: auth.user };

      // Data karyawan (hanya untuk akun role employee)
      let employee: Employee | null = null;
      if (akun.employee_id) {
        const { data: emp } = await supabase
          .from("employees")
          .select("*")
          .eq("id", akun.employee_id)
          .maybeSingle();
        employee = (emp as Employee | undefined) ?? null;
      }

      const isAdmin = akun.role === "admin";

      return {
        user: auth.user,
        employee,
        isRegistered: true,
        isAdmin,
        isEmployee: !isAdmin && employee !== null,
        role: isAdmin ? ("admin" as const) : ("employee" as const),
        username: akun.username,
      };
    },
    staleTime: 1000 * 60 * 5, // Cache 5 menit
  });
}
