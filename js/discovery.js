export const themes=[{id:'food',label:'美食',note:'一起吃过的好滋味',mark:'01'},{id:'together',label:'合照',note:'镜头里，刚好有我们',mark:'02'},{id:'scenery',label:'美景建筑',note:'走过的风景与街巷',mark:'03'},{id:'daily',label:'旅途日常',note:'那些平凡又可爱的瞬间',mark:'04'}];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function collectPhotos(trips){return trips.flatMap(trip=>trip.photos.map((photo,index)=>({trip,photo,index,city:trip.city||trip.place.split('·')[0].trim()})));}
function spreadCities(records){const cities=new Map();for(const r of records){if(!cities.has(r.city))cities.set(r.city,[]);cities.get(r.city).push(r);}const result=[];while(result.length<records.length)for(const list of cities.values())if(list.length)result.push(list.shift());return result;}
export function shuffle(items,random=Math.random){const list=[...items];for(let i=list.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[list[i],list[j]]=[list[j],list[i]];}return list;}
export function makeQuiz(records,quizAssets,random=Math.random){
 const allowed=new Set(quizAssets||[]),candidates=records.filter(r=>allowed.has(r.photo.asset)),cities=[...new Set(records.map(r=>r.city))];
 if(cities.length<2||!candidates.length)return [];
 const groups=new Map();for(const r of candidates){if(!groups.has(r.city))groups.set(r.city,[]);groups.get(r.city).push(r);}
 return shuffle([...groups.keys()],random).slice(0,5).map(city=>{const pool=groups.get(city),record=pool[Math.floor(random()*pool.length)];return {record,options:shuffle([city,...shuffle(cities.filter(c=>c!==city),random).slice(0,3)],random)};});
}
export function mountDiscovery({trips,quizAssets,photoThumb,photoSrc,openPhoto,openTrip}){
 const $=id=>document.getElementById(id),records=collectPhotos(trips);let theme='food',limit=18,shown=[];
 function renderMoments(){
  shown=spreadCities(records.filter(r=>(r.photo.themes||['daily']).includes(theme)));
  $('momentFilters').innerHTML=themes.map(t=>'<button class="moment-filter" data-moment-theme="'+t.id+'" aria-pressed="'+(theme===t.id)+'"><span>'+t.mark+'</span><strong>'+t.label+'</strong><small>'+records.filter(r=>(r.photo.themes||['daily']).includes(t.id)).length+' 帧</small></button>').join('');
  $('momentSummary').textContent=themes.find(t=>t.id===theme).note+' · '+shown.length+' 帧回忆';
  const visible=shown.slice(0,limit);
  $('momentGrid').innerHTML=visible.map((r,i)=>'<button class="moment-photo" data-moment-photo="'+i+'" aria-label="放大'+esc(r.city)+'的照片"><span class="moment-photo-frame"><img src="'+photoThumb(r.photo)+'" alt="'+esc(r.photo.caption||r.city+'的旅途瞬间')+'" loading="lazy" decoding="async" width="380" height="380"></span><span class="moment-photo-note"><strong>'+esc(r.city)+'</strong><small>第 '+String(r.index+1).padStart(2,'0')+' 帧 <span aria-hidden="true">↗</span></small></span></button>').join('')||'<p>这一页，留给下一次收藏。</p>';
  $('moreMoments').hidden=limit>=shown.length;$('moreMoments').textContent='再翻 '+Math.min(18,shown.length-limit)+' 张 ↗';
 }
 $('momentFilters').addEventListener('click',e=>{const button=e.target.closest('[data-moment-theme]');if(!button)return;theme=button.dataset.momentTheme;limit=18;renderMoments();});
 $('moreMoments').addEventListener('click',()=>{const first=limit;limit+=18;renderMoments();$('momentGrid').children[first]?.focus({preventScroll:true});});
 $('momentGrid').addEventListener('click',e=>{const b=e.target.closest('[data-moment-photo]'),r=b&&shown[Number(b.dataset.momentPhoto)];if(r)openPhoto(r.trip,r.index);});
 renderMoments();let rounds=[],round=0,score=0,answered=false;
 function showRound(){
  answered=false;const q=rounds[round],cityLabel='回忆中的一处风景';
  $('guessPlay').innerHTML='<div class="guess-round-head"><span>第 '+(round+1)+' / '+rounds.length+' 题</span><span>已猜对 '+score+' 题</span></div><div class="guess-image"><img src="'+photoThumb(q.record.photo)+'" alt="'+cityLabel+'" loading="eager" decoding="async"><span aria-hidden="true">WHERE WERE WE?</span></div><h3 class="guess-prompt" tabindex="-1">这张照片，是在哪座城市拍的？</h3><div class="guess-options" role="group" aria-label="选择城市">'+q.options.map((city,i)=>'<button data-guess-answer="'+i+'"><span>'+String.fromCharCode(65+i)+'</span>'+esc(city)+'</button>').join('')+'</div><div id="guessFeedback" class="guess-feedback" role="status"></div>';
  $('guessPlay').querySelector('.guess-prompt').focus({preventScroll:true});
 }
 function finish(){const line=score===rounds.length?'原来这些风景，我们都记得。':score>=3?'走过的路，总有熟悉的光。':'没关系，再一起重温一次。';$('guessPlay').innerHTML='<div class="guess-result"><p class="eyebrow">OUR MEMORY SCORE</p><div class="guess-score">'+score+'<span> / '+rounds.length+'</span></div><h3>'+line+'</h3><p>答案藏在旅行里，也藏在我们的相册里。</p><button class="discovery-button" data-guess-start>再猜一轮 ↻</button></div>';}
 $('guessPlay').addEventListener('click',e=>{
  if(e.target.closest('[data-guess-start]')){rounds=makeQuiz(records,quizAssets);round=0;score=0;if(!rounds.length){$('guessPlay').innerHTML='<p>再收藏几处风景，就能开始出题啦。</p>';return;}showRound();return;}
  if(e.target.closest('[data-guess-next]')){round++;if(round>=rounds.length)finish();else showRound();return;}
  if(e.target.closest('[data-guess-album]')){openTrip(rounds[round].record.trip.id);return;}
  const answer=e.target.closest('[data-guess-answer]');if(!answer||answered)return;answered=true;
  const q=rounds[round],correct=q.options[Number(answer.dataset.guessAnswer)]===q.record.city;if(correct)score++;
  for(const button of $('guessPlay').querySelectorAll('[data-guess-answer]')){const city=q.options[Number(button.dataset.guessAnswer)];button.disabled=true;button.classList.toggle('is-correct',city===q.record.city);button.classList.toggle('is-wrong',button===answer&&!correct);}
  const trip=q.record.trip,visits=trip.visits||[],date=trip.datePeriod?trip.datePeriod.startYear+'—'+trip.datePeriod.endYear+' 年的回忆':visits.map(v=>v.start.replaceAll('-','.')+(v.end!==v.start?'—'+v.end.replaceAll('-','.'):'')).join(' / ');
  $('guessFeedback').innerHTML='<strong>'+(correct?'猜对啦！':'这次的答案是')+' · '+esc(q.record.city)+'</strong>'+(date?'<p>'+esc(date)+'</p>':'')+'<div><button data-guess-album>翻回这本相册 ↗</button><button class="discovery-button" data-guess-next>'+(round===rounds.length-1?'看看成绩':'下一题')+' →</button></div>';
 });
}
