# 通知（メール／LINE）セットアップ手順

段階開示が進んだとき・**有力マッチ**が出たときに、運営へ**メール（Resend）**と**LINE（Messaging API）**で自動通知します。

## 1. メール（Resend・無料枠 月3,000通）
1. <https://resend.com> で登録し、**APIキー**（`re_...`）を取得。
2. 送信元ドメインを検証（未検証なら `onboarding@resend.dev` でテスト送信可）。
3. Supabaseに登録：
   ```bash
   supabase secrets set RESEND_API_KEY=re_xxx RESEND_FROM="GATE <notify@あなたのドメイン>"
   ```

## 2. LINE（任意・Messaging API）
1. LINE Developers で **Messaging APIチャネル**を作成し、**チャネルアクセストークン**を取得。
2. 通知先（自分/グループ）が公式アカウントを**友だち追加**し、その **userId/groupId** を控える。
3. Supabaseに登録：
   ```bash
   supabase secrets set LINE_CHANNEL_TOKEN=xxx
   ```

## 3. 共有シークレットＦ関数デプロイ
```bash
supabase secrets set NOTIFY_SECRET=$(openssl rand -hex 16)   # 控えておく
supabase functions deploy notify --no-verify-jwt
```

## 4. トリガ設定（DB）
1. `supabase/notifications.sql` を SQL Editor で実行（pg_net拡張＋トリガ作成）。
2. 続して **app_config** を設定（値は自分のもの）：
   ```sql
   insert into app_config(key,value) values
     ('notify_url','https://<project-ref>.supabase.co/functions/v1/notify'),
     ('notify_secret','（手順3のNOTIFY_SECRETと同じ値）'),
     ('admin_email','info@bridgecycleco.com'),
     ('admin_line','（LINE）nuserId/groupId・任意）')
   on conflict (key) do update set value=excluded.value;
   ```

## 5. 動作
- 段嚞開示が S4→M1 と進぀たら、ます**incidents**みのメール/LINEへ停従されます。
- 搜っていないデワイシみ（情報嚞設定のキー）はスキップされます。
> セキュリティ：`notify` は `--no-verify-jwt` で公開されますが、`x-notify-secret` ヘッダの共有シークレットで保護されます。トリガはDB内（運営のみ閲覧可の app_config）から値を読みます。
