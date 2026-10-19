/**
 * 南草津駅前、よりみち。 運営の台帳（Googleスプレッドシート ＋ Apps Script）
 * 版：v2（2026-10-19 会員番号・先行案内） BRIDGE CYCLE株式会社
 *
 * できること
 *  ・ページからの「食べたいもの投票」「開催案内の登録」を、このスプレッドシートに記録する
 *  ・ページに「次の情報更新」「開催日」「並ぶもの」「投票の結果（有効回答30件以上）」を渡す
 *  ・登録確認メール、開催案内メール（メニューから送る）、前日のお知らせ（毎日決まった時刻に自動確認）
 *  ・メールの配信停止（メール末尾のリンクから）
 *
 * 使い方は同じフォルダの「公開手順.md」を参照。
 * 秘密の情報は入っていない（このファイルを公開しても問題ない）。
 */

var TZ = 'Asia/Tokyo';
var SH = { conf: '設定', vote: '投票', reg: '登録', shops: '並ぶもの', log: '送信記録' };
var HEAD = {
  '投票': ['受付日時', '版', '入口', '帰り道', '買いたいもの', '時間', '出口', 'ひとこと', '流入元'],
  '登録': ['受付日時', 'メールアドレス', '入口', '帰り道', '流入元', '状態', '停止用の鍵', '案内を送った回', '前日お知らせを送った回', '会員番号'],
  '並ぶもの': ['公開する', '状態', '商品名', '税込価格', '店名', '写真', '並び順', 'メモ（非公開）'],
  '送信記録': ['日時', '種類', '回', '送った数', '結果']
};
var CONF_DEFAULT = [
  ['次の情報更新', '10月26日（月）', 'ページ上部に「次の情報更新」として出る。空なら出さない'],
  ['開催の回', '第1回', 'メールの件名と「送った回」の印に使う。次の回に進んだら書き換える'],
  ['開催日', '', '日付で入れる（例：2026/11/20）。入れるとページが開催案内に切り替わる。過ぎると元に戻る'],
  ['開催日の表示', '', '例：11月20日（金）'],
  ['時間', '', '例：17:00〜20:00'],
  ['場所', '', '例：西口の駅前'],
  ['店数', '', '例：3'],
  ['結果を公開する有効回答数', 30, 'これ未満のあいだは、ページに結果を出さない'],
  ['集計に使う版', 'v2', 'この文字で始まる版の投票だけを数える（初期選択をなくす前の回答を除く）'],
  ['結果の補足', '結果は、出店をお願いするお店に伝えています', 'ページの結果の下に出る一言'],
  ['送信者名', '南草津駅前、よりみち。（BRIDGE CYCLE）', 'メールの差出人名'],
  ['返信先', 'info@bridgecycleco.com', 'メールに返信されたときの宛先'],
  ['ページのURL', 'https://www.bridgecycleco.com/minakusa-yorimichi.html', ''],
  ['受付のURL', '', '公開（デプロイ）したときの「ウェブアプリのURL」を貼る。配信停止のリンクに使う'],
  ['前日お知らせの時刻', 12, '毎日この時（0〜23）に確認し、翌日が開催日なら送る'],
  ['登録確認メール', '送る', '送る／送らない'],
  ['案内メールの追記', '', '開催案内の本文に足したい一言（任意）'],
  ['先行案内の人数', 100, 'この番号までの登録者に、開催案内を一般より先に送る（メニュー「先行案内を送る」）'],
  ['待っている人数を出す数', 30, '登録がこの人数以上になったら、ページに「いま○人が待っています」と出す']
];
var FOOTER = [
  '――',
  '南草津駅周辺まちづくりの社会実験（実施：UDCみなくさ・立命館大学）',
  '出店者の募集・調整：BRIDGE CYCLE株式会社',
  '〒520-0801 滋賀県大津市におの浜2-1-28　info@bridgecycleco.com　080-5309-9770（平日10〜17時）'
];

/* ───────── 準備・メニュー ───────── */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('よりみち')
    .addItem('最初の準備（シートと自動確認をつくる）', 'setup')
    .addSeparator()
    .addItem('先行案内を送る（会員番号の早い人から）', 'menuSendEarly')
    .addItem('開催案内を送る', 'menuSendAnnouncement')
    .addItem('自分あてにテスト送信', 'sendTestMails')
    .addItem('いまの集計を見る', 'menuShowSummary')
    .addToUi();
}

function setup() {
  var ss = SpreadsheetApp.getActive();
  Object.keys(HEAD).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sh.getLastRow() === 0) { sh.appendRow(HEAD[name]); sh.setFrozenRows(1); }
  });
  var conf = ss.getSheetByName(SH.conf) || ss.insertSheet(SH.conf, 0);
  if (conf.getLastRow() === 0) { conf.appendRow(['項目', '値', '説明']); conf.setFrozenRows(1); }
  var have = conf.getDataRange().getValues().map(function (r) { return String(r[0]); });
  CONF_DEFAULT.forEach(function (r) { if (have.indexOf(r[0]) < 0) conf.appendRow(r); });
  ss.getSheetByName(SH.shops).getRange(2, 1, 50, 1).insertCheckboxes();
  // 前日お知らせの自動確認（同じものを二重につくらない）
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'dailyCheck') ScriptApp.deleteTrigger(t); });
  var hour = Number(readConf()['前日お知らせの時刻']);
  ScriptApp.newTrigger('dailyCheck').timeBased().atHour(isNaN(hour) ? 12 : hour).everyDays(1).inTimezone(TZ).create();
  clearDataCache();
  notify('準備ができました。次は「デプロイ」→「新しいデプロイ」でウェブアプリとして公開してください。');
}

/* ───────── ページからの受付 ───────── */

function doPost(e) {
  var body;
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return json({ ok: false, error: 'bad_json' }); }
  if (body._gotcha) return json({ ok: true });   // ボット対策の見えない欄に入力があれば、記録せずに成功を返す
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    if (body.kind === '投票') return json(saveVote(body));
    if (body.kind === '開催案内登録') return json(saveRegistration(body));
    return json({ ok: false, error: 'unknown_kind' });
  } catch (err) {
    return json({ ok: false, error: 'server' });
  } finally {
    try { lock.releaseLock(); } catch (err2) {}
  }
}

function saveVote(b) {
  var food = clip(b.food, 300);
  if (!food) return { ok: false, error: 'no_food' };
  sheet(SH.vote).appendRow([now(), clip(b.form_ver, 30), clip(b.via, 30), clip(b.persona, 40), food,
    clip(b.time, 200), clip(b.exit, 200), clip(b.comment, 200), clip(b.src, 30)].map(safe));
  clearDataCache();
  return { ok: true };
}

function saveRegistration(b) {
  var email = String(b.email || '').trim().toLowerCase();
  if (!/^[^\s@<>"']{1,64}@[^\s@<>"']+\.[^\s@<>"']{2,}$/.test(email) || email.length > 254) return { ok: false, error: 'bad_email' };
  var cache = CacheService.getScriptCache();
  if (cache.get('reg:' + email)) return { ok: true };   // 同じアドレスの連打は1分間まとめる
  cache.put('reg:' + email, '1', 60);
  var sh = sheet(SH.reg), rows = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][1]).toLowerCase() === email) {
      if (rows[i][5] !== '有効') sh.getRange(i + 1, 6).setValue('有効');   // 停止した人が自分で登録し直したら戻す
      return { ok: true, existed: true, no: Number(rows[i][9]) || i };
    }
  }
  var token = Utilities.getUuid().replace(/-/g, '');
  var no = rows.length;   // 登録した順の番号（1行目は見出しなので、行数がそのまま次の番号になる）
  if (!rows[0][9]) sh.getRange(1, 10).setValue('会員番号');
  sh.appendRow([now(), email, clip(b.where, 30), clip(b.persona, 40), clip(b.src, 30), '有効', token, '', '', no].map(safe));
  clearDataCache();
  var c = readConf();
  if (c['登録確認メール'] !== '送らない' && MailApp.getRemainingDailyQuota() > 0) {
    try { mail(email, '【南草津駅前、よりみち。】よりみち会員 No.' + pad3(no) + ' として登録しました', confirmBody(c, token, no), c); } catch (err) {}
  }
  return { ok: true, no: no, early: no <= earlyLimit(c) };
}

/* ───────── ページに渡すデータ・配信停止 ───────── */

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === 'unsub') return unsubscribe(p.t);
  var cache = CacheService.getScriptCache(), hit = cache.get('data');
  if (hit) return ContentService.createTextOutput(hit).setMimeType(ContentService.MimeType.JSON);
  var out = JSON.stringify(pageData());
  cache.put('data', out, 120);
  return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.JSON);
}

function pageData() {
  var c = readConf();
  var active = sheet(SH.reg).getDataRange().getValues().slice(1).filter(function (r) { return r[5] === '有効'; }).length;
  var showAt = Number(c['待っている人数を出す数']) || 30;
  return { ok: true, nextUpdate: String(c['次の情報更新'] || ''), nextEvent: eventInfo(c, true), shops: publicShops(), results: results(c, false),
    waiting: active >= showAt ? active : null, earlyLimit: earlyLimit(c) };
}

function eventInfo(c, onlyUpcoming) {
  var d = c['開催日'];
  if (!d) return null;
  var day = d instanceof Date ? d : new Date(String(d).replace(/-/g, '/'));
  if (isNaN(day.getTime())) return null;
  var key = Utilities.formatDate(day, TZ, 'yyyyMMdd');
  if (onlyUpcoming && key < Utilities.formatDate(new Date(), TZ, 'yyyyMMdd')) return null;
  return {
    round: String(c['開催の回'] || ''), key: key,
    date: String(c['開催日の表示'] || Utilities.formatDate(day, TZ, 'M月d日')),
    time: String(c['時間'] || ''), place: String(c['場所'] || ''), shops: Number(c['店数']) || 0
  };
}

function publicShops() {
  var rows = sheet(SH.shops).getDataRange().getValues().slice(1);
  return rows.filter(function (r) { return r[0] === true && r[2]; })
    .sort(function (a, b) { return (Number(a[6]) || 99) - (Number(b[6]) || 99); })
    .map(function (r) {
      var photo = String(r[5] || '');
      if (!/^(https:\/\/|images\/)/.test(photo)) photo = '';
      var price = String(r[3] || '');
      if (/^\d+$/.test(price)) price = Number(price).toLocaleString('ja-JP') + '円';
      return { status: r[1] === '出店予定' ? '出店予定' : '検討中', item: String(r[2]), price: price, shop: String(r[4] || ''), photo: photo };
    });
}

/** 有効回答（集計に使う版のもの）の件数と、買いたいものの上位。full=true なら時間・出口も（未回答を分母から外して）返す */
function results(c, full) {
  var prefix = String(c['集計に使う版'] || 'v2'), min = Number(c['結果を公開する有効回答数']) || 30;
  var rows = sheet(SH.vote).getDataRange().getValues().slice(1).filter(function (r) { return String(r[1]).indexOf(prefix) === 0; });
  var total = rows.length;
  if (!full && total < min) return null;
  function tally(col) {
    var n = {}, answered = 0;
    rows.forEach(function (r) {
      var v = String(r[col] || '');
      if (!v || v === '（未回答）') return;
      answered++;
      v.split('／').forEach(function (x) { x = x.trim(); if (x) n[x] = (n[x] || 0) + 1; });
    });
    var list = Object.keys(n).map(function (k) { return [k, n[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
    return { answered: answered, list: list };
  }
  var food = tally(4);
  var out = { asof: Utilities.formatDate(new Date(), TZ, 'M/d'), total: total, top: topWithTies(food.list, 3, 5), used: String(c['結果の補足'] || '') };
  if (full) { out.food = food; out.time = tally(5); out.exit = tally(6); out.min = min; }
  return out;
}

/** 上位n件。n位と同数のものは、max件まで一緒に出す（同数なのに片方だけ載らないようにする） */
function topWithTies(list, n, max) {
  if (list.length <= n) return list.slice();
  var edge = list[n - 1][1];
  return list.filter(function (x, i) { return i < n || x[1] === edge; }).slice(0, max);
}

function unsubscribe(token) {
  var msg = 'リンクが正しくないか、すでに停止されています。お手数ですが info@bridgecycleco.com へご連絡ください。';
  if (token && /^[0-9a-f]{32}$/.test(token)) {
    var sh = sheet(SH.reg), rows = sh.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][6] === token) { sh.getRange(i + 1, 6).setValue('停止'); msg = '配信を停止しました。これまでご登録いただき、ありがとうございました。'; break; }
    }
  }
  return HtmlService.createHtmlOutput('<meta name="viewport" content="width=device-width,initial-scale=1"><div style="font-family:sans-serif;max-width:520px;margin:48px auto;padding:0 20px;line-height:1.8"><h1 style="font-size:20px">南草津駅前、よりみち。</h1><p>' + msg + '</p></div>').setTitle('配信の停止');
}

/* ───────── メール ───────── */

function menuSendAnnouncement() {
  var c = readConf(), ev = eventInfo(c, true), ui = SpreadsheetApp.getUi();
  if (!ev) { ui.alert('「設定」の開催日が空か、もう過ぎています。開催日を入れてから送ってください。'); return; }
  var targets = targetRows(7, ev.round);
  if (!targets.length) { ui.alert(ev.round + 'の開催案内は、全員に送り終わっています。'); return; }
  var quota = MailApp.getRemainingDailyQuota();
  var ans = ui.alert('開催案内を送りますか',
    ev.round + '　' + ev.date + ' ' + ev.time + '　' + ev.place + '\n送る相手：' + targets.length + '人（今日あと' + quota + '通まで送れます）\n\n先に「自分あてにテスト送信」で文面を確かめることをお勧めします。',
    ui.ButtonSet.YES_NO);
  if (ans !== ui.Button.YES) return;
  var r = sendTo(targets, 7, ev.round, function (token) { return [announceSubject(ev), announceBody(c, ev, token)]; }, '開催案内');
  ui.alert(r.sent + '人に送りました。' + (r.left ? '\n今日の送信上限に達したため、残り' + r.left + '人は明日もう一度「開催案内を送る」を押してください。' : ''));
}

function menuSendEarly() {
  var c = readConf(), ev = eventInfo(c, true), ui = SpreadsheetApp.getUi(), lim = earlyLimit(c);
  if (!ev) { ui.alert('「設定」の開催日が空か、もう過ぎています。開催日を入れてから送ってください。'); return; }
  var targets = targetRows(7, ev.round).filter(function (t) { return t.no <= lim; });
  if (!targets.length) { ui.alert('No.' + lim + 'までの方には、' + ev.round + 'の案内を送り終わっています。'); return; }
  var ans = ui.alert('先行案内を送りますか', ev.round + '　' + ev.date + ' ' + ev.time + '　' + ev.place + '\n送る相手：会員番号' + lim + 'までの ' + targets.length + '人\n\n一般向けの「開催案内を送る」は、翌日以降に押すのがお勧めです（先行案内を送った人には重ねて届きません）。', ui.ButtonSet.YES_NO);
  if (ans !== ui.Button.YES) return;
  var r = sendTo(targets, 7, ev.round, function (token) { return ['【先行案内】' + announceSubject(ev), '会員番号' + lim + 'までの方に、一般より先にお知らせしています。\n\n' + announceBody(c, ev, token)]; }, '先行案内');
  ui.alert(r.sent + '人に先行案内を送りました。' + (r.left ? '\n残り' + r.left + '人は明日もう一度押してください。' : ''));
}

/** 毎日決まった時刻に動く。翌日が開催日なら、前日のお知らせを送る */
function dailyCheck() {
  var c = readConf(), ev = eventInfo(c, true);
  if (!ev) return;
  var tomorrow = Utilities.formatDate(new Date(Date.now() + 24 * 3600 * 1000), TZ, 'yyyyMMdd');
  if (ev.key !== tomorrow) return;
  var targets = targetRows(8, ev.round);
  if (!targets.length) return;
  sendTo(targets, 8, ev.round, function (token) { return [reminderSubject(ev), reminderBody(c, ev, token)]; }, '前日お知らせ');
}

function targetRows(markCol, round) {
  var rows = sheet(SH.reg).getDataRange().getValues(), out = [];
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][5] === '有効' && rows[i][1] && String(rows[i][markCol]) !== round) out.push({ row: i + 1, email: String(rows[i][1]), token: String(rows[i][6]), no: Number(rows[i][9]) || i });
  }
  return out;
}

function sendTo(targets, markCol, round, build, kind) {
  var c = readConf(), sh = sheet(SH.reg), sent = 0, failed = 0;
  for (var i = 0; i < targets.length; i++) {
    if (MailApp.getRemainingDailyQuota() < 1) break;
    var t = targets[i], m = build(t.token);
    try { mail(t.email, m[0], m[1], c); sh.getRange(t.row, markCol + 1).setValue(round); sent++; } catch (err) { failed++; }
  }
  var left = targets.length - sent - failed;
  sheet(SH.log).appendRow([now(), kind, round, sent, (failed ? '失敗' + failed + '件 ' : '') + (left ? '上限で残り' + left + '人' : '完了')]);
  return { sent: sent, failed: failed, left: left };
}

function mail(to, subject, body, c) {
  MailApp.sendEmail({ to: to, subject: subject, body: body, name: String(c['送信者名'] || '南草津駅前、よりみち。'), replyTo: String(c['返信先'] || '') || undefined });
}

function unsubLine(c, token) {
  var base = String(c['受付のURL'] || '');
  if (!base) { try { base = ScriptApp.getService().getUrl(); } catch (err) { base = ''; } }
  return base ? '配信の停止：' + base + '?action=unsub&t=' + token : '配信の停止：このメールに「停止」とご返信ください。';
}

function pageUrl(c, src) { return String(c['ページのURL'] || '') + '?src=' + src; }

function shopLines() {
  var s = publicShops();
  if (!s.length) return [];
  return ['', '並ぶもの（予定）'].concat(s.map(function (x) { return '・' + x.item + '　' + x.price + '（' + x.shop + '）' + (x.status === '出店予定' ? '' : '※検討中'); }));
}

function confirmBody(c, token, no) {
  var lim = earlyLimit(c), n = no || 0;
  return ['南草津駅前、よりみち。の開催案内にご登録いただき、ありがとうございます。', '',
    'あなたは「よりみち会員」No.' + pad3(n) + ' です。',
    n && n <= lim ? 'No.' + pad3(lim) + 'までの方には、第1回の日程と出店するお店を、一般より先にお知らせします。' : '第1回の日程と出店するお店が決まりしだい、このアドレスにお知らせします。',
    '開催の前日にも、もう一度お送りします。', '',
    '南草津駅を使うお知り合いにも、よかったら教えてください：' + pageUrl(c, 'friend'),
    '', 'ページ：' + pageUrl(c, 'mail'), '', 'お心当たりがない場合は、下のリンクから停止できます。', unsubLine(c, token), ''].concat(FOOTER).join('\n');
}

function announceSubject(ev) { return '【南草津駅前、よりみち。】' + ev.round + 'は' + ev.date + ' ' + ev.time + 'です'; }
function announceBody(c, ev, token) {
  var lines = ['南草津駅前、よりみち。の開催案内にご登録いただいた方へお送りしています。', '',
    ev.round + 'の日程が決まりました。', '',
    '日時：' + ev.date + ' ' + ev.time, '場所：JR南草津駅 ' + ev.place];
  if (ev.shops) lines.push('出店：' + ev.shops + '店');
  lines = lines.concat(shopLines());
  if (c['案内メールの追記']) lines.push('', String(c['案内メールの追記']));
  lines.push('', 'くわしくはこちら：' + pageUrl(c, 'mail'), '開催の前日にも、もう一度お知らせします。', '', unsubLine(c, token), '');
  return lines.concat(FOOTER).join('\n');
}
function reminderSubject(ev) { return '【明日です】南草津駅前、よりみち。' + ev.round + '　' + ev.date + ' ' + ev.time; }
function reminderBody(c, ev, token) {
  var lines = ['明日、南草津駅前に小さなお店が並びます。帰り道に、ちょっと寄ってみてください。', '',
    '日時：' + ev.date + ' ' + ev.time, '場所：JR南草津駅 ' + ev.place].concat(shopLines());
  lines.push('', '売り切れることがあります。お目当てがある方は早めの時間がおすすめです。', '', 'くわしくはこちら：' + pageUrl(c, 'remind'), '', unsubLine(c, token), '');
  return lines.concat(FOOTER).join('\n');
}

function sendTestMails() {
  var me = Session.getActiveUser().getEmail(), c = readConf();
  var ev = eventInfo(c, false) || { round: String(c['開催の回'] || '第1回'), key: '', date: '（開催日の表示）', time: '（時間）', place: '（場所）', shops: Number(c['店数']) || 0 };
  var t = '0'.repeat(32);
  mail(me, '［テスト］' + '【南草津駅前、よりみち。】開催案内の登録を受け付けました', confirmBody(c, t, 7), c);
  mail(me, '［テスト］' + announceSubject(ev), announceBody(c, ev, t), c);
  mail(me, '［テスト］' + reminderSubject(ev), reminderBody(c, ev, t), c);
  notify(me + ' に3通（登録確認・開催案内・前日お知らせ）を送りました。');
}

function menuShowSummary() {
  var c = readConf(), r = results(c, true), regs = sheet(SH.reg).getDataRange().getValues().slice(1);
  var active = regs.filter(function (x) { return x[5] === '有効'; }).length;
  function top(t) { return t.list.slice(0, 5).map(function (x) { return '  ' + x[0] + '　' + x[1] + '（' + Math.round(x[1] / Math.max(1, t.answered) * 100) + '%）'; }).join('\n'); }
  SpreadsheetApp.getUi().alert('いまの集計',
    '有効回答：' + r.total + '件（ページに出すのは' + r.min + '件から）\n開催案内の登録：' + active + '人（停止を除く）\n\n買いたいもの（割合は回答者に対して）\n' + top(r.food) +
    '\n\n時間（未回答を除く ' + r.time.answered + '人）\n' + top(r.time) + '\n\n出口（未回答を除く ' + r.exit.answered + '人）\n' + top(r.exit),
    SpreadsheetApp.getUi().ButtonSet.OK);
}

/* ───────── 小さな道具 ───────── */

function readConf() {
  var sh = SpreadsheetApp.getActive().getSheetByName(SH.conf), out = {};
  if (!sh) return out;
  sh.getDataRange().getValues().forEach(function (r) { if (r[0]) out[String(r[0])] = r[1]; });
  return out;
}
function sheet(name) {
  var ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(HEAD[name]); sh.setFrozenRows(1); }
  return sh;
}
function clearDataCache() { try { CacheService.getScriptCache().remove('data'); } catch (err) {} }
function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function now() { return Utilities.formatDate(new Date(), TZ, 'yyyy/MM/dd HH:mm:ss'); }
function clip(v, n) { return String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n); }
/** = + - @ で始まる入力は、式として動かないよう先頭に ' を付ける */
function safe(v) { return (typeof v === 'string' && /^[=+\-@]/.test(v)) ? "'" + v : v; }
function pad3(n) { n = Number(n) || 0; return n < 1000 ? ('00' + n).slice(-3) : String(n); }
function earlyLimit(c) { return Number(c['先行案内の人数']) || 100; }
function notify(msg) { try { SpreadsheetApp.getActive().toast(msg, 'よりみち', 8); } catch (err) {} }
