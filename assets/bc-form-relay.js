/*
 * BRIDGE CYCLE フォーム中継（2026-11-01）
 * FormSubmit の AJAX 送信では自動返信（_autoresponse）が送られないため、
 * FormSubmit 宛ての送信を先に自社の Google Apps Script（info@ から通知＋自動返信）へ回す。
 * Apps Script が失敗したときだけ、元どおり FormSubmit に送る（取りこぼし防止）。
 * ページ側の送信コードは変更不要。ファイル添付を含む送信は対象外（FormSubmit へそのまま送る）。
 * サーバー側のコード：gas/form-relay/Code.gs
 */
(function () {
  "use strict";
  var GAS = "https://script.google.com/macros/s/AKfycbxPWEX8MbMaAJ0LE92aw5f8G2FKE79hT-YywiBUA0RCl-Ra8sm3hqV_LktOA9FVMNSg/exec";
  var TARGET = /^https:\/\/formsubmit\.co\/ajax\/info@bridgecycleco\.com\/?$/;
  var original = window.fetch;
  if (!original || window.__bcFormRelay) return;
  window.__bcFormRelay = true;

  function toObject(body) {
    if (typeof body === "string") {
      try { var o = JSON.parse(body); return o && typeof o === "object" && !Array.isArray(o) ? o : null; } catch (e) { return null; }
    }
    if (window.FormData && body instanceof FormData) {
      var out = {}, hasFile = false;
      body.forEach(function (v, k) {
        if (typeof v !== "string") { if (v && v.size) hasFile = true; return; }
        out[k] = Object.prototype.hasOwnProperty.call(out, k) ? out[k] + "、" + v : v;
      });
      return hasFile ? null : out;
    }
    return null;
  }

  window.fetch = function (input, init) {
    var self = this, args = arguments;
    try {
      var url = typeof input === "string" ? input : (input && input.url) || "";
      if (!TARGET.test(url) || !init || String(init.method || "GET").toUpperCase() !== "POST") return original.apply(self, args);
      var data = toObject(init.body);
      if (!data) return original.apply(self, args);
      var payload = {};
      Object.keys(data).forEach(function (k) { payload[k] = data[k]; });
      payload.form = payload.form || location.pathname;
      payload._page = location.href.split("#")[0];
      return original.call(window, GAS, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      }).then(function (r) { return r.json(); }).then(function (j) {
        if (!j || j.success !== true) throw new Error("relay failed");
        window.bcFormAutoreply = j.autoreply === true;
        return new Response(JSON.stringify({ success: "true", message: "The form was submitted successfully." }), {
          status: 200, headers: { "Content-Type": "application/json" }
        });
      }).catch(function () { return original.apply(self, args); });
    } catch (e) {
      return original.apply(self, args);
    }
  };

  /* ---- 通常送信（画面遷移型・ファイル添付あり）のフォーム ----
     FormSubmit の通常送信は「送信完了」と表示しても届かないことがあったため（2026-11-01 確認）、
     添付ファイルごと Apps Script に送り、成功したら _next に遷移する。
     失敗時は申込を失わないよう、画面に連絡先を出して再送信できる状態に戻す。 */
  var NATIVE = /^https:\/\/formsubmit\.co\/info@bridgecycleco\.com\/?$/;
  var MAX_TOTAL = 10 * 1024 * 1024;

  function readFile(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(",")[1] || ""); };
      r.onerror = function () { reject(r.error); };
      r.readAsDataURL(file);
    });
  }

  function showError(form, btn, msg) {
    var box = form.querySelector(".bc-relay-error");
    if (!box) {
      box = document.createElement("div");
      box.className = "bc-relay-error";
      box.setAttribute("role", "alert");
      box.style.cssText = "color:#bf4429;font-weight:700;font-size:.92rem;line-height:1.8;margin-top:12px";
      (btn && btn.parentNode ? btn.parentNode : form).appendChild(box);
    }
    box.innerHTML = (msg || "送信できませんでした。通信環境をご確認のうえ、もう一度お試しください。") + "<br>解決しない場合は "
      + '<a href="mailto:info@bridgecycleco.com">info@bridgecycleco.com</a> または '
      + '<a href="https://line.me/R/ti/p/@907kxssd" target="_blank" rel="noopener">公式LINE</a> へご連絡ください。';
    form.dataset.sending = "";
    if (btn) { btn.disabled = false; btn.textContent = "もう一度送信する"; }
  }

  document.addEventListener("submit", function (e) {
    var form = e.target;
    if (!form || form.tagName !== "FORM" || e.defaultPrevented) return;
    if (!NATIVE.test(form.getAttribute("action") || "")) return;
    if (!window.FormData || !window.FileReader || !window.Promise) return;   // 古い環境は従来どおり
    e.preventDefault();
    var btn = form.querySelector('button[type="submit"],input[type="submit"]');
    var fd = new FormData(form), payload = {}, files = [], total = 0;
    fd.forEach(function (v, k) {
      if (typeof v !== "string") { if (v && v.size) { files.push({ key: k, file: v }); total += v.size; } return; }
      payload[k] = Object.prototype.hasOwnProperty.call(payload, k) ? payload[k] + "、" + v : v;
    });
    if (total > MAX_TOTAL) { showError(form, btn, "添付ファイルの合計が10MBを超えています。枚数を減らすか、小さい画像にしてお試しください。"); return; }
    payload.form = location.pathname;
    payload._page = location.href.split("#")[0];
    Promise.all(files.map(function (f) {
      return readFile(f.file).then(function (b64) {
        return { field: f.key, name: f.file.name || "file", type: f.file.type || "application/octet-stream", data: b64 };
      });
    })).then(function (list) {
      payload._files = list;
      return original.call(window, GAS, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      });
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j || j.success !== true) throw new Error("relay failed");
      window.bcFormAutoreply = j.autoreply === true;
      var next = payload._next;
      if (next && /^https:\/\/www\.bridgecycleco\.com\//.test(next)) { location.href = next; }
      else { form.innerHTML = '<p style="font-weight:700;text-align:center;padding:24px 8px">送信しました。ありがとうございました。</p>'; }
    }).catch(function () { showError(form, btn); });
  });
})();
