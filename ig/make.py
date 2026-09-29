from playwright.sync_api import sync_playwright
import pathlib, html

import json, sys
# 使い方: python3 ig/make.py ig/posts.json
# posts.json = [{"slug":"1007_wed_shikumi","label":"しくみ","color":"ai|mid|kin|shu",
#                "h":"見出し（<br>で改行、3行まで）","sub":"補足（<br>で改行、2行まで）"}, ...]
# 出力: ig/<slug>.jpg（1080x1350）
OUT = pathlib.Path(__file__).parent
posts = [(p["slug"], p["label"], p["color"], p["h"], p["sub"]) for p in json.load(open(sys.argv[1], encoding="utf-8"))]

COLORS = {"ai": "#1B3B5F", "mid": "#2E6B4F", "kin": "#8A6D1F", "shu": "#A8382C"}

TPL = """<!doctype html><html><head><meta charset="utf-8"><style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{width:1080px;height:1350px;background:#EDEEEA;color:#15171C;
 font-family:"Noto Sans CJK JP","Noto Sans JP",sans-serif;position:relative;overflow:hidden}}
.frame{{position:absolute;inset:48px;border:2px solid #C3C4BC}}
.bar{{position:absolute;left:48px;top:48px;width:14px;height:1254px;background:{accent}}}
.head{{position:absolute;left:120px;right:110px;top:110px;display:flex;justify-content:space-between;align-items:center}}
.logo{{font-size:34px;letter-spacing:.12em;font-weight:500}}
.logo b{{font-weight:900}}
.area{{font-size:24px;color:#4A4C52;letter-spacing:.08em}}
.label{{position:absolute;left:120px;top:250px;display:inline-block;background:{accent};color:#fff;
 font-size:32px;font-weight:700;padding:14px 30px;letter-spacing:.1em}}
.h{{position:absolute;left:120px;right:100px;top:380px;font-family:"Shippori Mincho",serif;
 font-weight:800;font-size:{hsize}px;line-height:1.42;letter-spacing:.02em}}
.rule{{position:absolute;left:120px;top:{ruletop}px;width:120px;height:6px;background:#A8382C}}
.sub{{position:absolute;left:120px;right:100px;top:{subtop}px;font-size:34px;line-height:1.75;color:#4A4C52;font-weight:500}}
.foot{{position:absolute;left:120px;right:110px;bottom:110px;border-top:2px solid #D9DAD3;padding-top:34px;
 display:flex;flex-direction:column;gap:18px;white-space:nowrap}}
.tag{{font-family:"Shippori Mincho",serif;font-weight:700;font-size:40px;letter-spacing:.04em}}
.cta{{font-size:26px;color:{accent};font-weight:700;letter-spacing:.06em}}
</style></head><body>
<div class="frame"></div><div class="bar"></div>
<div class="head"><div class="logo">BRIDGE <b>CYCLE</b></div><div class="area">滋賀県大津市｜認定経営革新等支援機関</div></div>
<div class="label">{label}</div>
<div class="h">{h}</div>
<div class="rule"></div>
<div class="sub">{sub}</div>
<div class="foot"><div class="tag">店じまいを、まちのはじまりに。</div><div class="cta">プロフィールのリンクから →</div></div>
</body></html>"""

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1080, "height": 1350})
    for slug, label, col, h, sub in posts:
        lines = h.count("<br>") + 1
        hsize = 104 if lines <= 2 else 96
        htop = 380
        hheight = int(lines * hsize * 1.42)
        ruletop = htop + hheight + 50
        subtop = ruletop + 60
        page = TPL.format(accent=COLORS[col], label=label, h=h, sub=sub,
                          hsize=hsize, ruletop=ruletop, subtop=subtop)
        pg.set_content(page)
        pg.wait_for_timeout(300)
        pg.screenshot(path=str(OUT / f"{slug}.jpg"), type="jpeg", quality=88)
        print("ok", slug)
    b.close()
