/**
 * 南草津駅前 出店者台帳（Googleスプレッドシート ＋ Apps Script）
 * 版：v1（2026-11-07） BRIDGE CYCLE株式会社
 *
 * 目的：出店者がボタンを押さなくても、次にやることが届くようにする。
 *  ・申込を台帳に記録し、出店ナビ（minakusa-day-guide.html）の専用リンクをメールで送る
 *  ・運営が台帳の「確定エリア・確定日・時間枠」「許可証」「支払」を入れると、次の指示を自動でメールする
 *  ・前日・当日（設営前／閉店時）・報告忘れのお知らせを、時刻になったら自動でメールする
 *  ・「開催日」シートで中止／開催を選ぶと、その日の出店者全員に自動で知らせる
 *  ・出店ナビに、その出店者の状態（次にやること）を渡す
 *  ・到着／撤収の写真と終了報告（売上・人数・アンケート）を記録し、info@ にも届ける
 *
 * 使い方は同じフォルダの「公開手順.md」。秘密の情報は入っていない。
 */

var TZ = 'Asia/Tokyo';
var OWNER = 'info@bridgecycleco.com';
var SENDER = 'BRIDGE CYCLE（南草津駅前 出店事務局）';
var NAVI = 'https://www.bridgecycleco.com/minakusa-day-guide.html';
var LP = 'https://www.bridgecycleco.com/minakusa-ekimae.html';
var LINE = 'https://line.me/R/ti/p/@907kxssd';

var SH = { v: '出店者', d: '開催日', day: '当日記録', rep: '終了報告', conf: '設定', log: '通知記録' };
var HEAD = {
  '出店者': ['受付番号', '鍵', '申込日時', '屋号', '担当者', 'メール', '電話', '希望エリア', '希望日', '出店の形', 'メニュー', '営業許可', '状態',
            '確定エリア', '区画番号', '確定日', '時間枠', '許可証', '支払', '通知済み', 'メモ'],
  '開催日': ['日付', '開催判断', '知らせた判断', 'ひとこと（任意・メールに入る）'],
  '当日記録': ['日時', '受付番号', '屋号', '出店日', '種類', '枚数'],
  '終了報告': ['日時', '受付番号', '屋号', '出店日', 'エリア', '売上', '人数', '客単価', '販売数', '売れた時間', '天気', '客層', '満足度', 'また出たいか', '本店・SNS', 'よかったこと', '困ったこと'],
  '通知記録': ['日時', '受付番号', '屋号', '種類', '宛先', '結果']
};
var CONF_DEFAULT = [
  ['支払ページ（3,300円の枠）', '', 'Stripeの支払リンク。許可証が「確認済」になったら出店者に送る'],
  ['支払ページ（5,500円の枠）', '', '通し枠・朝夕セット用'],
  ['許可証の出し方', 'このメールに返信して、営業許可証の写真（全体が写ったもの）を送ってください。', '区画の連絡メールに入る文'],
  ['当日の連絡先', 'LINE（' + LINE + '）', '前日・当日のメールに入る'],
  ['前日のお知らせ時刻', '18', '前日のこの時刻（時）に送る'],
  ['自動通知', 'オン', '「オフ」にすると自動メールを止める（申込の受付メールは送る）']
];
/* 区画・曜日ごとの時間枠（出店ナビと同じ並び。時間枠の欄にはこの表示名を入れる） */
var SLOTS = {
  A: { 5: [['15:00', '20:00', '金曜 15:00〜20:00']], 6: [['10:00', '20:00', '通し 10:00〜20:00']], 0: [['10:00', '20:00', '通し 10:00〜20:00']] },
  B: { 6: [['10:00', '20:00', '通し 10:00〜20:00']], 0: [['10:00', '20:00', '通し 10:00〜20:00']] },
  C: { 5: [['07:00', '09:30', '朝 7:00〜9:30'], ['17:00', '20:00', '夕 17:00〜20:00'], ['07:00', '20:00', '朝夕セット']], 6: [['07:00', '09:30', '朝 7:00〜9:30'], ['17:00', '20:00', '夕 17:00〜20:00'], ['07:00', '20:00', '朝夕セット']], 0: [['07:00', '09:30', '朝 7:00〜9:30'], ['17:00', '20:00', '夕 17:00〜20:00'], ['07:00', '20:00', '朝夕セット']] },
  D: { 5: [['07:00', '09:30', '朝 7:00〜9:30'], ['17:00', '20:00', '夕 17:00〜20:00'], ['07:00', '20:00', '朝夕セット']], 6: [['07:00', '09:30', '朝 7:00〜9:30'], ['17:00', '20:00', '夕 17:00〜20:00'], ['07:00', '20:00', '朝夕セット']], 0: [['07:00', '09:30', '朝 7:00〜9:30'], ['17:00', '20:00', '夕 17:00〜20:00'], ['07:00', '20:00', '朝夕セット']] }
};
var ZONE_NAME = { A: '西口A（駅前広場）', B: '東口B（のりば1・2前）', C: '東口C（のりば3・4前）', D: '東口D（のりば5前）' };
var ZONE_SHORT = { A: '西口A', B: '東口B', C: '東口C', D: '東口D' };
var GATE = {
  A: '経路：西口ロータリーの一般車乗降場側 → 搬入口（幅330cm）→ 駅前広場の舗装部分 → 区画（仮）。キッチンカーはミラーを含めた車幅が330cm未満か事前にご確認のうえ、係員の誘導でゆっくり進入してください。',
  B: '経路：東口ロータリーに入り、赤い舗装の車いす用乗降スペースの横 → 屋根の下の広場への入り口 → 搬入口（幅250cm）→ 屋根の下を通って区画（仮）。キッチンカーはミラーを含めた車幅が250cm未満か事前にご確認のうえ、係員の誘導で、バスと歩行者に気をつけながらゆっくり区画へ進入してください。テント・机は荷下ろし後、台車で区画へ。係員の指示なくロータリーの中で停車・荷下ろしはしないでください（仮）。',
  C: '経路：東口ロータリーに入り、赤い舗装の車いす用乗降スペースの横 → 屋根の下の広場への入り口 → 搬入口（幅250cm）→ 屋根の下を通って区画（仮）。キッチンカーはミラーを含めた車幅が250cm未満か事前にご確認のうえ、係員の誘導で、バスと歩行者に気をつけながらゆっくり区画へ進入してください。テント・机は荷下ろし後、台車で区画へ。係員の指示なくロータリーの中で停車・荷下ろしはしないでください（仮）。',
  D: '経路：東口ロータリーに入り、赤い舗装の車いす用乗降スペースの横 → 屋根の下の広場への入り口 → 搬入口（幅250cm）→ 屋根の下を通って区画（仮）。キッチンカーはミラーを含めた車幅が250cm未満か事前にご確認のうえ、係員の誘導で、バスと歩行者に気をつけながらゆっくり区画へ進入してください。テント・机は荷下ろし後、台車で区画へ。係員の指示なくロータリーの中で停車・荷下ろしはしないでください（仮）。'
};

/* ================= 初期設定 ================= */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('出店者台帳')
    .addItem('最初の設定（シートと自動処理）', 'setup')
    .addItem('自分あてにテスト送信', 'testMail')
    .addItem('いまの状況を見る', 'showSummary')
    .addToUi();
}

function setup() {
  var ss = SpreadsheetApp.getActive();
  Object.keys(HEAD).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sh.getLastRow() === 0) { sh.appendRow(HEAD[name]); sh.setFrozenRows(1); sh.getRange(1, 1, 1, HEAD[name].length).setFontWeight('bold').setBackground('#e6f1e7'); }
  });
  var conf = ss.getSheetByName(SH.conf) || ss.insertSheet(SH.conf);
  if (conf.getLastRow() === 0) { conf.appendRow(['項目', '値', '説明']); CONF_DEFAULT.forEach(function (r) { conf.appendRow(r); }); conf.setFrozenRows(1); }
  // 開催日（12月の金・土・日）
  var d = ss.getSheetByName(SH.d);
  if (d.getLastRow() === 1) {
    ['2026/12/04', '2026/12/05', '2026/12/06', '2026/12/11', '2026/12/12', '2026/12/13', '2026/12/18', '2026/12/19', '2026/12/20']
      .forEach(function (x) { d.appendRow([x, '未定', '', '']); });
    d.getRange('A2:A10').setNumberFormat('yyyy/mm/dd');
  }
  d.getRange('B2:B60').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['未定', '開催', '中止'], true).build());
  var v = ss.getSheetByName(SH.v), col = function (n) { return HEAD['出店者'].indexOf(n) + 1; };
  v.getRange(2, col('状態'), 500).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['申込受付', '区画連絡済', '出店確定', '見送り'], true).build());
  v.getRange(2, col('確定エリア'), 500).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['A', 'B', 'C', 'D'], true).build());
  v.getRange(2, col('許可証'), 500).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['', '確認済', '不備あり'], true).build());
  v.getRange(2, col('支払'), 500).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['', '済'], true).build());
  v.getRange(1, col('確定日')).setNote('出店日を「2026/12/18」の形で。複数日は「2026/12/18,2026/12/19」のようにカンマで区切る');
  v.getRange(1, col('時間枠')).setNote('例：金曜 15:00〜20:00／通し 10:00〜20:00／朝 7:00〜9:30／夕 17:00〜20:00／朝夕セット（出店ナビと同じ表示名）');
  v.hideColumns(col('鍵')); v.hideColumns(col('通知済み'));
  // 自動処理（編集時・15分ごと）
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('onEditInstalled').forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger('tick').timeBased().everyMinutes(15).create();
  SpreadsheetApp.getActive().toast('シートと自動処理を準備しました。次に「デプロイ」でウェブアプリとして公開してください。');
}

/* ================= 共通 ================= */
function conf_(key) {
  var sh = SpreadsheetApp.getActive().getSheetByName(SH.conf); if (!sh) return '';
  var v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) if (v[i][0] === key) return String(v[i][1]).trim();
  return '';
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function fmt_(d, f) { return Utilities.formatDate(d, TZ, f || 'yyyy/MM/dd HH:mm'); }
function ymd_(x) {
  if (x instanceof Date) return fmt_(x, 'yyyy-MM-dd');
  var m = String(x || '').match(/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  return m ? m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2) : '';
}
function jpDay_(ymd) { var p = ymd.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2]); return (+p[1]) + '月' + (+p[2]) + '日（' + '日月火水木金土'.charAt(d.getDay()) + '）'; }
function dateOf_(ymd, hm, addMin) { var p = ymd.split('-'), h = hm.split(':'); return new Date(+p[0], +p[1] - 1, +p[2], +h[0], +h[1] + (addMin || 0)); }
function vendors_() {
  var sh = SpreadsheetApp.getActive().getSheetByName(SH.v), v = sh.getDataRange().getValues(), h = v[0], out = [];
  for (var i = 1; i < v.length; i++) {
    var o = { _row: i + 1 }; h.forEach(function (k, j) { o[k] = v[i][j]; });
    if (!o['受付番号']) continue;
    o.dates = String(o['確定日'] instanceof Date ? ymd_(o['確定日']) : o['確定日'] || '').split(/[,、\s]+/).map(ymd_).filter(String);
    try { o.sent = JSON.parse(o['通知済み'] || '{}'); } catch (e) { o.sent = {}; }
    out.push(o);
  }
  return out;
}
function setCell_(row, name, val) { var sh = SpreadsheetApp.getActive().getSheetByName(SH.v); sh.getRange(row, HEAD['出店者'].indexOf(name) + 1).setValue(val); }
function markSent_(o, key) { o.sent[key] = fmt_(new Date()); setCell_(o._row, '通知済み', JSON.stringify(o.sent)); }
function findByKey_(key) { if (!key) return null; var l = vendors_(); for (var i = 0; i < l.length; i++) if (String(l[i]['鍵']) === String(key)) return l[i]; return null; }
function naviUrl_(o) { return NAVI + '?t=' + encodeURIComponent(o['鍵']); }
function slotTimes_(o, ymd) {
  var z = String(o['確定エリア'] || ''), p = ymd.split('-'), w = new Date(+p[0], +p[1] - 1, +p[2]).getDay();
  var list = (SLOTS[z] && SLOTS[z][w]) || [], name = String(o['時間枠'] || '').trim();
  for (var i = 0; i < list.length; i++) if (list[i][2] === name) return { start: list[i][0], end: list[i][1], name: name, idx: i, set: name === '朝夕セット' };
  return list.length ? { start: list[0][0], end: list[0][1], name: list[0][2], idx: 0 } : null;
}
function decisions_() {
  var sh = SpreadsheetApp.getActive().getSheetByName(SH.d), v = sh.getDataRange().getValues(), out = {};
  for (var i = 1; i < v.length; i++) { var k = ymd_(v[i][0]); if (k) out[k] = { val: String(v[i][1] || '未定'), told: String(v[i][2] || ''), note: String(v[i][3] || ''), row: i + 1 }; }
  return out;
}
function dayLog_(no) {
  var sh = SpreadsheetApp.getActive().getSheetByName(SH.day), v = sh.getDataRange().getValues(), out = {};
  for (var i = 1; i < v.length; i++) if (String(v[i][1]) === String(no)) out[ymd_(v[i][3]) + ':' + v[i][4]] = fmt_(new Date(v[i][0]), 'HH:mm');
  var r = SpreadsheetApp.getActive().getSheetByName(SH.rep).getDataRange().getValues();
  for (var j = 1; j < r.length; j++) if (String(r[j][1]) === String(no)) out[ymd_(r[j][3]) + ':report'] = fmt_(new Date(r[j][0]), 'HH:mm');
  return out;
}
function log_(o, kind, to, res) { SpreadsheetApp.getActive().getSheetByName(SH.log).appendRow([new Date(), o['受付番号'] || '', o['屋号'] || '', kind, to, res]); }
function mail_(o, kind, subject, body) {
  var to = String(o['メール'] || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) { log_(o, kind, to, '宛先なし'); return false; }
  var full = (o['屋号'] ? o['屋号'] + ' ' + (o['担当者'] || '') + ' 様\n\n' : '') + body +
    '\n\n――――――――――――――――\nBRIDGE CYCLE株式会社（南草津駅前 出店者の募集・調整）\n〒520-0801 滋賀県大津市におの浜2-1-28\ninfo@bridgecycleco.com\n公式LINE：' + LINE + '\n――――――――――――――――';
  try {
    MailApp.sendEmail({ to: to, replyTo: OWNER, name: SENDER, subject: subject, body: full });
    log_(o, kind, to, '送信'); return true;
  } catch (e) { log_(o, kind, to, 'エラー：' + e.message); return false; }
}
function autoOn_() { return conf_('自動通知') !== 'オフ'; }

/* ================= ページとのやりとり ================= */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === 'status') return json_(status_(p.t));
  return json_({ ok: true });
}
function doPost(e) {
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (d._honey) return json_({ success: true });
    if (d.action === 'apply') return json_(apply_(d));
    if (d.action === 'photo') return json_(photo_(d));
    if (d.action === 'report') return json_(report_(d));
    return json_({ success: false, error: 'unknown_action' });
  } catch (err) {
    return json_({ success: false, error: String(err && err.message || err) });
  } finally { lock.releaseLock(); }
}

/* 申込：台帳に記録し、出店ナビの専用リンクを送る */
function apply_(d) {
  var email = String(d.email || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { success: false, error: 'invalid_email' };
  var key = Utilities.getUuid().replace(/-/g, '').slice(0, 24);
  var no = String(d['受付番号'] || ('MK' + fmt_(new Date(), 'MMdd') + '-' + key.slice(0, 4).toUpperCase())).slice(0, 20);
  var sh = SpreadsheetApp.getActive().getSheetByName(SH.v);
  var row = HEAD['出店者'].map(function (k) {
    return ({ '受付番号': no, '鍵': key, '申込日時': new Date(), '屋号': d['会社名・屋号'], '担当者': d['お名前'], 'メール': email, '電話': d['電話'],
      '希望エリア': (d['第1希望の区画'] || '') + (d['第2希望の区画'] && d['第2希望の区画'] !== 'なし' ? '／第2：' + d['第2希望の区画'] : ''), '希望日': d['出店したい日'],
      '出店の形': (d['出店の形'] || '') + '（' + (d['大きさ'] || '') + '）', 'メニュー': d['メニューと価格'], '営業許可': (d['営業許可の種類'] || '') + ' ' + (d['許可番号'] || ''),
      '状態': '申込受付', '通知済み': '{}', 'メモ': [d['火気'], d['電源'], d['食品衛生責任者'], d['PL保険'], d['備考']].filter(String).join('／') })[k] || '';
  });
  sh.appendRow(row);
  var o = vendors_().filter(function (x) { return x['受付番号'] === no; })[0];
  // 運営への通知
  var lines = Object.keys(d).filter(function (k) { return k.charAt(0) !== '_' && k !== 'action' && k !== 'form'; }).map(function (k) { return k + '：' + String(d[k]).slice(0, 1000); });
  MailApp.sendEmail({ to: OWNER, replyTo: email, name: 'BRIDGE CYCLE 出店者台帳', subject: '【南草津駅前 出店申込】' + (d['会社名・屋号'] || '') + '（' + no + '）', body: lines.join('\n') + '\n\n台帳：' + SpreadsheetApp.getActive().getUrl() });
  // 出店者への受付メール（出店ナビの専用リンク入り）
  mail_(o, '受付', '【南草津駅前】出店申込を受け付けました（' + no + '）',
    '南草津駅前（UDCみなくさによる社会実験）の出店にお申し込みいただき、ありがとうございます。\n受付番号：' + no + '\n\n' +
    '■ ここから撤収まで、スマホの「出店ナビ」が次にやることを案内します\n' + naviUrl_(o) + '\n（このリンクはあなた専用です。ほかの人に共有しないでください）\n\n' +
    '■ この後の流れ\n1. 当社で内容と区画を確認し、3営業日以内を目安に区画と日程をお知らせします。\n2. 営業許可証の確認 → 3. カードで出店料のお支払い → 出店確定。\nそれぞれ、こちらからメールでご案内します。出店ナビにも自動で表示されます。\n\n' +
    '※この時点では、まだ出店は確定していません。');
  markSent_(o, 'applied');
  return { success: true, t: key, no: no };
}

/* 写真報告（到着・撤収） */
function photo_(d) {
  var o = findByKey_(d.t); if (!o) return { success: false, error: 'unknown_key' };
  var kind = d.kind === 'cleanup' ? 'cleanup' : 'arrival', label = kind === 'cleanup' ? '撤収完了' : '到着・設営', ymd = ymd_(d.date);
  var blobs = (Array.isArray(d.files) ? d.files : []).slice(0, 3).map(function (f, i) {
    return Utilities.newBlob(Utilities.base64Decode(String(f.data || '')), 'image/jpeg', ymd + '_' + o['確定エリア'] + '_' + kind + '_' + (i + 1) + '.jpg');
  });
  SpreadsheetApp.getActive().getSheetByName(SH.day).appendRow([new Date(), o['受付番号'], o['屋号'], ymd, kind, blobs.length]);
  MailApp.sendEmail({ to: OWNER, name: 'BRIDGE CYCLE 出店者台帳', subject: '【南草津 ' + label + 'の写真】' + o['屋号'] + '｜' + ymd.slice(5).replace('-', '/') + ' ' + (ZONE_SHORT[o['確定エリア']] || '') + ' ' + fmt_(new Date(), 'HH:mm'),
    body: '屋号：' + o['屋号'] + '\n受付番号：' + o['受付番号'] + '\n出店日：' + ymd + '\nエリア：' + (ZONE_NAME[o['確定エリア']] || '') + '\n報告：' + label + '\n枚数：' + blobs.length, attachments: blobs });
  return { success: true };
}

/* 終了報告（売上・人数・アンケート） */
function report_(d) {
  var o = findByKey_(d.t); if (!o) return { success: false, error: 'unknown_key' };
  var ymd = ymd_(d.date), sales = Number(d.sales) || 0, people = Number(d.people) || 0;
  SpreadsheetApp.getActive().getSheetByName(SH.rep).appendRow([new Date(), o['受付番号'], o['屋号'], ymd, o['確定エリア'], sales, people, people ? Math.round(sales / people) : '',
    d.qty || '', d.peak || '', d.weather || '', d.who || '', d.sat || '', d.again || '', d.link || '', d.good || '', d.bad || '']);
  MailApp.sendEmail({ to: OWNER, name: 'BRIDGE CYCLE 出店者台帳', subject: '【南草津 終了報告】' + o['屋号'] + '｜' + ymd.slice(5).replace('-', '/') + ' ' + (ZONE_SHORT[o['確定エリア']] || '') + '｜売上' + sales.toLocaleString('ja-JP') + '円・' + people + '人',
    body: ['屋号：' + o['屋号'], '出店日：' + ymd, '売上：' + sales + '円', '人数：' + people + '人', '販売数：' + (d.qty || '-'), '売れた時間：' + (d.peak || '-'), '天気：' + (d.weather || '-'), '客層：' + (d.who || '-'),
      '満足度：' + (d.sat || '-'), 'また出たいか：' + (d.again || '-'), '本店・SNS：' + (d.link || '-'), 'よかったこと：' + (d.good || '-'), '困ったこと：' + (d.bad || '-')].join('\n') });
  mail_(o, '報告お礼:' + ymd, '【南草津駅前】終了報告を受け取りました。おつかれさまでした',
    jpDay_(ymd) + 'の出店、おつかれさまでした。終了報告を受け取りました。\n売上 ' + sales.toLocaleString('ja-JP') + '円・お客さん ' + people + '人' + (people ? '（客単価 ' + Math.round(sales / people).toLocaleString('ja-JP') + '円）' : '') + '\n\n' +
    (nextDate_(o, ymd) ? '次の出店日は ' + jpDay_(nextDate_(o, ymd)) + ' です。出店ナビで準備を確認できます。\n' + naviUrl_(o) : 'いただいた声は、次の開催に生かします。ありがとうございました。'));
  return { success: true };
}
function nextDate_(o, after) { var l = o.dates.filter(function (x) { return x > after; }).sort(); return l[0] || ''; }

/* 出店ナビに渡す状態 */
function status_(key) {
  var o = findByKey_(key); if (!o) return { ok: false };
  var log = dayLog_(o['受付番号']), dec = decisions_(), today = fmt_(new Date(), 'yyyy-MM-dd');
  var dates = o.dates.slice().sort();
  var focus = dates.filter(function (x) { return !log[x + ':report'] && x >= today; })[0] || dates.filter(function (x) { return !log[x + ':report']; })[0] || dates[dates.length - 1] || '';
  var st = focus ? slotTimes_(o, focus) : null;
  return {
    ok: true, shop: o['屋号'], no: o['受付番号'], state: o['状態'],
    zone: String(o['確定エリア'] || ''), booth: String(o['区画番号'] || ''), dates: dates, focus: focus, slot: st ? st.idx : null, slotName: st ? st.name : '',
    assigned: !!(o['確定エリア'] && dates.length && o['時間枠']), permit: o['許可証'] === '確認済', permitNg: o['許可証'] === '不備あり', paid: o['支払'] === '済' || o['状態'] === '出店確定',
    declined: o['状態'] === '見送り', decision: focus && dec[focus] ? dec[focus].val : '未定',
    arrival: log[focus + ':arrival'] || '', cleanup: log[focus + ':cleanup'] || '', report: log[focus + ':report'] || '',
    allReported: dates.length > 0 && dates.every(function (x) { return !!log[x + ':report']; }),
    payUrl: o['支払'] === '済' ? '' : payUrl_(o)
  };
}
function payUrl_(o) { var n = String(o['時間枠'] || ''); return /通し|セット/.test(n) ? conf_('支払ページ（5,500円の枠）') : conf_('支払ページ（3,300円の枠）'); }

/* ================= 運営が台帳を入力したら、次の指示を送る ================= */
function onEditInstalled(e) {
  if (!e || !e.range) return;
  var name = e.range.getSheet().getName();
  if (name === SH.v && e.range.getRow() > 1) { Utilities.sleep(1500); progress_(); }
  if (name === SH.d && e.range.getRow() > 1) decisionsNotify_();
}
function progress_() {
  if (!autoOn_()) return;
  vendors_().forEach(function (o) {
    if (o['状態'] === '見送り') {
      if (!o.sent.declined) { mail_(o, '見送り', '【南草津駅前】今回の出店について', '出店にお申し込みいただき、ありがとうございました。\n誠に申し訳ありませんが、今回は区画・日程の都合により、ご希望に沿うことができませんでした。\n次の開催の募集が始まりましたら、あらためてご案内します。'); markSent_(o, 'declined'); }
      return;
    }
    var ready = o['確定エリア'] && o.dates.length && o['時間枠'];
    if (ready && !o.sent.assigned) {
      var lines = o.dates.map(function (x) { var s = slotTimes_(o, x); return '・' + jpDay_(x) + '　' + (s ? s.name : o['時間枠']); });
      mail_(o, '区画連絡', '【南草津駅前】区画と日程が決まりました（' + o['受付番号'] + '）',
        '出店の区画と日程が決まりました。\n\n■ 区画：' + (ZONE_NAME[o['確定エリア']] || o['確定エリア']) + (o['区画番号'] ? '　区画番号 ' + o['確定エリア'] + o['区画番号'] : '') + '\n■ 出店日と時間\n' + lines.join('\n') + '\n\n' +
        '■ 次にやること：営業許可証を送ってください\n' + conf_('許可証の出し方') + '\n確認できたら、出店料のお支払いページをお送りします。\n\n出店ナビ：' + naviUrl_(o));
      markSent_(o, 'assigned'); if (o['状態'] === '申込受付') setCell_(o._row, '状態', '区画連絡済');
    }
    if (ready && o['許可証'] === '不備あり' && !o.sent.permitNg) {
      mail_(o, '許可証不備', '【南草津駅前】営業許可証をもう一度お送りください', 'お送りいただいた営業許可証の写真で、内容を確認できませんでした。\n許可証の全体（許可の種類・番号・有効期限）がはっきり写るように撮って、このメールに返信してお送りください。\n\n出店ナビ：' + naviUrl_(o));
      markSent_(o, 'permitNg');
    }
    if (ready && o['許可証'] === '確認済' && !o.sent.permit && o['支払'] !== '済') {
      var pay = payUrl_(o);
      mail_(o, '支払案内', '【南草津駅前】出店料のお支払いをお願いします（' + o['受付番号'] + '）',
        '営業許可証を確認しました。ありがとうございます。\n\n■ 次にやること：出店料をカードでお支払いください\n' + (pay ? pay + '\n（' + o.dates.length + '日分。お支払いページで日数を選んでください）' : 'お支払いページは、追ってお送りします。') +
        '\nお支払いの完了で、出店確定です。\n\n出店ナビ：' + naviUrl_(o));
      markSent_(o, 'permit');
    }
    if (ready && o['支払'] === '済' && !o.sent.paid) {
      mail_(o, '出店確定', '【南草津駅前】出店が確定しました（' + o['受付番号'] + '）',
        'お支払いを確認しました。出店確定です。よろしくお願いします。\n\n■ 区画：' + (ZONE_NAME[o['確定エリア']] || '') + '\n■ 搬入口（仮）：' + (GATE[o['確定エリア']] || '') + '\n\n' +
        '■ ここからの流れ（すべて自動でお知らせします）\n・前日夕方：持ち物の確認と、22時までの開催連絡\n・当日：設営の前にお知らせ。設営できたら写真で報告\n・閉店時：片付けたら写真で報告し、売上・人数・アンケートを送って完了\n\n出店ナビ（当日もこの画面を開いてください）：\n' + naviUrl_(o));
      markSent_(o, 'paid'); setCell_(o._row, '状態', '出店確定');
    }
  });
}

/* 開催判断（中止・開催）を、その日の出店者全員に知らせる */
function decisionsNotify_() {
  var ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName(SH.d), dec = decisions_(), list = vendors_();
  Object.keys(dec).forEach(function (ymd) {
    var x = dec[ymd]; if (x.val === '未定' || x.val === x.told) return;
    list.filter(function (o) { return o.dates.indexOf(ymd) >= 0 && o['支払'] === '済' && o['状態'] !== '見送り'; }).forEach(function (o) {
      var key = 'decision:' + ymd + ':' + x.val; if (o.sent[key]) return;
      if (x.val === '中止') mail_(o, '中止', '【南草津駅前】' + jpDay_(ymd) + 'は中止になりました',
        jpDay_(ymd) + 'の開催は、中止になりました。' + (x.note ? '\n理由：' + x.note : '') + '\n出店料は全額返金するか、別の日に振り替えます。どちらがよいか、このメールに返信してお知らせください。\n\n出店ナビ：' + naviUrl_(o));
      else mail_(o, '開催', '【南草津駅前】' + jpDay_(ymd) + 'は予定どおり開催します',
        jpDay_(ymd) + 'は予定どおり開催します。' + (x.note ? '\n' + x.note : '') + '\n当日は出店ナビを開いて、設営前のお知らせを確認してください。\n' + naviUrl_(o));
      markSent_(o, key);
    });
    sh.getRange(x.row, 3).setValue(x.val);
  });
}

/* ================= 時刻になったら送るお知らせ（15分ごと） ================= */
function tick() {
  if (!autoOn_()) return;
  var lock = LockService.getScriptLock(); if (!lock.tryLock(5000)) return;
  try {
    progress_(); decisionsNotify_();
    var now = new Date(), eveHour = Number(conf_('前日のお知らせ時刻')) || 18, dec = decisions_();
    vendors_().forEach(function (o) {
      if (o['支払'] !== '済' || o['状態'] === '見送り') return;
      var log = dayLog_(o['受付番号']);
      o.dates.forEach(function (ymd) {
        if (dec[ymd] && dec[ymd].val === '中止') return;
        var s = slotTimes_(o, ymd); if (!s) return;
        var eve = dateOf_(ymd, '00:00', -(24 - eveHour) * 60), start = dateOf_(ymd, s.start), end = dateOf_(ymd, s.end);
        // 前日夕方
        if (now >= eve && now < start && !o.sent['eve:' + ymd]) {
          mail_(o, '前日', '【南草津駅前】明日 ' + jpDay_(ymd) + ' は出店日です',
            '明日は出店日です。\n■ 区画：' + (ZONE_NAME[o['確定エリア']] || '') + '\n■ 時間：' + s.name + '（設営は60分前から）\n■ 搬入口（仮）：' + (GATE[o['確定エリア']] || '') + '\n\n' +
            '■ 今夜やること\n・持ち物の確認（営業許可証・食材・釣り銭・ごみ袋・消毒用品）\n・22時までに開催するかをお知らせします。雨の日は特に、メールを確認してください\n\n出店ナビ：' + naviUrl_(o));
          markSent_(o, 'eve:' + ymd);
        }
        // 設営前（設営開始の30分前＝開店90分前）
        if (now >= dateOf_(ymd, s.start, -90) && now < end && !o.sent['setup:' + ymd]) {
          mail_(o, '設営前', '【南草津駅前】まもなく設営開始です（' + s.start.replace(/^0/, '') + ' 開店）',
            'おはようございます。今日は出店日です。\n■ 設営開始：' + fmt_(dateOf_(ymd, s.start, -60), 'H:mm') + 'から\n■ 搬入口（仮）：' + (GATE[o['確定エリア']] || '') + '\n\n' +
            '設営できたら、出店ナビで「到着・設営の写真」を送ってください（1分）。\n' + naviUrl_(o) + '\n\n困ったときは：' + conf_('当日の連絡先') + '\n火事・急病は119、事故は110へ。');
          markSent_(o, 'setup:' + ymd);
        }
        // 閉店時
        if (now >= end && !o.sent['close:' + ymd] && !log[ymd + ':report']) {
          mail_(o, '閉店', '【南草津駅前】おつかれさまでした。片付けの写真と終了報告をお願いします',
            '閉店の時刻になりました。おつかれさまでした。\n撤収は45分以内にお願いします。\n\n■ 最後にやること（2つで完了です）\n1. 片付けた区画の写真を送る\n2. 売上・人数・アンケートを送る（約2分）\n\n出店ナビ：' + naviUrl_(o));
          markSent_(o, 'close:' + ymd);
        }
        // 報告がまだのとき（閉店3時間後に1回だけ）
        if (now >= dateOf_(ymd, s.end, 180) && !log[ymd + ':report'] && !o.sent['remind:' + ymd]) {
          mail_(o, '報告のお願い', '【南草津駅前】終了報告がまだ届いていません', jpDay_(ymd) + 'の終了報告（売上・人数・アンケート）がまだ届いていません。\n2分ほどで終わります。次の開催の改善に使わせてください。\n\n' + naviUrl_(o));
          markSent_(o, 'remind:' + ymd);
        }
      });
    });
  } finally { lock.releaseLock(); }
}

/* ================= 確認用 ================= */
function testMail() {
  var me = Session.getActiveUser().getEmail() || OWNER;
  var o = { '屋号': 'テスト食堂', '担当者': '（テスト）', 'メール': me, '受付番号': 'TEST', '鍵': 'test', '確定エリア': 'A', '時間枠': '金曜 15:00〜20:00', dates: ['2026-12-18'], sent: {} };
  mail_(o, 'テスト', '【テスト】出店者台帳からのメール', 'これはテスト送信です。出店ナビのリンク例：' + naviUrl_(o));
  SpreadsheetApp.getActive().toast(me + ' にテストメールを送りました。');
}
function showSummary() {
  var l = vendors_(), c = {}; l.forEach(function (o) { c[o['状態']] = (c[o['状態']] || 0) + 1; });
  var r = SpreadsheetApp.getActive().getSheetByName(SH.rep).getDataRange().getValues().slice(1);
  var sales = r.reduce(function (a, x) { return a + (Number(x[5]) || 0); }, 0), people = r.reduce(function (a, x) { return a + (Number(x[6]) || 0); }, 0);
  SpreadsheetApp.getUi().alert('出店者：' + l.length + '件\n' + Object.keys(c).map(function (k) { return '・' + k + '：' + c[k] + '件'; }).join('\n') +
    '\n\n終了報告：' + r.length + '件\n売上合計：' + sales.toLocaleString('ja-JP') + '円\nお客さん合計：' + people + '人');
}
