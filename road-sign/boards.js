/* トオリミチ：空き看板データの読み込み（akiban.html・トップ・クリニック向けページで共通）
   data/boards.json は「公開してよい項目だけ」を tools/build_boards.py で書き出したもの。
   看板会社名・担当者・連絡先・正確な所在地・紹介条件は、このファイルにも boards.json にも入れない。
   念のため、ここでも公開できる項目だけを通し、それ以外の項目は捨てる。 */
(() => {
  'use strict';
  const STALE_DAYS = 30;
  const FIELDS = {
    full: ['id', 'city', 'place', 'kind', 'facing', 'size', 'monthly_fee', 'fee_note', 'setup_fee', 'min_term_months', 'vacancy', 'confirmed_at', 'permit', 'suits', 'photo', 'map_url', 'publish_scope'],
    area_price: ['id', 'city', 'kind', 'size', 'monthly_fee', 'fee_note', 'setup_fee', 'min_term_months', 'vacancy', 'confirmed_at', 'suits', 'publish_scope']
  };
  const load = () => fetch('data/boards.json?t=' + Math.floor(Date.now() / 600000), {cache: 'no-cache'})
    .then(r => { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
    .catch(() => ({min_public: 5, boards: [], error: true}));
  const pick = b => {
    const keys = FIELDS[b && b.publish_scope];
    if (!keys || (b.status && b.status !== '公開')) return null;
    const o = {}; keys.forEach(k => { if (b[k] !== undefined) o[k] = b[k]; }); return o;
  };
  const isStale = b => {
    if (!b.confirmed_at) return true;
    const d = Date.parse(b.confirmed_at);
    if (!isFinite(d) || d > Date.now() + 864e5) return true;   // 日付が読めない・未来の日付は「要再確認」
    return (Date.now() - d) / 864e5 > STALE_DAYS;
  };
  const ready = load().then(data => {
    const boards = (data.boards || []).map(pick).filter(Boolean);
    const m = Number(data.min_public), min = Number.isFinite(m) && m >= 0 ? m : 5;
    const l = Number(data.list_min), listMin = Number.isFinite(l) && l >= 0 ? l : 5;
    const open = !data.error && boards.length >= min, listOpen = boards.length >= listMin;
    document.querySelectorAll('[data-boards-link]').forEach(el => {
      if (open) el.hidden = false;
      const label = listOpen ? el.dataset.labelOpen : el.dataset.labelPre;
      const target = el.matches('a') ? el : el.querySelector('a');
      if (label && target) target.textContent = label;
    });
    return {boards, min, open, listOpen, error: !!data.error};
  });
  window.TooriBoards = {ready, isStale, STALE_DAYS};
})();
