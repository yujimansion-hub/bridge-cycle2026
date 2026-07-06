// 承継OS「GATE」 — eKYC本人確認（Stripe Identity）VerificationSession 作成
// Supabase Edge Function（Deno）。デプロイ: supabase functions deploy create-verification
// 必要な secret: STRIPE_SECRET_KEY（既存）。Stripe Identity を有効化しておくこと。
// S0（打診）の本人確認ゲート。確認完了は webhook（identity.verification_session.verified）で cases.kyc=true。
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return json({ error: "認証が必要です" }, 401);

    const { case_id, return_url } = await req.json();
    if (!case_id) return json({ error: "case_id がありません" }, 400);

    const { data: kase } = await supabase.from("cases").select("id").eq("id", case_id).maybeSingle();
    if (!kase) return json({ error: "対象ケースが見つかりません" }, 404);

    const base = (return_url ?? "").split("?")[0];
    const vs = await stripe.identity.verificationSessions.create({
      type: "document",
      metadata: { case_id },
      return_url: `${base}?verified=${case_id}`,
    });
    return json({ url: vs.url });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });
}
