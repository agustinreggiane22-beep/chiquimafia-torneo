(function(root){
 'use strict';
 const teams={white:['LORIA','DIEGO','FRANCO','MATU','VALEN','MATI BILLO','DARIO','NAHUEL'],black:['LUCAS','AUGUSTO','LIHUEL','PABLO','GONZA','AGUSREGGI','LAUTY','KEVIN']};
 const clean=text=>String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
 const aliases={LORIA:['loria','gloria'],DIEGO:['diego'],FRANCO:['franco'],MATU:['matu','matute'],VALEN:['valen','valentin'],'MATI BILLO':['mati billo','billo'],DARIO:['dario'],NAHUEL:['nahuel'],LUCAS:['lucas'],AUGUSTO:['augusto','agusto'],LIHUEL:['lihuel','lihuen'],PABLO:['pablo'],GONZA:['gonza','gonzalo'],AGUSREGGI:['agusreggi','agus reggi','agus regi'],LAUTY:['lauty','lauti','lautaro'],KEVIN:['kevin']};
 function find(text){
  const input=' '+clean(text)+' ';let hits=[];
  for(const [name,values] of Object.entries(aliases))if(values.some(alias=>input.includes(' '+alias+' ')))hits.push(name);
  if(!hits.length&&/\bagus\b/.test(input))hits=['AUGUSTO','AGUSREGGI'];
  return hits;
 }
 function parse(text){
  const input=clean(text),mark=input.match(/\b(sin asistencia|sin pase|jugada individual|lo hizo solo|asistencia(?: de)?|asistio(?: de)?|pase(?: de)?|asistido por)\b/);
  const goalText=mark?input.slice(0,mark.index):input,assistText=mark?input.slice(mark.index+mark[0].length):'',scorers=find(goalText),scorer=scorers.length===1?scorers[0]:null;
  const base={scorer,team:scorer?Object.keys(teams).find(t=>teams[t].includes(scorer)):null,assist:null,decision:'pending',error:'',candidates:scorers};
  if(!scorer){base.error=scorers.length?'Escuché más de un posible goleador. Elegí quién hizo el gol.':'No reconocí al goleador. Corregí el texto o elegí su nombre.';return base}
  if(!mark)return base;
  if(/^(sin |jugada individual|lo hizo solo)/.test(mark[0])){base.decision='none';return base}
  const assists=find(assistText);
  if(assists.length!==1){base.error=assists.length?'No quedó claro quién dio la asistencia.':'No reconocí quién dio la asistencia.';return base}
  if(assists[0]===scorer){base.error='El goleador no puede darse una asistencia a sí mismo.';return base}
  if(!teams[base.team].includes(assists[0])){base.error='La asistencia debe ser de un compañero del mismo equipo.';return base}
  base.assist=assists[0];base.decision='assigned';return base;
 }
 const api={teams,parse};if(typeof module==='object'&&module.exports)module.exports=api;else root.ChiquiVoiceParser=api;
})(typeof window==='undefined'?globalThis:window);
