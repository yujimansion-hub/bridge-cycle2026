/* トオリミチの無料診断フォーム：選択された業種に応じた入力補助。
   既存の送信処理(app.js)、UTM、GA4の計測区分は変更しない。 */
(() => {
  'use strict';
  const form = document.querySelector('form.leadform[data-form="advertiser"]');
  if (!form) return;
  const industry = form.querySelector('select[name="industry"]');
  if (!industry) return;
  const clinicOnly = [...form.querySelectorAll('[data-clinic-only]')];
  const signageOnly = [...form.querySelectorAll('[data-signage-only]')];
  const names = {
    area: form.querySelector('[data-audience-copy="area"]'),
    status: form.querySelector('[data-audience-copy="status"]'),
    shop: form.querySelector('[data-audience-copy="shop"]'),
    optional: form.querySelector('[data-audience-copy="optional"]'),
    company: form.querySelector('[data-audience-copy="company"]')
  };
  const update = () => {
    const clinic = industry.value === 'クリニック・歯科';
    form.dataset.clinicMode = clinic ? 'clinic' : 'general';
    for (const el of clinicOnly) {
      el.hidden = !clinic;
      for (const field of el.querySelectorAll('input,select,textarea')) {
        field.disabled = !clinic;
        if (!clinic && field.type === 'checkbox') field.checked = false;
      }
    }
    for (const el of signageOnly) {
      el.hidden = clinic;
      for (const field of el.querySelectorAll('input,select,textarea')) {
        field.disabled = clinic;
        if (clinic && field.type === 'checkbox') field.checked = false;
      }
    }
    if (names.area) names.area.textContent = clinic ? '医院の所在地 *' : 'お店の所在地（予定地） *';
    if (names.status) names.status.textContent = clinic ? '医院の状況 *' : 'お店の状況 *';
    if (names.shop) names.shop.textContent = clinic ? '医院名、またはGoogleマップのURL *' : '店名、またはGoogleマップのURL *';
    if (names.optional) names.optional.textContent = clinic
      ? '任意の項目（医院名・気になっていること）'
      : '任意の項目（予算・掲載時期・広告の種類・店舗名・相談内容）';
    if (names.company) names.company.textContent = clinic ? '医院名（任意）' : '会社名・店舗名（任意）';
    const message = form.querySelector('[data-audience-message]');
    if (message) message.placeholder = clinic
      ? '例：Googleマップの診療時間が古い、予約の入口が分かりにくい'
      : '気になることや、お困りごとがあればお書きください';
  };
  const params = new URLSearchParams(location.search);
  if (/^(clinic|medical|dental)$/i.test(params.get('industry') || '')) {
    industry.value = 'クリニック・歯科';
  }
  industry.addEventListener('change', () => {
    update();
    // This event distinguishes clinic inquiries from ordinary signage inquiries.
    // The established FV-V3_CL attribution and form submit events are unchanged.
    try {
      if (typeof window.bcTrack === 'function') {
        window.bcTrack('lp_audience_selected', {
          lead_category: industry.value === 'クリニック・歯科' ? 'clinic' : 'other',
          fv_variant: window.trFv || 'V3_CL'
        });
      }
    } catch (_) { /* Analytics must never block the form. */ }
  });
  update();
})();
