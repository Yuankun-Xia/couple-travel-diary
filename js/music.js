import {decryptEnvelope} from './crypto.js';
import {fetchCipher} from './photo-loader.js?v=20261030-2';

export function randomTrackIndex(length,previous=-1,random=Math.random){
 if(length<1)return -1;if(length===1)return 0;
 if(previous<0||previous>=length)return Math.floor(random()*length);
 const pick=Math.floor(random()*(length-1));return pick>=previous?pick+1:pick;
}
function silentWave(){
 const bytes=new ArrayBuffer(1644),v=new DataView(bytes),write=(offset,text)=>[...text].forEach((c,i)=>v.setUint8(offset+i,c.charCodeAt(0)));
 write(0,'RIFF');v.setUint32(4,1636,true);write(8,'WAVE');write(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,8000,true);v.setUint32(28,16000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);write(36,'data');v.setUint32(40,1600,true);return new Blob([bytes],{type:'audio/wav'});
}
export function mountMusic({tracks,key}){
 const hero=document.getElementById('soundToggle'),heroLabel=document.getElementById('soundLabel');
 if(!hero||!heroLabel)return {dispose(){}};
 if(!Array.isArray(tracks)||!tracks.length){hero.hidden=true;return {dispose(){}};}
 if(tracks.some(t=>! /^[a-f0-9]{32}\.bin$/.test(t.file)||t.mime!=='audio/mp4'||typeof t.title!=='string'||typeof t.artist!=='string'))throw Error('invalid-music');
 const panel=document.createElement('section');panel.className='music-player';panel.id='musicPlayer';panel.hidden=true;panel.setAttribute('aria-label','背景音乐');
 panel.innerHTML='<button type="button" class="music-control music-toggle" aria-label="暂停音乐" aria-pressed="false"><span aria-hidden="true">Ⅱ</span></button><div class="music-info"><span class="music-title"></span><small class="music-detail" role="status" aria-live="polite"></small></div><button type="button" class="music-control music-next" aria-label="随机下一首" title="随机下一首"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m5 5 10 7-10 7V5Zm14 0v14"/></svg></button>';
 document.body.append(panel);const button=panel.querySelector('.music-toggle'),next=panel.querySelector('.music-next'),title=panel.querySelector('.music-title'),detail=panel.querySelector('.music-detail');
 const audio=document.createElement('audio');audio.id='diaryAudio';audio.preload='none';audio.volume=.32;audio.setAttribute('playsinline','');document.body.append(audio);
 let current=-1,wanted=false,loading=false,ready=false,disposed=false,serial=0,currentUrl=null,silenceUrl=null,primed=false,lastError=false;
 const revoke=()=>{if(currentUrl){URL.revokeObjectURL(currentUrl);currentUrl=null;}};
 function paint(message){
  hero.setAttribute('aria-pressed',String(wanted));hero.setAttribute('aria-busy',String(loading));hero.setAttribute('aria-label',wanted?'暂停音乐':'播放音乐');heroLabel.textContent=loading&&wanted?'正在加载音乐…':wanted?'暂停音乐':current<0?'随机听一首':'继续播放音乐';
  button.setAttribute('aria-pressed',String(wanted));button.setAttribute('aria-label',wanted?'暂停音乐':lastError?'重试音乐':'播放音乐');button.firstElementChild.textContent=wanted?'Ⅱ':'▶';next.disabled=loading||tracks.length<2;
  title.textContent=current<0?'我们的随机歌单':tracks[current].title;detail.textContent=message||(loading&&wanted?'正在翻出这首歌…':wanted?tracks[current].artist+' · 随机播放':'已暂停 · 点播放继续');
 }
 function prime(){if(primed||ready)return;primed=true;silenceUrl=URL.createObjectURL(silentWave());audio.src=silenceUrl;audio.play().catch(()=>{});}
 async function playReady(){const attempt=serial;try{await audio.play();if(disposed||attempt!==serial)return;if(!wanted){audio.pause();return;}lastError=false;paint();}catch(error){if(disposed||attempt!==serial||!wanted)return;wanted=false;lastError=error.name!=='NotAllowedError';paint(error.name==='NotAllowedError'?'已准备好，点播放开始聆听':'暂时无法播放，点播放重试');}}
 async function loadTrack(index){
  const attempt=++serial;current=index;loading=true;ready=false;lastError=false;panel.hidden=false;if(currentUrl||!silenceUrl){audio.pause();audio.removeAttribute('src');audio.load();}revoke();paint();
  try{const track=tracks[index],bytes=await fetchCipher(new URL('../data/'+track.file,import.meta.url),{timeout:30000,attempts:2}),raw=await decryptEnvelope(bytes,key,'audio:'+track.file);if(disposed||attempt!==serial)return;
   currentUrl=URL.createObjectURL(new Blob([raw],{type:track.mime}));audio.src=currentUrl;ready=true;loading=false;if(silenceUrl){URL.revokeObjectURL(silenceUrl);silenceUrl=null;}
   if(wanted)await playReady();else paint();
  }catch(error){if(disposed||attempt!==serial)return;loading=false;ready=false;wanted=false;lastError=true;paint('音乐暂未加载，点播放重试');}
 }
 function toggle(){
  if(disposed)return;if(wanted){wanted=false;audio.pause();paint();return;}wanted=true;panel.hidden=false;prime();
  if(loading){paint();return;}if(ready){paint();playReady();return;}loadTrack(current<0?randomTrackIndex(tracks.length):current);
 }
 function advance(){if(disposed||loading)return;wanted=true;prime();loadTrack(randomTrackIndex(tracks.length,current));}
 hero.addEventListener('click',toggle);button.addEventListener('click',toggle);next.addEventListener('click',advance);
 audio.addEventListener('ended',()=>{if(!disposed&&ready&&wanted&&audio.ended)advance();});
 audio.addEventListener('error',()=>{if(!disposed&&ready&&!loading&&audio.error){wanted=false;lastError=true;ready=false;paint('这首暂时无法播放，可重试或切下一首');}});
 audio.addEventListener('playing',()=>{if(!disposed&&ready&&wanted)paint();});
 const onPageHide=()=>{wanted=false;audio.pause();if(!disposed)paint();};window.addEventListener('pagehide',onPageHide);paint();
 return {dispose(){disposed=true;serial++;wanted=false;audio.pause();audio.removeAttribute('src');audio.load();revoke();if(silenceUrl)URL.revokeObjectURL(silenceUrl);hero.removeEventListener('click',toggle);window.removeEventListener('pagehide',onPageHide);audio.remove();panel.remove();}};
}
