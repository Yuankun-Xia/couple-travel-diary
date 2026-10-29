import { startJournal } from './journal.js';
import { decryptEnvelope } from './crypto.js';

const status = document.querySelector('#gateStatus');
const retry = document.querySelector('#gateRetry');
const storageName = 'mmz-key:' + location.pathname;
const params = new URLSearchParams(location.hash.slice(1));
let encoded = params.get('k');
if (encoded !== null) history.replaceState(null, '', location.pathname + location.search);
try { if (encoded === null) encoded = sessionStorage.getItem(storageName); } catch { /* Private mode can disable storage. */ }
retry.addEventListener('click', () => location.reload());
const decodeKey = text => {
  if (!/^[A-Za-z0-9_-]{43}$/.test(text || '')) throw Error('invalid-key');
  return Uint8Array.from(atob(text.replace(/-/g,'+').replace(/_/g,'/')+'='),c=>c.charCodeAt(0));
};
async function readEncrypted(file) {
  const response=await fetch(new URL('../data/'+file,import.meta.url),{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});
  if(!response.ok)throw Error('network');return response.arrayBuffer();
}
async function unlock() {
  if(!encoded)return;
  if(!crypto.subtle){status.textContent='请通过 HTTPS 或本机预览地址打开手帖。';return;}
  status.textContent='正在轻轻翻开我们的回忆……';
  let payload,key;
  try {
    key=await crypto.subtle.importKey('raw',decodeKey(encoded),'AES-GCM',false,['decrypt']);
    payload=JSON.parse(new TextDecoder().decode(await decryptEnvelope(await readEncrypted('manifest.bin'),key,'manifest:v1')));
    if(payload.version!==1||!Array.isArray(payload.seed?.trips)||typeof payload.layout!=='string')throw Error('invalid-data');
  } catch {
    try {sessionStorage.removeItem(storageName);} catch {}
    encoded=null;status.textContent='暂时无法翻开手帖。请检查网络，或重新打开完整专属链接。';retry.hidden=false;return;
  }
  try {sessionStorage.setItem(storageName,encoded);} catch {}
  encoded=null;
  const template=document.createElement('template');template.innerHTML=payload.layout;
  if(template.content.querySelector('script,iframe,object,embed,form,base'))throw Error('unsafe-template');
  document.body.replaceChildren(template.content);
  const descriptors=payload.assets,assets={},pending=new Map(),loaded=new Map(),urls=new Set();
  for(const [name,d]of Object.entries(descriptors)) {
    if(!/^[a-f0-9]{32}\.bin$/.test(d.file)||!/^image\/(jpeg|png|webp|gif)$/.test(d.mime))throw Error('unsafe-image');
    assets[name]='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="12"><rect width="16" height="12" fill="#d9d8cc"/></svg>')+'#mmz='+d.file;
  }
  const byFile=new Map(Object.values(descriptors).map(d=>[d.file,d]));
  async function imageUrl(file) {
    if(loaded.has(file))return loaded.get(file);
    if(!pending.has(file))pending.set(file,(async()=>{
      const d=byFile.get(file);const raw=await decryptEnvelope(await readEncrypted(file),key,'photo:'+file);
      const url=URL.createObjectURL(new Blob([raw],{type:d.mime}));urls.add(url);loaded.set(file,url);return url;
    })().catch(error=>{pending.delete(file);throw error;}));
    return pending.get(file);
  }
  const queued=new WeakMap();let queue=[],active=0;
  function pump(){while(active<5&&queue.length){const [img,src,file]=queue.shift();active++;imageUrl(file).then(url=>{if(img.getAttribute('src')===src){img.src=url;img.classList.remove('asset-error');}}).catch(()=>{img.classList.add('asset-error');img.title='照片暂未载入，请刷新后重试。';}).finally(()=>{active--;pump();});}}
  const observer=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){observer.unobserve(e.target);const img=e.target,src=img.getAttribute('src'),file=src?.match(/#mmz=([a-f0-9]{32}\.bin)$/)?.[1];if(file){queue.push([img,src,file]);pump();}}},{rootMargin:'400px'});
  function watch(img){const src=img.getAttribute('src');if(!src?.includes('#mmz=')||queued.get(img)===src)return;queued.set(img,src);observer.unobserve(img);observer.observe(img);}
  new MutationObserver(mutations=>{for(const m of mutations){if(m.type==='attributes')watch(m.target);else for(const n of m.addedNodes)if(n.nodeType===1){if(n.matches('img'))watch(n);n.querySelectorAll('img').forEach(watch);}}}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});
  document.querySelectorAll('img').forEach(watch);
  document.querySelector('#lockDiary').addEventListener('click',()=>{try{sessionStorage.removeItem(storageName);}catch{}for(const url of urls)URL.revokeObjectURL(url);location.replace(location.pathname);});
  await startJournal({assets,seed:payload.seed,chinaMapData:payload.chinaMapData});
}
unlock().catch(()=>{try{sessionStorage.removeItem(storageName);}catch{}location.replace(location.pathname);});
