// 承継OS「GATE」 — 支援者の招待（運営=admin のみ）
// Supabase Edge Function（Deno）。デプロイ: supabase functions deploy invite-supporter
-// 運営が読かな刊自の信動を招待
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const caller = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: u } = await caller.auth.getUser();
    if (!u?.user) return json({ error: "認証が必要です" }, 401);
    const { data: prof } = await caller.from("profiles").select("role").eq("id", u.user.id).maybeSingle();
    if (!prof || prof.role !== "admin") return json({ error: "admin only" }, 403);

    const { email, full_name, org, pref, redirect_to } = await req.json();
    if (!email) return json({ error: "email required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: inv, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: redirect_to,
      data: { full_name },
    });
    if (error) return json({ error: error.message }, 400);

    await admin.from("profiles").update({
      role: "supporter", full_name: full_name ?? "", org: org ?? "", pref: pref ?? "",
    }).eq("id", inv.user.id);

    return json({ ok: true, user_id: inv.user.id });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });
}
