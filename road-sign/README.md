# 京滋ロードサイン・ネットワーク

BRIDGE CYCLE株式会社の屋外看板マッチングLP（広告主向け・看板会社向け）。

- index.html：広告主向け
- partner.html：看板会社向け
- config.js：フォーム送信先（FormSubmit → info@bridgecycleco.com）。Formspreeに切り替える場合は formEndpoint を変更
- app.js：媒体の広告料試算（紹介料率は表示しない）、フォーム送信、計測
- styles.css：レイアウト
- assets/：写真はAI生成の写真調イメージと、それに架空の広告面を合成したもの。実在の媒体・広告主ではない。最初の提携成立後、看板会社の許可を得て実在媒体の写真に差し替える

個人情報の取扱いはサイト共通の /privacy.html（京滋ロードサインの利用目的・第三者提供を記載）。計測はサイト共通の /bc-analytics.js（グループ「ロードサイン」）。

## 空き看板の一覧（akiban.html）

- 掲載データは `data/boards.json` の1ファイルだけ。書き方は `data/boards.example.json` を参照。
- 看板会社が partner.html の登録フォームで「サイトへの掲載」を承諾した媒体だけを入れる。`publish_scope` は `full`（写真・場所・地図・料金）か `area_price`（エリアと料金のみ）。「掲載しない」の媒体は入れない（入れても表示されない）。
- 2026-10-17に公開済み（`min_public` を0にして導線を常に表示）。掲載媒体が0面のあいだは akiban.html に「準備中」と、探してもらう依頼・看板会社の登録への導線を表示する。導線を隠したいときは `min_public` を5などに戻す。
- 写真は `assets/boards/` に置き、看板会社の許可を得た実物写真だけを使う。最終確認日から30日を過ぎると画面上は「要再確認」と表示される。
