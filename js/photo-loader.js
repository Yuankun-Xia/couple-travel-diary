import {decryptEnvelope} from './crypto.js';
export async function fetchCipher(url,{cache='force-cache',attempts=2,timeout=8000}={}){
 let last;for(let i=0;i<attempts;i++){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
  try{const response=await fetch(url,{signal:controller.signal,cache,credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok)throw Error('network-'+response.status);return await response.arrayBuffer();}
  catch(error){last=error;if(i+1<attempts)await new Promise(r=>setTimeout(r,500*(i+1)));}finally{clearTimeout(timer);}
 }throw last;
}
// Object URLs stay in device memory. Only ciphertext enters the HTTP cache.
export function createAssetStore({load,createUrl,revokeUrl,concurrency=3,budget=12*1024*1024,onEvict=()=>{},protectedFiles=()=>new Set(),estimateSize=data=>data.byteLength}){
 const loaded=new Map(),pending=new Map();let queue=[],active=0,bytes=0,disposed=false;
 function prune(){const keep=protectedFiles();for(const [file,item] of [...loaded].sort((a,b)=>a[1].used-b[1].used)){if(bytes<=budget)break;if(keep.has(file))continue;loaded.delete(file);bytes-=item.size;onEvict(file,item.url);revokeUrl(item.url);}}
 function pump(){while(!disposed&&active<concurrency&&queue.length){queue.sort((a,b)=>b.priority-a.priority);const job=queue.shift();if(!job.needed.some(fn=>fn())){pending.delete(job.file);job.reject(Error('cancelled'));continue;}active++;(async()=>{try{const data=await load(job.file);if(disposed)throw Error('disposed');const url=createUrl(data,job.file),size=estimateSize(data,job.file);loaded.set(job.file,{url,size,used:Date.now()});bytes+=size;job.resolve(url);prune();}catch(error){job.reject(error);}finally{pending.delete(job.file);active--;pump();}})();}}
 function get(file){const hit=loaded.get(file);if(hit){hit.used=Date.now();return hit.url;}return null;}
 function ensure(file,priority=0,needed=()=>true){const hit=get(file);if(hit)return Promise.resolve(hit);const old=pending.get(file);if(old){old.priority=Math.max(old.priority,priority);old.needed.push(needed);return old.promise;}let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});const job={file,priority,needed:[needed],promise,resolve,reject};pending.set(file,job);queue.push(job);pump();return promise;}
 return {get,ensure,prune,stats:()=>({bytes,loaded:loaded.size,pending:pending.size,active}),dispose(){disposed=true;for(const job of queue)job.reject(Error('disposed'));queue=[];for(const item of loaded.values())revokeUrl(item.url);loaded.clear();bytes=0;}};
}
export function installPhotoLoader({descriptors,key,baseUrl=new URL('../data/',import.meta.url)}){
 const slow=navigator.connection?.saveData||/2g/.test(navigator.connection?.effectiveType||''),mobile=matchMedia('(max-width:760px)').matches;
 const fileOf=src=>src?.match(/#mmz=([a-f0-9]{32}\.bin)$/)?.[1],byFile=new Map(Object.values(descriptors).map(d=>[d.file,d]));
 const weights=new Map();for(const [name,d]of Object.entries(descriptors))weights.set(d.file,Math.max(weights.get(d.file)||0,(name.endsWith('-thumb')?380*380:1600*1600)*4));
 const bindings=new WeakMap(),states=new Set(),visible=new Set(),failed=new Set();let stopped=false;
 const notice=document.createElement('div');notice.className='photo-load-notice';notice.hidden=true;notice.setAttribute('role','status');notice.innerHTML='<span>有照片暂时没加载出来</span><button type="button">重试照片</button>';document.body.append(notice);
 const protectedFiles=()=>new Set([...visible].filter(s=>s.img.isConnected).flatMap(s=>[s.file,s.preview].filter(Boolean)));
 const store=createAssetStore({concurrency:slow?2:mobile?3:4,budget:(mobile?24:64)*1024*1024,estimateSize:(data,file)=>Math.max(data.byteLength,weights.get(file)||0),protectedFiles,load:async file=>new Uint8Array(await decryptEnvelope(await fetchCipher(new URL(file,baseUrl)),key,'photo:'+file)),createUrl:(data,file)=>URL.createObjectURL(new Blob([data],{type:byFile.get(file).mime})),revokeUrl:url=>URL.revokeObjectURL(url),onEvict(file,url){for(const s of states)if(s.expected===url){s.status='idle';paint(s,s.src);}}});
 function updateNotice(){for(const s of failed)if(!s.img.isConnected)failed.delete(s);notice.hidden=!failed.size;}
 function paint(s,url){if(bindings.get(s.img)!==s||!s.img.isConnected)return;s.expected=url;s.img.src=url;}
 async function display(s){if(stopped||s.status==='loading'||s.status==='error'||!s.img.isConnected)return;s.status='loading';const needed=()=>!stopped&&s.img.isConnected&&bindings.get(s.img)===s&&visible.has(s);
  try{if(s.preview&&s.preview!==s.file){try{const preview=await store.ensure(s.preview,40,needed);if(!needed()){s.status='idle';return;}paint(s,preview);s.hasPreview=true;}catch(error){if(error.message==='cancelled'){s.status='idle';return;}}}
   const urgent=s.img.id==='lightboxImage'||s.img.closest('#guessPlay')?60:s.img.id==='heroImage'?50:10;
   const url=await store.ensure(s.file,urgent,needed);if(!needed()){s.status='idle';return;}paint(s,url);s.status='loaded';s.img.classList.remove('asset-error');failed.delete(s);updateNotice();
  }catch(error){if(bindings.get(s.img)!==s)return;if(error.message==='cancelled'||stopped){s.status='idle';return;}s.status='error';failed.add(s);s.img.classList.toggle('asset-error',!s.hasPreview);updateNotice();}
 }
 const observer=new IntersectionObserver(entries=>{for(const e of entries){const s=bindings.get(e.target);if(!s)continue;if(e.isIntersecting){visible.add(s);display(s);}else visible.delete(s);}store.prune();},{rootMargin:mobile?'140px':'260px'});
 function watch(img){const src=img.getAttribute('src'),old=bindings.get(img);if(old&&src===old.expected)return;const file=fileOf(src);if(!file||!byFile.has(file))return;if(old){visible.delete(old);failed.delete(old);states.delete(old);observer.unobserve(img);}const s={img,file,src,expected:src,preview:fileOf(img.dataset.previewSrc),status:'idle',hasPreview:false};bindings.set(img,s);states.add(s);img.decoding='async';observer.observe(img);updateNotice();}
 function retry(){for(const s of failed){s.status='idle';s.img.classList.remove('asset-error');if(visible.has(s))display(s);}failed.clear();updateNotice();}
 notice.querySelector('button').addEventListener('click',retry);window.addEventListener('online',retry);
 const mutations=new MutationObserver(list=>{for(const m of list){if(m.type==='attributes')watch(m.target);else for(const node of m.addedNodes)if(node.nodeType===1){if(node.matches('img'))watch(node);node.querySelectorAll('img').forEach(watch);}}for(const s of states)if(!s.img.isConnected){states.delete(s);visible.delete(s);failed.delete(s);observer.unobserve(s.img);}updateNotice();store.prune();});
 mutations.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['src']});document.querySelectorAll('img').forEach(watch);
 const dispose=()=>{stopped=true;mutations.disconnect();observer.disconnect();store.dispose();window.removeEventListener('online',retry);notice.remove();};window.addEventListener('pagehide',event=>{if(!event.persisted)dispose();},{once:true});return {dispose,stats:store.stats};
}
