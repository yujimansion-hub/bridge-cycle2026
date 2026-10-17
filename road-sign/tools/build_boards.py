#!/usr/bin/env python3
"""非公開の媒体管理台帳（CSV）から、公開してよい項目だけを data/boards.json に書き出す。

使い方：
  python3 road-sign/tools/build_boards.py <台帳CSVのパス>

台帳CSVはリポジトリの外（Googleドライブなど）か、road-sign/data/private/ に置く。
private/ は .gitignore 済みで、GitHub に上がらない。このリポジトリは公開されるので、
看板会社名・担当者・連絡先・正確な所在地・紹介条件は、絶対にリポジトリ内の公開ファイルに書かない。

書き出す条件：
  - 状態 が「公開」
  - 掲載承諾日 が入っている（看板会社が掲載を承諾した日）
  - publish_scope が full か area_price
  - 最終確認日 が未来の日付でない
書き出す項目は、publish_scope ごとに下の PUBLIC に並べたものだけ。写真は 写真利用許諾 が「あり」のときだけ出す。
"""
import csv, json, sys, datetime, pathlib

PUBLIC = {
    'full': ['id', 'city', 'place', 'kind', 'facing', 'size', 'monthly_fee', 'fee_note', 'setup_fee', 'min_term_months',
             'vacancy', 'confirmed_at', 'permit', 'suits', 'photo', 'map_url', 'publish_scope'],
    'area_price': ['id', 'city', 'kind', 'size', 'monthly_fee', 'fee_note', 'setup_fee', 'min_term_months',
                   'vacancy', 'confirmed_at', 'suits', 'publish_scope'],
}
NUM = {'monthly_fee', 'setup_fee', 'min_term_months'}
VACANCY = {'空きあり', '近日空き', '確認中'}


def main(src):
    out = pathlib.Path(__file__).resolve().parents[1] / 'data' / 'boards.json'
    current = json.loads(out.read_text(encoding='utf-8')) if out.exists() else {}
    today = datetime.date.today()
    boards, skipped = [], []
    with open(src, encoding='utf-8-sig', newline='') as f:
        for row in csv.DictReader(f):
            rid = (row.get('id') or '').strip()
            scope = (row.get('publish_scope') or '').strip()
            why = None
            if (row.get('状態') or '').strip() != '公開': why = '状態が「公開」ではない'
            elif not (row.get('掲載承諾日') or '').strip(): why = '掲載承諾日がない'
            elif scope not in PUBLIC: why = 'publish_scope が full / area_price ではない'
            else:
                try:
                    d = datetime.date.fromisoformat((row.get('confirmed_at') or '').strip())
                    if d > today: why = '最終確認日が未来の日付'
                except ValueError:
                    why = '最終確認日が YYYY-MM-DD ではない'
            if why: skipped.append((rid, why)); continue
            b = {}
            for k in PUBLIC[scope]:
                v = (row.get(k) or '').strip()
                if k in NUM: b[k] = int(v.replace(',', '')) if v else None
                elif k == 'vacancy': b[k] = v if v in VACANCY else '確認中'
                elif v: b[k] = v
            if (row.get('写真利用許諾') or '').strip() != 'あり': b.pop('photo', None)  # 写真の利用許諾がなければ写真は出さない
            boards.append(b)
    data = {'min_public': current.get('min_public', 0), 'list_min': current.get('list_min', 5), 'boards': boards}
    out.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'書き出し：{len(boards)}面 → {out}')
    for rid, why in skipped: print(f'  除外 {rid or "(idなし)"}：{why}')


if __name__ == '__main__':
    if len(sys.argv) != 2: sys.exit(__doc__)
    main(sys.argv[1])
