/* キャンプ場の平日収益化キャンペーン帯（トップ・補助金ページ共通）
   使い方：<div id="campBand" data-from="top"></div> を置き、このファイルを読み込む。
   締切を変えるときは END と表示文言の両方を直す（camp.html の END・本文もあわせて）。
   締切日を過ぎると帯は自動で表示されなくなる。 */
(function(){
  var END=new Date(2026,10,20);               /* 2026年11月20日（金）まで */
  var LABEL='11/20（金）';
  var el=document.getElementById('campBand'); if(!el) return;
  var t=new Date(); t.setHours(0,0,0,0);
  var d=Math.round((END-t)/864e5);
  if(d<0){ el.remove(); return; }
  var from=el.getAttribute('data-from')||'site';
  var left=d>0?'あと'+d+'日':'本日まで';

  var css='#campBand{background:#143B2E;color:#DCE8DF;font-family:inherit;position:relative;z-index:5}'
   +'#campBand a{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:6px 14px;max-width:1120px;margin:0 auto;padding:11px 18px;color:inherit;text-decoration:none;line-height:1.5}'
   +'#campBand .cb-tag{flex:none;background:#E4572E;color:#fff;font-weight:800;font-size:11.5px;letter-spacing:.08em;border-radius:4px;padding:3px 9px}'
   +'#campBand .cb-main{font-size:14.5px;font-weight:800;color:#fff}'
   +'#campBand .cb-main small{font-weight:700;font-size:12px;color:#BFD6C7;margin-left:6px}'
   +'#campBand .cb-date{font-size:13px;color:#DCE8DF}'
   +'#campBand .cb-date b{color:#F2C230;font-size:17px;font-weight:800;margin-right:2px}'
   +'#campBand .cb-left{flex:none;background:#F2C230;color:#15171C;font-weight:800;font-size:13px;border-radius:999px;padding:3px 12px}'
   +'#campBand .cb-go{flex:none;background:#fff;color:#143B2E;font-weight:800;font-size:13px;border-radius:999px;padding:6px 16px;transition:transform .15s}'
   +'#campBand a:hover .cb-go{transform:translateX(3px)}'
   +'@media (max-width:640px){#campBand a{gap:6px 10px;padding:10px 14px}#campBand .cb-main{width:100%;text-align:center;font-size:14px}#campBand .cb-main small{display:block;margin:0}}';
  var st=document.createElement('style'); st.textContent=css; document.head.appendChild(st);

  el.setAttribute('role','region'); el.setAttribute('aria-label','期間限定キャンペーン');
  el.innerHTML='<a href="camp.html?utm_source=bridgecycle&amp;utm_medium=band&amp;utm_campaign=camp&amp;utm_content='+encodeURIComponent(from)+'" id="campBand_'+from+'">'
    +'<span class="cb-tag">期間限定</span>'
    +'<span class="cb-main">キャンプ場の平日を、仕事客の売上に。<small>第20回 持続化補助金キャンペーン・先着20施設</small></span>'
    +'<span class="cb-date">受付 <b>'+LABEL+'</b>まで</span>'
    +'<span class="cb-left">'+left+'</span>'
    +'<span class="cb-go">詳しく見る →</span></a>';
  el.firstChild.addEventListener('click',function(){
    try{ if(window.bcTrack) bcTrack('camp_band_click',{link_id:'campBand_'+from}); }catch(e){}
  });
})();
