#!/usr/bin/env python3
"""Re-edit pre-existing BRIDGE CYCLE footage; no video/image generation services used.
Clips are pre-existing media from the user's own Higgsfield library, not new generations.
"""
from pathlib import Path
import subprocess, math, wave, io, base64, json, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"assets"/"BRIDGE_CYCLE_concept_liveaction_30s.mp4"
TEMP=ROOT/"film_preview"
TEMP.mkdir(exist_ok=True)
W,H,FPS=1280,720,24
BASE="https://d2ol7oe51mr4n9.cloudfront.net/user_3Kge3VIyzevLQoBIXKMX9fw2Y59/"
SRC={
 "factory": "24b78806-ef40-466e-9d0a-ef5d5dffec2c.mp4",
 "story": "823e8b58-c11c-4d81-8ada-7cfd1af2edb0.mp4",
}
def sh(cmd):
    print("RUN:",' '.join(str(x) for x in cmd[:7]),flush=True)
    subprocess.run([str(x) for x in cmd],check=True)
for key,fn in SRC.items():
    dest=TEMP/(key+".mp4")
    subprocess.run(["curl","-fL","--retry","3","--connect-timeout","20","--max-time","120","--silent","--show-error",BASE+fn,"-o",str(dest)],check=True)
    if dest.stat().st_size<100000:raise RuntimeError(f"Invalid downloaded video {key}")
    print(key,dest.stat().st_size,flush=True)

font_candidates=[
"/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
"/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
"/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]
fontpath=next((f for f in font_candidates if Path(f).exists()),font_candidates[-1])
def font(size):return ImageFont.truetype(fontpath,size)
navy=(14,31,54);lime=(184,225,125)
def overlay(title,section,index):
    img=Image.new("RGBA",(W,H),(0,0,0,0))
    # Transparent upper film tint + bottom branded vignette that hides the old hardcoded lower subtitles.
    p=img.load()
    for y in range(H):
        if y<350:alpha=0
        else:alpha=int(232*((y-350)/(H-350))**1.2)
        if alpha>0:
            for x in range(W):
                p[x,y]=(navy[0],navy[1],navy[2],alpha)
    d=ImageDraw.Draw(img)
    d.rounded_rectangle((64,477,154,481),radius=2,fill=lime+(255,))
    d.text((64,504),section,font=font(20),fill=(205,227,210),stroke_width=0)
    y=538
    for line in title.split("\n"):
        d.text((60,y),line,font=font(57 if len(line)<=12 else 52),fill=(255,255,255),stroke_width=0)
        y+=68
    d.text((1125,55),f"{index:02d} / 06",font=font(16),fill=(235,244,242,180))
    return img
scenes=[
    ("factory",0.0,4.0,"見積書に、\nもう1枚。","THE QUESTION"),
    ("story",0.5,4.0,"「予算が…」\nその一言で。","THE WALL"),
    ("factory",8.0,5.0,"まだ、\n終わりじゃない。","THE POSSIBILITY"),
    ("factory",14.0,6.0,"道は、\nひとつじゃない。","THE TURN"),
    ("factory",22.0,6.0,"もう一度、\n提案できる。","THE NEXT MOVE"),
    ("story",26.0,2.5,"道を増やせ。","THE PROMISE"),
]
# Render overlays + cinematic footage cut. No fabricated award/subsidy figures.
segments=[]
for n,(clip,start,dur,title,section) in enumerate(scenes):
    pic=TEMP/f"overlay_{n}.png"
    overlay(title,section,n+1).save(pic)
    target=TEMP/f"cut_{n}.mp4"
    # Mild contrast and warmer saturation while keeping footage genuinely visible.
    filter_script=(
      "[0:v]fps=24,scale=1280:720:force_original_aspect_ratio=increase,"
      "crop=1280:720,eq=contrast=1.055:saturation=1.08:brightness=0.013,"
      "format=rgba[base];"
      "[1:v]format=rgba,fade=t=in:st=0:d=0.33:alpha=1[title];"
      "[base][title]overlay=0:0:format=auto:shortest=1,"
      "format=yuv420p[v]"
    )
    sh(["ffmpeg","-hide_banner","-loglevel","error","-y",
        "-ss",str(start),"-i",str(TEMP/(clip+".mp4")),"-loop","1","-framerate",str(FPS),"-i",str(pic),
        "-filter_complex",filter_script,"-map","[v]","-t",str(dur),
        "-an","-r",str(FPS),"-c:v","libx264","-preset","fast","-crf","24",
        "-pix_fmt","yuv420p","-movflags","+faststart",str(target)])
    segments.append(target)

# Final brand page: actual BRIDGE CYCLE logo & an existing A4 example, not an invented logo.
end=Image.new("RGB",(W,H),navy)
d=ImageDraw.Draw(end)
d.rectangle((70,133,182,139),fill=lime)
logo=Image.open(ROOT/"logo.png").convert("RGBA")
logo.thumbnail((82,82),Image.Resampling.LANCZOS)
end.paste(logo,(77,186),logo)
d.text((184,196),"BRIDGE CYCLE",font=font(40),fill=(255,255,255))
d.text((68,311),"見積書に、",font=font(72),fill=(255,255,255))
d.text((68,407),"もう1枚。",font=font(84),fill=lime)
d.text((72,554),"決める前に、確かめる。",font=font(24),fill=(212,227,239))
if (ROOT/"assets/hojokin-sheet-sample.webp").exists():
    paper=Image.open(ROOT/"assets/hojokin-sheet-sample.webp").convert("RGBA")
    paper.thumbnail((290,435),Image.Resampling.LANCZOS)
    paper=paper.rotate(-4,expand=True,resample=Image.Resampling.BICUBIC)
    shadow=Image.new("RGBA",paper.size,(16,22,28,100)).filter(ImageFilter.GaussianBlur(15))
    end.paste(shadow.convert("RGB"),(910,158))
    end.paste(paper,(914,143),paper)
endpng=TEMP/"end.png";end.save(endpng)
endmov=TEMP/"cut_6.mp4"
sh(["ffmpeg","-hide_banner","-loglevel","error","-y","-loop","1","-framerate",str(FPS),"-i",str(endpng),"-t","2.5","-an","-vf","format=yuv420p","-c:v","libx264","-preset","fast","-crf","21",str(endmov)])
segments.append(endmov)

concat_txt=TEMP/"concat.txt"
concat_txt.write_text(chr(10).join("file '"+str(p.resolve()).replace("'","")+"'" for p in segments)+chr(10))
silent=TEMP/"silent.mp4"
sh(["ffmpeg","-hide_banner","-loglevel","error","-y","-f","concat","-safe","0","-i",str(concat_txt),"-c","copy","-movflags","+faststart",str(silent)])

# Unique bright original BGM: synth chord/melody/percussion, no licensed music or generation credits.
SR=24000;T=30;N=SR*T
a=np.zeros(N,dtype=np.float32);rng=np.random.default_rng(17)
bpm=120;beat=60/bpm
def note(m,when,length,vol=.05,kind="pluck"):
    st=int(when*SR);n=min(max(0,int(length*SR)),N-st)
    if st<0 or n<=0:return
    t=np.arange(n,dtype=np.float32)/SR
    hz=440*2**((m-69)/12)
    env=(1-np.exp(-t*150))*np.exp(-t*(6 if kind=="pluck" else 0.8))
    if kind=="pad":env=np.minimum(1.,t*8)*np.minimum(1.,(length-t)*5)
    tone=np.sin(2*np.pi*hz*t)+.20*np.sin(2*np.pi*hz*2*t)
    a[st:st+n]+=vol*env*tone
chords=[(50,[62,66,69]),(47,[59,62,66]),(55,[62,67,71]),(57,[61,64,69])]
for bar in range(16):
    base=bar*beat*4;root,triad=chords[bar%4]
    if base>=T:break
    for m in triad:note(m,base,beat*3.9,.031,"pad")
    for k in range(4):
        when=base+k*beat
        if when>=T:break
        note(root-12,when,.42,.085)
        note(triad[k%3]+12,when,.25,.07)
        if k%2==0:note(triad[(k+2)%3]+12,when+beat*.5,.24,.03)
line=[74,78,81,78,76,74,71,74,76,78,81,86,83,81,78,76]
for k in range(int(T/(beat/2))):
    if k%16 in (3,7):continue
    note(line[k%16],k*beat/2,.23,.036)
for k in range(int(T/beat)):
    t=k*beat;st=int(t*SR);n=min(int(.17*SR),N-st)
    u=np.arange(n)/SR
    kick=np.sin(2*np.pi*(60*u+36*(1-np.exp(-u*28))/28))*np.exp(-u*28)
    a[st:st+n]+=.16*kick
    if k%4 in (1,3):
        nr=min(int(.08*SR),N-st);uu=np.arange(nr)/SR
        a[st:st+nr]+=.018*rng.standard_normal(nr).astype(np.float32)*np.exp(-uu*50)
fade=int(SR*.8);a[-fade:]*=np.linspace(1,0,fade)
a*=.88/max(.05,np.max(np.abs(a)))
music=TEMP/"music.wav"
with wave.open(str(music),"wb") as f:
    f.setnchannels(1);f.setsampwidth(2);f.setframerate(SR)
    f.writeframes((a*32767).astype("<i2").tobytes())
OUT.parent.mkdir(exist_ok=True)
sh(["ffmpeg","-hide_banner","-loglevel","error","-y","-i",str(silent),"-i",str(music),"-map","0:v:0","-map","1:a:0","-c:v","copy","-c:a","aac","-b:a","160k","-shortest","-movflags","+faststart",str(OUT)])

# Human-review contact sheet, ASCII base64 in GitHub so the image can be inspected without binary download.
tiles=[]
for index,t in enumerate([2,6,10.5,16,22,26.3,28.5]):
    jpg=TEMP/f"finished_{index}.jpg"
    sh(["ffmpeg","-hide_banner","-loglevel","error","-y","-ss",str(t),"-i",str(OUT),"-frames:v","1","-vf","scale=426:240","-q:v","4",str(jpg)])
    tiles.append(Image.open(jpg).convert("RGB"))
contact=Image.new("RGB",(426*4,240*2),(235,240,239))
for i,im in enumerate(tiles):contact.paste(im,((i%4)*426,(i//4)*240))
bp=io.BytesIO();contact.save(bp,format="JPEG",quality=75,optimize=True)
(TEMP/"final_contact.b64").write_text(base64.b64encode(bp.getvalue()).decode(),encoding="ascii")
(TEMP/"render_meta.json").write_text(json.dumps({"seconds":30,"width":1280,"height":720,"bytes":OUT.stat().st_size,"source":"existing_user_owned_higgsfield_videos","new_generation_credits":0},indent=2))
print("COMPLETED",str(OUT),OUT.stat().st_size,flush=True)
