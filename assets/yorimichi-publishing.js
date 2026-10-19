/* Public posting plan only. This file never calls a social network or stores a credential. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.YorimichiPublishing = api;
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  var PAGE = 'https://www.bridgecycleco.com/minakusa-yorimichi.html';
  var IMAGE = 'https://www.bridgecycleco.com/images/minakusa/yorimichi/share/index.png';
  var DAY = 86400000, JST = 9 * 3600000;
  function str(v, n) { return String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n || 160); }
  function date(v) {
    if (typeof v !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{3})?)?(?:Z|\+09:00)$/.test(v)) return null;
    var d = new Date(v); return isNaN(d.getTime()) ? null : d;
  }
  function jstDay(d) { var x = new Date(d.getTime() + JST); return Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()) - JST; }
  function dayKey(d) { return new Date(d.getTime() + JST).toISOString().slice(0, 10); }
  function hash(s) { var n = 2166136261; for (var i = 0; i < s.length; i++) { n ^= s.charCodeAt(i); n = Math.imul(n, 16777619); } return (n >>> 0).toString(36); }
  function shopKey(s) { return hash(str(s.shop) + '|' + str(s.item)); }
  function link(channel, campaign, anchor) { return PAGE + '?src=' + channel + '&utm_source=' + channel + '&utm_medium=social&utm_campaign=yorimichi_' + campaign + (anchor || ''); }
  function slot(after, channel, cfg) {
    var p = cfg.policy && cfg.policy[channel];
    if (!p || !Array.isArray(p.weekdays) || !p.weekdays.length || p.weekdays.some(function (x) { return !Number.isInteger(x) || x < 0 || x > 6; }) || !Number.isInteger(p.hour) || p.hour < 0 || p.hour > 23 || !Number.isInteger(p.minute) || p.minute < 0 || p.minute > 59) return null;
    for (var i = 0; i < 8; i++) {
      var t = jstDay(after) + i * DAY + p.hour * 3600000 + p.minute * 60000;
      if (t >= after.getTime() && p.weekdays.indexOf(new Date(t + JST).getUTCDay()) >= 0) return new Date(t);
    }
    return null;
  }
  function eventDay(e) {
    if (!e || !/^\d{8}$/.test(String(e.key || '')) || !str(e.date) || !str(e.time) || !str(e.place)) return null;
    var k = String(e.key), d = new Date(k.slice(0, 4) + '-' + k.slice(4, 6) + '-' + k.slice(6, 8) + 'T00:00:00+09:00');
    return !isNaN(d.getTime()) && dayKey(d).replace(/-/g, '') === k ? d : null;
  }
  function gate(cfg, now) {
    var reasons = [];
    if (!cfg || cfg.schemaVersion !== 1) reasons.push('投稿設定を確認できません');
    cfg = cfg || {};
    var approved = cfg.approval && cfg.approval.status === 'approved', approvalAt = date(cfg.approval && cfg.approval.approvedAt);
    if (!approved || !approvalAt || approvalAt > now) reasons.push('UDC承認待ち');
    if (!(cfg.delivery && cfg.delivery.connected === true && date(cfg.delivery.verifiedAt) && date(cfg.delivery.verifiedAt) <= now)) reasons.push('Metricoolの接続確認待ち');
    if (cfg.mode !== 'enabled') reasons.push('自動投稿は停止中');
    var start = date(cfg.startAt);
    if (!start || start > now) reasons.push(start ? '投稿開始日時の前です' : '投稿開始日時が未設定です');
    if (['cancelled', 'postponed'].indexOf(cfg.eventStatus) >= 0) reasons.push('中止・延期のため停止中。予約済み投稿も配信先で停止してください');
    if (cfg.eventStatus !== 'planned') reasons.push('開催状態の確認が必要です');
    if (!cfg.policy || cfg.policy.requireLiveAccountCheck !== true || cfg.policy.requireDuplicateCheck !== true) reasons.push('配信前のアカウント確認・重複確認が必要です');
    return { allowed: reasons.length === 0, reasons: reasons, start: start && approvalAt ? new Date(Math.max(start.getTime(), approvalAt.getTime())) : null };
  }
  function build(data, cfg, at) {
    var now = at instanceof Date ? at : new Date(at || Date.now());
    if (isNaN(now.getTime())) throw new Error('invalid_time');
    data = data || {}; cfg = cfg || {};
    var g = gate(cfg, now), posts = [], channels = (cfg.channels || []).filter(function (x) { return x === 'threads' || x === 'instagram'; });
    var base = g.start || now, from = new Date(Math.max(base.getTime(), now.getTime()));
    var sourceOK = data.ok === true;
    if (!sourceOK) { g.allowed = false; g.reasons.push('台帳の最新情報を取得できません'); }
    function add(id, title, body, offset, anchor, priority, options) {
      options = options || {};
      channels.forEach(function (ch) {
        if (options.only && options.only !== ch) return;
        var earliest = options.at || new Date(base.getTime() + offset * DAY);
        var when = options.exact ? earliest : slot(new Date(Math.max(earliest.getTime(), now.getTime())), ch, cfg);
        var expiry = options.expires || new Date(base.getTime() + (offset + 10) * DAY);
        var url = link(ch, id, anchor), text = body + '\n\n' + (ch === 'instagram' ? '投票・開催案内はプロフィールのリンクから。\n#南草津 #南草津駅 #草津市 #滋賀グルメ' : url + '\n#南草津');
        var reasons = g.reasons.slice();
        if (!sourceOK && reasons.indexOf('台帳の最新情報を取得できません') < 0) reasons.push('台帳の最新情報を取得できません');
        if (!when) reasons.push('投稿時刻を確認してください');
        if (when && when >= expiry) reasons.push('この投稿の案内期間が終わっています');
        if ((ch === 'threads' && Array.from(text).length > 500) || (ch === 'instagram' && Array.from(text).length > 2200)) reasons.push('投稿文の文字数を確認してください');
        var within = when && when.getTime() - now.getTime() <= 24 * 3600000;
        posts.push({ id: 'ym-' + id + '-' + ch, title: title, channel: ch, text: text, url: url,
          mediaUrl: options.image || IMAGE, mediaAlt: options.alt || '南草津駅前、よりみち。食べたいものを募る案内カード。出店商品を示す写真ではありません。',
          publishAt: when ? when.toISOString() : null, expiresAt: expiry.toISOString(), priority: priority,
          canSchedule: reasons.length === 0 && !!within, reasons: reasons, outsideSchedulingWindow: !within,
          dedupeKey: 'ym-' + id + '-' + ch, source: '公開台帳・UDC承認設定', fingerprint: hash(text),
          rule: options.rule || '承認・接続後の定期枠', shopPermissionKey: options.permissionKey || null });
      });
    }
    add('start-v1', '帰り道が変わる予告', 'いつもの改札の先に、いつもと違う楽しみを。\n\n南草津駅に、おいしい寄り道を。\n今夜のおかず、明日のパン、自分へのおやつ。小さな市を駅前で準備しています。\n\nあなたなら、何が買えたらうれしい？\n名前・メール不要、3つまで選べる投票を受付中です。\n開催日は、決まりしだいお知らせします。', 0, '#vote', 30, {rule:'承認後の最初の定期枠'});
    add('commute-v1', '南草津駅を使う人への質問', '南草津駅を使う人に、聞きたい。\n\n帰り道で買えるなら、どれがうれしい？\n・今日の晩ごはんのおかず\n・明日の朝が楽しみになるパン\n・自分にひとつ、ごほうびのおやつ\n\n駅前で準備中の「南草津駅前、よりみち。」。食べたいものを、投票で教えてください。\n名前・メールの入力は不要です。開催日は調整中です。', 3, '#vote', 20, {only:'threads', rule:'承認から3日後以降の定期枠'});
    var r = sourceOK && data.results;
    var top = r && Number.isInteger(r.total) && r.total >= 30 && Array.isArray(r.top) ? r.top.slice(0, 5).filter(function (x) { return Array.isArray(x) && str(x[0]) && Number.isInteger(x[1]) && x[1] >= 0 && x[1] <= r.total; }) : [];
    if (top.length) {
      var sig = hash(JSON.stringify([r.total, top]));
      add('poll-' + sig, '実際の投票結果を届ける', '南草津駅の帰り道、みんなが食べたいのは？\n\n' + str(r.asof, 30) + '時点・有効回答' + r.total + '件の途中経過です。\n' + top.map(function (x, i) { return '・' + str(x[0], 45) + '（' + x[1] + '人が選択）'; }).join('\n') + '\n\nあなたの食べたいものも、教えてください。\n結果は出店の相談に使います。商品の出店をお約束する投票ではありません。', 0, '#vote', 60, {at:from, expires:new Date(now.getTime() + 7 * DAY), rule:'30件以上の公開結果。結果が変わったときだけ'});
    }
    var e = sourceOK && data.nextEvent, ed = eventDay(e);
    if (ed && ed > now) {
      var eid = 'event-' + e.key + '-' + hash([e.round, e.date, e.time, e.place].join('|'));
      var details = str(e.date, 40) + ' ' + str(e.time, 50) + '\nJR南草津駅 ' + str(e.place, 80);
      add(eid, '日時が決まったら開催案内', '南草津駅に、おいしい寄り道を。\n\n' + str(e.round || '次回', 20) + 'の開催日が決まりました。\n' + details + '\n\nいつもの帰り道に、小さな楽しみを。\n最新の出店情報は案内ページへ。', 0, '#status', 100, {at:from, expires:ed, rule:'承認済みの開催日・時間・場所がそろったとき'});
      var eve = new Date(ed.getTime() - DAY + 17 * 3600000 + 30 * 60000);
      if (eve > now) add('remind-' + eid, '開催前日の来場案内', '明日の帰り道、南草津駅でよりみちしませんか。\n\n' + details + '\n\nお目当てがある方は、最新の出店情報を案内ページでチェック。\n売り切れ・天候による変更も、ページでお知らせします。', 0, '#status', 200, {at:eve, exact:true, expires:ed, rule:'開催前日17:30。開催状態を直前にも再確認'});
      var permissions = Array.isArray(cfg.shopPermissions) ? cfg.shopPermissions : [];
      (data.shops || []).filter(function (s) { return s.status === '出店予定' && str(s.item) && str(s.shop) && str(s.price) && permissions.indexOf(shopKey(s)) >= 0 && /^https:\/\//.test(s.photo || ''); }).slice(0, 3).forEach(function (s) {
        var key = shopKey(s);
        add('shop-' + e.key + '-' + key + '-' + hash(str(s.price) + '|' + str(s.photo)), '掲載了承を得た一品の紹介', '南草津駅の帰り道に、' + str(s.item, 45) + '。\n\n' + str(s.shop, 50) + '／' + str(s.price, 30) + '（税込）\n' + details + '\n\n寄り道の楽しみを、ひとつずつ。\n当日の販売数や最新情報は、案内ページでお確かめください。', 0, '#shops', 80, {at:from, expires:ed, image:s.photo, alt:str(s.shop, 50) + 'の' + str(s.item, 70), permissionKey:key, rule:'出店予定・税込価格・写真・SNS掲載了承がそろった一品'});
      });
    }
    // A date confirmation replaces the generic "date being arranged" invitations.
    if (ed) posts = posts.filter(function (p) { return !/^ym-(start-v1|commute-v1)-/.test(p.id); });
    posts.sort(function (a, b) { return b.priority - a.priority || String(a.publishAt).localeCompare(String(b.publishAt)); });
    var selected = {};
    posts.forEach(function (p) {
      if (!p.canSchedule) return;
      var k = p.channel + ':' + dayKey(new Date(p.publishAt));
      if (selected[k]) { p.canSchedule = false; p.reasons.push('同じ日の優先する投稿があります'); }
      else selected[k] = true;
    });
    return { schemaVersion:1, generatedAt:now.toISOString(), validUntil:new Date(now.getTime() + 3600000).toISOString(),
      status:g.allowed ? 'ready_for_delivery_check' : 'held', reasons:g.reasons,
      deliveryNote:'このページは投稿候補です。実際の予約・公開はMetricoolとの接続と定期実行の設定が必要です。',
      policy:{timezone:'Asia/Tokyo',maxPostsPerChannelPerDay:1,maxScheduleAheadHours:24,requireLiveAccountCheck:true,requireDuplicateCheck:true},
      posts:posts,
      awaiting:{poll:!top.length,event:!ed,shopConsent:!(cfg.shopPermissions || []).length} };
  }
  return {build:build,shopKey:shopKey};
}));
