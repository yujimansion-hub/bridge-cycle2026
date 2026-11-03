const {chromium}=require('playwright-core'), fs=require('fs');
const path=require('path');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-gpu']});
 const cases=[['desktop',1440,900],['laptop',1024,768],['tablet',768,1000],['mobile',390,844],['small',320,720]];
 const out=[];
 for(const [label,width,height] of cases){
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
 const page=await context.newPage();const errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto('https://www.bridgecycleco.com/?qa='+Date.now(),{waitUntil:'domcontentloaded',timeout:45000});
 await page.waitForTimeout(2200);
 const data=await page.evaluate(()=>{
   const rect=(q)=>{const e=document.querySelector(q);if(!e)return null;const r=e.getBoundingClientRect(),cs=getComputedStyle(e);return {x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height),display:cs.display,grid:cs.gridTemplateColumns,color:cs.color,visibility:cs.visibility,overflowX:cs.overflowX}};
   const overflowing=[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&& (r.right>innerWidth+10||r.left< -10) && getComputedStyle(e).position!=='absolute'}).slice(0,24).map(e=>({tag:e.tagName,cl:(e.className?.baseVal||e.className||'').toString().slice(0,65),width:Math.round(e.getBoundingClientRect().width),left:Math.round(e.getBoundingClientRect().left)}));
   return {url:location.href,docWidth:document.documentElement.scrollWidth,viewport:innerWidth,bodyWidth:document.body.scrollWidth,hero:rect('.top2'),grid:rect('.top2>.w'),copy:rect('.top2 .hero-copy'),h1:rect('.top2 h1'),choices:rect('.bcq-home-choices'),cards:[rect('.bcq-choice:first-child'),rect('.bcq-choice:nth-child(2)')],preview:rect('.home-a4-preview'),paper:rect('.home-a4-paper'),topRep:rect('.top2-rep'),video:rect('#home-brand-video'),trust:rect('.trustsec'),nav:rect('.site-head .gnav'),overflowing};
 });
 out.push({label,width,height,...data,errors});
 const snap=await page.screenshot({type:'jpeg',quality:63});
 fs.mkdirSync('qa', {recursive:true});
 fs.writeFileSync('qa/'+label+'.b64',snap.toString('base64'));
 if(label==='desktop'||label==='mobile'){
  await page.screenshot({path:'qa/'+label+'_full.jpg',type:'jpeg',quality:50,fullPage:true});
 }
 console.log(JSON.stringify({label,width,height,docWidth:data.docWidth,hero:data.hero,copy:data.copy,choices:data.choices,preview:data.preview,overflowing:data.overflowing,errors:errors.slice(0,4)}));
 await context.close();
 }
 fs.writeFileSync('qa/home-layout-geometry.json',JSON.stringify(out,null,2));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
