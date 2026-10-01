// Supabase Edge Function: manage-employee-account
//
// Dipanggil dari Panel Admin > Data Karyawan untuk:
//   action = "create"          -> buat akun Supabase Auth + baris employees
//                                  + baris login_accounts sekaligus
//   action = "reset_password"  -> ganti kata sandi karyawan
//   action = "delete"          -> hapus akun Auth + data karyawan
//
// Hanya admin yang boleh memanggil fungsi ini.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Method": "POST, OPTIONS",
};

type Json = Record<string, unknown>;

function json(body: Json, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function pesan(error: { message: string; code?: string }): string {
  const msg = error.message || "Terjadi kesalahan";
  if (msg.includes("duplicate key")) return "Username atau NIK sudah dipakai.";
  if (msg.includes("already registered") || msg.includes("already been registered")) {
    return "Email tersebut sudah punya akun login. Gunakan email lain.";
  }
  if (msg.includes("Password should be")) return "Kata sandi minimal 6 karakter.";
  if (msg.includes("email address")) return "Format email tidak valid.";
  return msg;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return json({ error: "Tidak terautentikasi." }, 401);

    // 1) Pastikan pemanggil adalah admin
    const caller = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userErr } = await caller.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Sesi tidak valid. Masuk ulang." }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: akun } = await admin
      .from("login_accounts")
      .select("role, active")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (!akun || akun.role !== "admin" || !akun.active) {
      return json({ error: "Hanya admin yang boleh menambah atau mengubah akun karyawan." }, 403);
    }

    const body = (await req.json()) as Json;
    const action = String(body.action ?? "");

    // ---------------------------------------------------------------------
    // CREATE: buat akun Auth + karyawan + akun login
    // ---------------------------------------------------------------------
    if (action === "create") {
      const username = String(body.username ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      const email = String(body.email ?? "").trim().toLowerCase();
      const nik = String(body.nik ?? "").trim().toUpperCase();
      const fullName = String(body.full_name ?? "").trim();
      const department = String(body.department ?? "Operasional").trim();
      const position = String(body.position ?? "Staff").trim();
      const dailySalary = Number(body.daily_salary ?? 0);

      if (!username || !email || !nik || !fullName) {
        return json({ error: "Username, email, NIK, dan nama lengkap wajib diisi." }, 400);
      }
      if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
        return json(
          { error: "Username hanya boleh huruf, angka, titik, garis, atau strip (3-32 karakter)." },
          400,
        );
      }
      if (password.length < 6) {
        return json({ error: "Kata sandi minimal 6 karakter." }, 400);
      }
      if (!dailySalary || dailySalary < 0) {
        return json({ error: "Tarif gaji harian tidak valid." }, 400);
      }

      const { data: usernameBentrok } = await admin
        .from("login_accounts")
        .select("id")
        .eq("username", username)
        .maybeSingle();
      if (usernameBentrok) return json({ error: `Username "${username}" sudah dipakai.` }, 409);

      const { data: nikBentrok } = await admin
        .from("employees")
        .select("id")
        .eq("nik", nik)
        .maybeSingle();
      if (nikBentrok) return json({ error: `NIK "${nik}" sudah terdaftar.` }, 409);

      // a) Buat akun Supabase Auth. Trigger database akan membuat baris
      //    login_accounts dengan role 'admin'; di bawah kita turunkan jadi employee.
      const { data: dibuat, error: authErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (authErr || !dibuat?.user) {
        return json({ error: pesan(authErr ?? { message: "Gagal membuat akun login." }) }, 400);
      }

      const userId = dibuat.user.id;

      // b) Baris data karyawan
      const { data: karyawan, error: empErr } = await admin
        .from("employees")
        .insert({
          user_id: userId,
          nik,
          full_name: fullName,
          email,
          department,
          position,
          daily_salary: dailySalary,
          role: "employee",
          active: true,
        })
        .select("id")
        .single();

      if (empErr || !karyawan) {
        // Batalkan semuanya supaya tidak ada akun yatim
        await admin.auth.admin.deleteUser(userId);
        return json({ error: pesan(empErr ?? { message: "Gagal menyimpan data karyawan." }) }, 400);
      }

      // c) Jadikan akun login sebagai karyawan dengan username pilihan admin
      const { error: akunErr } = await admin
        .from("login_accounts")
        .update({
          username,
          role: "employee",
          employee_id: karyawan.id,
          active: true,
        })
        .eq("user_id", userId);

      if (akunErr) {
        await admin.from("employees").delete().eq("id", karyawan.id);
        await admin.auth.admin.deleteUser(userId);
        return json({ error: pesan(akunErr) }, 400);
      }

      return json({ ok: true, employee_id: karyawan.id, username });
    }

    // ---------------------------------------------------------------------
    // RESET PASSWORD
    // ---------------------------------------------------------------------
    if (action === "reset_password") {
      const password = String(body.password ?? "");
      if (password.length < 6) return json({ error: "Kata sandi minimal 6 karakter." }, 400);

      const employeeId = String(body.employee_id ?? "");
      const { data: target } = await admin
        .from("login_accounts")
        .select("user_id, username")
        .eq("employee_id", employeeId)
        .maybeSingle();

      if (!target?.user_id) {
        return json({ error: "Karyawan ini belum punya akun login." }, 404);
      }

      const { error: upErr } = await admin.auth.admin.updateUserById(target.user_id, { password });
      if (upErr) return json({ error: pesan(upErr) }, 400);

      return json({ ok: true, username: target.username });
    }

    // ---------------------------------------------------------------------
    // SET_ACTIVE: aktif/nonaktifkan akun login karyawan
    // ---------------------------------------------------------------------
    if (action === "set_active") {
      const employeeId = String(body.employee_id ?? "");
      const active = Boolean(body.active);

      await admin.from("employees").update({ active }).eq("id", employeeId);

      const { error: upErr } = await admin
        .from("login_accounts")
        .update({ active })
        .eq("employee_id", employeeId);
      if (upErr) return json({ error: pesan(upErr) }, 400);

      return json({ ok: true });
    }

    // ---------------------------------------------------------------------
    // DELETE: hapus akun Auth + data karyawan (presensi ikut terhapus)
    // ---------------------------------------------------------------------
    if (action === "delete") {
      const employeeId = String(body.employee_id ?? "");
      const { data: target } = await admin
        .from("login_accounts")
        .select("user_id, username")
        .eq("employee_id", employeeId)
        .maybeSingle();

      const { error: delErr } = await admin.from("employees").delete().eq("id", employeeId);
      if (delErr) return json({ error: pesan(delErr) }, 400);

      if (target?.user_id) {
        await admin.auth.admin.deleteUser(target.user_id);
      }

      return json({ ok: true });
    }

    return json({ error: `Aksi "${action}" tidak dikenal.` }, 400);
  } catch (err) {
    return json({ error: `Kesalahan server: ${(err as Error).message}` }, 500);
  }
});