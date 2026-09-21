# わたしの商い設計 API セットアップ

## 目的
GitHub Pages側では「支払い済み」を判定せず、Cloudflare WorkerがStripe Checkout Sessionを照会して payment_status=paid を確認します。
購入時にブラウザで生成した client_reference_id とStripe Sessionの client_reference_id が一致した場合だけ、30日有効の署名トークンを返します。
固定受付コード、?paid=1、localStorageの真偽値だけでは解錠しません。

## 1. Cloudflare Worker
```bash
cd worker
npx wrangler kv namespace create AKINAI_KV
# wrangler.toml の id を発行されたIDへ置換
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put TOKEN_SECRET
npx wrangler deploy
```

TOKEN_SECRET は十分長いランダム文字列にしてください。

## 2. Worker URL
デプロイ後のURL（例: https://akinai-api.<account>.workers.dev）を
`akinai-plan.html` の `API_BASE` に設定します。

## 3. Stripe Payment Link の完了後URL
Stripe DashboardでPayment Linkの支払い完了後リダイレクトを次に変更します。

```
https://yujimansion-hub.github.io/bridge-cycle2026/akinai-plan.html?session_id={CHECKOUT_SESSION_ID}
```

Payment Linkへ遷移するとき、akinai.html は client_reference_id を付加します。
WorkerはStripe Sessionに記録された client_reference_id と、購入ブラウザの localStorage にある値を照合します。
そのため、支払い完了URLだけを友人へ共有しても利用できません。

## 4. OpenAI
Workerは Responses API を利用します。APIキーはWorker Secretにのみ保存し、HTML/JavaScriptへ絶対に埋め込みません。
既定モデルは wrangler.toml の OPENAI_MODEL で変更できます。

## 5. KV
AKINAI_KV を設定すると購入1件につき最大5回まで生成し、結果を30日保存します。
