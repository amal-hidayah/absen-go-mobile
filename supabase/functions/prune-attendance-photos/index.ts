import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Missing env variables" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Cari evidence yang memiliki foto dan berusia lebih dari 90 hari
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);

    const { data: evidences, error: fetchErr } = await supabase
      .from("attendance_evidence")
      .select("id, photo_path")
      .not("photo_path", "is", null)
      .lt("captured_at", cutoffDate.toISOString())
      .limit(200);

    if (fetchErr) {
      throw fetchErr;
    }

    if (!evidences || evidences.length === 0) {
      return new Response(
        JSON.stringify({ message: "No expired photos found to prune.", prunedCount: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pathsToRemove = evidences
      .map((e) => e.photo_path)
      .filter((p): p is string => Boolean(p));

    // Hapus dari Storage API
    const { error: storageErr } = await supabase.storage
      .from("attendance-photos")
      .remove(pathsToRemove);

    if (storageErr) {
      console.error("Storage delete warning:", storageErr);
    }

    // Kosongkan photo_path pada database agar baris evidence tetap utuh untuk riwayat jarak & jam
    const ids = evidences.map((e) => e.id);
    const { error: updateErr } = await supabase
      .from("attendance_evidence")
      .update({ photo_path: null })
      .in("id", ids);

    if (updateErr) {
      throw updateErr;
    }

    return new Response(
      JSON.stringify({
        success: true,
        prunedCount: ids.length,
        message: `Successfully pruned ${ids.length} photo(s) older than 90 days.`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
