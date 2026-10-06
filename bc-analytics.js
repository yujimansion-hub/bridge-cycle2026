/* BRIDGE CYCLE サイト共通の計測（GA4）
 * 送るもの：ページ閲覧、ボタン・リンクの押下、試算ページを使い始めたこと、相談予約の完了、紹介コード（BC-xxx）
 * 送らないもの：試算の入力値や結果、フォームの記入内容、氏名・連絡先
 * BC_ANALYTICS_ID を空文字にすると計測は止まり、外部通信もしません。
 */
(function(){
  var BC_ANALYTICS_ID = "G-GYGZ9W6FQ9";
  if(!BC_ANALYTICS_ID) { window.bcTrack=function(){}; return; }

  var page = (location.pathname.split('/').pop() || 'index.html').replace(/\.html$/,'') || 'index';
  var group =
    /^(index|yameru|genjo|taiten|check|soudan|watasu|seller-lp|owner-entry|matching|touroku|audition|tsugite)/.test(page) ? '退店前承継' :
    /^(partner|fudosan)/.test(page) ? 'パートナー' :
    /^(uriba|kokaido|yoyaku|thanks-kokaido|kanryo|bridge-cycle-kokaido)/.test(page) ? '売り場レンタル' :
    /^yomu/.test(page) ? '閉める前に読む' :
    /^hojokin/.test(page) ? '補助金' :
    /^uchino/.test(page) ? 'うちのシェフ' :
    /^kasu/.test(page) ? '空きスペース貸し' :
    /^akinai/.test(page) ? 'わたしのこれから診断' : 'その他';

  var ref='';
  try{
    var m=location.search.match(/[?&]ref=([A-Za-z0-9_-]{2,20})/);
    if(m){ ref=m[1].toUpperCase(); localStorage.setItem('bc_ref',ref); localStorage.setItem('bc_ref_at',new Date().toISOString()); }
    else { ref=localStorage.getItem('bc_ref')||''; }
  }catch(e){}

  window.dataLayer=window.dataLayer||[];
  window.gtag=window.gtag||function(){window.dataLayer.push(arguments);};
  var s=document.createElement('script'); s.async=true;
  s.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(BC_ANALYTICS_ID);
  document.head.appendChild(s);
  gtag('js',new Date());
  /* 自分のアクセスの印：一度 ?internal=1 付きで開いた端末・ブラウザは traffic_type=internal を送る（?internal=0 で解除） */
  try{if(/[?&]internal=1\b/.test(location.search))localStorage.setItem('bc_internal','1');if(/[?&]internal=0\b/.test(location.search))localStorage.removeItem('bc_internal');if(localStorage.getItem('bc_internal')==='1')gtag('set',{traffic_type:'internal'});}catch(e){}
  gtag('config',BC_ANALYTICS_ID,{
    content_group: group,
    allow_google_signals:false,
    allow_ad_personalization_signals:false
  });
  if(ref) gtag('set','user_properties',{ref_code:ref});


  /* Metricool のサイト計測（閲覧数・訪問者数・流入元・ページ別。SNSの分析と同じ画面で見るため）。自分のアクセス（?internal=1 済みの端末）は数えない */
  try{ if(localStorage.getItem('bc_internal')!=='1'){
    var mc=document.createElement('script'); mc.async=true; mc.src='https://tracker.metricool.com/resources/be.js';
    mc.onload=function(){ try{ window.beTracker&&beTracker.t({hash:'ac63abb6a3d652c64478fbabcc7b338e'}); }catch(e){} };
    document.head.appendChild(mc);
  } }catch(e){}
  window.bcTrack=function(name,params){
    var p={page_name:page,content_group:group}; if(ref)p.ref_code=ref;
    for(var k in (params||{})) p[k]=params[k];
    gtag('event',name,p);
  };

  /* リンク・ボタンの押下（どこから押されたかだけを送る） */
  document.addEventListener('click',function(e){
    var a=e.target.closest&&e.target.closest('a'); if(!a) return;
    var h=a.getAttribute('href')||'', id=a.id||'';
    if(/^tel:/.test(h)) bcTrack('tel_click',{link_id:id});
    else if(/line\.me\//.test(h)) bcTrack('line_click',{link_id:id});
    else if(/^mailto:/.test(h)) bcTrack('mail_click',{link_id:id});
    else if(/soudan\.html/.test(h)) bcTrack('soudan_cta_click',{link_id:id});
    else if(/yameru\.html/.test(h)) bcTrack('yameru_cta_click',{link_id:id});
  },true);

  /* 試算ページ：最初に入力を始めたときに1回だけ（入力値は送らない） */
  if(page==='yameru'){
    var started=false;
    document.addEventListener('input',function(){
      if(started) return; started=true; bcTrack('yameru_start');
    },true);

    /* 試算の完了：主要10項目のうち3項目以上を自分の数字に変え、結果欄を見たときに1回だけ。
       送るのは「変えた項目の数」だけで、入力値は送らない */
    var MAIN=['tsubo','rent','dep','notice','lease','inv','yrs','staff','profit','wait'];
    var touched={}, seen=false, done=false;
    function tryDone(){
      if(done) return;
      var n=Object.keys(touched).length;
      if(n>=3 && seen){ done=true; bcTrack('yameru_complete',{fields_changed:n}); }
    }
    document.addEventListener('input',function(e){
      var id=e.target&&e.target.id; if(MAIN.indexOf(id)>=0){ touched[id]=1; tryDone(); }
    },true);
    document.addEventListener('change',function(e){
      var id=e.target&&e.target.id; if(MAIN.indexOf(id)>=0){ touched[id]=1; tryDone(); }
    },true);
    var watchRes=function(){
      var res=document.getElementById('res'); if(!res || !('IntersectionObserver' in window)) return;
      new IntersectionObserver(function(es){
        es.forEach(function(x){ if(x.isIntersecting){ seen=true; tryDone(); } });
      },{threshold:0.3}).observe(res);
    };
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',watchRes); else watchRes();
  }

  /* 紹介コードを申込・登録フォームに添える（紹介パートナーへの報酬の確認用）。
     有効期間は最後に紹介リンクを開いてから180日。新しい紹介リンクを開くと上書き（最後の紹介を優先）。
     送るのはコード（例：P-DAISEI）だけで、紹介した人に申込内容は伝わりません。 */
  var REF_DAYS=180;
  var refActive='';
  try{
    var at=Date.parse(localStorage.getItem('bc_ref_at')||'');
    if(ref && (isNaN(at) || Date.now()-at < REF_DAYS*864e5)) refActive=ref;
  }catch(e){ refActive=ref; }
  window.bcRefActive=refActive;
  var addRef=function(){
    if(!refActive) return;
    document.querySelectorAll('form[action*="formsubmit.co"],form[action*="formspree.io"]').forEach(function(f){
      if(f.querySelector('input[name="紹介コード"]')) return;
      var i=document.createElement('input'); i.type='hidden'; i.name='紹介コード'; i.value=refActive; f.appendChild(i);
    });
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',addRef); else addRef();
})();
