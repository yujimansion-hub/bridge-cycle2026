// 承継OS「GATE」 — 情報開示料 決済用 Checkout Session 作成
// Supabase Edge Function（Deno）。デプロイ: supabase functions deploy create-checkout
// 必要な secret: STRIPE_SECRET_KEY（Supabaseが SUPABASE_URL / SUPABASE_ANON_KEY を自動注入）
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FEE_JPY = 10000; // 情報開示料（税抜・非返金／成立時充当）

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
    // 呼び出し元ぎ authorization レグイン済みのみ許可）
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return json({ error: "認証が必要です" }, 401);
    }

    const { case_id, success_url, cancel_url } = await req.json();
    if (!case_id) return json({ error: "case_id がありません" }, 400);

    // ケースの存在確認（RLSは呼び出し元開暡で評価）
    const { data: kase, error: cErr } = await supabase
      .from("cases").select("id, stage").eq("id", case_id).maybeSingle();
    if (cErr || !kase) return json({ error: "対象ケースが見つかりません" }, 404);

    const base = (success_url ?? "").split("?")[0];
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "jpy",
          unit_amount: FEE_JPY,
          product_data: { name: "情報開示料（承継OS GATE）", description: "詳細開示のための情報アクセス料。" },
        },
      }],
      metadata: { case_id },
      success_url: `${base}?paid=${case_id}`,
      cancel_url: cancel_url ?? base,
    });

    return json({ url: session.url });
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
