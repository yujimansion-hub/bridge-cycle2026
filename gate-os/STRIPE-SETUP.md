# 情報開示料の決済（Stripe）セットアップ手順

承継OS「GATE」の段階開示 **S1→S2** ゲート（情報開示料 ¥10,000・非返金／成立時充当）を、
Stripe の安全な決済ページで受け取る設定です。秘密鍵はフロントに置かず、**Supabase Edge Function**（無料枠）で処理します。

処理の流れ：
`画面の[¥10,000を決済]` → `create-checkout（Session作成）` → `Stripe決済ページ` → `webhook（署名検証）` → `cases.fee_disclosure=true`（S2へ）

---

## 0. 前提
- `supabase/schema.sql` と `supabase/payments.sql` を Supabase の SQL Editor で実行済みであること。
- Supabase CLI を使います：`npm i -g supabase`（または <https://supabase.com/docs/guides/cli> 参照）。

## 1. Stripe アカウントと APIキー
1. <https://stripe.com> で登録（最初はテストモードでOK）。
2. **開発者 → APIキー** から **シークレットキー**（`sk_test_...`）を控える。

## 2. Supabase にログイン＆リンク
```bash
supabase login
supabase link --project-ref <あなたのproject-ref>   # SupabaseのProject URLの xxxx 部分
```

## 3. シークレット（秘密鍵）を Supabase に登録
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_xxxxxxxx
# STRIPE_WEBHOOL_SECRET は 手順5でWebhook作成後に設定します
```
> `SUPABASE_URL` `SUPABASE_ANON_KEY` `SUPABASE_SERVICE_ROLE_KEY` は Edge Function に自動で入るので設定不要です。

## 4. Edge Function をデプロイ
```bash
supabase functions deploy create-checkout
supabase functions deploy stripe-webhook --no-verify-jwt   # WebhookはStripeが叩くのでJWT検証を外す
```
- `create-checkout` のURL：`https://<ref>.supabase.co/functions/v1/create-checkout`
- `stripe-webhook` のURL：`https://<ref>.supabase.co/functions/v1/stripe-webhook`

## 5. Stripe に Webhook を登録
1. Stripe **開発者 → Webhook → エンドポイントを追加**。
2. **エンドポイントURL** に上記 `stripe-webhook` のURLを入力。
3. **リッスンするイベント**：`checkout.session.completed` を選択。
4. 作成後に表示される **署名シークレット**（`whsec_...`）を控え、Supabaseへ登録：
```bash
supabase secrets set STRIPE_WEBHOOL_SECRET=whsec_xxxxxxxx
supabase functions deploy stripe-webhook --no-verify-jwt   # secret反映のため再デプロイ
```

## 6. 動作テスト（テストモード）
1. `index.html` 上部の接続バーに Supabase の **URL** と **anon key** を入れ、本番モードでログイン。
2. ①で店主・継ぎ手を登録 →②マッチング→有力ペアを「S0へ」→③段階開示でS0のゲート（eKYC・守秘）にチェック→S1へ。
3. S1で **[¥10,000を決済する]** → Stripe決済ページで **テストカード `4242 4242 4242 4242`（有効期限は未来・CVC任意）** を入力。
4. 決済完了 → 画面に戻り「決済完了」。**cases.fee_disclosure が true** になり、**S2（詳細開示）** に進められます。
   - 確認：Supabase の Table Editor で `payments`（status=paid）と `cases.fee_paid_at` を確認。

## 7. 本番切替
- Stripe を **本番モード** にして本番の `sk_live_...` と 本番Webhookの `whsec_...` を `supabase secrets set` で差し替え、`stripe-webhook` を再デプロイ。
- 決済ページ・利用規約に「**情報開示料は非返金／成立時は仲介成功報酬へ充当**」を明記（既に商品説明に記載済み）。

---

### 補足
- 金額は `create-checkout/index.ts` の `FEE_JPY = 10000`。JPYは最小単位＝円（10000 = ¥10,000）。
- 返金・領収書・請求書はStripeダッシュボードから発行可能。
- 冪等性：`payments.stripe_session_id` を unique にしており、Webhook二重着信でも重複記録しません。

---

## 8. eKYC 本人確認（Stripe Identity）— S0ゲート

情報開示料と同じStripeアカウントで、**本人確認（公的身分証＋顔照合）**を行います。

1. **Identityを有効化**：Stripe ダッシュボード → **Identity** を開き、利用を開始（本番前に本人確認情報の設定が必要な場合あり）。
2. **関数デプロイ**：
   ```bash
   supabase functions deploy create-verification
   ```
3. **Webhookイベントを追加**：手順5で作成したエンドポイントに、イベント **`identity.verification_session.verified`** を追加（`checkout.session.completed` と併せて2種）。`stripe-webhook` は両方を処理します。
4. **動作**：段階開示 **S0** の「本人確認をする（eKYC）」→ Stripeの本人確認ページ→完了で戻ると、**cases.kyc が true**。守秘同意(nda)にチェックすればS1（打診）へ進めます。
   - テストモードでは Stripe の指示に従いテスト用書類で確認できます。
- 料金の目安：Identityは1回あたり数百円程度（Stripeの料金体系による）。
