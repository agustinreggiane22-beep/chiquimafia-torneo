(function(root){
 'use strict';
 const teams={white:['LORIA','DIEGO','FRANCO','MATU','VALEN','MATI BILLO','DARIO','NAHUEL','AGUSTIN K'],black:['LUCAS','AUGUSTO','LIHUEL','PABLO','GONZA','AGUSREGGI','LAUTY','KEVIN','JOACOREGGI']};
 const clean=text=>String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
 const aliases={LORIA:['loria','gloria'],DIEGO:['diego'],FRANCO:['franco'],MATU:['matu','matute'],VALEN:['valen','valentin'],'MATI BILLO':['mati billo','billo'],DARIO:['dario'],NAHUEL:['nahuel'],LUCAS:['lucas'],AUGUSTO:['augusto','agusto'],LIHUEL:['lihuel','lihuen'],PABLO:['pablo'],GONZA:['gonza','gonzalo'],AGUSREGGI:['agus','agusreggi','agus reggi','agus regi','agustin reggi','agustin reggiane','agustin regi','agustin'],'AGUSTIN K':['agustin','agustin k','agustin ka','agustin kotick','agustin cotick','agustin kotik','agustin cotik','kotick','cotick','kotik','cotik'],JOACOREGGI:['joaquin','joaco','joacoreggi','joaco reggi','joaquin reggiane','joaquin reggi'],LAUTY:['lauty','lauti','lautaro'],KEVIN:['kevin']};
 const labels={'AGUSREGGI':'Agustín Reggiane','AGUSTIN K':'Agustín Kotick','JOACOREGGI':'Joaquín'};
 const displayName=name=>labels[name]||String(name||'').toLowerCase();
 function find(text){
  const input=' '+clean(text)+' ',matches=[];
  for(const [name,values] of Object.entries(aliases))for(const alias of values){
   const needle=' '+alias+' ';let position=input.indexOf(needle);
   while(position>=0){matches.push({name,start:position,end:position+needle.length});position=input.indexOf(needle,position+1)}
  }
  // Full names take priority over the bare first name inside that same phrase.
  const exact=matches.filter(hit=>!matches.some(other=>other.start<=hit.start&&other.end>=hit.end&&other.end-other.start>hit.end-hit.start));
  let hits=[...new Set(exact.map(hit=>hit.name))];
  return hits;
 }
 function parse(text){
  const input=clean(text),mark=input.match(/\b(sin asistencia|sin pase|jugada individual|lo hizo solo|asistencia(?: de)?|asistio(?: de)?|pase(?: de)?|asistido por)\b/);
  const goalText=mark?input.slice(0,mark.index):input,assistText=mark?input.slice(mark.index+mark[0].length):'',scorers=find(goalText),scorer=scorers.length===1?scorers[0]:null;
  const base={scorer,team:scorer?Object.keys(teams).find(t=>teams[t].includes(scorer)):null,assist:null,decision:'pending',error:'',candidates:scorers};
  if(!scorer){base.error=scorers.length?'El nombre puede corresponder a '+scorers.map(displayName).join(' o ')+'. Elegí quién hizo el gol.':'No reconocí al goleador. Corregí el texto o elegí su nombre.';return base}
  if(!mark)return base;
  if(/^(sin |jugada individual|lo hizo solo)/.test(mark[0])){base.decision='none';return base}
  const assists=find(assistText);
  if(assists.length!==1){base.error=assists.length?'No quedó claro quién dio la asistencia.':'No reconocí quién dio la asistencia.';return base}
  if(assists[0]===scorer){base.error='El goleador no puede darse una asistencia a sí mismo.';return base}
  if(!teams[base.team].includes(assists[0])){base.error='La asistencia debe ser de un compañero del mismo equipo.';return base}
  base.assist=assists[0];base.decision='assigned';return base;
 }
 const api={teams,parse,displayName};if(typeof module==='object'&&module.exports)module.exports=api;else root.ChiquiVoiceParser=api;
})(typeof window==='undefined'?globalThis:window);
