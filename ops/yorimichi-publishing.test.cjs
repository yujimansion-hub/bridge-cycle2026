const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { build, shopKey } = require('../assets/yorimichi-publishing.js');
const pending = JSON.parse(fs.readFileSync(path.join(__dirname, '../yorimichi-publishing.json'), 'utf8'));
const now = new Date('2026-10-23T08:00:00+09:00');
function ready() { return {...pending, mode:'enabled', approval:{status:'approved',approvedAt:'2026-10-22T12:00:00+09:00'},delivery:{connected:true,verifiedAt:'2026-10-22T13:00:00+09:00'},startAt:'2026-10-23T07:00:00+09:00'}; }
const data = {ok:true, results:null, nextEvent:null, shops:[]};
const event = {round:'第1回',key:'20261106',date:'11月6日（金）',time:'17:00〜20:00',place:'西口の駅前'};
test('pending approval and missing connection cannot schedule any post', () => {
  const p=build(data,pending,now); assert.equal(p.status,'held'); assert.ok(p.posts.length); assert.ok(p.posts.every(x=>!x.canSchedule)); assert.ok(p.reasons.includes('UDC承認待ち'));
});
test('all approval, delivery, start, mode and current-data gates are required', () => {
  const mutations=[c=>c.approval.status='pending',c=>c.approval.approvedAt=null,c=>c.approval.approvedAt='2026-10-24T00:00:00+09:00',c=>c.delivery.connected=false,c=>c.delivery.connected='false',c=>c.delivery.verifiedAt=null,c=>c.startAt=null,c=>c.startAt='2026-10-24T00:00:00+09:00',c=>c.mode='paused',c=>c.eventStatus='cancelled',c=>c.eventStatus='postponed',c=>c.policy={...c.policy,requireDuplicateCheck:false}];
  for(const mutate of mutations){const c=ready(); mutate(c); assert.ok(build(data,c,now).posts.every(x=>!x.canSchedule));}
  assert.ok(build({ok:false},ready(),now).posts.every(x=>!x.canSchedule));
});
test('ready plan selects at most one post per channel and day, within 24h',()=>{
  const p=build(data,ready(),now), selected=p.posts.filter(x=>x.canSchedule); assert.equal(selected.length,2); assert.equal(new Set(selected.map(x=>x.channel)).size,2);
  for(const x of selected){assert.ok(new Date(x.publishAt)>now); assert.ok(new Date(x.publishAt)-now<=86400000);}
  assert.equal(selected.find(x=>x.channel==='threads').publishAt,'2026-10-23T08:30:00.000Z');
  assert.equal(selected.find(x=>x.channel==='instagram').publishAt,'2026-10-23T09:00:00.000Z');
});
test('no fabricated results, shops, dates or private fields are included',()=>{
  const p=build({...data,email:'secret@example.test',comment:'PRIVATE COMMENT',members:[{no:7}]},ready(),now), s=JSON.stringify(p);
  assert.ok(!s.includes('secret@example.test')); assert.ok(!s.includes('PRIVATE COMMENT')); assert.ok(!p.posts.some(x=>/poll-|event-|shop-/.test(x.id)));
});
test('public results below 30 and invalid counts cannot create a results post',()=>{
  for(const r of [{total:29,top:[['パン',9]]},{total:30,top:[['パン',31]]},{total:30,top:[['パン','12']]}])assert.ok(!build({...data,results:r},ready(),now).posts.some(x=>x.id.startsWith('ym-poll-')));
});
test('ties from the public result remain in the post and unchanged results retain IDs',()=>{
  const d={...data,results:{total:42,asof:'10/23',top:[['おかず',20],['パン',17],['おやつ',15],['コーヒー',15]]}}, p=build(d,ready(),now);
  const a=p.posts.find(x=>x.id.startsWith('ym-poll-')); assert.ok(a.text.includes('コーヒー')); assert.ok(a.canSchedule); assert.ok(!p.posts.find(x=>x.id==='ym-start-v1-threads').canSchedule);
  assert.equal(a.id,build({...d,results:{...d.results,asof:'10/24'}},ready(),new Date('2026-10-24T08:00:00+09:00')).posts.find(x=>x.id.startsWith('ym-poll-')).id);
});
test('event needs valid future date, time and place; confirmed event replaces generic copy',()=>{
  for(const e of [{...event,time:''},{...event,place:''},{...event,key:'20260230'}])assert.ok(!build({...data,nextEvent:e},ready(),now).posts.some(x=>x.id.startsWith('ym-event-')));
  const p=build({...data,nextEvent:event},ready(),now); assert.ok(p.posts.some(x=>x.id.startsWith('ym-event-'))); assert.ok(p.posts.every(x=>!x.text.includes('開催日は調整中'))); assert.ok(p.posts.every(x=>!x.text.includes('開催日は、決まりしだい')));
});
test('shop introduction requires separate consent, actual photo and price',()=>{
  const shop={status:'出店予定',shop:'テスト店',item:'テストパン',price:'300円',photo:'https://example.test/bread.jpg'}, d={...data,nextEvent:event,shops:[shop]};
  assert.ok(!build(d,ready(),now).posts.some(x=>x.id.startsWith('ym-shop-')));
  const c={...ready(),shopPermissions:[shopKey(shop)]}; assert.equal(build(d,c,now).posts.filter(x=>x.id.startsWith('ym-shop-')).length,2);
  for(const change of [{status:'検討中'},{photo:''},{price:''}])assert.ok(!build({...d,shops:[{...shop,...change}]},c,now).posts.some(x=>x.id.startsWith('ym-shop-')));
});
test('reminder is only schedulable on the eve, before event date',()=>{
  const p=build({...data,nextEvent:event},ready(),new Date('2026-11-05T08:00:00+09:00'));
  assert.equal(p.posts.filter(x=>x.canSchedule&&x.id.startsWith('ym-remind-')).length,2);
  assert.ok(!build({...data,nextEvent:event},ready(),new Date('2026-11-06T08:00:00+09:00')).posts.some(x=>x.canSchedule));
});
test('bad schedule fails closed and expired initial posts are never rescheduled',()=>{
  const c=ready(); c.policy={...c.policy,threads:{weekdays:[],hour:17,minute:30}};
  assert.ok(build(data,c,now).posts.filter(x=>x.channel==='threads').every(x=>!x.canSchedule));
  assert.ok(build(data,ready(),new Date('2026-11-20T08:00:00+09:00')).posts.every(x=>!x.canSchedule));
});
test('copy respects platform length and links retain existing source tracking',()=>{
  const p=build(data,ready(),now);
  for(const x of p.posts){assert.ok(Array.from(x.text).length<=(x.channel==='threads'?500:2200));assert.ok(x.url.includes('src='+x.channel)); assert.ok(!x.text.includes(x.id));}
});
