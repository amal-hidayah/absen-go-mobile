import { supabase } from "@/integrations/supabase/client";

export interface HasilKelolaAkun {
  ok: boolean;
  error?: string;
  username?: string;
  employee_id?: string;
}

/**
 * Memanggil Edge Function "manage-employee-account".
 * Diambil alih di sini supaya penanganan error konsisten di semua halaman.
 */
export async function kelolaAkunKaryawan(
  payload: Record<string, unknown>,
): Promise<HasilKelolaAkun> {
  const { data, error } = await supabase.functions.invoke("manage-employee-account", {
    body: payload,
  });

  if (!error) {
    return { ok: true, ...((data ?? {}) as Partial<HasilKelolaAkun>) };
  }

  // Fungsi mengembalikan error lewat HTTP status non-2xx (FunctionsHttpError).
  let message = error.message;
  let status = 0;
  const context = (error as { context?: Response }).context;
  if (context) {
    status = context.status ?? 0;
    if (typeof context.json === "function") {
      try {
        const parsed = (await context.json()) as { error?: string; message?: string };
        if (parsed?.error) message = parsed.error;
        else if (parsed?.message) message = parsed.message;
      } catch {
        // body bukan JSON, abaikan
      }
    }
  }

  // Fungsi belum dipublish di Supabase = penyebab paling umum kegagalan.
  if (status === 404 || error.name === "FunctionsFetchError") {
    return {
      ok: false,
      error:
        "Edge Function 'manage-employee-account' belum ada di Supabase. " +
        "Deploy dulu: Supabase Dashboard → Edge Functions → Deploy new function → " +
        "nama 'manage-employee-account' → paste isi file supabase/functions/manage-employee-account/index.ts.",
    };
  }

  return { ok: false, error: message };
}
