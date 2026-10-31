(function(){
 'use strict';
 const root=document.querySelector('#recoveryDrafts'),status=document.querySelector('#recoveryStatus');
 const prefixes=['chiquimafia_live_score_v1:','chiquimafia_shared_score_v1:copia-local:'];
 let urls=[];
 const node=(tag,text,className)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e};
 const filename=(number,extension)=>'chiquimafia-fecha-'+String(number||'sin-identificar').replace(/[^\w-]/g,'')+'-anotaciones.'+extension;
 function download(article,body,name,label){
  const url=URL.createObjectURL(new Blob([body],{type:name.endsWith('.json')?'application/json':'text/plain;charset=utf-8'}));urls.push(url);
  const link=node('a',label,'download');link.href=url;link.download=name;article.append(link);
 }
 function report(d){
  const events=Array.isArray(d.events)?d.events:[],counts={white:0,black:0},players=new Map(),assists=new Map();
  let invalid=0;
  for(const e of events){if(!e||!['white','black'].includes(e.team)){invalid++;continue}counts[e.team]++;const player=String(e.player||'Sin identificar'),key=e.team+'\n'+player;players.set(key,(players.get(key)||0)+1);if(e.assist){const key=e.team+'\n'+String(e.assist);assists.set(key,(assists.get(key)||0)+1)}}
  const lines=['ANOTACIONES CHIQUIMAFIA','Fecha '+String(d.number??'sin identificar'),'Día: '+String(d.date||'sin fecha'),'Claro '+counts.white+' — '+counts.black+' Oscuro','Guardado: '+String(d.updatedAt||'sin horario'),'Estado en este celular: '+(d.published?'marcado como publicado':'sin publicar'),''];
  for(const [team,label] of [['white','CLARO'],['black','OSCURO']]){
   lines.push('EQUIPO '+label,Array.isArray(d[team])?d[team].map(String).join(', '):'Plantel no disponible','Goles:');
   const goals=[...players].filter(([key])=>key.startsWith(team+'\n'));lines.push(...(goals.length?goals.map(([key,n])=>key.slice(team.length+1)+': '+n):['Sin goles']));
   const passes=[...assists].filter(([key])=>key.startsWith(team+'\n'));lines.push('Asistencias:',...(passes.length?passes.map(([key,n])=>key.slice(team.length+1)+': '+n):['Sin asistencias registradas']),'');
  }
  lines.push('DETALLE DE LOS GOLES');events.forEach((e,i)=>{if(!e||!['white','black'].includes(e.team)){lines.push((i+1)+'. Anotación pendiente de revisión');return}lines.push((i+1)+'. '+(e.team==='white'?'Claro':'Oscuro')+' · '+String(e.player||'Sin identificar')+' · Pase: '+String(e.assist||(e.assistDecision==='none'?'Sin asistencia':'Pendiente')))});
  if(invalid)lines.push('',invalid+' anotación(es) necesitan revisión; están incluidas en la copia.');
  return {text:lines.join('\n'),counts,invalid};
 }
 function renderDraft(d,index){
  const article=node('article'),summary=report(d),snapshot={version:d.version,number:d.number,date:d.date,white:d.white,black:d.black,events:d.events,published:d.published,updatedAt:d.updatedAt,participantCorrectionId:d.participantCorrectionId};
  const backup=JSON.stringify({type:'chiquimafia-score-backup',version:1,exportedAt:new Date().toISOString(),snapshot},null,2),name=filename(d.number,'json');
  article.dataset.recoveryIndex=index;article.append(node('h2','Fecha '+String(d.number??'sin identificar')),node('p',String(d.date||'Sin fecha')+' · '+(d.published?'Marcado como publicado en este celular':'Anotaciones sin publicar'),'muted'),node('strong','Claro '+summary.counts.white+' — '+summary.counts.black+' Oscuro','score'));
  if(summary.invalid)article.append(node('p','Hay anotaciones que necesitan revisión. La copia las conserva.','error'));
  const actions=node('div',undefined,'actions'),share=node('button','Compartir copia'),copy=node('button','Copiar anotaciones','secondary'),message=node('p','','message');share.type=copy.type='button';
  const details=node('details'),title=node('summary','Ver goles y asistencias'),textarea=node('textarea');textarea.value=summary.text;textarea.readOnly=true;textarea.setAttribute('aria-label','Anotaciones de la fecha '+String(d.number));details.append(title,textarea);
  copy.onclick=async()=>{try{await navigator.clipboard.writeText(summary.text);message.textContent='Anotaciones copiadas. Pegalas en el chat del administrador.'}catch{details.open=true;textarea.focus();textarea.select();message.textContent='Seleccioná el texto y tocá Copiar. Después pegalo en el chat del administrador.'}};
  share.onclick=async()=>{try{const file=new File([backup],name,{type:'application/json'});if(navigator.canShare?.({files:[file]})&&navigator.share){await navigator.share({files:[file],title:'Anotaciones de Chiquimafia'});message.textContent='La copia está lista para enviar.'}else if(navigator.share){await navigator.share({title:'Anotaciones de Chiquimafia',text:summary.text});message.textContent='El texto está listo para enviar.'}else{message.textContent='Usá Copiar anotaciones o Guardar copia para enviarlas.'}}catch(error){message.textContent=error.name==='AbortError'?'Se canceló el envío. Las anotaciones siguen guardadas.':'No se pudo compartir. Usá Copiar anotaciones o Guardar copia.'}};
  actions.append(share,copy);download(actions,backup,name,'Guardar copia');article.append(actions,message,details);root.append(article);
 }
 function scan(){
  urls.forEach(url=>URL.revokeObjectURL(url));urls=[];root.replaceChildren();let found=0;
  try{
   const keys=[];for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(prefixes.some(prefix=>key.startsWith(prefix)))keys.push(key)}
   const drafts=[];
   for(const key of keys){const raw=localStorage.getItem(key);if(raw===null)continue;try{const d=JSON.parse(raw);if(!d||typeof d!=='object'||!Array.isArray(d.events))throw Error('invalid');drafts.push(d)}catch{found++;const article=node('article');article.append(node('h2','Copia que necesita revisión'),node('p','No se pudo mostrar esta copia, pero podés guardarla para recuperarla.'));download(article,raw,'chiquimafia-copia-revisar-'+found+'.txt','Guardar copia para revisar');root.append(article)}}
   drafts.sort((a,b)=>(Number(b.number)||0)-(Number(a.number)||0)||String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));drafts.forEach((d,i)=>renderDraft(d,i));found+=drafts.length;
   status.textContent=found?'Encontramos '+found+' copia(s). Elegí la fecha que anotaste y mandale la copia al administrador.':'No encontramos anotaciones en este navegador. Abrí este enlace desde el mismo navegador donde anotaste, sin usar modo incógnito. Si los datos se borraron, esta página no puede recuperarlos.';
  }catch{status.textContent='Este navegador no permite leer los datos guardados. Abrí el enlace en el navegador donde anotaste y fuera del modo incógnito.'}
 }
 document.querySelector('#recoveryRefresh').addEventListener('click',scan);scan();
})();
