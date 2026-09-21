# わたしの商い設計 API セットアップ

## 目的
GitHub Pages側では「支払い済み」を判定しません。Cloudflare WorkerがStripe Checkout Sessionを作成し、決済後にStripe APIへ payment_status=paid を照会します。

購入前にブラウザで生成した client_reference_id をCheckout Sessionへ保存し、決済後も同じブラウザの値と一致した場合だけ、30日有効の署名トークンを発行します。固定受付コード、?paid=1、localStorageの真偽値だけでは解錠しません。

## 1. KVを作成
```bash
cd worker
npx wrangler kv namespace create AKINAI_KV
```
発行されたnamespace IDを `wrangler.toml` の `REPLACE_WITH_KV_NAMESPACE_ID` と置き換えます。

## 2. Stripe Price ID
Stripeの商品「わたしの商い設計 3,300円」に紐づく Price ID（`price_...`）を `wrangler.toml` の `STRIPE_PRICE_ID` に設定します。

## 3. Secretを登録
```bash
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put TOKEN_SECRET
```
TOKEN_SECRET は十分長いランダム文字列にしてください。秘密値はGitHubへコミットしません。

## 4. Workerをデプロイ
```bash
npx wrangler deploy
```

## 5. 公開設定
発行されたWorker URL（例: `https://akinai-api.<account>.workers.dev`）を、リポジトリ直下の `akinai-config.js` に1か所だけ設定します。

```js
window.AKINAI_API_BASE = "https://akinai-api.<account>.workers.dev";
```

## 6. 決済フロー
`akinai.html` → Worker `/checkout` → Stripe Checkout → `akinai-plan.html?session_id={CHECKOUT_SESSION_ID}` → Worker `/verify` の順です。

Worker側が成功URLと client_reference_id を設定するため、Stripe Payment Linkの戻りURL設定は不要です。旧Payment Linkは、この商品については使いません。

## 7. AI生成
WorkerはOpenAI Responses APIを利用します。APIキーはWorker Secretにのみ保存し、HTML/JavaScriptには置きません。モデルは `wrangler.toml` の `OPENAI_MODEL` で変更できます。

生成時は「やりたくないこと」を禁止条件として扱い、時間・自己資金・家族・地域・デジタル環境を制約にして、A/B/Cを別のビジネスモデルとして生成します。

## 8. 利用回数と結果保存
KV設定時は、購入1件につき最大5回まで生成できます。生成結果はランダムな結果IDで30日保存し、`akinai-plan.html?result=<ID>` から再表示できます。
