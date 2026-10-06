/* BRIDGE CYCLE 試算の埋め込み
 * 使い方：<div data-bc-shisan data-ref="あなたの紹介コード" data-type="food"></div>
 *         <script src="https://www.bridgecycleco.com/embed.js" async></script>
 * data-type：food（居酒屋・ラーメン）/ cafe / beauty / clinic / retail（省略可）
 * 入力された数字は、埋め込み先にもBRIDGE CYCLEにも送られません。
 */
(function(){
  var B='https://www.bridgecycleco.com/shisan.html';
  function clean(v,n){return (v||'').replace(/[^A-Za-z0-9_-]/g,'').slice(0,n||20);}
  function mount(el){
    if(el.getAttribute('data-bc-done'))return; el.setAttribute('data-bc-done','1');
    var p='embed=1', ref=clean(el.getAttribute('data-ref')).toUpperCase(), t=clean(el.getAttribute('data-type'),10).toLowerCase();
    if(ref)p+='&ref='+ref; if(t)p+='&type='+t;
    var f=document.createElement('iframe');
    f.src=B+'?'+p; f.title='閉店の費用30秒チェック（BRIDGE CYCLE）'; f.loading='lazy';
    f.setAttribute('style','border:0;width:100%;max-width:560px;height:640px;display:block;margin:0 auto');
    el.appendChild(f);
    if(!el.querySelector('.bc-pr')){var n=document.createElement('p');n.className='bc-pr';n.setAttribute('style','font-size:11px;text-align:center;margin:4px 0 0;color:#666');n.textContent=ref?'PR｜BRIDGE CYCLEの試算ツールを紹介しています':'BRIDGE CYCLEの試算ツール';el.appendChild(n);}
  }
  function all(){var l=document.querySelectorAll('[data-bc-shisan]');for(var i=0;i<l.length;i++)mount(l[i]);}
  window.addEventListener('message',function(e){
    if(e.origin!=='https://www.bridgecycleco.com'||!e.data||!e.data.bcShisan)return;
    var fs=document.querySelectorAll('iframe[src^="'+B+'"]');
    for(var i=0;i<fs.length;i++){if(fs[i].contentWindow===e.source){fs[i].style.height=Math.min(Math.max(+e.data.h||0,300),1400)+'px';}}
  });
  window.bcShisanMount=all;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',all);else all();
})();
