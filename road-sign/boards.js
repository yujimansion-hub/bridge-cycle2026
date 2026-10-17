/* トオリミチ：空き看板データの読み込み（akiban.html・トップ・クリニック向けページで共通）
   data/boards.json に掲載承諾済みの看板が min_public 面以上そろうと、
   [data-boards-link] の付いた導線が自動で表示される。 */
(() => {
  'use strict';
  const STALE_DAYS = 30;
  const load = () => fetch('data/boards.json?t=' + Math.floor(Date.now() / 600000), {cache: 'no-cache'})
    .then(r => r.ok ? r.json() : {min_public: 5, boards: []})
    .catch(() => ({min_public: 5, boards: []}));
  const eligible = b => b && (b.publish_scope === 'full' || b.publish_scope === 'area_price');
  const isStale = b => {
    if (!b.confirmed_at) return true;
    const d = Date.parse(b.confirmed_at);
    return !isFinite(d) || (Date.now() - d) / 864e5 > STALE_DAYS;
  };
  const ready = load().then(data => {
    const boards = (data.boards || []).filter(eligible);
    const m = Number(data.min_public), min = Number.isFinite(m) && m >= 0 ? m : 5;
    const open = boards.length >= min;
    if (open) document.querySelectorAll('[data-boards-link]').forEach(el => { el.hidden = false; });
    return {boards, min, open};
  });
  window.TooriBoards = {ready, isStale, STALE_DAYS};
})();
