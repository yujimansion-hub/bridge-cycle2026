// jGrants（デジタル庁の補助金電子申請システム）の公開APIから、
// いま受付中の国・自治体の補助金を集めて data/jgrants.json に書き出します。
// GitHub Actions（.github/workflows/update-hojokin.yml）が3日ごとに実行します。
// 手元で動かす場合：node scripts/fetch-jgrants.mjs
import { writeFile, readFile } from 'node:fs/promises';

const API = 'https://api.jgrants-portal.go.jp/exp/v1/public/subsidies';
const KEYWORDS = ['補助', '助成', '支援', '給付', '奨励', '事業', '交付金', '補助金'];
const OUT = new URL('../data/jgrants.json', import.meta.url);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 事業者の役に立たないもの（練習用・個人向けの住宅や医療の一部など）は除きます
const EXCLUDE = [/練習/, /テスト/, /休廃止鉱山/, /廃止石油坑井/, /救命救急/, /放送ネットワーク/];

async function getJSON(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { Accept: 'application/json' } });
      if (r.ok) return await r.json();
      if (r.status === 404) return null;
    } catch (e) { /* retry */ }
    await sleep(1500 * (i + 1));
  }
  return null;
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\n{2,}/g, '\n').trim();
}
// 「■応募資格」「■対象者」などの見出しの中身を取り出す
function section(text, heads) {
  for (const h of heads) {
    const re = new RegExp('■?\\s*' + h + '[^\\n]*\\n([\\s\\S]*?)(?=\\n■|$)');
    const m = text.match(re);
    if (m && m[1].trim()) return m[1].trim();
  }
  return '';
}
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const jstDate = (iso) => {
  if (!iso) return '';
  const d = new Date(new Date(iso).getTime() + 9 * 3600e3);
  return d.toISOString().slice(0, 10);
};
const jstTime = (iso) => {
  if (!iso) return '';
  const d = new Date(new Date(iso).getTime() + 9 * 3600e3);
  return d.toISOString().slice(11, 16);
};

async function main() {
  const seen = new Map();
  for (const kw of KEYWORDS) {
    const q = new URLSearchParams({ keyword: kw, sort: 'acceptance_end_datetime', order: 'ASC', acceptance: '1' });
    const j = await getJSON(`${API}?${q}`);
    for (const it of (j && j.result) || []) if (!seen.has(it.id)) seen.set(it.id, it);
    await sleep(400);
  }
  const now = Date.now();
  const items = [];
  for (const it of seen.values()) {
    if (EXCLUDE.some((re) => re.test(it.title || ''))) continue;
    const end = it.acceptance_end_datetime ? new Date(it.acceptance_end_datetime).getTime() : null;
    if (end && end < now) continue;
    // 締切が10年以上先のものは「常設の制度」なので、締切は表示しません
    const open = end && end - now > 3650 * 864e5 ? null : end;
    const d = await getJSON(`${API}/id/${it.id}`);
    await sleep(250);
    const r = (d && d.result && d.result[0]) || {};
    const text = stripHtml(r.detail);
    const req = section(text, ['応募資格', '対象者', '補助対象者', '交付対象者', '対象事業者', '申請資格']);
    const what = section(text, ['目的・概要', '概要', '目的', '事業概要']);
    items.push({
      id: it.id,
      title: (it.title || '').trim(),
      pref: (r.target_area_search || it.target_area_search || '').trim(),
      area: (r.target_area_detail || '').trim(),
      max: Number(r.subsidy_max_limit || it.subsidy_max_limit || 0),
      rate: (r.subsidy_rate || '').trim(),
      start: jstDate(r.acceptance_start_datetime || it.acceptance_start_datetime),
      end: open ? jstDate(r.acceptance_end_datetime || it.acceptance_end_datetime) : '',
      end_time: open ? jstTime(r.acceptance_end_datetime || it.acceptance_end_datetime) : '',
      employees: (r.target_number_of_employees || it.target_number_of_employees || '').trim(),
      purpose: (r.use_purpose || '').trim(),
      industry: (r.industry || '').trim(),
      summary: clip(what.replace(/\n/g, ' '), 140),
      requirements: clip(req.replace(/\n/g, ' '), 220),
      url: r.front_subsidy_detail_page_url || `https://www.jgrants-portal.go.jp/subsidy/${it.id}`
    });
  }
  items.sort((a, b) => (a.end || '9999').localeCompare(b.end || '9999'));
  const out = {
    updated: jstDate(new Date().toISOString()),
    source: 'jGrants（デジタル庁）公開API https://developers.digital.go.jp/documents/jgrants/api/',
    note: 'GitHub Actions が3日ごとに自動で作り直します。手で編集しないでください。審査方式（一斉・随時・先着）はjGrantsに項目がないため、各公募要領で確認します。',
    count: items.length,
    items
  };
  let prev = '';
  try { prev = await readFile(OUT, 'utf8'); } catch (e) {}
  const next = JSON.stringify(out, null, 1) + '\n';
  // 件数が前回の3割未満に急減したらAPI障害とみなし、上書きしません
  try {
    const p = JSON.parse(prev);
    if (p.count && items.length < p.count * 0.3) {
      console.error(`件数が急減（${p.count}→${items.length}）。上書きを中止します。`);
      process.exit(1);
    }
  } catch (e) {}
  await writeFile(OUT, next);
  console.log(`jGrants: ${items.length} 件を書き出しました`);
}
main().catch((e) => { console.error(e); process.exit(1); });
