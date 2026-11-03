#!/usr/bin/env python3
"""Inspect user-owned existing Higgsfield clips for a zero-credit live-action re-edit."""
import base64, os, subprocess, json, urllib.request, time, pathlib, sys
from PIL import Image, ImageDraw, ImageFont
P=pathlib.Path("film_preview");P.mkdir(exist_ok=True)
BASE="https://d2ol7oe51mr4n9.cloudfront.net/user_3Kge3VIyzevLQoBIXKMX9fw2Y59/"
SOURCES={
 "A_latest":"823e8b58-c11c-4d81-8ada-7cfd1af2edb0.mp4",
 "B_latest":"a88932e0-901d-4a98-8427-765f634b3cfc.mp4",
 "C_older":"34268fc0-1da7-471a-8b2b-9dab7b3531e9.mp4",
 "D_older":"49c5eda5-0305-41a4-ba9f-85166b2dc2ce.mp4",
 "E_older":"179da91b-cc07-44ea-94fe-3febaaf2d354.mp4",
 "F_original_LP":"24b78806-ef40-466e-9d0a-ef5d5dffec2c.mp4",
}
def shell(cmd):
 p=subprocess.run(cmd,text=True,capture_output=True);return (p.returncode,p.stdout,p.stderr)
clips=[]
for n,src in SOURCES.items():
 url=BASE+src;path=P/(n+".mp4")
 ret,out,err=shell(["curl","-fL","--retry","2","--connect-timeout","15","--max-time","120","--silent","--show-error",url,"-o",str(path)])
 if ret or not path.exists() or path.stat().st_size<50000:
  clips.append({"name":n,"error":err[-400:] or f"download returned {ret}"});continue
 ret,out,err=shell(["ffprobe","-v","quiet","-show_entries","format=duration,size:stream=width,height,codec_name","-of","json",str(path)])
 try:
  probe=json.loads(out);dur=float(probe['format']['duration'])
  clips.append({"name":n,"ok":True,"duration":round(dur,2),"size":path.stat().st_size,"streams":probe.get("streams")})
 except Exception as e: clips.append({"name":n,"error":str(e)});continue
 for tag,ts in [('begin',min(1.,dur/4)),('mid',dur*.5),('end',dur*.82)]:
  outjpg=P/(n+"_"+tag+".jpg")
  shell(["ffmpeg","-nostdin","-hide_banner","-loglevel","error","-y","-ss",str(ts),"-i",str(path),"-frames:v","1","-vf","scale=384:216:force_original_aspect_ratio=increase,crop=384:216","-q:v","5",str(outjpg)])
try:
 imgs=[]
 for n in SOURCES:
  for tag in ["begin","mid","end"]:
   fn=P/(n+"_"+tag+".jpg")
   if fn.exists():imgs.append((n+" "+tag,Image.open(fn).convert("RGB")))
 cols=3;tilew=384;tileh=245;rows=(len(imgs)+cols-1)//cols
 sheet=Image.new("RGB",(cols*tilew,rows*tileh),(245,247,248));d=ImageDraw.Draw(sheet)
 for k,(title,im) in enumerate(imgs):
  x=k%cols*tilew;y=k//cols*tileh
  sheet.paste(im,(x,y));d.text((x+12,y+221),title,fill=(27,37,53))
 buf=P/"montage.jpg";sheet.save(buf,quality=76,optimize=True)
 (P/"montage.b64").write_text(base64.b64encode(buf.read_bytes()).decode(),encoding="ascii")
except Exception as e:clips.append({"montage_error":str(e)})
(P/"manifest.json").write_text(json.dumps(clips,ensure_ascii=False,indent=2),encoding="utf-8")
print(json.dumps(clips,ensure_ascii=False),flush=True)
