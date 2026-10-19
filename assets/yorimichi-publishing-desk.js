(function () {
  'use strict';
  var root = document.getElementById('publishingDesk');
  if (!root) return;
  var config = null, data = null;
  function el(tag, text, className) { var n = document.createElement(tag); if (text) n.textContent = text; if (className) n.className = className; return n; }
  function render() {
    if (!config || !data) return;
    var plan = YorimichiPublishing.build(data, config), box = document.getElementById('publishingPosts');
    document.getElementById('publishingState').textContent = plan.status === 'held' ? '承認・接続を待っている投稿プラン' : '予約投稿の候補を確認できます';
    document.getElementById('publishingReasons').textContent = plan.reasons.join(' ／ ') || '配信前に接続先・重複・最新の開催状態を再確認します。';
    document.getElementById('publishingJson').value = JSON.stringify(plan, null, 2);
    box.replaceChildren();
    plan.posts.forEach(function (p) {
      var card = el('article', '', 'publishing-post');
      card.appendChild(el('p', (p.channel === 'threads' ? 'Threads' : 'Instagram') + ' · ' + p.title, 'publishing-label'));
      card.appendChild(el('p', p.rule, 'publishing-rule'));
      var textarea = el('textarea'); textarea.value = p.text; textarea.readOnly = true; textarea.rows = 8; textarea.setAttribute('aria-label', p.title + ' ' + p.channel + 'の投稿文'); card.appendChild(textarea);
      var row = el('div', '', 'publishing-actions'), copy = el('button', '投稿文をコピー', 'btn btn-line btn-sm'); copy.type = 'button';
      copy.addEventListener('click', function () {
        if (!navigator.clipboard || !navigator.clipboard.writeText) { textarea.focus(); textarea.select(); copy.textContent = '投稿文を選択しました'; return; }
        navigator.clipboard.writeText(p.text).then(function () { copy.textContent = 'コピーしました'; }).catch(function () { textarea.focus(); textarea.select(); copy.textContent = '投稿文を選択しました'; });
      });
      var image = el('a', '添付画像を確認', 'publishing-image'); image.href = p.mediaUrl; image.target = '_blank'; image.rel = 'noopener';
      row.append(copy, image); card.appendChild(row);
      var state = p.reasons.length ? p.reasons[0] : p.outsideSchedulingWindow ? '予約は公開24時間前から' : '配信前の確認対象';
      card.appendChild(el('p', state + '｜ID: ' + p.id, 'publishing-post-state'));
      box.appendChild(card);
    });
    if (!plan.posts.length) box.appendChild(el('p', '現在の開催情報に合う投稿候補はありません。日時・価格・中止情報を確認してから次の投稿を用意します。'));
    document.getElementById('publishingEmpty').textContent = '投票30件以上で途中経過を追加。開催日時が確定したら開催案内と前日案内を追加。商品の紹介は写真・税込価格・SNS掲載の了承がそろってから追加します。';
    root.setAttribute('aria-busy', 'false');
  }
  window.addEventListener('yorimichi:public-data', function (e) { data = e.detail; render(); });
  window.addEventListener('yorimichi:public-data-error', function () { data = {ok:false}; render(); });
  fetch('yorimichi-publishing.json', {cache:'no-store'}).then(function (r) { if (!r.ok) throw Error('config'); return r.json(); }).then(function (c) { config = c; render(); }).catch(function () {
    document.getElementById('publishingState').textContent = '投稿設定を取得できませんでした';
    document.getElementById('publishingReasons').textContent = '自動投稿は停止した状態として扱います。再読み込みして確認してください。'; root.setAttribute('aria-busy', 'false');
  });
}());
