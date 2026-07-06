// 承継OS「GATE」 — Stripe Webhook（決済確定・本人確認完了を進める）
// Supabase Edge Function（Deno）。デプロイ: supabase functions deploy stripe-webhook --no-verify-jwt
// Required secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Events: checkout.session.completed => fee_disclosure=true, S1/S3 gate
//         identity.verification_session.verified => kyc=true, S0 gate
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});
const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body, sig!, Deno.env.get("STRIPE_WEBHOOK_SECRET")!,
      undefined, Stripe.createSubtleCryptoProvider(),
    );
  } catch (e) {
    return new Response(`Bad signature: ${(e as Error).message}`, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const s = event.data.object as Stripe.Checkout.Session;
      const caseId = s.metadata?.case_id;
      if (caseId) {
        await admin.from("cases").update({
          fee_disclosure: true,
          fee_paid_at: new Date().toISOString(),
          stripe_session_id: s.id,
        }).eq("id", caseId);
        await admin.from("payments").upsert({
          case_id: caseId, stripe_session_id: s.id, amount: s.amount_total,
          status: "paid", paid_at: new Date().toISOString(),
        }, { onConflict: "stripe_session_id" });
        await admin.from("events").insert({
          action: "fee_paid", entity: "cases", entity_id: caseId,
          meta: { session: s.id, amount: s.amount_total },
        });
      }
    } else if (event.type === "identity.verification_session.verified") {
      const vs = event.data.object as Stripe.Identity.VerificationSession;
      const caseId = vs.metadata?.case_id;
      if (caseId) {
        await admin.from("cases").update({ kyc: true }).eq("id", caseId);
        await admin.from("events").insert({
          action: "kyc_verified", entity: "cases", entity_id: caseId,
          meta: { verification_session: vs.id },
        });
      }
    }
  } catch (e) {
    return new Response(`Handler error: ${(e as Error).message}`, { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
});
