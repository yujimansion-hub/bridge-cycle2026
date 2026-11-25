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
  function shortArea(it){var a=(it.area||'').replace(/詳細は.*$/,'').trim();if(a.length>16)a='';var p=/\//.test(it.pref)?(it.pref.indexOf('全国')>=0?'全国':'複数の都道府県'):it.pref;if(/\//.test(a))a='';return a?p+' '+a:p;}
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

  /* 補助金検索（会社の条件を入力して探す） */
  var INDS=[['製造業','製造業',20,300],['建設業','建設業',20,300],['卸売業','卸売業、小売業',5,100],['小売業','卸売業、小売業',5,50],['飲食店','宿泊業、飲食サービス業',5,50],['宿泊業','宿泊業、飲食サービス業',20,100],['生活関連サービス・娯楽（美容・理容・クリーニング等）','生活関連サービス業、娯楽業',5,100],['医療・福祉（クリニック・介護等）','医療、福祉',5,100],['運輸業','運輸業、郵便業',20,300],['情報通信業','情報通信業',5,100],['不動産・物品賃貸業','不動産業、物品賃貸業',5,100],['専門・技術サービス（士業・設計・コンサル等）','学術研究、専門・技術サービス業',5,100],['教育・学習支援','教育、学習支援業',5,100],['農業・林業','農業、林業',20,300],['漁業','漁業',20,300],['その他のサービス業','サービス業（他に分類されないもの）',5,100]];
  /* 設備名から目的を推定（設備販売会社が入力しやすいように） */
  var EQ=[
    ['agri',/乾燥機|トラクター|コンバイン|田植|籾|もみ|選別機|防除|ドローン|ハウス|温室|ビニール|農機|農業|畜舎|搾乳|育苗|精米|色彩選別/],
    ['labor',/食洗機|食器洗浄|券売機|配膳|ロボット|自動|スチコン|スチームコンベクション|真空|包装機|充填|フィラー|デポジッター|成形|加工機|NC|マシニング|レーザー|溶接|プレス|フォークリフト|コンベア|省力|省人|検品|仕分|セルフレジ|製氷|冷凍機|急速冷凍|ブラスト/],
    ['energy',/エアコン|空調|LED|照明|冷蔵庫|冷凍庫|冷凍冷蔵|ボイラー|給湯|ヒートポンプ|太陽光|蓄電|断熱|二重窓|省エネ|EV|電気自動車|充電/],
    ['it',/システム|ソフト|アプリ|予約|POS|レジ|AI|クラウド|会計|勤怠|在庫管理|受発注|顧客管理|CRM|キャッシュレス|タブレット|パソコン|PC|セキュリティ/],
    ['sales',/ホームページ|HP|ウェブ|Web|EC|ネットショップ|チラシ|看板|改装|内装|外装|展示会|出展|パンフ|広告|店舗/],
    ['newbiz',/新商品|新製品|新サービス|開発|新事業|試作|キッチンカー|工房|設備一式/],
    ['hire',/研修|教育|人材|採用|雇用|正社員|賃上げ|資格/],
    ['succession',/承継|M&A|事業譲渡|引継/]
  ];
  function guessPurposes(t){var r=[];EQ.forEach(function(e){if(e[1].test(t))r.push(e[0]);});return r;}
  function words(t){return String(t||'').split(/[\s、,，・\/／]+/).filter(function(w){return w.length>=2;});}
  function cityOf(it){
    var m=(it.title||'').match(/【(?:[^】]*?[都道府県])?\s*([^【】\s]{1,8}?[市町村区])】/);if(m)return m[1];
    var a=(it.area||'').trim();if(/^[^\s、。]{1,8}[市町村区]$/.test(a))return a;
    return '';
  }
  function maxEmp(s){var m=String(s||'').match(/(\d+)名以下/);return m?+m[1]:null;}
  function monthDate(v){var m=String(v||'').match(/(\d{4})-(\d{1,2})/);return m?new Date(+m[1],+m[2]-1,1):null;}
  /* 導入時期と申請期間の関係：ok=間に合う / tight=急ぎ / late=導入予定に間に合わない / wait=次の公募待ち / free=随時 */
  function timing(endDate,state,order){
    if(state==='always'||state==='rolling')return{k:'free',t:'随時申請できます（交付決定の後に発注）'};
    if(state==='plan')return{k:'wait',t:'次の公募の日程待ち。導入時期が近いなら、時期の調整が必要です'};
    if(!order)return endDate?{k:'ok',t:'導入時期を決めるときは、交付決定の後に発注を'}:{k:'wait',t:'日程は公式発表待ち'};
    if(!endDate)return{k:'ok',t:''};
    var gap=(order-endDate)/864e5;
    if(gap>=60)return{k:'ok',t:'締切後、交付決定を待ってから発注しても間に合う見込み'};
    if(gap>=0)return{k:'tight',t:'締切から導入までが短いです。交付決定の時期を確認し、発注を遅らせる余地を'};
    return{k:'late',t:'導入予定が締切より前です。交付決定前の発注は対象外になるため、導入を遅らせるか別の制度を'};
  }
  var TM={ok:['◎','間に合う'],tight:['△','急ぎ'],late:['×','時期が合わない'],wait:['…','公募待ち'],free:['◎','随時']};
  function tmHTML(x){if(!x||!x.t)return '';return '<p class="sd-tm sd-tm-'+x.k+'"><b>'+TM[x.k][0]+' '+TM[x.k][1]+'</b> '+esc(x.t)+'</p>';}

  function renderShindan(box,data,jg){
    var qs=new URLSearchParams(location.search);
    var mm=new Date();mm.setMonth(mm.getMonth()+4);var defMonth=mm.getFullYear()+'-'+String(mm.getMonth()+1).padStart(2,'0');
    box.innerHTML='<form class="sd-card sd-form" novalidate>'
      +'<div class="sd-grid">'
      +'<label class="sd-f"><span>業種<em>必須</em></span><select name="ind" required><option value="">選んでください</option>'+INDS.map(function(x,i){return '<option value="'+i+'">'+esc(x[0])+'</option>';}).join('')+'</select></label>'
      +'<label class="sd-f"><span>常時雇用する従業員数<em>必須</em></span><span class="sd-unit"><input name="emp" type="number" inputmode="numeric" min="0" max="99999" placeholder="例：8" required>人</span><small>役員・事業主本人は含めず、パート等は所定労働時間などで判断</small></label>'
      +'<label class="sd-f"><span>都道府県<em>必須</em></span><select name="pref" required><option value="">選んでください</option>'+PREFS.map(function(p){return '<option>'+p+'</option>';}).join('')+'</select></label>'
      +'<label class="sd-f"><span>市区町村</span><input name="city" placeholder="例：大津市" maxlength="20"><small>入れると、その市町村の補助金に絞れます</small></label>'
      +'<label class="sd-f sd-wide"><span>導入しようと考えている設備・取り組み<em>必須</em></span><input name="equip" placeholder="例：食器洗浄機、予約システム、乾燥機、店舗の改装" maxlength="80" required><small>複数あるときは「、」で区切ってください</small></label>'
      +'<label class="sd-f"><span>導入（発注・契約）の予定時期</span><input name="when" type="month" value="'+defMonth+'"></label>'
      +'<label class="sd-f"><span>この1〜3年の賃上げ</span><select name="wage"><option value="dk">わからない</option><option value="yes">計画できる</option><option value="hard">難しい</option></select></label>'
      +'</div><p class="sd-err" role="alert"></p><button type="submit" class="btn sd-go-search">使える補助金を検索する ›</button>'
      +'<p class="sd-mini">入力内容は送信されません（この画面の中だけで検索します）。</p></form><div class="sd-out"></div>';
    var f=box.querySelector('form'),out=box.querySelector('.sd-out');
    ['ind','emp','pref','city','equip','when','wage'].forEach(function(k){var v=qs.get(k);if(v!=null&&f[k])f[k].value=v;});
    f.onsubmit=function(e){e.preventDefault();run(true);};
    if(qs.get('equip')&&qs.get('pref'))run(false);

    function run(scroll){
      var err=box.querySelector('.sd-err');err.textContent='';
      var a={ind:f.ind.value,emp:f.emp.value,pref:f.pref.value,city:f.city.value.trim(),equip:f.equip.value.trim(),when:f.when.value,wage:f.wage.value};
      if(a.ind===''||a.emp===''||!a.pref||!a.equip){err.textContent='業種・従業員数・都道府県・導入したい設備は必須です。';return;}
      var IND=INDS[+a.ind],emp=+a.emp,order=monthDate(a.when);
      var small=emp<=IND[2],sme=emp<=IND[3]||emp<=300&&/製造|建設|運輸|農業|漁業/.test(IND[1]);
      var purposes=guessPurposes(a.equip);var isAgri=/農業|漁業/.test(IND[1]);
      if(isAgri&&purposes.indexOf('agri')<0&&/機|施設|ハウス/.test(a.equip))purposes.push('agri');
      if(!purposes.length)purposes=['labor','newbiz','it','sales'];
      var ws=words(a.equip),results=[];
      /* 主な制度 */
      data.programs.forEach(function(p){
        if(p.pref&&p.pref!==a.pref)return;
        if(p.area&&a.city&&p.area.indexOf(a.pref)===0&&p.area.length>a.pref.length&&p.area.indexOf(a.city)<0)return;
        if(p.sector==='agri'&&!isAgri)return;
        var hit=(p.purposes||[]).filter(function(x){return purposes.indexOf(x)>=0;}).length;
        if(!hit)return;
        if(p.small_only&&!small)return;
        var live=liveRounds(p),best=live[0];
        var st=!best?null:(best.rs.s==='always'||p.review==='rolling')?'always':(best.rs.s==='plan'?'plan':'open');
        var tm=best?timing(day(best.r.end),st,order):{k:'wait',t:'次の公募は未定です'};
        if(p.review==='local')tm={k:'wait',t:'市町村の要望調査が入口です。導入の1年前から市町村に相談を'};
        results.push({kind:'p',p:p,score:hit*3+(p.pref?2:0)+(tm.k==='ok'||tm.k==='free'?2:tm.k==='late'?-3:0),tm:tm});
      });
      /* 全国の自治体の公募（jGrants） */
      (jg&&jg.items||[]).forEach(function(it){
        if(!jgLive(it))return;
        var nat=it.pref.indexOf('全国')>=0;
        if(!nat&&it.pref.indexOf(a.pref)<0)return;
        var c=cityOf(it);if(c&&a.city&&c!==a.city&&a.city.indexOf(c)<0)return;
        if(it.industry&&it.industry.indexOf(IND[1])<0)return;
        var me=maxEmp(it.employees);if(me!=null&&emp>me)return;
        var text=it.title+' '+it.purpose+' '+it.summary+' '+it.requirements;
        var kw=ws.filter(function(w){return text.indexOf(w)>=0;}).length;
        var pk=purposes.filter(function(x){return KW[x]&&KW[x].test(it.title+' '+it.purpose);}).length;
        var score=kw*4+pk*2+(nat?0:2)+(c&&a.city&&c===a.city?3:0);
        if(nat&&kw===0)return;           /* 全国向けは設備名が一致したものだけ */
        if(!nat&&kw===0&&pk===0)return;
        results.push({kind:'j',it:it,score:score,tm:timing(day(it.end),it.end?'open':'always',order)});
      });
      results.sort(function(x,y){return y.score-x.score;});
      var notes=[];
      if(!sme)notes.push('従業員数から、中小企業の定義（'+esc(IND[0])+'は'+IND[3]+'人以下など）を超える可能性があります。資本金でも判定できるので、ご相談ください。');
      if(order&&(order-today())/864e5<90)notes.push('<b>導入まで3か月を切っています。</b>多くの補助金は交付決定より前に発注した費用が対象外です。補助金を使うなら、導入時期の見直しも検討しましょう。');
      if(isAgri)notes.push('農業の国の補助金の多くは、市町村の農政担当・農業委員会への<b>要望調査</b>から始まります。');
      var w=a.wage;
      var html='<div class="sd-card sd-res"><p class="sd-step">検索結果：'+esc(a.pref+(a.city?' '+a.city:''))+'／'+esc(IND[0])+'／従業員'+emp+'人／「'+esc(a.equip)+'」'+(a.when?'／導入 '+esc(a.when.replace('-','年'))+'月':'')+'</p>'
        +'<h3 class="sd-q">'+(results.length?'活用できる可能性がある補助金・助成金は '+results.length+' 件です。':'条件に合う補助金は見つかりませんでした。')+'</h3>';
      if(!results.length)html+='<p class="sd-p">設備名の書き方を変える（例：「スチコン」→「厨房機器」）、市区町村を空欄にする、で広く探せます。融資・リース・導入時期の見直しも含め、初回相談（0円）で一緒に考えます。</p>';
      html+=results.slice(0,20).map(function(r){
        if(r.kind==='p')return programCard(r.p,{wage:w},'sd-hit').replace(/<\/div>$/,tmHTML(r.tm)+'</div>');
        return jgCard(r.it).replace(/<\/div>$/,tmHTML(r.tm)+'</div>');
      }).join('');
      if(results.length>20)html+='<p class="sd-mini">ほか '+(results.length-20)+' 件。条件を足すと絞り込めます。</p>';
      if(notes.length)html+='<div class="sd-notes">'+notes.map(function(n){return '<p>'+n+'</p>';}).join('')+'</div>';
      var share=location.origin+location.pathname+'?'+new URLSearchParams({ind:a.ind,emp:a.emp,pref:a.pref,city:a.city,equip:a.equip,when:a.when,wage:a.wage}).toString()+'#shindan-sec';
      html+='<div class="sd-cta"><button type="button" class="btn sd-go">この結果で無料相談する ›</button><a class="sd-line" href="https://line.me/R/ti/p/@907kxssd" target="_blank" rel="noopener">LINEで聞く</a><button type="button" class="sd-share">この条件のURLをコピー</button></div>'
        +'<p class="sd-disc">※公開情報をもとにした目安です。対象の可否・要件は各公募要領で確認し、採択・交付を保証するものではありません。</p></div>';
      out.innerHTML=html;
      track('hojokin_search',{ind:IND[0],pref:a.pref,hits:results.length,purposes:purposes.join(',')});
      out.querySelector('.sd-share').onclick=function(){var b=this;try{navigator.clipboard.writeText(share).then(function(){b.textContent='コピーしました';});}catch(e){prompt('このURLをコピーしてください',share);}};
      out.querySelector('.sd-go').onclick=function(){
        track('hojokin_shindan_to_contact',{ind:IND[0]});
        var kind=document.getElementById('cKind'),msg=document.getElementById('cMsg'),co=document.getElementById('cCompany');
        if(kind){var v=purposes.indexOf('sales')>=0&&small?'販路開拓・小規模事業者持続化補助金':purposes.indexOf('succession')>=0?'事業承継・M&A関連の補助金':'設備投資・改装の補助金';kind.value=v;}
        if(msg&&!msg.value.trim()){
          msg.value='【補助金検索の条件】\n・業種：'+IND[0]+'\n・常時雇用の従業員：'+emp+'人\n・所在地：'+a.pref+(a.city?' '+a.city:'')+'\n・導入したい設備等：'+a.equip+'\n・導入予定：'+(a.when||'未定')+'\n・賃上げ：'+({yes:'計画できる',hard:'難しい',dk:'わからない'}[w])+'\n・候補：'+results.slice(0,5).map(function(r){return r.kind==='p'?r.p.name:r.it.title;}).join('、')+'\n';
        }
        var c=document.getElementById('contact')||document.getElementById('form');
        if(c)c.scrollIntoView({behavior:'smooth'});
      };
      if(scroll)out.scrollIntoView({behavior:'smooth',block:'start'});
    }
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
