# 承継OS「GATE」 一枚もの セットアップ・ランブック

所要 約20–30分。**★=あなたの手が必要（アカウント作成・キー入力）**／それ以外はコピペで進みます。

---

## A. Supabase（共有DB・ログイン）— 必須
1. ★ <https://supabase.com> でアカウント作成 → **New project**（Region: Tokyo）。プロジェクトのパスワードは控える。
2. **SQL Editor** を開き、`supabase/all-in-one.sql` の中身を**丸ごと貼り付けて Run**（テーブル・RLS・関数・決済・店名保護・通知トリガが一括作成）。
3. **Authentication → Providers → Email** をON。**Users → Add user** で自分のメール＋パスワードを作成（Auto Confirmにチェック）。
4. SQL Editorで自分を運営に：
   ```sql
   update profiles set role='admin' where email='あなたのメール';
   ```
5. ★ **Settings → API** から **Project URL** と **anon public key** を控える。
6. `gate-os/index.html` を開き、上部バーにURLとanon keyを貼って「接続して本番モードへ」→ログイン。**これだけで登録・マッチング・段階開示は本番稼働**。

> ここまでで「決済・eKYC・通知・招待」以外はすべて動きます。以降は使う機能だけ設定すればOK。

---

## B. Edge Function 共通準備（決済/eKYC/通知/招待を使う場合）
```bash
npm i -g supabase
supabase login                 # ★ ブラウザで認証
supabase link --project-ref <あなたのproject-ref>   # URLの xxxx 部分
```

## C. 決済＋eKYC（Stripe）
1. <https://stripe.com> で登録（最初はテストモードでOK）。
2. **開発者 → APIキー** から **シークレットキー**（`sk_test_...`）を控える。

## F. 公開（任意）

`gate-os/` を GitHub に掩き、**Settings → Pages** で公開すると、全国の支援者がURLからログインしてしつ use してしつ同時に使えます。
