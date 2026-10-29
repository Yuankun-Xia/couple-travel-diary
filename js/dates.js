const day=86400000;
export const tripVisits=trip=>Array.isArray(trip.visits)?trip.visits:[];
export const hasTripDate=trip=>!!(trip.start||trip.datePeriod||tripVisits(trip).length);
export function tripYears(trip) {
  const visits=tripVisits(trip),years=new Set();
  if(trip.datePeriod){for(let y=trip.datePeriod.startYear;y<=trip.datePeriod.endYear;y++)years.add(String(y));return [...years];}
  for(const visit of visits.length?visits:(trip.start?[{start:trip.start,end:trip.end||trip.start}]:[])) {
    for(let y=Number(visit.start.slice(0,4));y<=Number((visit.end||visit.start).slice(0,4));y++)years.add(String(y));
  }
  return [...years].sort();
}
export const latestTripDate=trip=>trip.datePeriod?String(trip.datePeriod.endYear):tripVisits(trip).reduce((latest,v)=>v.start>latest?v.start:latest,trip.start||'');
export const dateText=value=>String(value||'').replaceAll('-','.');
export const visitDateLabel=visit=>dateText(visit.start)+(visit.end&&visit.end!==visit.start?' — '+dateText(visit.end):'');
export function tripDateLabel(trip) {
  if(trip.datePeriod)return trip.datePeriod.startYear+'—'+trip.datePeriod.endYear+' · 这些年的回忆';
  const visits=tripVisits(trip);
  if(visits.length>1)return tripYears(trip).join(' / ')+' · '+visits.length+' 次旅行';
  return visits.length?visitDateLabel(visits[0]):trip.start?visitDateLabel(trip):'日期待补充';
}
export function tripTravelDays(trip) {
  const days=new Set();for(const v of tripVisits(trip))for(let t=Date.parse(v.start+'T00:00:00Z'),end=Date.parse(v.end+'T00:00:00Z');t<=end;t+=day)days.add(t);
  return days.size;
}
export function timelineRecords(trips,scheduled) {
  const rows=Array.isArray(scheduled)?scheduled:trips.filter(t=>t.start).map(t=>({city:t.city||t.place.split('·')[0].trim(),start:t.start,end:t.end||t.start}));
  const periods=trips.filter(t=>t.datePeriod).map(t=>({city:t.city||t.place.split('·')[0].trim(),start:String(t.datePeriod.startYear),end:String(t.datePeriod.endYear),precision:'year-range',trip:t}));
  return [...rows.map(row=>({...row,trip:trips.find(t=>(t.city||t.place.split('·')[0].trim())===row.city)||null})),...periods].sort((a,b)=>(b.precision==='year-range'?b.end:b.start).localeCompare(a.precision==='year-range'?a.end:a.start)||a.city.localeCompare(b.city,'zh-CN'));
}
