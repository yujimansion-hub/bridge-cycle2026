/* 補助金診断と補助金一覧（国・自治体・農業・雇用の助成金）
   データ：/data/hojokin.json（当社が公式資料から整理した主要制度・3日ごとに確認）
           /data/jgrants.json（jGrantsから全国の自治体の補助金を3日ごとに自動取得）
   置き場所：<div id="shindan"></div>（診断）と <div id="skList"></div>（一覧）。 */
(function(){
  var FEE={
    jizokuka:'当社の料金：初回相談・着手金0円、採択時に補助額の12%（最低5万円・税別）',
    ogata:'当社の料金：着手金7万円＋採択時に採択額の10%（税別・不採択なら着手金のみ）',
    consult:'当社の料金：内容をうかがってお見積りします（初回相談0円）'
  };
  var REVIEW={batch:'締切後に一斉審査',rolling:'随時受付・随時審査',first_come:'受付順（予算に達し次第終了）',local:'市町村等の要望調査を経て採択'};
  var PREFS=['北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県','茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県','新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県'];
  var KW={sales:/販路|販売|PR|EC|出展|展示会|ホームページ|商店街|観光|集客|店舗/,labor:/省力|生産性|設備|機械|DX|自動化|効率/,newbiz:/新事業|新商品|新製品|開発|創業|起業|スタートアップ|実証/,it:/IT|デジタル|DX|システム|AI|キャッシュレス|ソフト/,energy:/省エネ|太陽光|脱炭素|再エネ|再生可能|EV|電気自動車|CO|温室効果|蓄電|断熱|カーボン/,hire:/雇用|人材|賃上げ|賃金|研修|奨学金|育成|インターン|両立|育児|介護休業|採用|退職金/,succession:/承継|M&A|継承|事業引継/,agri:/農|林業|漁|畜産|水産|森林/};
  var Q=[
    {k:'pref',t:'事業所はどちらの都道府県ですか',sel:true},
    {k:'ind',t:'業種はどれに近いですか',o:[['shogyo','小売・飲食・サービス業'],['other','製造・建設・運輸・宿泊・娯楽など'],['agri','農業（林業・漁業を含む）']]},
    {k:'role',t:'農業でのお立場は',when:function(a){return a.ind==='agri';},o:[['new','新しく就農した・これから就農する（認定新規就農者など）'],['ninaite','認定農業者・地域の担い手（法人を含む）'],['group','産地・JA・農業者の団体']]},
    {k:'purpose',t:'何に使いたいですか',o:[['agri','農業の機械・施設・乾燥機などを入れる'],['sales','集客・販路開拓（チラシ・HP・店舗改装）'],['labor','人手不足の解消（機械・設備で省力化）'],['newbiz','新しい商品・サービス・事業を始める'],['it','業務のIT化・AIの導入'],['energy','省エネ・光熱費を下げる設備'],['hire','人を雇う・育てる・賃上げする'],['succession','事業を引き継ぐ・買う・売る'],['any','まだ決めていない']]},
    {k:'emp',t:'従業員は何人ですか（パート含む常時の人数）',o:[['5','0〜5人'],['20','6〜20人'],['21','21人以上']]},
    {k:'when',t:'いつ頃、発注・契約したいですか',o:[['soon','3か月以内'],['half','半年〜1年以内'],['tbd','まだ決めていない']]},
    {k:'wage',t:'この1〜3年で、賃上げはできそうですか',o:[['yes','計画できる'],['hard','難しい'],['dk','わからない']]}
  ];
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function day(s){if(!s)return null;var m=String(s).match(/(\d{4})-(\d{1,2})-(\d{1,2})/);return m?new Date(+m[1],+m[2]-1,+m[3]):null;}
  function md(d){return (d.getFullYear()!==new Date().getFullYear()?d.getFullYear()+'年':'')+(d.getMonth()+1)+'月'+d.getDate()+'日';}
  function jgLive(it){var e=day(it.end);return !e||e>=today();}
  function shortArea(it){var a=(it.area||'').replace(/詳細は.*$/,'').trim();if(a.length>16)a='';var p=it.pref.indexOf(' / ')>=0?'複数の都道府県':it.pref;return a?p+' '+a:p;}
  function today(){var t=new Date();t.setHours(0,0,0,0);return t;}
  function yen(n){if(!n)return '';if(n>=1e8)return (Math.round(n/1e6)/100)+'億円';if(n>=1e4)return (Math.round(n/1e3)/10).toLocaleString()+'万円';return n.toLocaleString()+'円';}
  function track(n,v){try{if(typeof window.bcTrack==='function')window.bcTrack(n,v||{});}catch(e){}}
  function getJSON(u){return fetch(u,{cache:'no-cache'}).then(function(r){if(!r.ok)throw 0;return r.json();});}

  function roundState(r){
    var t=today(),st=day(r.start),en=day(r.end);
    if(r.always)return{s:'always',order:0.5};
    if(en&&t>en)return null;
    if(en&&(!st||t>=st)){var d=Math.round((en-t)/864e5);return{s:'open',days:d,order:d/1000};}
    if(st&&t<st)return{s:'soon',order:1+(st-t)/1e13};
    return{s:'plan',order:2};
  }
  function badge(rs){
    if(rs.s==='open')return '<span class="bdg open">受付中</span>';
    if(rs.s==='always')return '<span class="bdg open">随時受付</span>';
    if(rs.s==='soon')return '<span class="bdg soon">まもなく</span>';
    return '<span class="bdg tbd">予定・未定</span>';
  }
  function roundHTML(r,rs){
    var st=day(r.start),en=day(r.end),dt='',left='';
    if(rs.s==='open')left='<span class="left">'+(rs.days===0?'本日締切':'締切まで あと'+rs.days+'日')+'</span>';
    if(st||en)dt='<span class="dt">'+(st?md(st):'')+(st&&en?' → ':'')+(en?'<b>'+md(en)+(r.end_time?' '+esc(r.end_time):'')+'</b> 締切':'')+'</span>';
    else if(r.when)dt='<span class="dt">'+esc(r.when)+'</span>';
    return '<div class="sk-r">'+badge(rs)+'<span class="rd">'+esc(r.label)+'</span>'+dt+left+'</div>';
  }
  function liveRounds(p){return (p.rounds||[]).map(function(r){return{r:r,rs:roundState(r)};}).filter(function(x){return x.rs;}).sort(function(x,y){return x.rs.order-y.rs.order;});}
  function progOrder(p){var l=liveRounds(p);return l.length?l[0].rs.order:9;}
  function wageLine(p,a){
    if(p.wage==='required'&&a&&a.wage!=='yes')return '<p class="sd-warn">⚠ '+esc(p.wage_text)+(a.wage==='hard'?' 賃上げが難しい場合は、申請するかどうかから一緒に判断します。':'')+'</p>';
    if(p.wage==='core'&&a&&a.wage==='hard')return '<p class="sd-warn">⚠ '+esc(p.wage_text)+'</p>';
    return '<p class="sd-mini">'+esc(p.wage_text)+'</p>';
  }
  function programCard(p,a,cls){
    var lv='<span class="lv">'+esc(p.level==='国'?'国':(p.area||p.pref))+'</span>';
    var rounds=liveRounds(p).map(function(x){return roundHTML(x.r,x.rs);}).join('')||'<div class="sk-r"><span class="bdg tbd">次回未定</span></div>';
    return '<div class="'+cls+'"><div class="sk-h">'+lv+'<span class="nm">'+(p.link?'<a href="'+esc(p.link)+'" target="_blank" rel="noopener">'+esc(p.name)+'</a>':esc(p.name))+'</span></div>'
      +rounds+'<p class="sd-p">'+esc(p.summary)+'</p>'
      +'<dl class="sk-dl"><dt>補助率</dt><dd>'+esc(p.rate)+'</dd><dt>上限</dt><dd>'+esc(p.max)+'</dd><dt>審査</dt><dd>'+esc(p.review_text||REVIEW[p.review]||'')+'</dd></dl>'
      +'<details class="sk-req"><summary>主な申請要件</summary><ul>'+(p.requirements||[]).map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul></details>'
      +wageLine(p,a)+'<p class="sd-fee">'+esc(FEE[p.fee]||FEE.consult)+'</p></div>';
  }
  function jgCard(it){
    var en=day(it.end),t=today(),left='';
    if(en){var d=Math.round((en-t)/864e5);left='<span class="left">'+(d<=0?'本日締切':'締切まで あと'+d+'日')+'</span>';}
    return '<div class="jg"><div class="sk-h"><span class="lv">'+esc(it.area?it.pref+' '+it.area:it.pref)+'</span><span class="nm"><a href="'+esc(it.url)+'" target="_blank" rel="noopener">'+esc(it.title)+'</a></span></div>'
      +'<div class="sk-r"><span class="bdg open">受付中</span><span class="dt">'+(en?'<b>'+md(en)+(it.end_time?' '+esc(it.end_time):'')+'</b> 締切':'締切の定めなし（通年など）')+'</span>'+left+'</div>'
      +(it.summary?'<p class="sd-p">'+esc(it.summary)+'</p>':'')
      +'<dl class="sk-dl">'+(it.rate?'<dt>補助率</dt><dd>'+esc(it.rate)+'</dd>':'')+(it.max?'<dt>上限</dt><dd>'+yen(it.max)+'</dd>':'')+(it.employees?'<dt>規模</dt><dd>'+esc(it.employees)+'</dd>':'')+'<dt>審査</dt><dd>公募要領で確認</dd></dl>'
      +(it.requirements?'<details class="sk-req"><summary>主な申請要件</summary><p>'+esc(it.requirements)+'</p></details>':'')+'</div>';
  }
  function jgMatch(it,pref,purpose){
    if(it.pref.indexOf(pref)<0||it.pref.indexOf('全国')>=0)return false;
    if(!purpose)return true;
    var re=KW[purpose];return re?re.test(it.title+' '+it.purpose+' '+it.summary):true;
  }

  /* 一覧（絞り込みつき） */
  function renderList(box,data,jg){
    var f={tab:'all',pref:''},shown=30,body;
    function draw(){
      var progs=data.programs.filter(function(p){
        if(f.tab==='jg')return false;
        if(f.tab!=='all'&&p.sector!==f.tab)return false;
        if(f.pref&&p.pref&&p.pref!==f.pref)return false;
        return true;
      }).sort(function(x,y){return progOrder(x)-progOrder(y);});
      var jgs=(jg&&jg.items||[]).filter(function(it){
        if(!jgLive(it))return false;
        if(f.tab==='agri'&&!KW.agri.test(it.title+it.purpose))return false;
        if(f.tab==='business'||f.tab==='employment')return false;
        if(f.pref&&it.pref.indexOf(f.pref)<0)return false;
        return true;
      });
      var h='';
      if(progs.length)h+='<h3 class="sk-sub">主な制度（要点を当社で整理）</h3>'+progs.map(function(p){return programCard(p,null,'sk');}).join('');
      if(f.tab==='all'||f.tab==='jg'||f.tab==='agri'){
        h+='<h3 class="sk-sub">'+(f.pref?esc(f.pref)+'の':'全国の')+'自治体・国の公募（jGrants掲載・受付中'+(jg?' '+jgs.length+'件':'')+'）</h3>';
        if(!jg)h+='<div class="fallback">全国の自治体の補助金を集めています。しばらくお待ちください。</div>';
        else if(!jgs.length)h+='<div class="fallback">条件に合う受付中の公募はありません。地域を変えてお試しください。</div>';
        else{h+=jgs.slice(0,shown).map(jgCard).join('');if(jgs.length>shown)h+='<button type="button" class="sk-more">さらに表示（残り'+(jgs.length-shown)+'件）</button>';}
      }
      var u=day(data.updated),ju=jg&&day(jg.updated);
      h+='<p class="sk-upd">主な制度の最終確認：'+(u?u.getFullYear()+'年'+md(u):'—')+'／自治体の公募の自動取得：'+(ju?ju.getFullYear()+'年'+md(ju):'準備中')+'（どちらも3日ごとに更新）</p>';
      body.innerHTML=h;
      var m=body.querySelector('.sk-more');if(m)m.onclick=function(){shown+=30;draw();};
    }
    box.innerHTML='<div class="sk-f"><div class="sk-tabs" role="tablist">'
      +[['all','すべて'],['business','事業者の補助金'],['employment','雇用・賃上げの助成金'],['agri','農業'],['jg','自治体の公募（全国）']].map(function(t,i){return '<button type="button" role="tab" data-t="'+t[0]+'"'+(i?'':' class="on"')+'>'+t[1]+'</button>';}).join('')
      +'</div><label class="sk-pref">地域 <select><option value="">全国すべて</option>'+PREFS.map(function(p){return '<option>'+p+'</option>';}).join('')+'</select></label></div><div class="sk-body"></div>';
    body=box.querySelector('.sk-body');
    box.querySelectorAll('.sk-tabs button').forEach(function(b){b.onclick=function(){box.querySelectorAll('.sk-tabs button').forEach(function(x){x.classList.remove('on');});b.classList.add('on');f.tab=b.getAttribute('data-t');shown=30;draw();track('hojokin_list_filter',{tab:f.tab});};});
    box.querySelector('.sk-pref select').onchange=function(){f.pref=this.value;shown=30;draw();track('hojokin_list_filter',{pref:f.pref});};
    draw();
  }

  /* 診断 */
  function renderShindan(box,data,jg){
    var a={},hist=[],step=0;
    function nextStep(s){while(s<Q.length&&Q[s].when&&!Q[s].when(a))s++;return s;}
    function q(){
      var c=Q[step],n=Q.filter(function(x){return !x.when||x.when(a);}).length,idx=hist.length+1;
      var opts=c.sel?'<div class="sd-selrow"><select class="sd-sel" aria-label="都道府県"><option value="">選んでください</option>'+PREFS.map(function(p){return '<option'+(a.pref===p?' selected':'')+'>'+p+'</option>';}).join('')+'</select><button type="button" class="btn sd-next"'+(a.pref?'':' disabled')+'>次へ ›</button></div>'
        :'<div class="sd-opts">'+c.o.filter(function(o){return !(c.k==='purpose'&&o[0]==='agri'&&a.ind!=='agri');}).map(function(o){return '<button type="button" class="sd-opt" data-v="'+o[0]+'">'+esc(o[1])+'</button>';}).join('')+'</div>';
      box.innerHTML='<div class="sd-card"><div class="sd-prog"><span style="width:'+Math.round((idx-1)/n*100)+'%"></span></div><p class="sd-step">質問 '+idx+' / '+n+'</p><h3 class="sd-q">'+esc(c.t)+'</h3>'+opts+(hist.length?'<button type="button" class="sd-back">‹ 前の質問へ</button>':'')+'</div>';
      function go(v){a[c.k]=v;if(!hist.length)track('hojokin_shindan_start',{});hist.push(step);step=nextStep(step+1);if(step<Q.length)q();else result();}
      if(c.sel){var s=box.querySelector('.sd-sel'),nb=box.querySelector('.sd-next');s.onchange=function(){nb.disabled=!s.value;};nb.onclick=function(){if(s.value)go(s.value);};}
      else box.querySelectorAll('.sd-opt').forEach(function(b){b.onclick=function(){go(b.getAttribute('data-v'));};});
      var bk=box.querySelector('.sd-back');if(bk)bk.onclick=function(){step=hist.pop();q();};
    }
    function label(k){var c=Q.filter(function(x){return x.k===k;})[0];if(c.sel)return a[k]||'';var o=c.o.filter(function(x){return x[0]===a[k];})[0];return o?o[1]:'';}
    function result(){
      var small=a.ind==='shogyo'?a.emp==='5':(a.emp!=='21');
      var hits=[];
      data.programs.forEach(function(p){
        if(p.pref&&p.pref!==a.pref)return;
        if(p.sector==='agri'){
          if(a.ind!=='agri')return;
          if(a.purpose!=='agri'&&a.purpose!=='any')return;
          var ok={new:['agri-hatten','agri-challenge'],ninaite:['agri-kouzou','agri-yushi'],group:['agri-tsuyoi']}[a.role]||[];
          if(ok.indexOf(p.id)<0)return;
        }else{
          if(a.purpose==='agri')return;
          if(a.purpose!=='any'&&(p.purposes||[]).indexOf(a.purpose)<0)return;
          if(p.small_only&&!small)return;
        }
        hits.push(p);
      });
      hits.sort(function(x,y){return progOrder(x)-progOrder(y);});
      var local=(jg&&jg.items||[]).filter(function(it){return jgLive(it)&&jgMatch(it,a.pref,a.purpose==='any'?'':a.purpose);});
      var notes=[];
      if(a.when==='soon')notes.push('<b>発注は、交付決定のあとに。</b>多くの補助金は、交付決定より前に発注・契約した費用が対象外です。申請の日程から逆算して発注日を決めましょう。');
      if(!small&&(a.purpose==='sales'||a.purpose==='any'))notes.push('従業員数から、小規模事業者向けの持続化補助金は対象外の可能性が高いです。');
      if(a.ind==='agri')notes.push('農業の補助金の多くは、市町村の農政担当・農業委員会への<b>要望調査</b>から始まります。締切が市町村ごとに違うため、早めの確認が大切です。');
      var total=hits.length+Math.min(local.length,8);
      var html='<div class="sd-card sd-res"><p class="sd-step">診断の結果（'+esc(a.pref)+'）</p><h3 class="sd-q">'+(total?'候補になりそうな補助金・助成金は '+total+' 件です。':'いまの条件で、すぐに合う補助金は見当たりません。')+'</h3>';
      if(!total)html+='<p class="sd-p">補助金がなくても、融資・リース・投資時期の見直しで進められることがあります。初回相談（0円）で一緒に考えます。</p>';
      if(hits.length)html+='<p class="sd-sub">主な制度</p>'+hits.map(function(p){return programCard(p,a,'sd-hit');}).join('');
      if(local.length)html+='<p class="sd-sub">'+esc(a.pref)+'の自治体などの公募（受付中）</p>'+local.slice(0,8).map(jgCard).join('')+(local.length>8?'<p class="sd-mini">ほか '+(local.length-8)+' 件は、下の一覧で地域を選ぶと見られます。</p>':'');
      if(notes.length)html+='<div class="sd-notes">'+notes.map(function(n){return '<p>'+n+'</p>';}).join('')+'</div>';
      html+='<div class="sd-cta"><button type="button" class="btn sd-go">この結果で無料相談する ›</button><a class="sd-line" href="https://line.me/R/ti/p/@907kxssd" target="_blank" rel="noopener">LINEで聞く</a><button type="button" class="sd-again">もう一度診断する</button></div>'
        +'<p class="sd-disc">※公開情報をもとにした目安です。要件の詳細は各公募要領で確認し、採択・交付を保証するものではありません。</p></div>';
      box.innerHTML=html;
      track('hojokin_shindan_complete',{purpose:a.purpose,pref:a.pref,hits:total});
      box.querySelector('.sd-again').onclick=function(){a={};hist=[];step=0;q();};
      box.querySelector('.sd-go').onclick=function(){
        track('hojokin_shindan_to_contact',{purpose:a.purpose});
        var kind=document.getElementById('cKind'),msg=document.getElementById('cMsg');
        if(kind){var map={sales:'販路開拓・小規模事業者持続化補助金',labor:'設備投資・改装の補助金',newbiz:'設備投資・改装の補助金',energy:'設備投資・改装の補助金',agri:'設備投資・改装の補助金',succession:'事業承継・M&A関連の補助金'};var v=map[a.purpose];if(v)kind.value=v;}
        if(msg&&!msg.value.trim()){
          msg.value='【補助金診断の結果】\n・地域：'+a.pref+'\n・業種：'+label('ind')+(a.role?'\n・農業での立場：'+label('role'):'')+'\n・使いたいこと：'+label('purpose')+'\n・従業員：'+label('emp')+'\n・発注の時期：'+label('when')+'\n・賃上げ：'+label('wage')+'\n・候補：'+(hits.map(function(p){return p.name;}).concat(local.slice(0,3).map(function(it){return it.title;})).join('、')||'なし')+'\n';
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
    getJSON('/data/hojokin.json').then(function(data){
      return getJSON('/data/jgrants.json').catch(function(){return null;}).then(function(jg){
        if(sk)renderList(sk,data,jg);
        if(sd)renderShindan(sd,data,jg);
      });
    }).catch(function(){
      var fb='<div class="fallback"><b>最新の公募スケジュールは、公式サイトでご確認ください。</b><br>中小機構「<a href="https://seisansei.smrj.go.jp/subsidy_info/schedule.html" target="_blank" rel="noopener">補助金活用ナビ</a>」や「<a href="https://www.jgrants-portal.go.jp/" target="_blank" rel="noopener">jGrants</a>」に公募がまとまっています。</div>';
      if(sk)sk.innerHTML=fb; if(sd)sd.innerHTML='<div class="fallback">診断を読み込めませんでした。下のフォームから直接ご相談ください。</div>';
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
