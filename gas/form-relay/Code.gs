/**
 * BRIDGE CYCLE フォーム受付（通知＋自動返信）
 * 実行ユーザー：info@bridgecycleco.com ／ アクセス：全員
 * サイトのフォームから JSON（Content-Type: text/plain）で POST される。
 */
var OWNER = 'info@bridgecycleco.com';
var SENDER_NAME = 'BRIDGE CYCLE株式会社';
var DAILY_LIMIT = 80;          // 1日あたりの自動返信上限（迷惑送信対策）
var PER_EMAIL_SECONDS = 600;   // 同一アドレスへの再送間隔（秒）

var TEMPLATES = {
  setsubi_kounyu: {
    notifyLabel: '設備購入者LP・無料一次確認',
    subject: '【BRIDGE CYCLE】無料一次確認のお申込みを受け付けました',
    intro: '設備投資の無料一次確認にお申込みいただき、ありがとうございます。\n以下の内容で受け付けました。',
    next: '■ この後の流れ\n'
      + '担当者が内容を確認し、原則として翌営業日を目安に、このメールアドレスへ一次回答をお送りします。\n'
      + '見積書がお手元にある場合は、このメールへの返信に添付してください（任意です）。\n\n'
      + '■ 発注前のご注意\n'
      + '補助金によっては、交付決定より前に発注・契約した設備が対象外になります。\n'
      + '設備の発注・契約は、一次回答をご確認いただいてからご判断ください。\n\n'
      + '初回の一次確認は無料です。この段階で費用や契約が発生することはありません。',
    fields: ['設備名', '概算金額（万円）', '導入目的', '導入予定時期', '結果説明（15分）']
  },
  _default: {
    notifyLabel: 'サイトからのお問い合わせ',
    subject: '【BRIDGE CYCLE】お問い合わせを受け付けました',
    intro: 'お問い合わせいただき、ありがとうございます。\n以下の内容で受け付けました。',
    next: '■ この後の流れ\n担当者が内容を確認し、原則として翌営業日を目安にご連絡します。',
    fields: []
  }
};

function doPost(e) {
  try {
    var d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (d._honey) return json_({ success: true });               // ボット
    var email = String(d.email || d._replyto || '').trim();
    var company = String(d['会社名・屋号'] || d.company || '').trim().slice(0, 120);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 180) {
      return json_({ success: false, error: 'invalid_email' });
    }
    var key = String(d.form || '');
    var tpl = TEMPLATES[key] || TEMPLATES._default;
    var custom = (!TEMPLATES[key] && typeof d._autoresponse === 'string') ? customReply_(d._autoresponse) : null;

    // 1) 社内通知（必ず送る）
    var subject = String(d._subject || ('【' + tpl.notifyLabel + '】' + company)).slice(0, 200);
    var rows = Object.keys(d).filter(function (k) { return k.charAt(0) !== '_' && k !== 'form'; })
      .map(function (k) { return k + '：' + String(d[k]).slice(0, 2000); });
    var nbody = rows.join('\n') + '\n\n送信ページ：' + String(d._page || '').slice(0, 300)
      + '\n受信日時：' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm');
    var attachments = filesToBlobs_(d._files);
    if (attachments.length) {
      nbody += '\n添付：' + attachments.map(function (b) { return b.getName(); }).join('、');
    }
    MailApp.sendEmail({
      to: OWNER, replyTo: email, name: 'BRIDGE CYCLE フォーム',
      subject: subject, body: nbody, htmlBody: toHtml_(nbody), attachments: attachments
    });

    // 2) 自動返信（上限内のみ）
    var sent = false;
    if (custom) {
      // 各ページに書かれた自動返信文（リンクは自社・公式LINEのみ許可）
      if (custom.ok && canAutoReply_(email)) {
        MailApp.sendEmail({ to: email, replyTo: OWNER, name: SENDER_NAME, subject: custom.subject, body: custom.body, htmlBody: toHtml_(custom.body) });
        sent = true;
      }
    } else if (TEMPLATES[key] && canAutoReply_(email)) {
      var lines = tpl.fields.filter(function (k) { return d[k]; })
        .map(function (k) { return '・' + k + '：' + String(d[k]).slice(0, 300); });
      var body = (company ? company + ' 御中\n\n' : '')
        + tpl.intro + '\n'
        + '※このメールは自動送信です。\n\n'
        + (lines.length ? '■ 受付内容\n' + lines.join('\n') + '\n\n' : '')
        + tpl.next + '\n\n'
        + 'お心当たりのない場合は、お手数ですがこのメールを破棄してください。\n\n'
        + '――――――――――――――――\n'
        + 'BRIDGE CYCLE株式会社（認定経営革新等支援機関）\n'
        + '戻れるから、踏み出せる。\n'
        + '〒520-0801 滋賀県大津市におの浜2-1-28\n'
        + 'info@bridgecycleco.com ／ https://www.bridgecycleco.com/\n'
        + '公式LINE：https://line.me/R/ti/p/@907kxssd\n'
        + '――――――――――――――――';
      MailApp.sendEmail({ to: email, replyTo: OWNER, name: SENDER_NAME, subject: tpl.subject, body: body, htmlBody: toHtml_(body) });
      sent = true;
    }
    return json_({ success: true, autoreply: sent });
  } catch (err) {
    console.error(err);
    return json_({ success: false, error: 'server' });
  }
}

var ALLOWED_HOSTS = /^(www\.)?bridgecycleco\.com$|^line\.me$|^lin\.ee$/i;

function customReply_(raw) {
  var text = String(raw).replace(/\r\n?/g, '\n').trim().slice(0, 3000);
  if (!text) return { ok: false };
  var urls = text.match(/https?:\/\/[^\s\/)）」』>]+/g) || [];
  for (var i = 0; i < urls.length; i++) {
    var host = urls[i].replace(/^https?:\/\//, '').split(':')[0];
    if (!ALLOWED_HOSTS.test(host)) return { ok: false };
  }
  var first = text.split('\n')[0];
  var subject = /^【[^】]{1,40}】/.test(first) ? first.slice(0, 80) : '【BRIDGE CYCLE】お問い合わせを受け付けました';
  var body = text
    + '\n\n――――――――――――――――\n'
    + 'このメールは、BRIDGE CYCLE株式会社のWebフォームから自動送信しています。\n'
    + 'お心当たりのない場合は、お手数ですがこのメールを破棄してください。\n'
    + 'https://www.bridgecycleco.com/';
  return { ok: true, subject: subject, body: body };
}

/** 添付ファイル（base64）をメール添付に変換。最大5件・合計10MB、画像とPDFのみ */
function filesToBlobs_(files) {
  if (!Array.isArray(files)) return [];
  var out = [], total = 0;
  for (var i = 0; i < files.length && out.length < 5; i++) {
    var f = files[i] || {};
    var type = String(f.type || '');
    if (!/^image\/|^application\/pdf$/.test(type) || typeof f.data !== 'string') continue;
    var bytes = Utilities.base64Decode(f.data);
    total += bytes.length;
    if (total > 10 * 1024 * 1024) break;
    var label = String(f.field || '添付').replace(/[\\\/:*?"<>|]/g, '').slice(0, 30);
    var name = String(f.name || 'file').replace(/[\\\/:*?"<>|]/g, '').slice(0, 80);
    out.push(Utilities.newBlob(bytes, type, label + '_' + name));
  }
  return out;
}

function toHtml_(t) {
  return '<div style="font-family:sans-serif;font-size:14px;line-height:1.8;color:#1f2933">'
    + String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')
    + '</div>';
}

function doGet() { return json_({ ok: true }); }

function canAutoReply_(email) {
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var cache = CacheService.getScriptCache();
    var ek = 'e:' + Utilities.base64EncodeWebSafe(email.toLowerCase()).slice(0, 200);
    if (cache.get(ek)) return false;
    var day = 'd:' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd');
    var n = Number(cache.get(day) || 0);
    if (n >= DAILY_LIMIT || MailApp.getRemainingDailyQuota() < 20) return false;
    cache.put(day, String(n + 1), 21600);
    cache.put(ek, '1', PER_EMAIL_SECONDS);
    return true;
  } finally { lock.releaseLock(); }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/** 初回の権限許可用（エディタで一度だけ実行） */
function authorize() { MailApp.getRemainingDailyQuota(); }
