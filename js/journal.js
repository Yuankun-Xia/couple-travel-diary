import {mountDiscovery} from './discovery.js?v=20261030-1';
/* DISCOVERY_SECTIONS */
import {tripVisits,tripYears,hasTripDate,latestTripDate,visitDateLabel,tripDateLabel,tripTravelDays,timelineRecords} from './dates.js?v=20261029-1';
/* OWNER_TRAVEL_DATES */

export async function startJournal({assets,seed,chinaMapData}) {
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
for(const name of Object.keys(assets)){if(assets[name]&&typeof assets[name]==='object'&&assets[name].ref)assets[name]=assets[assets[name].ref];}
let state={trips:structuredClone(seed.trips),settings:{...seed.settings},photoRevision:seed.photoRevision||'initial'},filter='all',db=null,activeTrip=null,lightboxIndex=0,editorPhotos=[],editId=null,busy=false,audioCtx=null,audioNodes=[],searchQuery='',sortOrder='latest',galleryMode='full',slideshowTimer=null,stripTripId=null;
let mapView='country';
const MAX_PHOTOS=200;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=id=>`<svg class="icon" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const photoSrc=p=>p.src||(p.asset&&assets[p.asset])||assets.coast;
const photoThumb=p=>(p.thumbAsset&&assets[p.thumbAsset])||photoSrc(p);
const tripYear=t=>(t.start||'').slice(0,4);
const dateLabel=tripDateLabel;
const dateString=value=>{if(!value)return '';const [y,m,d]=value.split('-');return `${y}.${m}.${d}`;};
const dayCount=t=>{const start=Date.parse(t.start+'T00:00:00Z'),end=Date.parse((t.end||t.start)+'T00:00:00Z');return Number.isFinite(start)&&Number.isFinite(end)?Math.max(1,Math.round((end-start)/86400000)+1):1;};
const sorted=()=>[...state.trips].sort((a,b)=>latestTripDate(b).localeCompare(latestTripDate(a))||a.place.localeCompare(b.place,'zh-CN'));
let toastTimer;function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),4200);}
function openDialog(id){const dialog=document.getElementById(id);if(!dialog.open)dialog.showModal();}
function closeDialog(id){document.getElementById(id).close();}

function renderVisitPanel(trip,force=false){
 const visits=tripVisits(trip);if(!visits.length||(!force&&visits.length<2))return '';
 return '<section class="travel-dates-panel"><div class="eyebrow">DATES WE KEEP</div><h3>我们来过的日子</h3><ol>'+visits.map((v,i)=>'<li><span>'+String(i+1).padStart(2,'0')+'</span><time datetime="'+escape(v.start)+'">'+escape(visitDateLabel(v))+'</time></li>').join('')+'</ol></section>';
}
function renderTravelTimeline(){
 const records=timelineRecords(sorted(),state.settings.travelDates);
 const action=r=>r.trip?'data-trip="'+escape(r.trip.id)+'"':'data-visit-city="'+escape(r.city)+'"';
 const recent=records.slice(0,4).map(r=>'<button class="timeline-row" '+action(r)+'><span class="timeline-date">'+(r.precision==='year-range'?'时光':escape(r.start.slice(5).replace('-','.')))+'<small>'+escape(r.start.slice(0,4))+'</small></span><span class="timeline-dot"></span>'+(r.trip?'<img src="'+photoThumb(r.trip.photos[r.trip.cover||0]||r.trip.photos[0])+'" alt="" loading="lazy">':'<span class="timeline-photo-placeholder" aria-hidden="true">记</span>')+'<span class="timeline-caption"><strong>'+escape(r.city)+' · '+(r.trip?'我们的片段':'日期已收藏')+'</strong><span>'+escape(visitDateLabel(r))+'<br>'+(r.trip?r.trip.photos.length+' 帧回忆':'照片待补')+'</span></span>'+icon('diag')+'</button>').join('');
 const group=r=>r.precision==='year-range'?r.start+'—'+r.end:r.start.slice(0,4),years=[...new Set(records.map(group))];
 const precise=records.filter(r=>r.precision!=='year-range').length,periods=records.length-precise;
 const all=records.length?'<details class="travel-calendar"><summary>完整行程 · '+precise+' 次出发'+(periods?' · '+periods+' 段时光':'')+'<svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg></summary><div>'+years.map(year=>'<section class="travel-calendar-year"><h3>'+escape(year)+' <small>'+(year.includes('—')?'回忆时段':records.filter(r=>group(r)===year).length+' 次旅行')+'</small></h3>'+records.filter(r=>group(r)===year).map(r=>'<button class="travel-calendar-row" '+action(r)+'><span>'+escape(r.city)+(r.trip?'':'<small>照片待补</small>')+'</span><time datetime="'+escape(r.start)+'">'+escape(visitDateLabel(r))+'</time></button>').join('')+'</section>').join('')+'</div></details>':'';
 $('#timeline').innerHTML=recent+all||'<p class="section-subtitle">回忆会在这里慢慢排好。</p>';
}
function showVisitOnly(city){
 const visits=(state.settings.travelDates||[]).filter(v=>v.city===city);if(!visits.length)return;
 stopSlideshow();activeTrip=null;
 $('#detailContent').innerHTML='<div class="detail-body visit-only-body"><div class="detail-meta">OUR LITTLE JOURNEY</div><h2 class="detail-title" id="detailHeading">'+escape(city)+' · 我们来过</h2>'+renderVisitPanel({visits},true)+'<p class="detail-story">这段旅行的日期已经记下。照片，等我们慢慢收藏。</p></div>';
 openDialog('tripDialog');$('#tripDialog').scrollTop=0;
}

function render(){
 const trips=sorted(),years=[...new Set(trips.flatMap(tripYears).filter(Boolean))].sort().reverse();
 const hasUndated=trips.some(t=>!hasTripDate(t));
 if(filter!=='all'&&filter!=='undated'&&!years.includes(filter))filter='all';
 const cities=new Set(trips.map(t=>t.city||t.place.split(/[·,，]/)[0].trim()));
 const recordedYears=new Set(trips.flatMap(t=>t.dateSource==='owner'?tripYears(t):[...tripYears(t),...t.photos.map(p=>(p.takenAt||'').slice(0,4))]).filter(Boolean));
 const count=trips.reduce((n,t)=>n+t.photos.length,0);
 $('#statTrips').textContent=String(cities.size).padStart(2,'0');
 $('#statDays').textContent=recordedYears.size?String(recordedYears.size).padStart(2,'0'):'—';
 $('#statPhotos').textContent=String(count).padStart(2,'0');
 renderJournal(true);
 renderPending();
 renderTravelTimeline();
 renderChinaMap();
 $('#heroNames').textContent=state.settings.names||'你与我';$('#ourNames').textContent=state.settings.names||'你与我';$('#ourLetter').textContent=state.settings.letter||seed.settings.letter;
 document.body.classList.toggle('night',!!state.settings.night);$('#themeToggle').setAttribute('aria-pressed',String(!!state.settings.night));observeReveals();
}


function mapEntries(){
 const groups=new Map();
 for(const trip of sorted()){
  const city=(trip.city||trip.place.split(/[·,，]/)[0]).trim().replace(/市$/,'');
  if(!groups.has(city))groups.set(city,{city,trip,photos:0,albums:0,location:chinaMapData.locations[city]||null});
  const group=groups.get(city);group.photos+=trip.photos.length;group.albums++;
 }
 return [...groups.values()];
}
function renderChinaMap(){
 const entries=mapEntries(),located=entries.filter(e=>e.location),provinces=new Set(located.map(e=>String(e.location.province)));
 $('#mapVisitedCount').textContent=`${entries.length} 站 · ${provinces.size} 个省份`;
 $$('.china-province').forEach(p=>p.classList.toggle('is-visited',provinces.has(p.dataset.province)));
 $('#mapCities').innerHTML=entries.map((e,i)=>`<button class="map-city" data-trip="${escape(e.trip.id)}" aria-label="翻开${escape(e.city)}的旅行相册"><small>${String(i+1).padStart(2,'0')}</small><span>${escape(e.city)}</span><em>${e.photos} 帧${e.albums>1?' / '+e.albums+' 本':''}</em></button>`).join('');
 let view=[0,0,680,480];
 if(mapView==='east'&&located.length){
  const xs=located.map(e=>e.location.point[0]),ys=located.map(e=>e.location.point[1]);
  const left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
  const width=Math.max(150,(right-left)*1.8,(bottom-top)*680/480*1.35),height=width*480/680;
  view=[(left+right-width)/2,(top+bottom-height)/2,width,height];
 }
 $('#chinaMapSvg').setAttribute('viewBox',view.join(' '));
 $('#constellation').classList.toggle('focused-map',mapView==='east');
 $('#southSeaInset').setAttribute('display',mapView==='country'?'':'none');
 $('#chinaProvinceLabels').setAttribute('display',mapView==='country'?'':'none');
 $('#mapStars').innerHTML=located.map(e=>`<circle class="china-star-halo" cx="${e.location.point[0]}" cy="${e.location.point[1]}" r="6"/><circle class="china-star" cx="${e.location.point[0]}" cy="${e.location.point[1]}" r="2.4"/>`).join('');
 $$('[data-map-view]').forEach(b=>{if(b.closest('.map-view-switch'))b.setAttribute('aria-pressed',String(b.dataset.mapView===mapView));});
 $('#mapPoints').innerHTML='';$('#mapLeaderLines').innerHTML='';
 if(!located.length){$('#mapViewHint').textContent='新增相册后，已知城市会在这里点亮。';return;}
 const percent=e=>[(e.location.point[0]-view[0])/view[2]*100,(e.location.point[1]-view[1])/view[3]*100];
 if(mapView==='country'){
  const center=[located.reduce((n,e)=>n+e.location.point[0],0)/located.length,located.reduce((n,e)=>n+e.location.point[1],0)/located.length];
  $('#mapPoints').innerHTML=`<button class="map-cluster" data-map-view="east" style="left:${center[0]/6.8}%;top:${center[1]/4.8}%" aria-label="放大查看${located.length}站城市足迹"><i></i><span>${located.length} 站足迹<small>点亮的地方，都有我们</small></span></button>`;
  $('#mapViewHint').textContent='轻点华东的光点，放大我们的足迹';
 }else{
  const byLongitude=[...located].sort((a,b)=>a.location.coord[0]-b.location.coord[0]),leftSide=new Set(byLongitude.slice(0,Math.ceil(byLongitude.length/2)).map(e=>e.city));
  const labelPositions=new Map();
  [true,false].forEach(left=>{
   const side=located.filter(e=>leftSide.has(e.city)===left).sort((a,b)=>percent(a)[1]-percent(b)[1]);
   side.forEach((e,i)=>labelPositions.set(e.city,[left?16:84,side.length===1?50:14+i*72/(side.length-1)]));
  });
  $('#mapLeaderLines').innerHTML=located.map(e=>{const [x,y]=percent(e),[lx,ly]=labelPositions.get(e.city);return `<path d="M${x},${y} L${(x+lx)/2},${ly} L${lx},${ly}"/>`;}).join('');
  $('#mapPoints').innerHTML=located.map(e=>{const [x,y]=percent(e),[lx,ly]=labelPositions.get(e.city);return `<button class="china-city-pin" data-trip="${escape(e.trip.id)}" style="left:${x}%;top:${y}%" aria-label="地图标记：${escape(e.city)}，点击打开相册"><i></i></button><button class="china-city-label" data-trip="${escape(e.trip.id)}" style="left:${lx}%;top:${ly}%" aria-label="地图城市：${escape(e.city)}">${escape(e.city)}</button>`;}).join('');
  $('#mapViewHint').textContent='城市按实际方位标记 · 点击即可重温';
 }
}

function renderJournal(animate=false){
 const trips=sorted(),years=[...new Set(trips.flatMap(tripYears).filter(Boolean))].sort().reverse(),hasUndated=trips.some(t=>!hasTripDate(t));
 $('#filters').innerHTML=['all',...years,...(hasUndated?['undated']:[])].map(y=>`<button class="filter${filter===y?' active':''}" data-year="${escape(y)}" aria-pressed="${filter===y}">${y==='all'?'全部回忆':y==='undated'?'日期待补充':escape(y)}</button>`).join('');
 const query=searchQuery.trim().toLocaleLowerCase();
 const shown=trips.filter(t=>(filter==='all'||(filter==='undated'?!hasTripDate(t):tripYears(t).includes(filter)))&&(!query||[t.city,t.place,t.title,t.story].join(' ').toLocaleLowerCase().includes(query)));
 if(sortOrder==='city')shown.sort((a,b)=>(a.city||a.place).localeCompare(b.city||b.place,'zh-CN'));
 if(sortOrder==='photos')shown.sort((a,b)=>b.photos.length-a.photos.length);
 $('#tripsGrid').innerHTML=shown.length?shown.map(t=>{const no=String(trips.length-trips.indexOf(t)).padStart(2,'0');return `<article class="trip-card reveal${animate?'':' visible'}" tabindex="0" role="button" data-trip="${escape(t.id)}" aria-label="查看旅行：${escape(t.title)}"><div class="trip-image-wrap"><img src="${photoThumb(t.photos[t.cover||0]||t.photos[0])}" alt="${escape(t.place)}的旅行封面" loading="lazy" decoding="async"><span class="trip-num">STORY / ${no}</span><span class="photo-count">${icon('photo')}${t.photos.length} 帧回忆</span><span class="trip-open">${icon('diag')}</span></div><div class="trip-meta"><span>${escape(t.place)}</span><time${t.start?' datetime="'+escape(t.start)+'"':''}>${dateLabel(t)}</time></div><h3 class="trip-title">${escape(t.title)}</h3><p class="trip-summary">${escape(t.summary||t.story||'这段时光，因为有你而值得收藏。')}</p><div class="trip-tags"><span>${t.datePeriod?'时光相册':tripVisits(t).length?tripVisits(t).length+' 次旅行':t.album?'城市相册':t.demo?'示例旅行':dayCount(t)+' 天慢时光'}</span><span>${t.datePeriod?t.datePeriod.startYear+'—'+t.datePeriod.endYear:tripVisits(t).length?'共 '+tripTravelDays(t)+' 天慢时光':t.start?'光影已收藏':'日期可以慢慢补'}</span></div></article>`;}).join(''):`<div class="empty"><p>${searchQuery||filter!=='all'?'这一次，还没有翻到。':'这一页，等我们一起写。'}</p><button class="text-btn" ${searchQuery||filter!=='all'?'data-clear-search':'data-action="new"'}>${searchQuery||filter!=='all'?'查看全部回忆':'收藏第一段旅行'} ${icon('arrow')}</button></div>`;
 $('#journalCount').textContent=`共 ${shown.length} 本相册 · ${shown.reduce((n,t)=>n+t.photos.length,0)} 帧回忆`;
 $('#searchResult').hidden=!query;
 $('#searchResult').innerHTML=query?`找到 ${shown.length} 本关于「${escape(searchQuery.trim())}」的相册 <button data-clear-search>清除查找</button>`:'';
 observeReveals();
}
function renderPending(){
 const cities=new Set(state.trips.map(t=>t.city||t.place.split('·')[0].trim()));
 const pending=(state.settings.pendingPlaces||seed.settings.pendingPlaces||[]).filter(p=>typeof p.city==='string'&&!cities.has(p.city));
 $('#pendingSection').hidden=!pending.length;
 $('#pendingPlaces').innerHTML=pending.map(p=>`<span class="pending-place"><span>${escape(p.city)}</span><small>${p.visits?.length?escape(p.visits.map(visitDateLabel).join(" / "))+" · ":""}待补照片</small></span>`).join('');
}

const revealObserver=!reduced?new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');revealObserver.unobserve(entry.target);}});},{threshold:.07}):null;
function observeReveals(){if(reduced){$$('.reveal').forEach(e=>e.classList.add('visible'));return;}$$('.reveal:not(.visible)').forEach((el,i)=>{el.style.transitionDelay=(el.classList.contains('trip-card')?(i%3)*70:0)+'ms';revealObserver.observe(el);});}
function showTrip(id){
 const t=state.trips.find(t=>t.id===id);if(!t)return;stopSlideshow();stripTripId=null;activeTrip=t;
 const trips=sorted(),index=trips.findIndex(x=>x.id===id);
 const known=t.photos.filter(p=>p.takenAt).length;
 $('#detailContent').innerHTML=`<img class="detail-cover" src="${photoThumb(t.photos[t.cover||0]||t.photos[0])}" alt="${escape(t.place)}的旅行封面"><div class="detail-body"><div class="detail-meta">STORY ${String(trips.length-index).padStart(2,'0')} · ${t.album?'我们的城市相册':t.demo?'示例旅行':'OUR LITTLE JOURNEY'}</div><h2 class="detail-title" id="detailHeading">${escape(t.title)}</h2><div class="detail-info"><span>${icon('pin')}${escape(t.place)}</span><span>${icon('calendar')}${t.datePeriod?'回忆时段：':t.dateSource==='owner'?'旅行日期：':t.album&&t.start?'已知照片日期：':''}${dateLabel(t)}</span><span>${icon('photo')}${t.photos.length} 帧回忆</span></div>${renderVisitPanel(t)}<p class="detail-story">${escape(t.story||'我们把最好的心情，留在了这段旅途中。')}</p>${t.days&&t.days.length?`<div class="detail-days">${t.days.map((d,i)=>`<div class="day-note"><strong>Day ${String(i+1).padStart(2,'0')}</strong><h3>${escape(d.title)}</h3><p>${escape(d.text)}</p></div>`).join('')}</div>`:''}<div class="detail-gallery-head"><h3>把这些瞬间，留久一点。</h3><div class="gallery-controls"><span>${t.photos.length} 帧回忆 · 点击放大</span><div class="gallery-layout" role="group" aria-label="照片排版"><button data-gallery="full" aria-pressed="${galleryMode==='full'}">完整画幅</button><button data-gallery="grid" aria-pressed="${galleryMode==='grid'}">胶片方格</button></div></div></div><div class="detail-gallery${galleryMode==='full'?' full-frames':''}" id="detailGallery">${t.photos.map((p,i)=>`<button class="detail-photo${p.originalHeight>p.originalWidth*3.2?' long-frame':''}" data-photo="${i}" aria-label="放大第${i+1}张照片：${escape(p.caption||'旅途瞬间')}"><img style="--photo-ratio:${Number(p.originalWidth)||1}/${Number(p.originalHeight)||1}" src="${photoThumb(p)}" alt="${escape(p.caption||t.place+'的旅途瞬间')}" loading="lazy"><span><em>${String(i+1).padStart(2,'0')}</em>${p.originalHeight>p.originalWidth*3.2?'长图 · 放大细看 / ':''}${escape(p.caption||'这一刻，值得收藏。')}${p.takenAt?' · '+dateString(p.takenAt):''}</span></button>`).join('')}</div><div class="detail-bottom"><small>把这些瞬间，慢慢收藏。</small></div><div class="detail-pagination"><button data-trip="${escape(trips[(index-1+trips.length)%trips.length].id)}">${icon('left')}上一篇故事</button><button data-trip="${escape(trips[(index+1)%trips.length].id)}">下一篇故事${icon('right')}</button></div></div>`;
 openDialog('tripDialog');$('#tripDialog').scrollTop=0;
}
function showPhoto(index){
 if(!activeTrip)return;setPhotoZoom(false);lightboxIndex=(index+activeTrip.photos.length)%activeTrip.photos.length;
 const p=activeTrip.photos[lightboxIndex];
 $('#lightboxImage').dataset.previewSrc=photoThumb(p);$('#lightboxImage').src=photoSrc(p);$('#lightboxImage').alt=p.caption||activeTrip.place+'的旅行照片';
 $('#lightboxCount').textContent=`${String(lightboxIndex+1).padStart(2,'0')} / ${String(activeTrip.photos.length).padStart(2,'0')}`;
 $('#lightboxCaption').textContent=p.caption||'把这一刻，慢慢收藏。';$('#lightboxPlace').textContent=activeTrip.city||activeTrip.place.split('·')[0];
 if(stripTripId!==activeTrip.id){stripTripId=activeTrip.id;$('#lightboxStrip').innerHTML=activeTrip.photos.map((photo,i)=>`<button class="lightbox-thumb" data-lightbox-photo="${i}" aria-label="查看第${i+1}张照片" aria-current="false"><img src="${photoThumb(photo)}" alt="" loading="lazy" decoding="async"></button>`).join('');}
 $$('.lightbox-thumb').forEach((button,i)=>button.setAttribute('aria-current',String(i===lightboxIndex)));
 openDialog('lightbox');$('#lightboxStrip').children[lightboxIndex]?.scrollIntoView({block:'nearest',inline:'center',behavior:reduced?'instant':'smooth'});
}
function setPhotoZoom(zoom){$('#lightbox').classList.toggle('zoomed',zoom);$('#zoomToggle').setAttribute('aria-pressed',String(zoom));$('#zoomToggle').textContent=zoom?'适应屏幕':'放大细看';$('.lightbox-inner').scrollTop=0;}
$('#zoomToggle').addEventListener('click',()=>{stopSlideshow();setPhotoZoom(!$('#lightbox').classList.contains('zoomed'));});$('#lightboxImage').addEventListener('click',()=>{stopSlideshow();setPhotoZoom(!$('#lightbox').classList.contains('zoomed'));});
function stopSlideshow(){clearInterval(slideshowTimer);slideshowTimer=null;$('#slideshowToggle').setAttribute('aria-pressed','false');$('#slideshowToggle').innerHTML=icon('play')+'<span>自动放映</span>';}
function toggleSlideshow(){if(slideshowTimer){stopSlideshow();return;}$('#slideshowToggle').setAttribute('aria-pressed','true');$('#slideshowToggle').innerHTML=icon('pause')+'<span>暂停放映</span>';slideshowTimer=setInterval(()=>{if(document.hidden||!$('#lightbox').open){stopSlideshow();return;}showPhoto(lightboxIndex+1);},4500);}
$('#slideshowToggle').addEventListener('click',toggleSlideshow);$('#lightbox').addEventListener('close',stopSlideshow);document.addEventListener('visibilitychange',()=>{if(document.hidden)stopSlideshow();});

$('#themeToggle').addEventListener('click',()=>{state.settings.night=!state.settings.night;render();});
document.addEventListener('click',event=>{
 const target=event.target;
 const close=target.closest('[data-close]');if(close){closeDialog(close.dataset.close);return;}
 const map=target.closest('[data-map-view]');if(map){mapView=map.dataset.mapView;renderChinaMap();return;}
 const year=target.closest('[data-year]');if(year){filter=year.dataset.year;renderJournal();return;}
 if(target.closest('[data-clear-search]')){searchQuery='';filter='all';$('#journalSearch').value='';renderJournal();return;}
 const gallery=target.closest('[data-gallery]');if(gallery){galleryMode=gallery.dataset.gallery;$('#detailGallery').classList.toggle('full-frames',galleryMode==='full');$$('[data-gallery]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.gallery===galleryMode)));return;}
 const frame=target.closest('[data-lightbox-photo]');if(frame){stopSlideshow();showPhoto(Number(frame.dataset.lightboxPhoto));return;}
 const visitOnly=target.closest('[data-visit-city]');if(visitOnly){showVisitOnly(visitOnly.dataset.visitCity);return;}
 const trip=target.closest('[data-trip]');if(trip){showTrip(trip.dataset.trip);return;}
 const photo=target.closest('[data-photo]');if(photo)showPhoto(Number(photo.dataset.photo));
});
document.addEventListener('keydown',event=>{if($('#lightbox').open){if(event.key==='ArrowLeft'){event.preventDefault();stopSlideshow();showPhoto(lightboxIndex-1);}if(event.key==='ArrowRight'){event.preventDefault();stopSlideshow();showPhoto(lightboxIndex+1);}if(event.key===' '&&event.target===$('#lightbox')){event.preventDefault();toggleSlideshow();}}else if((event.key==='Enter'||event.key===' ')&&event.target.matches('.trip-card')){event.preventDefault();showTrip(event.target.dataset.trip);}});
$('#prevPhoto').addEventListener('click',()=>{stopSlideshow();showPhoto(lightboxIndex-1);});$('#nextPhoto').addEventListener('click',()=>{stopSlideshow();showPhoto(lightboxIndex+1);});
let touchX=null;$('#lightboxImage').addEventListener('touchstart',e=>{touchX=e.changedTouches[0].clientX;},{passive:true});$('#lightboxImage').addEventListener('touchend',e=>{if(touchX===null)return;const dx=e.changedTouches[0].clientX-touchX;if(Math.abs(dx)>45&&!$('#lightbox').classList.contains('zoomed')){stopSlideshow();showPhoto(lightboxIndex+(dx<0?1:-1));}touchX=null;},{passive:true});
$$('dialog:not(.lightbox)').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}}));
async function toggleSound(){try{if(audioCtx&&audioCtx.state==='running'){await audioCtx.suspend();$('#soundToggle').setAttribute('aria-pressed','false');$('#soundLabel').textContent='听一点晚风';return;}if(!audioCtx){audioCtx=new (window.AudioContext||window.webkitAudioContext)();const output=audioCtx.createGain();output.gain.value=.065;output.connect(audioCtx.destination);[130.81,164.81,196,246.94].forEach((frequency,i)=>{const oscillator=audioCtx.createOscillator(),gain=audioCtx.createGain(),lfo=audioCtx.createOscillator(),depth=audioCtx.createGain();oscillator.type='sine';oscillator.frequency.value=frequency;gain.gain.value=.12;lfo.frequency.value=.07+i*.013;depth.gain.value=.075;lfo.connect(depth);depth.connect(gain.gain);oscillator.connect(gain);gain.connect(output);oscillator.start();lfo.start();audioNodes.push(oscillator,lfo);});}await audioCtx.resume();$('#soundToggle').setAttribute('aria-pressed','true');$('#soundLabel').textContent='晚风正在轻唱';}catch{toast('当前浏览器暂时无法播放氛围声。');}}
$('#soundToggle').addEventListener('click',toggleSound);
function stars(){const canvas=$('#stars'),ctx=canvas.getContext('2d');let w,h,points=[],inView=true;function resize(){w=canvas.clientWidth;h=canvas.clientHeight;const ratio=Math.min(devicePixelRatio||1,2);canvas.width=w*ratio;canvas.height=h*ratio;ctx.setTransform(ratio,0,0,ratio,0,0);points=Array.from({length:w<760?32:65},()=>({x:Math.random()*w,y:Math.random()*h*.9,r:.3+Math.random()*1.2,phase:Math.random()*Math.PI*2,speed:.25+Math.random()*.7}));}resize();window.addEventListener('resize',resize,{passive:true});new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;}).observe($('#top'));function draw(time){if(inView&&!document.hidden){ctx.clearRect(0,0,w,h);points.forEach(p=>{const alpha=.12+(Math.sin(time*.00055+p.phase)+1)*.23;ctx.beginPath();ctx.fillStyle=`rgba(255,226,175,${alpha})`;ctx.shadowColor='#f9dba2';ctx.shadowBlur=p.r*4;ctx.arc(p.x,p.y+Math.sin(time*.00013*p.speed+p.phase)*12,p.r,0,Math.PI*2);ctx.fill();});}if(!reduced)requestAnimationFrame(draw);}draw(0);if(!reduced){let queued=false;window.addEventListener('scroll',()=>{if(!queued){queued=true;requestAnimationFrame(()=>{if(inView)$('#heroImage').style.transform=`scale(1.025) translateY(${Math.min(scrollY*.16,140)}px)`;queued=false;});}},{passive:true});}}
$('#journalSearch').addEventListener('input',event=>{searchQuery=event.target.value;renderJournal();});
$('#journalSort').addEventListener('change',event=>{sortOrder=event.target.value;renderJournal();});
$('#randomMemory').addEventListener('click',()=>{const total=state.trips.reduce((n,t)=>n+t.photos.length,0);if(!total){toast('先收藏一张照片，再来偶遇回忆吧。');return;}let pick=Math.floor(Math.random()*total);for(const trip of state.trips){if(pick<trip.photos.length){activeTrip=trip;stopSlideshow();showPhoto(pick);break;}pick-=trip.photos.length;}});
function initPageChrome(){let scheduled=false;const update=()=>{const height=document.documentElement.scrollHeight-innerHeight;$('#pageProgress').style.transform=`scaleX(${height>0?Math.min(1,scrollY/height):0})`;document.body.classList.toggle('past-hero',scrollY>$('#top').offsetHeight*.75);scheduled=false;};window.addEventListener('scroll',()=>{if(!scheduled){scheduled=true;requestAnimationFrame(update);}},{passive:true});window.addEventListener('resize',update,{passive:true});update();}
async function init(){ $('#heroImage').src=assets.hero||assets.coast;$('#heroPolaroid').src=assets.coast;$('#usImageMain').src=assets.road;$('#usImageSmall').src=assets.usSmall||assets.hero||assets.coast;render();mountDiscovery({trips:state.trips,quizAssets:state.settings.quizAssets,photoThumb,photoSrc,openPhoto:(trip,index)=>{activeTrip=trip;stopSlideshow();showPhoto(index);},openTrip:showTrip});stars();initPageChrome();if(['#journal','#moments','#guess','#footprints','#us','#top'].includes(location.hash))setTimeout(()=>document.getElementById(location.hash.slice(1))?.scrollIntoView(),100);}
await init();
}
