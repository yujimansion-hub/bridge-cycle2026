(() => {
  'use strict';
  const cfg = window.KEIJI_LP_CONFIG || {};
  const fmt = n => Math.round(n).toLocaleString('ja-JP') + '円';
  const f = document.getElementById('feeSlider');
  const m = document.getElementById('monthsSlider');
  const update = () => {
    if (!f || !m) return;
    const fee = Number(f.value), months = Number(m.value);
    document.getElementById('feeVal').textContent = fmt(fee);
    document.getElementById('monthsVal').textContent = months + 'か月';
    document.getElementById('grossRevenue').textContent = fmt(fee * months);
  };
  [f,m].forEach(el => el?.addEventListener('input', update)); update();
  const track = (name, label) => {
    const data = {event: name, audience: document.body.dataset.audience || '', action: label || ''};
    if (Array.isArray(window.dataLayer)) window.dataLayer.push(data);
    if (typeof window.gtag === 'function') window.gtag('event', name, {action: label || '', audience: data.audience});
  };
  const NEXT = {
    advertiser: ['担当者が内容を確認します。', '地図と道路の情報から、看板が向いているかを調べてメールでお返事します。', '向いている場合は、看板会社に空きと料金を照会し、候補を並べたプランをお送りします。'],
    board: ['担当者が内容を確認します。', '看板会社に、ご希望の地域と予算で空き状況を確認します。', '条件に合う候補があればご案内します。見つからない場合も、その旨をお知らせします。'],
    clinic: ['担当者が内容を確認します。', '公開されている情報から集客診断を行い、結果をお送りします。', 'ご希望があれば、15分のオンライン相談で内容をご説明します。'],
    media_register: ['担当者が登録内容を確認します。', 'サイトへの掲載範囲と紹介の条件を、メールで確認させていただきます。', '承諾いただいた範囲で、広告主探しを始めます。'],
    media_partner: ['担当者が内容を確認します。', '15分ほどの面談の日程をご相談します。', '試験提携の条件を、書面で確認してから始めます。'],
    owner: ['担当者が内容を確認します。', '道路からの見え方と、その場所の規制を一次確認します。', '広告スペースにできそうかを、メールでお伝えします。']
  };
  const receipt = () => { const d = new Date(), p = n => String(n).padStart(2, '0'), r = new Uint32Array(1); (window.crypto || {getRandomValues: a => { a[0] = Math.random() * 4294967295; return a; }}).getRandomValues(r); return 'TR-' + String(d.getFullYear()).slice(2) + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + '-' + r[0].toString(36).toUpperCase().slice(0, 4).padStart(4, '0'); };
  const doneHTML = (type, no) => '<div class="formdone" role="status"><p class="fdh">送信が完了しました</p>' + (no ? '<p class="fdno">受付番号 <b>' + no + '</b></p>' : '') + '<p class="fdl">このあとの流れ</p><ol>' + (NEXT[type] || NEXT.advertiser).map(s => '<li>' + s + '</li>').join('') + '</ol><p class="fdn">お急ぎの場合は、LINE（@907kxssd）からもご連絡いただけます。</p></div>';
  document.querySelectorAll('.track-cta').forEach(el => el.addEventListener('click', () => track('lp_cta_click', el.dataset.action || 'cta')));
  const params = new URLSearchParams(location.search);
  for (const form of document.querySelectorAll('.leadform')) {
    ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].forEach(k => {
      const hidden = document.createElement('input');hidden.type='hidden';hidden.name=k;hidden.value=(params.get(k)||'').slice(0,150);form.append(hidden);
    });
    for (const [k,v] of [['source_page',location.pathname],['referrer',document.referrer],['source_name',cfg.sourceName||'v5'],['submitted_at',new Date().toISOString()]]){
      const hidden = document.createElement('input');hidden.type='hidden';hidden.name=k;hidden.value=v;form.append(hidden);
    }
    const msg = form.querySelector('.form-msg');
    if (params.get('sent') === '1' && (!params.get('f') || params.get('f') === (form.dataset.form || 'advertiser'))) { const ft = form.dataset.form || 'advertiser'; form.innerHTML = doneHTML(ft, (params.get('no') || '').replace(/[^A-Z0-9-]/g, '').slice(0, 24)); if (params.get('f')) { const key = 'tr_done_' + (params.get('no') || ''); let seen = false; try { seen = sessionStorage.getItem(key) === '1'; sessionStorage.setItem(key, '1'); } catch (e) {} if (!seen) track('lp_lead_submit_success', ft + '_with_photo'); } continue; }
    let started = false;
    form.addEventListener('focusin', () => { if (!started) { started = true; track('lp_form_start', form.dataset.form || 'advertiser'); } });
    const LABELS = {area:'所在地・地域',industry:'業種',budget:'月額広告予算',start_period:'掲載開始の希望',company:'会社名・店舗名',name:'お名前',email:'メールアドレス',tel:'電話番号',empty_count:'空き面数の目安',media_role:'お立場',message:'ご相談内容',property_type:'物件の種類',ownership:'所有の形',road:'面している道路',size:'おおよその大きさ',self_score:'簡易チェックの点数',media_kind:'媒体の種類',monthly_fee:'月額掲載料の目安',min_term:'最短契約期間',vacancy:'空き状況',permit:'許可の状況',publish_scope:'サイトへの掲載',facing:'見る方向',fit_score:'看板の向き不向きチェック',map_url:'GoogleマップのURL',purpose:'ご相談の種類',board_id:'看板ID',business:'業種',specialty:'診療科',clinic_status:'医院の状況',timing:'開院・変更の時期',media_type:'検討中の広告の種類',notify_later:'条件に合う看板が見つかったら連絡してよいか',utm_source:'utm_source',utm_medium:'utm_medium',utm_campaign:'utm_campaign',utm_content:'utm_content',utm_term:'utm_term',source_page:'送信ページ',referrer:'参照元',submitted_at:'送信日時'};
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (form.querySelector('[name="website_url"]').value) return;
      if (!form.reportValidity()) return;
      if (!form.querySelector('[name="consent"]').checked) {form.querySelector('[name="consent"]').focus();return;}
      const type = form.dataset.form || 'advertiser';
      const SUBJ = {media_partner:['【トオリミチ】看板会社からの試験提携相談','看板会社'], owner:['【トオリミチ】壁面・土地の広告スペース確認依頼','建物・土地の所有者'], media_register:['【トオリミチ】空き媒体の登録','看板会社（媒体登録）'], advertiser:['【トオリミチ】広告主の看板候補相談','広告主'], clinic:['【トオリミチ】クリニック・歯科の集客診断依頼','クリニック・歯科'], board:['【トオリミチ】空き看板への相談','広告主（空き看板）']};
      const [subject, kind] = SUBJ[type] || SUBJ.advertiser;
      const no = receipt();
      const payload = {_subject: subject + '（' + no + '）', _template: 'table', 受付番号: no, 種別: kind, 個人情報の取扱いへの同意: 'あり'};
      for (const [k,v] of new FormData(form).entries()) {
        if (!v || v instanceof File || /^(website_url|consent|source_name)$/.test(k)) continue;
        payload[LABELS[k]||k] = String(v).slice(0,1000);
      }
      track('lp_lead_submit_attempt', type);
      const endpoint = (cfg.formEndpoint||'').trim();
      const submit = form.querySelector('button[type="submit"]');
      const mailto = `mailto:${cfg.contactEmail||'info@bridgecycleco.com'}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(Object.entries(payload).filter(([k])=>!k.startsWith('_')).map(([k,v])=>`${k}：${v}`).join('\n'))}`;
      const fail = () => {
        submit.disabled = false; submit.textContent = submit.dataset.label;
        msg.innerHTML = '送信できませんでした。お手数ですが、<a href="'+mailto+'" style="text-decoration:underline">こちらからメールで</a>お送りいただくか、LINE（@907kxssd）からご連絡ください。';
      };
      if (!/^https:\/\/(formsubmit\.co|formspree\.io)\//.test(endpoint)) { location.href = mailto; return; }
      const fileInput = form.querySelector('input[type="file"]');
      if (fileInput && fileInput.files.length && /formsubmit\.co/.test(endpoint)) {
        if ([...fileInput.files].some(f => f.size > 5*1024*1024)) { msg.textContent = '写真は1枚5MBまでです。大きい写真はLINE（@907kxssd）でお送りください。'; return; }
        const nf = document.createElement('form'); nf.method = 'POST'; nf.enctype = 'multipart/form-data'; nf.action = endpoint.replace('/ajax/', '/'); nf.style.display = 'none';
        const add = (k, v) => { const i = document.createElement('input'); i.type = 'hidden'; i.name = k; i.value = v; nf.append(i); };
        for (const [k, v] of Object.entries(payload)) add(k, v);
        add('_captcha', 'false'); add('_next', location.origin + location.pathname + '?sent=1&f=' + encodeURIComponent(type) + '&no=' + encodeURIComponent(no) + '#' + ((form.closest('section') || {}).id || 'contact'));
        fileInput.name = 'attachment'; nf.append(fileInput); document.body.append(nf);
        track('lp_lead_submit_attempt', type + '_with_photo'); nf.submit(); return;
      }
      submit.dataset.label = submit.textContent; submit.disabled = true; submit.textContent = '送信しています…';
      try {
        const res = await fetch(endpoint, {method:'POST', headers:{'Content-Type':'application/json','Accept':'application/json'}, body: JSON.stringify(payload)});
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false || data.success === 'false') { fail(); return; }
        track('lp_lead_submit_success', type);
        form.innerHTML = doneHTML(type, no); form.scrollIntoView({behavior: 'smooth', block: 'center'});
      } catch (e) { fail(); }
    });
  }
})();
