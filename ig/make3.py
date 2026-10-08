"""Instagram 1枚目（3段の型）を作る。

型：上＝呼びかけ／中＝主役の言葉を他の3倍／下＝一言の補足。色は藍・白・黄緑の3色。
使い方: python3 ig/make3.py ig/posts3.json
posts3.json = [{"slug":"1009_fri_shisan3",
                "call":"閉めるか迷っている店主さんへ",      # 上：呼びかけ（20字まで）
                "pre":"30坪の居酒屋、内装を壊して返すと",    # 主役の前置き（1行）
                "big":"240〜600", "unit":"万円",             # 主役（数字か短い言葉）
                "after":"次の人に渡せれば、<em>この工事がいらなくなることも。</em>",  # 下：補足（2行まで）
                "note":"京都市の相場×坪数の目安",                # 任意：根拠の一言
                "foot":"渡せるか30秒で試算｜プロフィールのリンクから"}]
出力: ig/<slug>.jpg（1080x1350）
"""
from playwright.sync_api import sync_playwright
import json, pathlib, sys

OUT = pathlib.Path(__file__).parent
posts = json.load(open(sys.argv[1], encoding="utf-8"))

TPL = """<!doctype html><html><head><meta charset="utf-8"><style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{width:1080px;height:1350px;background:#1d2b4f;color:#fff;
 font-family:"Noto Sans CJK JP","Noto Sans JP",sans-serif;position:relative;overflow:hidden}}
.call{{position:absolute;left:90px;right:90px;top:120px;text-align:center}}
.call span{{display:inline-block;background:#9bcf53;color:#1d2b4f;font-size:50px;font-weight:900;
 padding:16px 40px;border-radius:8px;letter-spacing:.04em}}
.mid{{position:absolute;left:60px;right:60px;top:330px;text-align:center}}
.pre{{font-size:54px;font-weight:700;letter-spacing:.02em}}
.big{{margin-top:10px;font-weight:900;line-height:1;white-space:nowrap;font-feature-settings:"palt"}}
.big b{{font-size:{bigsize}px;letter-spacing:-.02em}}
.big span{{font-size:96px;margin-left:8px}}
.after{{position:absolute;left:90px;right:90px;top:{aftertop}px;text-align:center;font-size:56px;font-weight:700;line-height:1.5}}
.after em{{font-style:normal;color:#9bcf53}}
.note{{position:absolute;left:90px;right:90px;bottom:200px;text-align:center;font-size:28px;color:rgba(255,255,255,.75)}}
.foot{{position:absolute;left:90px;right:90px;bottom:90px;border-top:2px solid rgba(255,255,255,.35);padding-top:30px;
 display:flex;justify-content:space-between;align-items:center;font-size:30px;white-space:nowrap}}
.foot b{{font-weight:900;letter-spacing:.12em}}
.foot span{{color:#9bcf53;font-weight:700}}
</style></head><body>
<div class="call"><span>{call}</span></div>
<div class="mid"><div class="pre">{pre}</div><div class="big"><b>{big}</b><span>{unit}</span></div></div>
<div class="after">{after}</div>
<div class="note">{note}</div>
<div class="foot"><b>BRIDGE CYCLE</b><span>{foot}</span></div>
</body></html>"""

# note の見出し画像（1280x670）用。"size":"wide" で使う
WIDE = """<!doctype html><html><head><meta charset="utf-8"><style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{width:1280px;height:670px;background:#1d2b4f;color:#fff;
 font-family:"Noto Sans CJK JP","Noto Sans JP",sans-serif;position:relative;overflow:hidden;text-align:center}}
.call{{position:absolute;left:0;right:0;top:44px}}
.call span{{display:inline-block;background:#9bcf53;color:#1d2b4f;font-size:36px;font-weight:900;padding:8px 28px;border-radius:6px}}
.mid{{position:absolute;left:80px;right:80px;top:140px}}
.pre{{font-size:40px;font-weight:700}}
.big{{margin-top:4px;font-weight:900;line-height:1;white-space:nowrap}}
.big b{{font-size:{bigsize}px;letter-spacing:-.02em}}
.big span{{font-size:64px;margin-left:6px}}
.after{{position:absolute;left:80px;right:80px;top:{aftertop}px;font-size:40px;font-weight:700;line-height:1.45}}
.after em{{font-style:normal;color:#9bcf53}}
.foot{{position:absolute;left:60px;right:60px;bottom:26px;display:flex;justify-content:space-between;font-size:22px;color:rgba(255,255,255,.75)}}
.foot b{{color:#fff;font-weight:900;letter-spacing:.12em}}
</style></head><body>
<div class="call"><span>{call}</span></div>
<div class="mid"><div class="pre">{pre}</div><div class="big"><b>{big}</b><span>{unit}</span></div></div>
<div class="after">{after}</div>
<div class="foot"><b>BRIDGE CYCLE</b><span>{note}</span></div>
</body></html>"""

with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/opt/pw-browsers/chromium")
    for x in posts:
        wide = x.get("size") == "wide"
        pg = b.new_page(viewport={"width": 1280, "height": 670} if wide else {"width": 1080, "height": 1350})
        n = len(x["big"]) + len(x.get("unit", "")) * 0.5
        bigsize = 250 if n <= 7 else 210 if n <= 9 else 170
        if wide:
            bs = 190
            page = WIDE.format(call=x["call"], pre=x["pre"], big=x["big"], unit=x.get("unit", ""),
                               after=x["after"], note=x.get("note", ""), bigsize=bs, aftertop=140 + 56 + bs + 30)
        else:
            page = TPL.format(call=x["call"], pre=x["pre"], big=x["big"], unit=x.get("unit", ""),
                              after=x["after"], foot=x["foot"], note=x.get("note", ""), bigsize=bigsize,
                              aftertop=330 + 90 + bigsize + 120)
        pg.set_content(page)
        pg.wait_for_timeout(300)
        # 主役が横にはみ出すときは、収まるまで文字を小さくし、下の補足も詰める
        over = pg.evaluate("""() => {const m=document.querySelector('.mid'), g=document.querySelector('.big'), b=g.querySelector('b'), a=document.querySelector('.after');
          let fs=parseFloat(getComputedStyle(b).fontSize), t=0;
          while (g.scrollWidth > m.clientWidth && fs > 120) { fs -= 6; t += 6; b.style.fontSize = fs + 'px'; }
          a.style.top = (parseFloat(getComputedStyle(a).top) - t) + 'px';
          return g.scrollWidth > m.clientWidth;}""")
        pg.screenshot(path=str(OUT / f"{x['slug']}.jpg"), type="jpeg", quality=90)
        print("ok", x["slug"], "OVERFLOW" if over else "")
        pg.close()
    b.close()
