import {startJournal} from './journal.js?v=20261030-1';
import {readManifest} from './manifest.js?v=20261030-1';
import {installPhotoLoader} from './photo-loader.js';
const status=document.querySelector('#gateStatus'),retry=document.querySelector('#gateRetry');
const storageName='mmz-key:'+location.pathname,params=new URLSearchParams(location.hash.slice(1));let encoded=params.get('k');
if(encoded!==null)history.replaceState(null,'',location.pathname+location.search);
try{if(encoded===null)encoded=sessionStorage.getItem(storageName);}catch{}
retry.addEventListener('click',()=>location.reload());
const decodeKey=text=>{if(!/^[A-Za-z0-9_-]{43}$/.test(text||''))throw Error('invalid-key');return Uint8Array.from(atob(text.replace(/-/g,'+').replace(/_/g,'/')+'='),c=>c.charCodeAt(0));};
async function unlock(){
 if(!encoded)return;if(!crypto.subtle){status.textContent='请通过 HTTPS 或本机预览地址打开手帖。';return;}
 status.textContent='正在轻轻翻开我们的回忆……';let key,payload;
 try{key=await crypto.subtle.importKey('raw',decodeKey(encoded),'AES-GCM',false,['decrypt']);try{sessionStorage.setItem(storageName,encoded);}catch{}payload=await readManifest(key);if(payload.version!==1||!Array.isArray(payload.seed?.trips)||typeof payload.layout!=='string')throw Error('invalid-data');}
 catch(error){if(error.name==='OperationError'||error.message==='invalid-key')try{sessionStorage.removeItem(storageName);}catch{}encoded=null;status.textContent='暂时无法翻开手帖。请检查网络，或重新打开完整专属链接。';retry.hidden=false;return;}
 encoded=null;const template=document.createElement('template');template.innerHTML=payload.layout;if(template.content.querySelector('script,iframe,object,embed,form,base'))throw Error('unsafe-template');
 const assets={};for(const [name,d]of Object.entries(payload.assets)){if(!/^[a-f0-9]{32}\.bin$/.test(d.file)||!/^image\/(jpeg|png|webp|gif)$/.test(d.mime))throw Error('unsafe-image');assets[name]='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="12"><rect width="16" height="12" fill="#dfddcf"/></svg>')+'#mmz='+d.file;}
 document.body.replaceChildren(template.content);const loader=installPhotoLoader({descriptors:payload.assets,key});
 document.querySelector('#lockDiary').addEventListener('click',()=>{try{sessionStorage.removeItem(storageName);}catch{}loader.dispose();location.replace(location.pathname);});
 await startJournal({assets,seed:payload.seed,chinaMapData:payload.chinaMapData});
}
unlock().catch(()=>{const panel=document.createElement('div');panel.className='photo-load-notice';panel.innerHTML='<span>手帖暂未完整打开</span><button type="button">重新打开</button>';panel.querySelector('button').addEventListener('click',()=>location.reload());document.body.append(panel);});
