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
})();
