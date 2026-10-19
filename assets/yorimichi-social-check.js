(function(){
  'use strict';
  var foods=[], page='', picks=[], data={}, dialog, canvas, blob, imageUrl='', revision=0, returnFocus, mode='wish';
  var format='story', channel='instagram', busy=false;
  var slugs=['okazu','bento','bread','coffee','sweets','otsumami','vegetables','souvenir','student','oyatsu'];
  var shortNames=['おかず','お弁当','パン','コーヒー','スイーツ','おつまみ','野菜','手みやげ','軽食','おやつ'];
  var root='https://www.bridgecycleco.com/';
  function read(k){try{return localStorage.getItem(k);}catch(e){return null;}}
  function save(k,v){try{localStorage.setItem(k,v);}catch(e){}}
  function clean(v){return (Array.isArray(v)?v:String(v||'').split('-')).filter(function(n){return /^\d+$/.test(String(n));}).map(Number).filter(function(n,i,a){return Number.isInteger(n)&&n>=0&&n<foods.length&&a.indexOf(n)===i;}).slice(0,3);}
  function track(name,extra){try{if(window.bcTrack)window.bcTrack(name,Object.assign({channel:channel,format:format,share_mode:mode},extra||{}));}catch(e){}}
  function message(s){var el=document.getElementById('snsMessage');if(el)el.textContent=s;}
  function shareLink(ch){
    var url=new URL('yorimichi-share/'+(picks.length&&mode==='wish'?slugs[picks[0]]:'index')+'.html',root);
    url.searchParams.set('src','share_'+ch);
    if(picks.length&&mode==='wish')url.searchParams.set('w',picks.join('-'));
    if(mode==='event'||mode==='results')url.searchParams.set('m',mode);
    return url.href;
  }
  function postText(){
    var text;
    if(mode==='results'&&data.results&&data.results.total>=30){
      text='南草津駅の帰り道、何が買えたらうれしい？\n'+data.results.asof+'時点・有効回答'+data.results.total+'件の途中経過です。\n'+data.results.top.slice(0,3).map(function(t,i){return(i+1)+'. '+t[0]+'（'+t[1]+'人が選択）';}).join('\n')+'\nあなたの食べたいものも、教えてください。';
    }else if(mode==='event'&&data.nextEvent){
      var e=data.nextEvent;text='南草津駅前に、小さなおいしい発見を。\n'+(e.round||'次回')+' '+e.date+' '+e.time+'\n'+e.place+(e.shops?'／'+e.shops+'店が出店':'')+'\n'+(data.shops||[]).slice(0,3).map(function(s){return '・'+s.item+(s.price?' '+s.price:'')+(s.status==='出店予定'?'':'（検討中）');}).join('\n')+'\n帰り道に、よりみちしませんか。';
    }else{
      text=picks.length?'南草津駅で、私は「'+picks.map(function(n){return foods[n][1];}).join('」「')+'」が買えたらうれしい。\nあなたは何派？':'南草津駅の帰り道、何が買えたらうれしい？';
      text+='\n名前・メール不要で、食べたいものを3つまで選べます。\n開催日は調整中。実際の出店商品は決まりしだいお知らせ。';
    }
    return text+'\n#南草津 #南草津駅前よりみち';
  }
  function syncLinks(){
    var full=postText()+'\n'+shareLink(channel);
    document.getElementById('snsText').value=full;
    document.getElementById('snsLine').href='https://social-plugins.line.me/lineit/share?url='+encodeURIComponent(shareLink('line'))+'&text='+encodeURIComponent(postText());
    document.getElementById('snsThreads').href='https://www.threads.com/intent/post?text='+encodeURIComponent(postText()+'\n'+shareLink('threads'));
    var xt=mode==='event'&&data.nextEvent?'南草津駅前、よりみち。\n'+data.nextEvent.date+' '+data.nextEvent.time+'\n'+data.nextEvent.place:mode==='results'&&data.results?'南草津駅で何が買えたらうれしい？\n有効回答'+data.results.total+'件の途中経過。あなたの食べたいものも教えてください。':picks.length?'南草津駅で「'+shortNames[picks[0]]+'」が買えたらうれしい。あなたは何派？\n名前・メール不要の投票受付中。開催日は調整中。':'南草津駅で、何が買えたらうれしい？ 名前・メール不要の投票受付中。開催日は調整中。';
    document.getElementById('snsX').href='https://twitter.com/intent/tweet?text='+encodeURIComponent(xt)+'&url='+encodeURIComponent(shareLink('x'));
    ['snsThreads','snsLine','snsX'].forEach(function(id){document.getElementById(id).hidden={snsThreads:'threads',snsLine:'line',snsX:'x'}[id]!==channel;});
    document.getElementById('snsFoodOptions').hidden=mode!=='wish';
    document.getElementById('snsInstagramHelp').hidden=channel!=='instagram';
    document.getElementById('snsDirectLinks').hidden=channel==='instagram';
  }
  function textLines(ctx,text,x,y,maxWidth,lineHeight,maxLines){
    var line='',lines=[];
    Array.from(String(text)).forEach(function(c){if(ctx.measureText(line+c).width>maxWidth&&line){lines.push(line);line=c;}else line+=c;});if(line)lines.push(line);
    lines.slice(0,maxLines||20).forEach(function(l,i){ctx.fillText(l,x,y+i*lineHeight);});
    return Math.min(lines.length,maxLines||20)*lineHeight;
  }
  function pill(ctx,text,x,y,w,h,bg,fg,size){ctx.fillStyle=bg;ctx.beginPath();ctx.roundRect(x,y,w,h,h/2);ctx.fill();ctx.fillStyle=fg;ctx.font='900 '+size+'px "Noto Sans JP", sans-serif';ctx.textAlign='center';ctx.fillText(text,x+w/2,y+h*.68);ctx.textAlign='left';}
  function star(ctx,x,y,r,color){ctx.fillStyle=color;ctx.beginPath();for(var i=0;i<8;i++){var a=i*Math.PI/4,rr=i%2?r*.35:r;var px=x+Math.cos(a)*rr,py=y+Math.sin(a)*rr;if(!i)ctx.moveTo(px,py);else ctx.lineTo(px,py);}ctx.closePath();ctx.fill();}
  function renderCard(){
    var ticket=++revision;blob=null;busy=true;
    document.getElementById('snsDownload').disabled=true;document.getElementById('snsNative').disabled=true;
    canvas.width=1080;canvas.height=format==='story'?1920:1350;
    var c=canvas.getContext('2d'),H=canvas.height;
    c.fillStyle='#FFF9EC';c.fillRect(0,0,1080,H);
    c.fillStyle='#FFD35B';c.beginPath();c.arc(1040,130,310,0,Math.PI*2);c.fill();
    star(c,950,500,72,'#DC492E');star(c,110,H-390,44,'#36745C');
    c.fillStyle='#173C51';c.font='900 37px "Noto Sans JP", sans-serif';c.fillText('南草津駅前、よりみち。',72,format==='story'?230:110);
    var top=format==='story'?365:225;
    c.font='900 68px "Noto Sans JP", sans-serif';
    if(mode==='results'&&data.results){c.fillText('みんなの食べたいもの。',72,top);c.font='700 32px "Noto Sans JP", sans-serif';c.fillText(data.results.asof+'時点／有効回答'+data.results.total+'件',72,top+70);}
    else if(mode==='event'&&data.nextEvent){c.fillText('次の、よりみち。',72,top);c.font='700 34px "Noto Sans JP", sans-serif';c.fillText('南草津駅前で、待っています。',72,top+70);}
    else{c.fillText('南草津駅で、',72,top);c.fillText(picks.length?'私はこれが食べたい。':'何が買えたらうれしい？',72,top+100);}
    var rows=mode==='results'&&data.results?data.results.top.slice(0,3).map(function(t,i){return{emoji:String(i+1),text:t[0],sub:t[1]+'人が選択'};}):mode==='event'&&data.nextEvent?[{emoji:'日',text:data.nextEvent.date,sub:data.nextEvent.time},{emoji:'場',text:data.nextEvent.place,sub:data.nextEvent.shops?data.nextEvent.shops+'店が出店':''}]:picks.map(function(n){return{emoji:foods[n][0],text:foods[n][1],sub:''};});
    if(!rows.length)rows=[{emoji:'?',text:'あなたなら、何がいい？',sub:'食べたいものを3つまで'}];
    var y=top+175,rowHeight=format==='story'?205:165;
    rows.forEach(function(r){
      c.fillStyle='#173C51';c.beginPath();c.roundRect(80,y+8,928,rowHeight-20,24);c.fill();
      c.fillStyle='#FFFFFF';c.beginPath();c.roundRect(72,y,928,rowHeight-20,24);c.fill();
      c.font='64px "Noto Color Emoji", "Apple Color Emoji", sans-serif';c.fillText(r.emoji,102,y+95);
      c.fillStyle='#173C51';c.font='900 43px "Noto Sans JP", sans-serif';
      textLines(c,r.text,200,y+68,755,55,2);
      if(r.sub){c.font='700 26px "Noto Sans JP", sans-serif';c.fillStyle='#536775';c.fillText(r.sub,200,y+rowHeight-43);}
      y+=rowHeight;
    });
    var foot=H-(format==='story'?455:340);
    pill(c,mode==='event'?'帰り道に、よりみちしよう。':'あなたの食べたいものは？',72,foot,936,90,'#FFD35B','#173C51',39);
    c.fillStyle='#173C51';c.font='700 30px "Noto Sans JP", sans-serif';
    c.fillText(mode==='event'?'くわしくは、リンクから。':'名前・メール不要／3つまで選んで投票',72,foot+150);
    c.font='500 24px "Noto Sans JP", sans-serif';
    textLines(c,mode==='event'?'日時・場所の最新情報は案内ページをご確認ください。':'開催日は調整中。食べたいもののリクエストです。\n出店する商品は、決まりしだいお知らせします。'.replace('\n',''),72,foot+200,920,36,2);
    if(format==='story'){pill(c,'↓ ここにリンクスタンプを ↓',202,H-140,676,54,'#EAE7DD','#536775',25);}
    c.font='500 21px "Noto Sans JP", sans-serif';c.fillStyle='#536775';c.fillText('南草津駅周辺まちづくりの社会実験',72,H-(format==='story'?190:42));
    var alt='南草津駅前、よりみち。'+rows.map(function(r){return r.text+(r.sub?' '+r.sub:'');}).join('、')+'。'+(mode==='event'?'開催案内':'食べたいもの投票。開催日は調整中。');
    canvas.setAttribute('aria-label',alt);
    canvas.toBlob(function(b){if(ticket!==revision)return;busy=false;if(!b){message('画像を作れませんでした。投稿文とリンクはコピーできます。');return;}blob=b;if(imageUrl)URL.revokeObjectURL(imageUrl);imageUrl=URL.createObjectURL(b);document.getElementById('snsDownload').disabled=false;document.getElementById('snsNative').disabled=false;},'image/png');
  }
  function refresh(){syncLinks();renderCard();}
  function choose(n,input){if(input.checked){if(picks.length>=3){input.checked=false;return;}picks.push(n);}else picks=picks.filter(function(x){return x!==n;});document.querySelectorAll('#snsFoodOptions input').forEach(function(el){el.disabled=!el.checked&&picks.length>=3;});refresh();}
  function prepare(){
    dialog=document.createElement('dialog');dialog.id='snsDialog';dialog.className='sns-dialog';dialog.setAttribute('aria-labelledby','snsTitle');
    dialog.innerHTML='<div class="sns-shell"><button type="button" class="sns-close" id="snsClose" aria-label="共有画面を閉じる">×</button><div class="sns-preview"><canvas id="snsCanvas" role="img"></canvas></div><div class="sns-controls"><p class="sns-eyebrow">南草津の、食べたいを広げよう。</p><h2 id="snsTitle">私はこれ派。あなたは？</h2><p class="sns-intro">画像と投稿文を用意しました。好きなSNSで、近くの人に教えてください。</p><fieldset class="sns-channel"><legend>どこに載せる？</legend><label><input type="radio" name="snsChannel" value="instagram" checked>Instagram</label><label><input type="radio" name="snsChannel" value="threads">Threads</label><label><input type="radio" name="snsChannel" value="line">LINE</label><label><input type="radio" name="snsChannel" value="x">X</label></fieldset><fieldset id="snsFoodOptions"><legend>カードに載せたいもの <small>3つまで</small></legend><div class="sns-foods"></div><p class="sns-fine">ここで選ぶと画像が変わります。投票はページの投票欄から。</p></fieldset><div class="sns-format"><label for="snsFormat">画像サイズ</label><select id="snsFormat"><option value="story">ストーリーズ（9:16）</option><option value="feed">投稿（4:5）</option></select></div><div class="sns-actions"><button type="button" class="btn btn-bulb" id="snsNative">画像を共有する</button><button type="button" class="btn btn-line" id="snsDownload">画像を保存</button></div><p id="snsInstagramHelp" class="sns-help">Instagramは、画像を保存して投稿へ。ストーリーズには「リンクをコピー」で取得したURLをリンクスタンプに貼ってください。</p><div id="snsDirectLinks" class="sns-links" hidden><a id="snsThreads" target="_blank" rel="noopener noreferrer">Threadsで投稿文を開く ↗</a><a id="snsLine" target="_blank" rel="noopener noreferrer">LINEで送る相手を選ぶ ↗</a><a id="snsX" target="_blank" rel="noopener noreferrer">Xで投稿文を開く ↗</a></div><label class="sns-text-label" for="snsText">投稿文とリンク</label><textarea id="snsText" rows="6" readonly></textarea><div class="sns-copy"><button type="button" class="btn btn-line btn-sm" id="snsCopyText">投稿文をコピー</button><button type="button" class="btn btn-line btn-sm" id="snsCopyLink">リンクをコピー</button></div><p id="snsMessage" class="sns-message" role="status" aria-live="polite"></p><p class="sns-fine">投稿や送信は、SNSの画面で内容を確認してから行えます。</p></div></div>';
    document.body.appendChild(dialog);canvas=document.getElementById('snsCanvas');
    var options=dialog.querySelector('.sns-foods');foods.forEach(function(f,n){var l=document.createElement('label'),i=document.createElement('input'),s=document.createElement('span');i.type='checkbox';i.value=n;i.addEventListener('change',function(){choose(n,i);});s.textContent=f[0]+' '+f[1];l.append(i,s);options.appendChild(l);});
    document.getElementById('snsClose').addEventListener('click',function(){dialog.close();});
    dialog.addEventListener('click',function(e){if(e.target===dialog)dialog.close();});
    dialog.addEventListener('close',function(){document.body.classList.remove('sns-open');if(returnFocus&&returnFocus.isConnected)returnFocus.focus();});
    dialog.querySelectorAll('input[name=snsChannel]').forEach(function(i){i.addEventListener('change',function(){channel=i.value;format=channel==='instagram'?'story':'feed';document.getElementById('snsFormat').value=format;refresh();});});
    document.getElementById('snsFormat').addEventListener('change',function(){format=this.value;renderCard();});
    function copy(value,label){if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(value).then(function(){message(label+'をコピーしました。');track('yorimichi_share_copy',{copy_kind:label==='リンク'?'link':'text'});}).catch(function(){message('下の投稿文を選択してコピーしてください。');document.getElementById('snsText').focus();document.getElementById('snsText').select();});}else{message('下の投稿文を選択してコピーしてください。');document.getElementById('snsText').focus();document.getElementById('snsText').select();}}
    document.getElementById('snsCopyText').addEventListener('click',function(){copy(postText()+'\n'+shareLink(channel),'投稿文');});
    document.getElementById('snsCopyLink').addEventListener('click',function(){copy(shareLink(channel),'リンク');});
    document.getElementById('snsDownload').addEventListener('click',function(){if(!imageUrl)return;var a=document.createElement('a');a.href=imageUrl;a.download='minakusa-yorimichi-'+format+'.png';document.body.appendChild(a);a.click();a.remove();message('画像を保存しました。投稿文とリンクもコピーできます。');track('yorimichi_share_image');});
    document.getElementById('snsNative').addEventListener('click',function(){
      if(busy||!blob)return;var file=new File([blob],'minakusa-yorimichi.png',{type:'image/png'});
      if(navigator.canShare&&navigator.canShare({files:[file]})&&navigator.share){navigator.share({files:[file],title:'南草津駅前、よりみち。',text:postText(),url:shareLink(channel)}).then(function(){message('共有先に画像を渡しました。投稿の状況はSNS側でご確認ください。');track('yorimichi_share_handoff');}).catch(function(e){if(e.name==='AbortError')message('共有をキャンセルしました。');else message('この端末では画像の共有を開けませんでした。「画像を保存」をお使いください。');});}
      else{document.getElementById('snsDownload').click();message('画像を保存して、SNSの投稿画面に添付してください。');}
    });
    ['snsLine','snsThreads','snsX'].forEach(function(id){document.getElementById(id).addEventListener('click',function(){track('yorimichi_share_intent',{channel:{snsLine:'line',snsThreads:'threads',snsX:'x'}[id]});});});
  }
  function open(nextMode){
    if(!dialog)prepare();mode=nextMode||'wish';if(mode==='results'&&!(data.results&&data.results.total>=30))mode='wish';if(mode==='event'&&!data.nextEvent)mode='wish';
    returnFocus=document.activeElement;document.getElementById('snsTitle').textContent=mode==='results'?'投票の途中経過を、届けよう。':mode==='event'?'次のよりみちを、知らせよう。':'私はこれ派。あなたは？';
    dialog.querySelectorAll('#snsFoodOptions input').forEach(function(i){i.checked=picks.indexOf(Number(i.value))>=0;i.disabled=!i.checked&&picks.length>=3;});
    if(!dialog.open){dialog.showModal();document.body.classList.add('sns-open');}
    message('');syncLinks();document.getElementById('snsClose').focus();
    Promise.resolve(document.fonts?document.fonts.ready:null).then(renderCard);track('yorimichi_share_open');
  }
  function init(config){
    foods=config.foods;page=config.page;picks=clean(read('minakusa_check_share_picks')||'');
    if(!picks.length&&read('minakusa_check_voted')){picks=clean(String(read('minakusa_check_vote_food')||'').split('／').map(function(label){return foods.findIndex(function(f){return f[1]===label;});}));}
    var q=new URLSearchParams(location.search),incoming=clean(q.get('w')||'');
    if(incoming.length&&/^share_(instagram|line|threads|x|native|copy)$/.test(q.get('src')||'')){
      var invite=document.getElementById('snsInvite');if(invite){invite.hidden=false;invite.querySelector('strong').textContent='「'+incoming.map(function(n){return shortNames[n];}).join('・')+'」派からの、おさそい。';}
      window.addEventListener('load',function(){track('yorimichi_share_landing',{channel:(q.get('src')||'').slice(6)});},{once:true});
    }
    document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-share]');if(b){e.preventDefault();open(b.getAttribute('data-share-mode')||'wish');}});
    var oldLine=document.getElementById('lineShare');if(oldLine){oldLine.href='https://social-plugins.line.me/lineit/share?url='+encodeURIComponent(shareLink('line'));oldLine.addEventListener('click',function(){track('yorimichi_share_intent',{channel:'line'});});}
  }
  function voteDone(indices){picks=clean(indices);save('minakusa_check_share_picks',picks.join('-'));}
  function update(d){data=d||{};if(dialog&&dialog.open)refresh();var rs=document.querySelector('[data-share-mode="results"]'),ev=document.querySelector('[data-share-mode="event"]');if(rs)rs.disabled=!(data.results&&data.results.total>=30);if(ev)ev.disabled=!data.nextEvent;}
  window.YorimichiSocial={init:init,open:open,voteDone:voteDone,update:update};
})();
