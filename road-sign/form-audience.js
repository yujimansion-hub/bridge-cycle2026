/* タドリツクの無料診断フォーム：選択された業種に応じた入力補助。
   既存の送信処理(app.js)、UTM、GA4の計測区分は変更しない。 */
(() => {
  'use strict';
  const form = document.querySelector('form.leadform[data-form="advertiser"]');
  if (!form) return;
  const industry = form.querySelector('select[name="industry"]');
  if (!industry) return;
  const clinicOnly = [...form.querySelectorAll('[data-clinic-only]')];
  const signageOnly = [...form.querySelectorAll('[data-signage-only]')];
  const statusGeneral = form.querySelector('[data-general-status]');
  const statusClinic = form.querySelector('select[name="clinic_status"]');
  const statusRadios = [...form.querySelectorAll('input[name="store_status"]')];
  const companyGeneral = form.querySelector('[data-general-company]');
  const names = {
    area: form.querySelector('[data-audience-copy="area"]'),
    status: form.querySelector('[data-audience-copy="status"]'),
    shop: form.querySelector('[data-audience-copy="shop"]'),
    optional: form.querySelector('[data-audience-copy="optional"]')
  };
  // Four clinic statuses use the exact choices from kaiin.html.
  // The original radios are internal display switches; they are not submitted for clinics.
  const syncClinicStatus = () => {
    if (form.dataset.clinicMode !== 'clinic') return;
    const choice = statusClinic?.value || '';
    const internalStatus = !choice ? '' : choice === 'これから開院する' ? '開業前' : '営業中';
    for (const radio of statusRadios) radio.checked = !!internalStatus && radio.value === internalStatus;
    // The existing script in index.html updates open/pre-opening detail fields.
    statusRadios[0]?.dispatchEvent(new Event('change',{bubbles:true}));
  };
  let previousMode = null;
  const update = () => {
    const clinic = industry.value === 'クリニック・歯科';
    const mode = clinic ? 'clinic' : 'general';
    const switched = previousMode !== null && previousMode !== mode;
    previousMode = mode;
    form.dataset.clinicMode = mode;
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
    if (companyGeneral) {
      companyGeneral.hidden = clinic;
      for (const field of companyGeneral.querySelectorAll('input,select,textarea')) {
        field.disabled = clinic;
        if (clinic) field.value = '';
      }
    }
    if (statusGeneral) statusGeneral.hidden = clinic;
    for (const radio of statusRadios) {
      radio.disabled = clinic;
      radio.required = !clinic;
      if (switched) radio.checked = false;
    }
    if (switched && statusClinic) statusClinic.value = '';
    if (clinic) syncClinicStatus();
    else statusRadios[0]?.dispatchEvent(new Event('change',{bubbles:true}));
    if (names.area) names.area.textContent = clinic ? '医院の所在地 *' : 'お店の所在地（予定地） *';
    if (names.status) names.status.textContent = 'お店の状況 *';
    if (names.shop) names.shop.textContent = clinic ? '医院名、またはGoogleマップのURL *' : '店名、またはGoogleマップのURL *';
    if (names.optional) names.optional.textContent = clinic
      ? '任意の項目（気になっていること）'
      : '任意の項目（予算・掲載時期・広告の種類・店舗名・相談内容）';
    const message = form.querySelector('[data-audience-message]');
    if (message) message.placeholder = clinic
      ? '例：Googleマップの診療時間が古い、予約の入口が分かりにくい'
      : '気になることや、お困りごとがあればお書きください';
  };
  statusClinic?.addEventListener('change', syncClinicStatus);
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
