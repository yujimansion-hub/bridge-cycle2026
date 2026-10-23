(function(){
  'use strict';
  var foods=[], page='', voteFn=null, voting=false, picks=[], data={}, dialog, canvas, blob, imageUrl='', revision=0, returnFocus, mode='wish';
  var format='feed', channel='native', busy=false, onUse=null, announcement={}, foodArt=[], artStarted=false;
  var slugs=['okazu','bento','bread','coffee','sweets','otsumami','vegetables','souvenir','student','oyatsu'];
  var shortNames=['おかず','お弁当','パン','コーヒー','スイーツ','おつまみ','野菜','手みやげ','軽食','おやつ'];
  var root='https://www.bridgecycleco.com/';
  function read(k){try{return localStorage.getItem(k);}catch(e){return null;}}
  function save(k,v){try{localStorage.setItem(k,v);}catch(e){}}
  function clean(v){return (Array.isArray(v)?v:String(v||'').split('-')).filter(function(n){return /^\d+$/.test(String(n));}).map(Number).filter(function(n,i,a){return Number.isInteger(n)&&n>=0&&n<foods.length&&a.indexOf(n)===i;}).slice(0,3);}
  function track(name,extra){try{if(window.bcTrack)window.bcTrack(name,Object.assign({channel:channel,format:format,share_mode:mode},extra||{}));}catch(e){}}
  function use(method){try{if(onUse)onUse(method);}catch(e){}}
  function message(s){var el=document.getElementById('snsMessage');if(el)el.textContent=s;}
  function shareLink(ch){
    var url=new URL('yorimichi-share/'+(mode==='announce'?'announce':picks.length&&mode==='wish'?slugs[picks[0]]:'index')+'.html',root);
    url.searchParams.set('src','share_'+ch);
    if(picks.length&&mode==='wish')url.searchParams.set('w',picks.join('-'));
    if(mode==='event'||mode==='results'||mode==='announce')url.searchParams.set('m',mode);
    var no=read('minakusa_no');if(no&&/^\d{1,4}$/.test(no))url.searchParams.set('r','m'+('00'+no).slice(-3));
    return url.href;
  }
  function periodText(){return announcement.date ? announcement.date+'、'+announcement.place+'で。' : '開催日は調整中。';}
  function loadFoodArt(){
    if(artStarted)return;artStarted=true;
    ['food-osozai-v1.webp','food-bread-v1.webp','food-oyatsu-v1.webp'].forEach(function(file){
      var img=new Image();foodArt.push(img);
      img.onload=function(){if(dialog&&dialog.open&&mode==='announce')renderCard();};
      img.src=new URL('images/minakusa/yorimichi/'+file,root).href;
    });
  }
  function postText(){
    var text;
    if(mode==='announce'&&announcement.date){
      text='南草津駅の未来を、みんなで変える。\nこの3週間の主役は、ここを使うみんなです。\n'+announcement.date+'／'+announcement.place+'。入場無料。\n一票を入れる。駅前に寄る。お店で買う。\nあなたの行動が、これからの駅前をつくる力に。\n食べたいものの投票も受付中。\n'+announcement.note;
    }else if(mode==='results'&&data.results&&data.results.total>=30){
      text='南草津駅の帰り道、何が買えたらうれしい？\n'+data.results.asof+'時点・有効回答'+data.results.total+'件の途中経過です。\n'+data.results.top.slice(0,3).map(function(t,i){return(i+1)+'. '+t[0]+'（'+t[1]+'人が選択）';}).join('\n')+'\nあなたの食べたいものも、教えてください。';
    }else if(mode==='event'&&data.nextEvent){
      var e=data.nextEvent;text='南草津駅に、おいしい寄り道を。\n'+(e.round||'次回')+' '+e.date+' '+e.time+'\n'+e.place+(e.shops?'／'+e.shops+'店が出店':'')+'\n'+(data.shops||[]).slice(0,3).map(function(s){return '・'+s.item+(s.price?' '+s.price:'')+(s.status==='出店予定'?'':'（検討中）');}).join('\n')+'\n帰り道に、よりみちしませんか。';
    }else{
      text=picks.length?'南草津駅で、私は「'+picks.map(function(n){return foods[n][1];}).join('」「')+'」が買えたらうれしい。\nあなたは何派？':'南草津駅の帰り道、何が買えたらうれしい？';
      text+='\n名前・メール不要で、食べたいものを3つまで選べます。\n'+periodText()+'\n各日の出店・時間・商品は、決まりしだいお知らせ。';
    }
    return text+'\n#南草津駅前よりみち #南草津';
  }
  function syncLinks(){
    var full=postText()+'\n'+shareLink(channel==='native'?'copy':channel);
    document.getElementById('snsText').value=full;
    document.getElementById('snsLine').href='https://line.me/R/share?text='+encodeURIComponent(postText()+'\n'+shareLink('line'));
    document.getElementById('snsThreads').href='https://www.threads.com/intent/post?text='+encodeURIComponent(postText()+'\n'+shareLink('threads'));
    var xt=mode==='announce'&&announcement.date?'南草津駅の未来を、みんなで変える。\n変えるのは、みんなです。\n'+announcement.date+'\n'+announcement.place+'。入場無料。\n各日の出店・時間・お店は順次公開。':mode==='event'&&data.nextEvent?'南草津駅前、よりみち。\n'+data.nextEvent.date+' '+data.nextEvent.time+'\n'+data.nextEvent.place:mode==='results'&&data.results?'南草津駅で何が買えたらうれしい？\n有効回答'+data.results.total+'件の途中経過。あなたの食べたいものも教えてください。':picks.length?'南草津駅で「'+shortNames[picks[0]]+'」が買えたらうれしい。あなたは何派？\n名前・メール不要の投票受付中。'+periodText():'南草津駅で、何が買えたらうれしい？ 名前・メール不要の投票受付中。'+periodText();
    document.getElementById('snsX').href='https://twitter.com/intent/tweet?text='+encodeURIComponent(xt)+'&url='+encodeURIComponent(shareLink('x'));
    ['snsThreads','snsX'].forEach(function(id){document.getElementById(id).hidden={snsThreads:'threads',snsX:'x'}[id]!==channel;});
    document.getElementById('snsFoodOptions').hidden=mode!=='wish';
    document.getElementById('snsInstagramHelp').hidden=channel!=='instagram';
    document.getElementById('snsDirectLinks').hidden=!(channel==='threads'||channel==='x');
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
    star(c,950,500,72,'#DC492E');
    c.fillStyle='#173C51';c.font='900 37px "Noto Sans JP", sans-serif';c.fillText('南草津駅前、よりみち。',72,format==='story'?230:110);
    var top=format==='story'?365:225;
    c.font='900 68px "Noto Sans JP", sans-serif';
    if(mode==='results'&&data.results){c.fillText('みんなの食べたいもの。',72,top);c.font='700 32px "Noto Sans JP", sans-serif';c.fillText(data.results.asof+'時点／有効回答'+data.results.total+'件',72,top+70);}
    else if(mode==='event'&&data.nextEvent){c.fillText('次の、よりみち。',72,top);c.font='700 34px "Noto Sans JP", sans-serif';c.fillText('南草津駅前で、待っています。',72,top+70);}
    else if(mode==='announce'){c.fillText('南草津駅の未来を、',72,top);c.fillText('みんなで変える。',72,top+100);}
    else{c.fillText('南草津駅で、',72,top);c.fillText(picks.length?'私はこれが食べたい。':'何が買えたらうれしい？',72,top+100);}
    var rows=mode==='results'&&data.results?data.results.top.slice(0,3).map(function(t,i){return{emoji:String(i+1),text:t[0],sub:t[1]+'人が選択'};}):mode==='event'&&data.nextEvent?[{emoji:'日',text:data.nextEvent.date,sub:data.nextEvent.time},{emoji:'場',text:data.nextEvent.place,sub:data.nextEvent.shops?data.nextEvent.shops+'店が出店':''}]:mode==='announce'?[]:picks.map(function(n){return{emoji:foods[n][0],text:foods[n][1],sub:''};});
    var y=top+175,rowHeight=format==='story'?205:165;
    if(mode==='announce'){
      var ay=top+190,artY=ay+135,artH=format==='story'?330:230;
      c.fillStyle='#173C51';c.font='900 52px \"Noto Sans JP\", sans-serif';c.fillText(announcement.shortDate||announcement.date,72,ay);
      c.font='700 30px \"Noto Sans JP\", sans-serif';c.fillText(announcement.place,72,ay+65);
      ['おかずも。','パンも。','おやつも。'].forEach(function(label,i){
        var ax=72+i*320,img=foodArt[i];
        c.save();c.beginPath();c.roundRect(ax,artY,296,artH,24);c.clip();c.fillStyle='#F2EADD';c.fillRect(ax,artY,296,artH);
        if(img&&img.complete&&img.naturalWidth){var scale=Math.max(296/img.naturalWidth,artH/img.naturalHeight),dw=img.naturalWidth*scale,dh=img.naturalHeight*scale;c.drawImage(img,ax+(296-dw)/2,artY+(artH-dh)/2,dw,dh);}
        c.restore();c.fillStyle='#173C51';c.font='900 29px \"Noto Sans JP\", sans-serif';c.fillText(label,ax+20,artY+artH+48);
      });
      c.font='700 34px \"Noto Sans JP\", sans-serif';c.fillText('この3週間の主役は、みんなです。',72,artY+artH+125);
    }
    if(!rows.length&&mode!=='announce'){
      // まだ選んでいない人のカード：10の候補を並べて「あなたなら、どれ？」と問いかける（空白を作らない）
      var gEnd=H-(format==='story'?495:370),cellH=Math.floor((gEnd-y)/5),cellW=456,fs=format==='story'?30:25;
      foods.forEach(function(f,n){
        var gx=72+(n%2)*(cellW+16),gy=y+Math.floor(n/2)*cellH;
        c.fillStyle='#FFFFFF';c.beginPath();c.roundRect(gx,gy,cellW,cellH-14,18);c.fill();
        c.strokeStyle='#173C51';c.lineWidth=2;c.stroke();
        c.font=(format==='story'?50:40)+'px "Noto Color Emoji", "Apple Color Emoji", sans-serif';c.fillText(f[0],gx+20,gy+(cellH-14)/2+(format==='story'?18:14));
        c.fillStyle='#173C51';c.font='900 '+fs+'px "Noto Sans JP", sans-serif';
        var lines=Math.ceil(c.measureText(f[1]).width/(cellW-(format==='story'?110:95)))>1?2:1;
        textLines(c,f[1],gx+(format==='story'?95:80),gy+(cellH-14)/2+fs*.35-(lines-1)*fs*.62,cellW-(format==='story'?110:95),fs*1.25,2);
      });
    }
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
    pill(c,mode==='announce'?'あなたの寄り道が、駅前を変える。':mode==='event'?'帰り道に、よりみちしよう。':'あなたの食べたいものは？',72,foot,936,90,'#FFD35B','#173C51',39);
    c.fillStyle='#173C51';c.font='700 30px "Noto Sans JP", sans-serif';
    c.fillText(mode==='announce'?'お店と最新の予定は、リンクから。':mode==='event'?'くわしくは、リンクから。':'名前・メール不要／3つまで選んで投票',72,foot+150);
    c.font='500 24px "Noto Sans JP", sans-serif';
    textLines(c,mode==='announce'?announcement.note:mode==='event'?'日時・場所の最新情報は案内ページをご確認ください。':announcement.date?announcement.date+'。各日の出店・時間・商品は順次お知らせ。':'開催日は調整中。食べたいもののリクエストです。',72,foot+200,920,36,2);
    if(mode==='announce'){c.font='500 22px "Noto Sans JP", sans-serif';c.fillText('イラストはイメージ。販売する商品・価格は未定です。',72,foot+236);}
    if(format==='story'){pill(c,'↓ ここにリンクスタンプを ↓',202,H-140,676,54,'#EAE7DD','#536775',25);}
    c.font='500 21px "Noto Sans JP", sans-serif';c.fillStyle='#536775';c.fillText('南草津駅周辺まちづくりの社会実験',72,H-(format==='story'?190:42));
    var alt='南草津駅前、よりみち。'+rows.map(function(r){return r.text+(r.sub?' '+r.sub:'');}).join('、')+'。'+(mode==='announce'?announcement.date+'。'+announcement.place+'。'+announcement.note:mode==='event'?'開催案内':'食べたいもの投票。'+periodText());
    canvas.setAttribute('aria-label',alt);
    canvas.toBlob(function(b){if(ticket!==revision)return;busy=false;if(!b){message('画像を作れませんでした。投稿文とリンクはコピーできます。');return;}blob=b;if(imageUrl)URL.revokeObjectURL(imageUrl);imageUrl=URL.createObjectURL(b);document.getElementById('snsDownload').disabled=false;document.getElementById('snsNative').disabled=false;},'image/png');
  }
  function syncVote(){
    var box=document.getElementById('snsVote'),fine=document.getElementById('snsFine');if(!box)return;
    var can=!!voteFn&&mode==='wish'&&!read('minakusa_voted');
    box.hidden=!(can&&picks.length);
    fine.textContent=read('minakusa_voted')?'ここで選ぶと画像が変わります（投票はもう届いています）。':can&&!picks.length?'ここで選ぶと画像が変わります。選んだ3つは、そのまま1票にもできます。':'ここで選ぶと画像が変わります。';
    var b=document.getElementById('snsVoteBtn');if(b&&!voting)b.textContent='この'+picks.length+'つで、1票も入れる';
  }
  function refresh(){syncLinks();syncVote();renderCard();}
  function choose(n,input){if(input.checked){if(picks.length>=3){input.checked=false;return;}picks.push(n);}else picks=picks.filter(function(x){return x!==n;});document.querySelectorAll('#snsFoodOptions input').forEach(function(el){el.disabled=!el.checked&&picks.length>=3;});refresh();}
  function prepare(){
    dialog=document.createElement('dialog');dialog.id='snsDialog';dialog.className='sns-dialog';dialog.setAttribute('aria-labelledby','snsTitle');
    dialog.innerHTML='<div class="sns-shell"><button type="button" class="sns-close" id="snsClose" aria-label="共有画面を閉じる">×</button><div class="sns-preview"><canvas id="snsCanvas" role="img"></canvas></div><div class="sns-controls"><p class="sns-eyebrow">私のカードで、友だちを誘う</p><h2 id="snsTitle">私はこれ派。あなたは？</h2><p class="sns-intro">カードとリンクを、そのまま友だちに送れます。</p><fieldset id="snsFoodOptions"><legend>カードに載せたいもの <small>3つまで</small></legend><div class="sns-foods"></div><p class="sns-fine" id="snsFine">ここで選ぶと画像が変わります。</p><div class="sns-vote" id="snsVote" hidden><button type="button" class="btn btn-bulb" id="snsVoteBtn">この3つで、1票も入れる</button><span>名前・メール不要。選んだものが、そのまま投票になります。</span></div></fieldset><div class="sns-main"><button type="button" class="btn btn-bulb sns-primary" id="snsNative">共有する</button><a class="btn sns-line-main" id="snsLine" target="_blank" rel="noopener noreferrer">LINEで友だちに送る</a></div><p id="snsMessage" class="sns-message" role="status" aria-live="polite"></p><details class="sns-more" id="snsMore"><summary>ほかの方法（画像の保存・サイズ・文章のコピー）</summary><fieldset class="sns-channel"><legend>投稿するSNSに合わせる</legend><label><input type="radio" name="snsChannel" value="instagram">Instagram</label><label><input type="radio" name="snsChannel" value="threads">Threads</label><label><input type="radio" name="snsChannel" value="x">X</label></fieldset><div class="sns-format"><label for="snsFormat">画像サイズ</label><select id="snsFormat"><option value="feed">投稿・トーク（4:5）</option><option value="story">ストーリーズ（9:16）</option></select></div><div class="sns-actions"><button type="button" class="btn btn-line" id="snsDownload">画像を保存</button></div><p id="snsInstagramHelp" class="sns-help" hidden>Instagramは、画像を保存して投稿へ。ストーリーズには「リンクをコピー」で取得したURLをリンクスタンプに貼ってください。</p><div id="snsDirectLinks" class="sns-links" hidden><a id="snsThreads" target="_blank" rel="noopener noreferrer">Threadsで投稿文を開く ↗</a><a id="snsX" target="_blank" rel="noopener noreferrer">Xで投稿文を開く ↗</a></div><label class="sns-text-label" for="snsText">投稿文とリンク</label><textarea id="snsText" rows="6" readonly></textarea><div class="sns-copy"><button type="button" class="btn btn-line btn-sm" id="snsCopyText">投稿文をコピー</button><button type="button" class="btn btn-line btn-sm" id="snsCopyLink">リンクをコピー</button></div></details><p class="sns-fine">送る前に、LINEやSNSの画面で内容を確認できます。</p></div></div';
    document.body.appendChild(dialog);canvas=document.getElementById('snsCanvas');
    var options=dialog.querySelector('.sns-foods');foods.forEach(function(f,n){var l=document.createElement('label'),i=document.createElement('input'),s=document.createElement('span');i.type='checkbox';i.value=n;i.addEventListener('change',function(){choose(n,i);});s.textContent=f[0]+' '+f[1];l.append(i,s);options.appendChild(l);});
    document.getElementById('snsClose').addEventListener('click',function(){dialog.close();});
    document.getElementById('snsVoteBtn').addEventListener('click',function(){
      if(voting||!voteFn||!picks.length)return;var b=this;voting=true;b.disabled=true;b.textContent='送信しています…';
      Promise.resolve(voteFn(picks.slice())).then(function(){voting=false;b.disabled=false;save('minakusa_share_picks',picks.join('-'));message('1票、届きました。このまま「共有する」か「LINEで友だちに送る」で、友だちを誘えます。');track('yorimichi_share_vote');syncVote();})
      .catch(function(){voting=false;b.disabled=false;message('送信できませんでした。通信の状態を確かめて、もう一度押してください。');syncVote();});
    });
    dialog.addEventListener('click',function(e){if(e.target===dialog)dialog.close();});
    dialog.addEventListener('close',function(){document.body.classList.remove('sns-open');if(returnFocus&&returnFocus.isConnected)returnFocus.focus();});
    dialog.querySelectorAll('input[name=snsChannel]').forEach(function(i){i.addEventListener('change',function(){channel=i.value;format=channel==='instagram'?'story':'feed';document.getElementById('snsFormat').value=format;refresh();});});
    document.getElementById('snsFormat').addEventListener('change',function(){format=this.value;renderCard();});
    function copy(value,label){if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(value).then(function(){message(label+'をコピーしました。');track('yorimichi_share_copy',{copy_kind:label==='リンク'?'link':'text'});}).catch(function(){message('下の投稿文を選択してコピーしてください。');document.getElementById('snsText').focus();document.getElementById('snsText').select();});}else{message('下の投稿文を選択してコピーしてください。');document.getElementById('snsText').focus();document.getElementById('snsText').select();}}
    document.getElementById('snsCopyText').addEventListener('click',function(){copy(postText()+'\n'+shareLink(channel==='native'?'copy':channel),'投稿文');use('copy');});
    document.getElementById('snsCopyLink').addEventListener('click',function(){copy(shareLink(channel==='native'?'copy':channel),'リンク');use('copy');});
    document.getElementById('snsDownload').addEventListener('click',function(){if(!imageUrl)return;var a=document.createElement('a');a.href=imageUrl;a.download='minakusa-yorimichi-'+format+'.png';document.body.appendChild(a);a.click();a.remove();message('画像を保存しました。投稿文とリンクもコピーできます。');track('yorimichi_share_image');use('save');});
    document.getElementById('snsNative').addEventListener('click',function(){
      if(busy||!blob)return;var file=new File([blob],'minakusa-yorimichi.png',{type:'image/png'});
      var fail=function(e){if(e&&e.name==='AbortError')message('共有をキャンセルしました。');else{message('この端末では共有を開けませんでした。「LINEで友だちに送る」か、下の「ほかの方法」から画像を保存してください。');document.getElementById('snsMore').open=true;}};
      if(navigator.canShare&&navigator.canShare({files:[file]})&&navigator.share){navigator.share({files:[file],title:'南草津駅前、よりみち。',text:postText(),url:shareLink('native')}).then(function(){message('共有先にカードを渡しました。送る前に内容を確かめてください。');track('yorimichi_share_handoff',{method:'native'});use('native');}).catch(fail);}
      else if(navigator.share){navigator.share({title:'南草津駅前、よりみち。',text:postText(),url:shareLink('native')}).then(function(){message('共有先にリンクを渡しました。');track('yorimichi_share_handoff',{method:'native_link'});use('native');}).catch(fail);}
      else fail();
    });
    ['snsLine','snsThreads','snsX'].forEach(function(id){document.getElementById(id).addEventListener('click',function(){var ch={snsLine:'line',snsThreads:'threads',snsX:'x'}[id];track('yorimichi_share_intent',{channel:ch,method:ch});use(ch);});});
  }
  function open(nextMode){
    if(!dialog)prepare();mode=nextMode||'wish';if(mode==='results'&&!(data.results&&data.results.total>=30))mode='wish';if(mode==='event'&&!data.nextEvent)mode='wish';if(mode==='announce'&&!announcement.date)mode='wish';if(mode==='announce')loadFoodArt();
    returnFocus=document.activeElement;var more=document.getElementById('snsMore');if(more&&!dialog.open)more.open=false;document.getElementById('snsTitle').textContent=mode==='announce'?'あの人に、よりみちのおさそい。':mode==='results'?'投票の途中経過を、届けよう。':mode==='event'?'次のよりみちを、知らせよう。':'私はこれ派。あなたは？';
    dialog.querySelectorAll('#snsFoodOptions input').forEach(function(i){i.checked=picks.indexOf(Number(i.value))>=0;i.disabled=!i.checked&&picks.length>=3;});
    if(!dialog.open){dialog.showModal();document.body.classList.add('sns-open');}
    message('');syncLinks();syncVote();document.getElementById('snsClose').focus();
    Promise.resolve(document.fonts?document.fonts.ready:null).then(renderCard);track('yorimichi_share_open');
  }
  function init(config){
    foods=config.foods;page=config.page;announcement=config.announcement||{};voteFn=typeof config.vote==='function'?config.vote:null;onUse=typeof config.onUse==='function'?config.onUse:null;picks=clean(read('minakusa_share_picks')||'');
    if(!picks.length&&read('minakusa_voted')){picks=clean(String(read('minakusa_vote_food')||'').split('／').map(function(label){return foods.findIndex(function(f){return f[1]===label;});}));}
    var q=new URLSearchParams(location.search),incoming=clean(q.get('w')||'');
    if(incoming.length&&/^share_(instagram|line|threads|x|native|copy)$/.test(q.get('src')||'')){
      var invite=document.getElementById('snsInvite');if(invite){invite.hidden=false;invite.querySelector('strong').textContent='「'+incoming.map(function(n){return shortNames[n];}).join('・')+'」派からの、おさそい。';}
      window.addEventListener('load',function(){track('yorimichi_share_landing',{channel:(q.get('src')||'').slice(6)});},{once:true});
    }
    document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-share]');if(b){e.preventDefault();open(b.getAttribute('data-share-mode')||'wish');}});
    var oldLine=document.getElementById('lineShare');if(oldLine){oldLine.href='https://social-plugins.line.me/lineit/share?url='+encodeURIComponent(shareLink('line'));oldLine.addEventListener('click',function(){track('yorimichi_share_intent',{channel:'line'});});}
  }
  function voteDone(indices){picks=clean(indices);save('minakusa_share_picks',picks.join('-'));}
  function update(d){data=d||{};if(dialog&&dialog.open)refresh();var rs=document.querySelector('[data-share-mode="results"]'),ev=document.querySelector('[data-share-mode="event"]');if(rs)rs.disabled=!(data.results&&data.results.total>=30);if(ev)ev.disabled=!data.nextEvent;}
  window.YorimichiSocial={init:init,open:open,voteDone:voteDone,update:update};
})();

