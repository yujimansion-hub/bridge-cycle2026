/**
 * わたしの商い設計 API (Cloudflare Worker)
 *
 * Secrets:
 *   STRIPE_SECRET_KEY
 *   OPENAI_API_KEY
 *   TOKEN_SECRET
 * Vars:
 *   ALLOWED_ORIGIN=https://yujimansion-hub.github.io
 *   OPENAI_MODEL=gpt-5.6-luna
 * Optional KV binding:
 *   AKINAI_KV  (generation count + saved result)
 */
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{
  status,headers:{'content-type':'application/json; charset=utf-8',...headers}
});
const b64url = bytes => {
  let s=''; new Uint8Array(bytes).forEach(b=>s+=String.fromCharCode(b));
  return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
};
async function hmac(secret,text){
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return b64url(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(text)));
}
async function makeToken(env,payload){
  const body=b64url(new TextEncoder().encode(JSON.stringify(payload)));
  return body+'.'+await hmac(env.TOKEN_SECRET,body);
}
async function readToken(env,token){
  if(!token||!token.includes('.')) return null;
  const [body,sig]=token.split('.');
  if(await hmac(env.TOKEN_SECRET,body)!==sig) return null;
  try{
    let b=body.replace(/-/g,'+').replace(/_/g,'/');
    b+='='.repeat((4-b.length%4)%4);
    const bin=atob(b), bytes=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
    const p=JSON.parse(new TextDecoder().decode(bytes));
    if(!p.exp||Date.now()>p.exp) return null;
    return p;
  }catch(e){return null}
}
function cors(env,req){
  const origin=req.headers.get('Origin')||'';
  const allowed=(env.ALLOWED_ORIGIN||'https://yujimansion-hub.github.io').split(',').map(s=>s.trim());
  return allowed.includes(origin)?origin:allowed[0];
}
async function createCheckout(env,clientKey){
  if(!env.STRIPE_PRICE_ID) throw new Error('stripe_price_not_configured');
  const site=(env.SITE_BASE||'https://yujimansion-hub.github.io/bridge-cycle2026').replace(/\/$/,'');
  const p=new URLSearchParams();
  p.set('mode','payment');
  p.set('line_items[0][price]',env.STRIPE_PRICE_ID);
  p.set('line_items[0][quantity]','1');
  p.set('client_reference_id',clientKey);
  p.set('success_url',site+'/akinai-plan.html?session_id={CHECKOUT_SESSION_ID}');
  p.set('cancel_url',site+'/akinai.html#paidEngine');
  p.set('metadata[product]','akinai_plan');
  const r=await fetch('https://api.stripe.com/v1/checkout/sessions',{
    method:'POST',
    headers:{Authorization:'Bearer '+env.STRIPE_SECRET_KEY,'content-type':'application/x-www-form-urlencoded'},
    body:p.toString()
  });
  if(!r.ok) throw new Error('stripe_checkout_create_failed');
  return r.json();
}
async function stripeSession(env,id){
  const r=await fetch('https://api.stripe.com/v1/checkout/sessions/'+encodeURIComponent(id),{
    headers:{Authorization:'Bearer '+env.STRIPE_SECRET_KEY}
  });
  if(!r.ok) throw new Error('stripe_verify_failed');
  return r.json();
}
function cleanAnswers(a){
  const out={}; const allowed=['product','customer','need','voice','repeat','negative','purpose','threeYears','avoid','region','hours','funds','targetIncome','digital','experience','skills','family','firstPeople','notes'];
  for(const k of allowed){
    const v=a?.[k];
    if(Array.isArray(v)) out[k]=v.slice(0,12).map(x=>String(x).slice(0,120));
    else out[k]=String(v??'').slice(0,1200);
  }
  return out;
}
function systemPrompt(){
return `あなたは小規模事業者の創業・事業設計を支援する実務家です。
ユーザーの回答から、同じ案の言い換えではなく、商品形態・顧客・販売方法・価格構造が明確に異なる3つの商いプランを設計してください。

原則:
- PLAN A: 今の暮らしを守る。固定費・在庫・初期投資を最小化。
- PLAN B: 本人の経験・他者評価・強みを最も価値化する。
- PLAN C: 3年後から逆算し、段階的に育てる。
- avoid（やりたくないこと）は禁止条件として実際に案へ反映する。
- hours/funds/family/region/digital を制約条件として必ず反映する。
- 売上目安は price × quantity = monthly_sales の関係が分かる具体数値にする。
- 市場・競合は事実確認していないので断定せず「仮説」と明示する。
- 大きな投資を先に勧めない。最初の3人・30/60/90日・撤退基準を具体化する。
- 医療、法律、金融等の資格・許認可が関わり得る場合は確認事項として示す。
- 日本語。40代前後の生活者にも読みやすく、煽らない。

必ずJSONだけで返してください。構造:
{
 "summary":{"strengths":[],"constraints":[],"principle":""},
 "plans":[
  {
   "id":"A","name":"","one_line":"","why":"",
   "customer":"","problem":"","offer":"","price_yen":0,"quantity_per_month":0,"monthly_sales_yen":0,
   "sales_method":"","region":"","competitors_hypothesis":"","differentiation":"",
   "hours_per_week":"","startup_cost_yen":0,"family_fit":"","digital_fit":"",
   "first_three":[],"day30":"","day60":"","day90":"","stop_rule":"",
   "checks_before_start":[]
  }
 ]
}
plansは必ずA/B/Cの3件。数値は整数。JSON以外の文章やMarkdownは禁止。`;
}
function userPrompt(a){
  return '以下が本人の回答です。制約を守り、3案を別ビジネスモデルとして設計してください。\n'+JSON.stringify(a,null,2);
}
function outputSchema(){
  const plan={
    type:'object',
    additionalProperties:false,
    required:['id','name','one_line','why','customer','problem','offer','price_yen','quantity_per_month','monthly_sales_yen','sales_method','region','competitors_hypothesis','differentiation','hours_per_week','startup_cost_yen','family_fit','digital_fit','first_three','day30','day60','day90','stop_rule','checks_before_start'],
    properties:{
      id:{type:'string',enum:['A','B','C']},
      name:{type:'string'},one_line:{type:'string'},why:{type:'string'},
      customer:{type:'string'},problem:{type:'string'},offer:{type:'string'},
      price_yen:{type:'integer',minimum:0},quantity_per_month:{type:'integer',minimum:0},monthly_sales_yen:{type:'integer',minimum:0},
      sales_method:{type:'string'},region:{type:'string'},competitors_hypothesis:{type:'string'},differentiation:{type:'string'},
      hours_per_week:{type:'string'},startup_cost_yen:{type:'integer',minimum:0},family_fit:{type:'string'},digital_fit:{type:'string'},
      first_three:{type:'array',minItems:1,maxItems:6,items:{type:'string'}},
      day30:{type:'string'},day60:{type:'string'},day90:{type:'string'},stop_rule:{type:'string'},
      checks_before_start:{type:'array',items:{type:'string'}}
    }
  };
  return {
    type:'object',
    additionalProperties:false,
    required:['summary','plans'],
    properties:{
      summary:{
        type:'object',additionalProperties:false,
        required:['strengths','constraints','principle'],
        properties:{
          strengths:{type:'array',items:{type:'string'}},
          constraints:{type:'array',items:{type:'string'}},
          principle:{type:'string'}
        }
      },
      plans:{type:'array',minItems:3,maxItems:3,items:plan}
    }
  };
}
async function generateWithOpenAI(env,answers){
  const body={
    model:env.OPENAI_MODEL||'gpt-5.6-luna',
    input:[
      {role:'system',content:[{type:'input_text',text:systemPrompt()}]},
      {role:'user',content:[{type:'input_text',text:userPrompt(answers)}]}
    ],
    text:{
      format:{
        type:'json_schema',
        name:'akinai_three_plans',
        strict:true,
        schema:outputSchema()
      }
    },
    max_output_tokens:7500
  };
  const r=await fetch('https://api.openai.com/v1/responses',{
    method:'POST',
    headers:{Authorization:'Bearer '+env.OPENAI_API_KEY,'content-type':'application/json'},
    body:JSON.stringify(body)
  });
  if(!r.ok) throw new Error('openai_generate_failed');
  const data=await r.json();
  let txt='';
  for(const item of (data.output||[])) for(const part of (item.content||[])) if(part.type==='output_text') txt+=part.text||'';
  txt=txt.trim();
  if(!txt) throw new Error('openai_empty_output');
  return JSON.parse(txt);
}
function randId(){
  const a=new Uint8Array(18);crypto.getRandomValues(a);return b64url(a);
}
export default {
  async fetch(req,env){
    const origin=cors(env,req);
    const headers={'access-control-allow-origin':origin,'access-control-allow-methods':'POST,GET,OPTIONS','access-control-allow-headers':'content-type,authorization','vary':'Origin','cache-control':'no-store'};
    if(req.method==='OPTIONS') return new Response(null,{status:204,headers});
    const u=new URL(req.url);
    try{
      if(u.pathname==='/checkout'&&req.method==='POST'){
        const {client_key}=await req.json();
        if(!client_key||String(client_key).length<12) return json({ok:false,error:'invalid_client_key'},400,headers);
        const s=await createCheckout(env,String(client_key).slice(0,180));
        return json({ok:true,url:s.url},200,headers);
      }
      if(u.pathname==='/verify'&&req.method==='POST'){
        const {session_id,client_key}=await req.json();
        if(!session_id||!client_key) return json({ok:false,error:'missing_parameters'},400,headers);
        const s=await stripeSession(env,session_id);
        if(s.payment_status!=='paid') return json({ok:false,error:'payment_not_confirmed'},402,headers);
        if(s.metadata?.product!=='akinai_plan') return json({ok:false,error:'wrong_product'},403,headers);
        if(Number(s.amount_total)!==3300 || String(s.currency||'').toLowerCase()!=='jpy') return json({ok:false,error:'wrong_amount_or_currency'},403,headers);
        if(!s.client_reference_id||s.client_reference_id!==client_key) return json({ok:false,error:'browser_mismatch'},403,headers);
        const payload={sid:s.id,ref:client_key,exp:Date.now()+30*24*60*60*1000};
        const token=await makeToken(env,payload);
        if(env.AKINAI_KV) await env.AKINAI_KV.put('verified:'+s.id,'1',{expirationTtl:31*24*60*60});
        return json({ok:true,token,expires_in_days:30,max_generations:5},200,headers);
      }
      if(u.pathname==='/generate'&&req.method==='POST'){
        const auth=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
        const p=await readToken(env,auth);
        if(!p) return json({ok:false,error:'invalid_or_expired_token'},401,headers);
        let used=0;
        if(env.AKINAI_KV){
          const k='uses:'+p.sid; used=Number(await env.AKINAI_KV.get(k)||0);
          if(used>=5) return json({ok:false,error:'generation_limit'},429,headers);
        }
        const {answers}=await req.json();
        const cleaned=cleanAnswers(answers||{});
        if(!cleaned.product&&!cleaned.voice&&!cleaned.experience) return json({ok:false,error:'insufficient_answers'},400,headers);
        const result=await generateWithOpenAI(env,cleaned);
        const result_id=randId();
        if(env.AKINAI_KV){
          await env.AKINAI_KV.put('result:'+result_id,JSON.stringify(result),{expirationTtl:31*24*60*60});
          await env.AKINAI_KV.put('uses:'+p.sid,String(used+1),{expirationTtl:31*24*60*60});
        }
        return json({ok:true,result,result_id:env.AKINAI_KV?result_id:null},200,headers);
      }
      if(u.pathname.startsWith('/result/')&&req.method==='GET'){
        if(!env.AKINAI_KV) return json({ok:false,error:'result_storage_disabled'},404,headers);
        const id=u.pathname.slice('/result/'.length);
        const raw=await env.AKINAI_KV.get('result:'+id);
        if(!raw) return json({ok:false,error:'result_not_found'},404,headers);
        return json({ok:true,result:JSON.parse(raw)},200,headers);
      }
      return json({ok:false,error:'not_found'},404,headers);
    }catch(e){
      return json({ok:false,error:e?.message||'server_error'},500,headers);
    }
  }
};