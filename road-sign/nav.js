/* スマホ用メニュー（幅850px以下で表示）。ヘッダーにボタンを足し、主要な入口をまとめて出す */
(() => {
  'use strict';
  const bar = document.querySelector('.topnav .navrow');
  if (!bar || document.getElementById('spmenu')) return;
  const here = (location.pathname.split('/').pop() || 'index.html');
  const items = [
    ['./', 'index.html', '集客診断', '無料診断・ご相談'],
    ['kaiin.html', 'kaiin.html', 'クリニック', '開院・歯科の集客支援'],
    ['akiban.html', 'akiban.html', '看板を探す', '空き媒体と希望条件の相談'],
    ['maps.html', 'maps.html', '提案事例', '看板 × 検索 × 来店'],
    ['owner.html', 'owner.html', '場所を貸す', '土地・外壁の広告活用'],
    ['partner.html', 'partner.html', '看板会社', '媒体の登録・提携の相談']
  ];
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'spmenu-btn'; btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', 'spmenu');
  btn.innerHTML = '<span class="spmenu-ic" aria-hidden="true"><i></i><i></i><i></i></span><span class="spmenu-tx">メニュー</span>';
  const panel = document.createElement('nav');
  panel.id = 'spmenu'; panel.className = 'spmenu'; panel.hidden = true; panel.setAttribute('aria-label', 'ページの一覧');
  panel.innerHTML = items.map(([href, file, label, sub]) => '<a href="' + href + '"' + (file === here ? ' aria-current="page"' : '') + '><b>' + label + '</b><span>' + sub + '</span></a>').join('') +
    '<a class="spmenu-line" href="https://line.me/R/ti/p/@907kxssd" target="_blank" rel="noopener"><b>LINEで相談する</b><span>写真を送るだけでも構いません</span></a>';
  bar.append(btn); document.querySelector('.topnav').append(panel);
  const set = open => { btn.setAttribute('aria-expanded', String(open)); panel.hidden = !open; document.body.classList.toggle('spmenu-open', open); };
  btn.addEventListener('click', () => set(panel.hidden));
  panel.addEventListener('click', e => { if (e.target.closest('a')) set(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) { set(false); btn.focus(); } });
  document.addEventListener('click', e => { if (!panel.hidden && !e.target.closest('.topnav')) set(false); });
})();
