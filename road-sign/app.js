
(()=>{'use strict';const cfg=window.KEIJI_LP_CONFIG||{},fmt=n=>Math.round(n).toLocaleString('ja-JP')+'円';
const a=document.getElementById('feeSlider'),b=document.getElementById('monthsSlider'),c=document.getElementById('commissionSlider');
function calc(){if(!a||!b||!c)return;const fee=+a.value,months=+b.value,rate=+c.value,gross=fee*months,com=gross*rate/100;for(const [id,v] of Object.entries({feeVal:fmt(fee),monthsVal:months+'か月',commissionVal:rate+'%',grossRevenue:fmt(gross),commissionTotal:fmt(com),netRevenue:fmt(gross-com)})){const el=document.getElementById(id);if(el)el.textContent=v;}}
[a,b,c].forEach(x=>x?.addEventListener('input',calc));calc();
const params=new URLSearchParams(location.search);
document.querySelectorAll('.leadform').forEach(form=>{
['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].forEach(k=>{const h=document.createElement('input');h.type='hidden';h.name=k;h.value=(params.get(k)||'').slice(0,100);form.append(h)});
form.addEventListener('submit',e=>{e.preventDefault();if(form.querySelector('[name="website_url"]')?.value)return;if(!form.reportValidity())return;
const type=form.dataset.form||'advertiser',subject=type==='media_partner'?'【京滋ロードサイン】看板会社からの試験提携相談':'【京滋ロードサイン】広告主の看板候補相談';
const rows=[...new FormData(form).entries()].filter(([k,v])=>v&&k!=='website_url'&&k!=='consent').map(([k,v])=>k+'：'+String(v).slice(0,800));
const uri='mailto:'+(cfg.contactEmail||'info@bridgecycleco.com')+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(rows.join('\n')+'\n\n内容を確認して送信してください。');
const m=form.querySelector('.form-msg');if(m)m.textContent='メール作成画面が開きます。内容を確認してメールアプリの「送信」を押してください。ここでは送信は完了していません。';
location.href=uri;
});
});
})();
