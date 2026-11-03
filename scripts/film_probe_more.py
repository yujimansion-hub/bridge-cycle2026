#!/usr/bin/env python3
"""Contact sheet for earlier already-owned video assets; zero new AI generations."""
from pathlib import Path
import subprocess, json, base64, io
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parents[1];P=ROOT/"film_preview";P.mkdir(exist_ok=True)
BASE="https://d2ol7oe51mr4n9.cloudfront.net/user_3Kge3VIyzevLQoBIXKMX9fw2Y59/"
IDS={
"G":"74d289a0-248d-4cf4-a1e5-37f3536b1338.mp4",
"H":"929469e2-0527-4419-ad9c-77bb0cbec41e.mp4",
"I":"433c5bd4-10a3-4eb0-9199-8e44c53b5310.mp4",
"J":"df9d0956-1831-4871-a435-89df97123eeb.mp4",
"K":"7ea1ad01-f298-4652-b894-ece1b0f24cbc.mp4",
"L":"ccca1552-df8e-4830-8d7e-e2a74d3e9a73.mp4",
"M":"8147c5d1-0b6f-4de8-8c05-d2746b6acdeb.mp4",
"N":"5503390e-b254-41ed-a03a-ec5fedaa359a.mp4",
"O":"e82d53ec-ab60-441e-b3c8-1404b6db4f0d.mp4",
"P":"67cdeae9-990a-45b1-a4b6-70de38b2e020.mp4"
}
clips=[];imgs=[]
for k,v in IDS.items():
 try:
  path=P/(k+".mp4")
  subprocess.run(["curl","-fLs","--retry","1","--connect-timeout","12","--max-time","60",BASE+v,"-o",str(path)],check=True)
  dur=float(subprocess.run(["ffprobe","-v","quiet","-show_entries","format=duration","-of","csv=p=0",str(path)],text=True,capture_output=True,check=True).stdout.strip())
  clips.append({"id":k,"duration":dur,"bytes":path.stat().st_size})
  for label,t in [("a",dur*.09),("b",dur*.51),("c",dur*.87)]:
   jpg=P/f"older_{k}_{label}.jpg"
   subprocess.run(["ffmpeg","-nostdin","-hide_banner","-loglevel","error","-y","-ss",str(t),"-i",str(path),"-frames:v","1","-vf","scale=352:198:force_original_aspect_ratio=increase,crop=352:198","-q:v","5",str(jpg)],check=True)
   imgs.append((k+label,Image.open(jpg).convert("RGB")))
 except Exception as e: clips.append({"id":k,"error":str(e)[:250]})
cols=3;w=352;h=224;rows=(len(imgs)+cols-1)//cols
sheet=Image.new("RGB",(w*cols,h*rows),(238,244,242));draw=ImageDraw.Draw(sheet)
for i,(title,im) in enumerate(imgs):
 x=(i%cols)*w;y=(i//cols)*h
 sheet.paste(im,(x,y));draw.text((x+10,y+200),title,fill=(15,35,50))
bio=io.BytesIO();sheet.save(bio,format="JPEG",quality=81,optimize=True)
(P/"more_montage.b64").write_text(base64.b64encode(bio.getvalue()).decode(),encoding="ascii")
(P/"more_manifest.json").write_text(json.dumps(clips,indent=2),encoding="utf-8")
print(clips,flush=True)
