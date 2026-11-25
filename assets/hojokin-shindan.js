/* 補助金診断と「いま申請できる補助金」の一覧
   データは /data/hojokin.json だけを読みます（毎週更新）。
   置き場所：<div id="shindan"></div>（診断）と <div id="skList"></div>（一覧）。どちらか一方だけでも動きます。 */
(function(){
  var DATA_URL='/data/hojokin.json';
  var FEE={
    jizokuka:'当社の料金：初回相談・着手金0円、採択時に補助額の12%（最低5万円・税別）',
    ogata:'当社の料金：着手金7万円＋採択時に採択額の10%（税別・不採択なら着手金のみ）',
    consult:'当社の料金：内容をうかがってお見積りします（初回相談0円）'
  };
  var Q=[
    {k:'purpose',t:'何に使いたいですか',o:[
      ['sales','集客・販路開拓（チラシ・HP・店舗改装）'],
      ['labor','人手不足の解消（機械・設備で省力化）'],
      ['newbiz','新しい商品・サービス・事業を始める'],
      ['it','業務のIT化・AIの導入'],
      ['succession','事業を引き継ぐ・買う・売る'],
      ['any','まだ決めていない']]},
    {k:'ind',t:'業種はどちらに近いですか',o:[
      ['shogyo','小売・飲食・サービス業'],
      ['other','製造・建設・運輸・宿泊・娯楽など']]},
    {k:'emp',t:'従業員は何人ですか（パート含む常時の人数）',o:[
      ['5','0〜5人'],['20','6〜20人'],['21','21人以上']]},
    {k:'when',t:'いつ頃、発注・契約したいですか',o:[
      ['soon','3か月以内'],['half','半年〜1年以内'],['tbd','まだ決めていない']]},
    {k:'wage',t:'この1〜3年で、賃上げはできそうですか',o:[
      ['yes','計画できる'],['hard','難しい'],['dk','わからない']]}
  ];
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function day(s){if(!s)return null;var m=String(s).match(/(\d{4})-(\d{1,2})-(\d{1,2})/);return m?new Date(+m[1],+m[2]-1,+m[3]):null;}
  function md(d){return (d.getMonth()+1)+'月'+d.getDate()+'日';}
  function today(){var t=new Date();t.setHours(0,0,0,0);return t;}
  function track(n,v){try{if(typeof window.bcTrack==='function')window.bcTrack(n,v||{});}catch(e){}}

  /* 回ごとの状態：open（受付中）/ soon（開始前・日付あり）/ plan（予定・未定）/ always（随時）。締切済みは null */
  function roundState(r){
    var t=today(),st=day(r.start),en=day(r.end);
    if(r.always)return{s:'always',order:0.5};
    if(en&&t>en)return null;
    if(en&&(!st||t>=st)){var d=Math.round((en-t)/864e5);return{s:'open',days:d,order:d/1000};}
    if(st&&t<st)return{s:'soon',order:1+(st-t)/1e13};
    return{s:'plan',order:2};
  }
  function roundLine(r,rs){
    var st=day(r.start),en=day(r.end),b,dt='',left='';
    if(rs.s==='open'){b='<span class="bdg open">受付中</span>';left='<span class="left">'+(rs.days===0?'本日締切':'締切まで あと'+rs.days+'日')+'</span>';}
    else if(rs.s==='always'){b='<span class="bdg open">随時受付</span>';}
    else if(rs.s==='soon'){b='<span class="bdg soon">まもなく</span>';}
    else{b='<span class="bdg tbd">予定・未定</span>';}
    if(st||en){dt='<span class="dt">'+(st?md(st):'')+(st&&en?' → ':'')+(en?'<b>'+md(en)+(r.end_time?' '+esc(r.end_time):'')+'</b> 締切':'')+'</span>';}
    else if(r.when){dt='<span class="dt">'+esc(r.when)+'</span>';}
    return{b:b,dt:dt,left:left};
  }
  function bestRound(p){
    var best=null;
    (p.rounds||[]).forEach(function(r){var rs=roundState(r);if(rs&&(!best||rs.order<best.rs.order))best={r:r,rs:rs};});
    return best;
  }
  function isSmall(a){return a.ind==='shogyo'?a.emp==='5':(a.emp!=='21');}

  /* 一覧 */
  function renderList(box,data){
    var items=[];
    data.programs.forEach(function(p){
      (p.rounds||[]).forEach(function(r){
        var rs=roundState(r);if(!rs)return;
        var l=roundLine(r,rs);
        var nm=p.link?'<a href="'+esc(p.link)+'" target="_blank" rel="noopener" style="color:inherit">'+esc(p.name)+'</a>':esc(p.name);
        items.push({o:rs.order,h:'<div class="sk">'+l.b+'<span class="nm">'+nm+'</span><span class="rd">'+esc(r.label)+'</span>'+l.dt+l.left+(r.memo?'<span class="memo">'+esc(r.memo)+'</span>':'')+'</div>'});
      });
    });
    items.sort(function(a,b){return a.o-b.o;});
    var u=day(data.updated);
    box.innerHTML=(items.length?items.map(function(i){return i.h;}).join(''):'<div class="fallback">いま受付中の公募はありません。次の公募の時期は無料相談でお伝えします。</div>')
      +(u?'<p class="sk-upd">最終確認：'+u.getFullYear()+'年'+md(u)+'（毎週、公式情報を確認して更新しています）</p>':'');
  }

  /* 診断 */
  function renderShindan(box,data){
    var a={},step=0;
    function q(){
      var c=Q[step];
      box.innerHTML='<div class="sd-card"><div class="sd-prog"><span style="width:'+Math.round(step/Q.length*100)+'%"></span></div>'
        +'<p class="sd-step">質問 '+(step+1)+' / '+Q.length+'</p><h3 class="sd-q">'+esc(c.t)+'</h3><div class="sd-opts">'
        +c.o.map(function(o){return '<button type="button" class="sd-opt" data-v="'+o[0]+'">'+esc(o[1])+'</button>';}).join('')
        +'</div>'+(step?'<button type="button" class="sd-back">‹ 前の質問へ</button>':'')+'</div>';
      box.querySelectorAll('.sd-opt').forEach(function(b){b.onclick=function(){
        a[c.k]=b.getAttribute('data-v');
        if(step===0)track('hojokin_shindan_start',{});
        step++; if(step<Q.length)q(); else result();
      };});
      var bk=box.querySelector('.sd-back'); if(bk)bk.onclick=function(){step--;q();};
    }
    function label(k){var c=Q.filter(function(x){return x.k===k;})[0];var o=c.o.filter(function(x){return x[0]===a[k];})[0];return o?o[1]:'';}
    function result(){
      var small=isSmall(a),hits=[],skipped=[];
      data.programs.forEach(function(p){
        var fit=a.purpose==='any'||(p.purposes||[]).indexOf(a.purpose)>=0;
        if(!fit)return;
        if(p.small_only&&!small){skipped.push(p);return;}
        var br=bestRound(p);
        hits.push({p:p,br:br,o:br?br.rs.order:9});
      });
      hits.sort(function(x,y){return x.o-y.o;});
      var notes=[];
      if(a.when==='soon')notes.push('<b>発注は、交付決定のあとに。</b>多くの補助金は、交付決定より前に発注・契約した費用が対象外です。3か月以内の発注なら、申請の日程から逆算して発注日を決めましょう。');
      if(!small&&(a.purpose==='sales'||a.purpose==='any'))notes.push('従業員数から、小規模事業者向けの持続化補助金は対象外の可能性が高いです。ほかの制度や融資を含めて考えます。');
      var html='<div class="sd-card sd-res"><p class="sd-step">診断の結果</p><h3 class="sd-q">'+(hits.length?'候補になりそうな補助金は '+hits.length+' つです。':'いまの条件で、すぐに合う補助金は見当たりません。')+'</h3>';
      if(!hits.length)html+='<p class="sd-p">補助金がなくても、融資・リース・投資時期の見直しで進められることがあります。初回相談（0円）で一緒に考えます。</p>';
      hits.forEach(function(h){
        var p=h.p,st='',l;
        var live=(p.rounds||[]).map(function(r){return{r:r,rs:roundState(r)};}).filter(function(x){return x.rs;}).sort(function(x,y){return x.rs.order-y.rs.order;});
        if(live.length)st=live.map(function(x){l=roundLine(x.r,x.rs);return '<div class="sd-hs">'+l.b+'<span class="sd-rl">'+esc(x.r.label)+'</span>'+l.dt+l.left+'</div>';}).join('');
        else st='<div class="sd-hs"><span class="bdg tbd">次回未定</span></div>';
        var warn=(p.wage==='required'&&a.wage!=='yes')?'<p class="sd-warn">⚠ '+esc(p.wage_text)+(a.wage==='hard'?' 賃上げが難しい場合は、申請するかどうかから一緒に判断します。':'')+'</p>':'<p class="sd-mini">'+esc(p.wage_text)+'</p>';
        html+='<div class="sd-hit"><div class="sd-hn">'+esc(p.name)+'</div>'+st+'<p class="sd-p">'+esc(p.summary)+'</p>'
          +'<p class="sd-mini">補助率 '+esc(p.rate)+'／上限 '+esc(p.max)+'</p>'+warn
          +'<p class="sd-fee">'+esc(FEE[p.fee]||FEE.consult)+'</p></div>';
      });
      if(notes.length)html+='<div class="sd-notes">'+notes.map(function(n){return '<p>'+n+'</p>';}).join('')+'</div>';
      html+='<div class="sd-cta"><button type="button" class="btn sd-go">この結果で無料相談する ›</button><a class="sd-line" href="https://line.me/R/ti/p/@907kxssd" target="_blank" rel="noopener">LINEで聞く</a><button type="button" class="sd-again">もう一度診断する</button></div>'
        +'<p class="sd-disc">※公開情報をもとにした目安です。要件の詳細は公募要領で確認し、採択を保証するものではありません。</p></div>';
      box.innerHTML=html;
      track('hojokin_shindan_complete',{purpose:a.purpose,hits:hits.length});
      box.querySelector('.sd-again').onclick=function(){a={};step=0;q();};
      box.querySelector('.sd-go').onclick=function(){
        track('hojokin_shindan_to_contact',{purpose:a.purpose});
        var kind=document.getElementById('cKind'),msg=document.getElementById('cMsg');
        if(kind){var map={sales:'販路開拓・小規模事業者持続化補助金',labor:'設備投資・改装の補助金',newbiz:'設備投資・改装の補助金',succession:'事業承継・M&A関連の補助金'};var v=map[a.purpose];if(v)kind.value=v;}
        if(msg&&!msg.value.trim()){
          msg.value='【補助金診断の結果】\n・使いたいこと：'+label('purpose')+'\n・業種：'+label('ind')+'\n・従業員：'+label('emp')+'\n・発注の時期：'+label('when')+'\n・賃上げ：'+label('wage')+'\n・候補：'+(hits.map(function(h){return h.p.name;}).join('、')||'なし')+'\n';
        }
        var c=document.getElementById('contact')||document.getElementById('form');
        if(c)c.scrollIntoView({behavior:'smooth'});
      };
      box.scrollIntoView({behavior:'smooth',block:'start'});
    }
    q();
  }

  function init(){
    var sd=document.getElementById('shindan'),sk=document.getElementById('skList');
    if(!sd&&!sk)return;
    fetch(DATA_URL,{cache:'no-cache'}).then(function(r){if(!r.ok)throw 0;return r.json();}).then(function(data){
      if(sk)renderList(sk,data);
      if(sd)renderShindan(sd,data);
    }).catch(function(){
      var fb='<div class="fallback"><b>最新の公募スケジュールは、公式サイトでご確認ください。</b><br>中小機構「<a href="https://seisansei.smrj.go.jp/subsidy_info/schedule.html" target="_blank" rel="noopener">補助金活用ナビ</a>」に主要補助金の公募状況がまとまっています。</div>';
      if(sk)sk.innerHTML=fb; if(sd)sd.innerHTML='<div class="fallback">診断を読み込めませんでした。下のフォームから直接ご相談ください。</div>';
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
