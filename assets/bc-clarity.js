/* BRIDGE CYCLE — Clarity Layer, progressive enhancement, no network calls */
(function(){
"use strict";
var raw=location.pathname||"/",key=raw.endsWith("/")?(raw==="/"?"index.html":raw.slice(1)+"index.html"):raw.replace(/^\//,"");
var templates={
"index.html":null,
"setsubi-kounyu.html":["設備を購入する経営者へ","補助金だけでなく、購入後の自己負担も無料で一次確認。","設備名・金額・目的を入力","#free-check","設備販売会社の方へ","/partner-setsubi.html","入力3項目","一次確認0円","購入を決める前"],
"partner-setsubi.html":["設備販売会社・メーカーへ","顧客名なしで確認できる。見積書に添える紹介リンクも作れます。","社名入り紹介リンクを作る","#referral-link","匿名で1件診断","#diagnosis","登録不要","販売会社の費用0円","1案件から"],
"hojokin-ogata.html":["大型補助金を検討中の企業へ","対象制度・資金繰り・発注の順番を、契約前に整理します。","使える制度を無料確認","/setsubi-kounyu.html","料金と支援内容を見る","#q-hiyo","無料一次確認","採択保証なし","全国オンライン"],
"hojokin.html":["小規模事業者の補助金相談","今の事業で申請できるか、何を準備するかを先に確認します。","相談する","/contact.html","大型設備投資はこちら","/hojokin-ogata.html","初回相談0円","条件確認から","正式依頼は別"],
"setsubi-soudan.html":["設備投資を検討中の方へ","購入前に補助金・負担額・導入時期を一緒に整理します。","無料一次確認へ","/setsubi-kounyu.html","販売会社向け入口","/partner-setsubi.html","相談0円","見積前でも可","オンライン対応"],
"gyosei.html":["自治体・商工団体へ","調査・計画・社会実験を、予算化に使える成果物から考えます。","業務と参考仕様書","#services","予算化前に相談","#yosan","参考仕様書あり","予算化前相談0円","滋賀・京都"],
"koen.html":["自治体・支援機関の研修担当へ","現場事例から制度改善まで。研修テーマ・時間・成果を確認できます。","研修プログラムを見る","#training","依頼について相談","/contact.html","90分講演","3時間研修","オンライン可"],
"matching.html":["閉店を考える店主・開業希望者へ","どちらの立場でも、まず登録・一覧を見るところから始められます。","店主：無料で登録","/owner-entry.html","開業希望：お店を探す","#mise","店名非公開","登録0円","全国で閲覧"],
"yameru.html":["閉店を考え始めた店主へ","原状回復で壊す前に、内装・設備を引き継ぐ選択肢を確認します。","無料で相談する","/contact.html","お店を無料登録","/owner-entry.html","閉店未決定でも","匿名相談","仲介なし"],
"genjo-kaifuku.html":["退去工事を考えている店主へ","原状回復を発注する前に、設備・内装を残せるか確かめます。","退店前承継を確認","/matching.html","相談する","/contact.html","発注前が重要","設備を確認","成約保証なし"],
"taiten-zen-shokei.html":["店舗の閉店・開業を考える方へ","閉める費用と始める費用を、同じ場所で減らす方法を確認します。","無料で店舗を登録","/owner-entry.html","登録店舗を探す","/matching.html","登録無料","店名非公開","全国で閲覧"],
"gyaku-shimei.html":["これからお店を始めたい方へ","希望する条件を伝え、閉店前のお店との接点を探します。","継ぎ手向けの入口","/tsugite.html","登録店舗を見る","/matching.html","条件から探す","開業前から","匿名性に配慮"],
"tsugite.html":["開業する場所を探している方へ","内装・設備を引き継げる店舗を探し、初期投資を比較できます。","お店の一覧を見る","/matching.html","相談する","/contact.html","全国の店舗","開業費を比較","条件の確認から"],
"zousaku.html":["内装・設備を次の人に渡したい方へ","捨てる前に残せる設備を確かめ、次の使い手へつなぎます。","お店を無料登録","/owner-entry.html","承継の仕組みを見る","/matching.html","撤去前に確認","店名非公開","まず登録"],
"shokei-inshokuten.html":["飲食店の承継へ","厨房・内装の再利用で、閉店と開業の費用を見直します。","登録店舗を見る","/matching.html","閉店前に登録","/owner-entry.html","厨房設備","造作の引継ぎ","登録無料"],
"shokei-biyoshitsu.html":["美容室・サロンの承継へ","まだ使えるセット面・シャンプー台・内装の価値を確かめます。","登録店舗を見る","/matching.html","お店を登録する","/owner-entry.html","設備を確認","造作の引継ぎ","登録無料"],
"shokei-clinic.html":["医院・クリニックの承継へ","残せる内装・設備と承継に必要な確認事項を整理します。","承継の相談をする","/contact.html","仕組みを読む","/matching.html","契約条件は別途確認","不動産仲介なし","事前確認"],
"uriba.html":["まず1回、売って試したい方へ","会場・日時を選んで、小さな出店から反応を確かめます。","出店会場を選ぶ","#finder","出店の相談をする","/contact.html","1日から","会場を比較","販売テスト"],
"uriba-kokaido.html":["旧大津公会堂で出店したい方へ","開催日と料金を確かめて、空き枠から申し込めます。","出店の申込へ","#apply","会場一覧へ","/uriba.html","小さく試せる","料金を確認","滋賀・大津"],
"uriba-ginkobo.html":["銀工房周辺で販売したい方へ","出店条件と空き枠を確認し、販売テストを始められます。","出店について申し込む","#apply","他の会場を見る","/uriba.html","小規模出店","日程を確認","大津"],
"kasu-lp.html":["空きスペースを活用したい方へ","貸したい人と出店したい人、それぞれの入口を選べます。","貸す・借りるを相談","/contact.html","出店会場を見る","/uriba.html","短期活用","地域の販路","小さく検証"],
"minakusa-yorimichi.html":["南草津駅前を活用したい方へ","出店・立ち寄り・実証の内容を、目的に合わせて確認できます。","食べたいものを投票","#voteForm","出店を申し込む","#register","社会実験","南草津駅前","実施情報を確認"],
"minakusa-ekimae.html":["南草津駅前の社会実験へ","参加方法と開催内容を最初に確認できます。","開催・参加案内を見る","{first}","問い合わせる","/contact.html","地域の実証","出店情報","日程を確認"],
"uchino-chef.html":["料理を楽しみたい方へ","料理人の出張・サービスの仕組みを確認し、相談できます。","料理人を探す","#find","LINEで相談","https://line.me/R/ti/p/@907kxssd","サービス内容","利用条件","まず相談"],
"uchino-chef-recruit.html":["出張料理に参加したい料理人へ","応募条件を確認し、まず一件から活動を検討できます。","応募について確認","#entry","問い合わせる","/contact.html","料理人募集","条件確認","まず相談"],
"camp.html":["キャンプ場の平日集客へ","平日の利用目的を増やすためのプラン制作を確認できます。","平日集客を相談する","#contact","料金・詳細を見る","#price","平日活用","企画から","効果検証"],
"akinai.html":["これからの自分を考えたい方へ","仕事を辞める前に、自分に合う一歩を9問で整理できます。","無料3分診断を始める","#qz","結果の見本を見る","#sample","9問","登録不要","無料で開始"],
"akinai-lp.html":["わたしのこれから診断","今の経験から、試せる仕事や次の一歩を整理します。","3分診断を始める","/akinai.html#qz","結果の見本を見る","/akinai.html#sample","9問","登録不要","無料"],
"akinai-start.html":["新しいことを始めたい方へ","自分の今の状況に合う、小さな始め方を考えます。","3分診断を試す","/akinai.html#qz","診断の説明を見る","/akinai-about.html","9問で診断","登録不要","次の一歩"],
"akinai-plan.html":["次の仕事を具体化したい方へ","小さく始めるための商品・顧客・価格を整理します。","無料診断から始める","/akinai.html#qz","プランの申込フォームへ","#formCard","プランを確認","金額を確認","無理に起業しない"],
"akinai-banso.html":["小さな一歩を続けたい方へ","診断結果から、実際の行動につなげる伴走の内容を確認します。","無料診断から始める","/akinai.html#qz","伴走について相談","/contact.html","内容を確認","料金を確認","段階的に"],
"akinai-lounge.html":["わたしのこれから診断","次の一歩を考えるための場所と参加方法を確認できます。","料金・利用方法を見る","#price","3分診断をする","/akinai.html#qz","自分のペース","条件を確認","無理に決めない"],
"road-sign/index.html":["医院・店舗の集客を見直したい方へ","看板・検索・Googleマップ・予約への流れを無料で点検します。","無料集客診断","#contact","医院向けの説明へ","/road-sign/kaiin.html","一次診断0円","改善点を3つ","滋賀・京都"],
"road-sign/kaiin.html":["医院・歯科の院長へ","集客の入口がどこで途切れるか、公開情報から診断します。","無料診断を依頼","{first}","看板と検索の考え方","/road-sign/","無料一次診断","既存院も対象","滋賀・京都"],
"road-sign/clinic.html":["クリニックの集客へ","開業前後の認知・地図・予約の導線を整理します。","無料で診断する","/road-sign/#contact","医院向け事例","/road-sign/kaiin.html","看板＋地図","予約まで","診断0円"],
"road-sign/beauty-clinic.html":["美容クリニックの集客へ","看板から検索、予約までの案内を確認できます。","無料で診断する","/road-sign/#contact","医院向け事例","/road-sign/kaiin.html","地図の整備","予約導線","診断0円"],
"road-sign/akiban.html":["看板の設置先を探している方へ","看板の候補と、その先の検索・予約へのつながりを考えます。","看板の候補を相談","#contact","集客診断へ","/road-sign/#contact","候補を比較","設置条件を確認","診断も可能"],
"road-sign/maps.html":["看板集客の事例を見たい方へ","看板から検索・予約まで、改善案を具体的に確認できます。","無料診断を申し込む","/road-sign/#contact","サービス全体を見る","/road-sign/","具体例","優先度で整理","無料診断あり"],
"road-sign/owner.html":["看板スペースを提供したい方へ","掲載場所・条件についてご相談いただけます。","場所の相談をする","{first}","仕組みを知る","/road-sign/","看板スペース","条件確認","相談から"],
"road-sign/partner.html":["看板会社・広告会社へ","看板の先にある検索・予約を組み合わせた提案ができます。","提携の登録・相談","#register","サービスを見る","/road-sign/","共同提案","店舗集客","相談から"]
};
var cohorts={
"succession":/^(owner-entry|shimekata|tsuzukeru|keisai|shisan-kit|shisan|hitokoto|torihiki|partner-fudosan|partner-kit|partners)\.html$/,
"shop":/^(kasu-lp-b|uriba-kit|shutten-kit|minakusa-vendor-day|minakusa-yorimichi-social)\.html$/,
"public":/^(partner-jichitai|partner-kinyu|partner-shien)\.html$/,
"personal":/^akinai-(about|faq|method|profile)\.html$/,
"other":/^(soudan|contact|check)\.html$/
};
var group={
"succession":["店舗承継を検討している方へ","閉店前に、内装・設備を引き継ぐ選択肢と費用を確認します。","店舗一覧を見る","/matching.html","店主の無料登録","/owner-entry.html","早めの相談","登録無料","匿名性に配慮"],
"shop":["小さく商いを試したい方へ","場所や日程を確認して、まず1回から販路を試せます。","会場一覧へ","/uriba.html","相談する","/contact.html","小規模出店","条件を確認","滋賀・大津"],
"public":["自治体・商工団体の方へ","施策の計画・現場調査・効果検証の範囲を、具体的に確認できます。","業務一覧を見る","/gyosei.html","予算化前の相談","/gyosei.html#yosan","参考仕様書","見積相談","事前整理"],
"personal":["わたしのこれから診断","自分の経験を整理し、無理のない最初の一歩を考えます。","無料3分診断へ","/akinai.html#qz","診断について","/akinai-about.html","9問","登録不要","無料"],
"other":["ご相談はこちらから","今の課題を簡単に選び、必要な支援にたどり着けます。","相談内容を選ぶ","/contact.html","会社トップへ","/","初回相談0円","課題から選択","無理な契約なし"]
};
var cfg=templates[key],cohort=null;
if(!cfg){Object.keys(cohorts).some(function(g){if(cohorts[g].test(key)){cohort=g;return true}return false});if(cohort)cfg=group[cohort]}
if(!cfg&&/^road-sign\/.+\.html$/.test(key))cfg=templates["road-sign/index.html"];
if(["contact.html","soudan.html","check.html"].includes(key))return;
if(!cfg||key==="index.html"){if(key==="index.html")onHome();return}
if(key.indexOf("akinai")===0)document.body.classList.add("bcq-akinai");
if(key.indexOf("road-sign/")===0)document.body.classList.add("bcq-sign");
var h1=document.querySelector("h1");if(!h1)return;
function text(s){return document.createTextNode(s)}
function el(tag,cl,s){var x=document.createElement(tag);if(cl)x.className=cl;if(s)x.textContent=s;return x}
function href(value){
 if(value==="{form}"){var form=document.querySelector("main form,section form,.form-card");if(form){if(form.id)return "#"+form.id;if(form.closest("[id]"))return "#"+form.closest("[id]").id;return "#bcq-direct-form"}return "/contact.html"}
 if(value==="{first}"){var hero=h1.closest("section")||h1.parentElement;var a=hero&&hero.querySelector('a[href^="#"]:not([href="#"])');return a?a.getAttribute("href"):"/contact.html"}
 if(value.charAt(0)==="#"&&!document.getElementById(value.slice(1)))return "/contact.html";
 return value;
}
if(cfg[3]==="{form}"){var f=document.querySelector("main form,section form,.form-card");if(f&&!f.id&&!f.closest("[id]"))f.id="bcq-direct-form"}
var sec=el("section","bcq");sec.setAttribute("aria-label","このページで最初にできること");
var wrap=el("div","bcq-top"),copy=el("div","bcq-copy"),acts=el("div","bcq-actions");
copy.append(el("p","bcq-kicker","ここから始める｜"+cfg[0]),el("h2","",cfg[1].split("。")[0]+"。"),el("p","bcq-summary",cfg[1]));
function link(label,url,alt){var a=el("a","bcq-action"+(alt?" alt":""),label+" →");a.href=href(url);a.dataset.bcClarity="1";return a}
var first=link(cfg[2],cfg[3],false),second=link(cfg[4],cfg[5],true);
acts.append(first,second);wrap.append(copy,acts);sec.append(wrap);
var flow=el("div","bcq-flow");cfg.slice(6,9).forEach(function(s){flow.append(el("span","",s))});sec.append(flow);
sec.append(el("p","bcq-foot","※表示内容・料金・受付条件は各サービスの案内をご確認ください。成果や採択を保証するものではありません。"));
var hero=h1.closest("section,article")||h1.closest(".hero,.top,.v4-hero")||h1.parentElement;
if(hero&&hero.parentNode)hero.insertAdjacentElement("afterend",sec);
else{var main=document.querySelector("main");(main||document.body).append(sec)}
if(document.querySelector(".mobile-cta,.sticky-cta,#stickyCta")||/^akinai/.test(key)||key==="setsubi-kounyu.html")return;
if(first.getAttribute("href")==="/contact.html"&&/^road-sign\//.test(key))return;
var floating=el("div","bcq-float");floating.append(el("span","bcq-float-label",cfg[0]),link(cfg[2],cfg[3],false));
document.body.append(floating);document.body.classList.add("bcq-has-float");
if("IntersectionObserver" in window){var io=new IntersectionObserver(function(entries){floating.hidden=entries[0].isIntersecting},{threshold:.1});io.observe(sec)}
function onHome(){
 document.body.classList.add("bcq-home");
 var hero=document.querySelector(".top2"),path=document.getElementById("entry-paths");
 if(hero&&path&&hero.parentNode){hero.insertAdjacentElement("afterend",path)}
 var tagline=document.querySelector(".top2-sub");
 if(tagline)tagline.textContent="設備を買う・補助金を探す・商談を進める・地域施策を動かす。いまの課題に合った入口から、無料の一次確認・相談を始められます。";
 var copy=document.querySelector(".top2 .hero-copy");
 if(copy&&!copy.querySelector(".bc-home-kicker"))copy.insertBefore(el("p","bc-home-kicker","目的を選んで、すぐに始められます"),copy.firstChild);
 if(path){var head=path.querySelector(".pathfinder-head h2");if(head)head.textContent="あなたは、どちらの立場ですか？";
 var cards=path.querySelectorAll(".pathfinder-item");
 [["設備の購入を考えている方","補助金・自己負担を無料で確かめる"],["設備を販売する方","社名入り紹介リンクを作る・匿名診断する"],["自治体・支援機関の方","仕様書・見積のたたき台を見る"],["医院・クリニックの方","Googleマップ・予約の集客を無料診断"]].forEach(function(x,i){var card=cards[i];if(!card)return;var audience=card.querySelector(".pathfinder-audience"),detail=card.querySelector(".pathfinder-detail");if(audience)audience.textContent=x[0];if(detail)detail.textContent=x[1]})}
}
})();
