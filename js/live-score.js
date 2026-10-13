(function(){
 'use strict';
 const $=selector=>document.querySelector(selector),dialog=$('#liveScoreDialog');
 if(!dialog)return;
 const PREFIX='chiquimafia_live_score_v1:',esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
 let matches=[],current=null,draft=null,wakeLock=null,assistEvent=null;
 const authorized=()=>!$('#adminPanel').hidden&&Boolean(sessionStorage.getItem('chiqui_admin_pin'));
 const key=match=>PREFIX+match.number+':'+String(match.date||'sin-fecha').slice(0,10);
 const score=value=>value.events.reduce((total,event)=>(total[event.team]++,total),{white:0,black:0});
 const message=(text,error=false)=>{const node=$('#liveScoreMessage');node.textContent=text;node.classList.toggle('error',error)};
 const event=(team,player='')=>({id:crypto.randomUUID?.()||Date.now()+'-'+Math.random(),team,player,assist:null,assistDecision:'pending',at:new Date().toISOString()});
 function fresh(match){
  const events=[];
  if(match.played){const ledger=window.ChiquiGoals?.savedGoalEvents?.(match.number);if(ledger){events.push(...ledger);return{version:1,number:match.number,date:match.date,white:[...match.white],black:[...match.black],events,published:true,updatedAt:new Date().toISOString()}}const official=window.ChiquiGoals?.savedScorers?.(match.number);if(official&&['white','black'].every(team=>official.filter(x=>x.team===team).reduce((sum,x)=>sum+Number(x.goals||0),0)===Number(match[team+'Goals']||0))){official.forEach(x=>{for(let i=0;i<x.goals;i++)events.push(event(x.team,x.player))})}else for(const team of ['white','black'])for(let i=0;i<Number(match[team+'Goals']||0);i++)events.push(event(team));}
  return{version:1,number:match.number,date:match.date,white:[...match.white],black:[...match.black],events,published:Boolean(match.played),updatedAt:new Date().toISOString()};
 }
 function read(match){
  const raw=localStorage.getItem(key(match));if(!raw)return null;
  const saved=JSON.parse(raw);
  if(saved.version!==1||Number(saved.number)!==match.number||!Array.isArray(saved.white)||!Array.isArray(saved.black)||!Array.isArray(saved.events)||!saved.white.every(p=>typeof p==='string')||!saved.black.every(p=>typeof p==='string')||!saved.events.every(e=>e&&['white','black'].includes(e.team)&&typeof e.player==='string'))throw new Error('Las anotaciones guardadas no se pudieron leer. Podés reiniciarlas desde “Opciones del partido”.');
  return saved;
 }
 function save(next){next.updatedAt=new Date().toISOString();localStorage.setItem(key(current),JSON.stringify(next));draft=next;}
 function errorText(error){return error instanceof SyntaxError?'Las anotaciones guardadas no se pudieron leer. Podés reiniciarlas desde “Opciones del partido”.':error.message?.startsWith('Las anotaciones')?error.message:'No se pudo guardar en este celular. El gol no se agregó. Revisá que el navegador permita guardar datos e intentá de nuevo.';}
 function render(){
  const available=Boolean(draft),totals=available?score(draft):{white:0,black:0};
  $('#liveWhiteScore').textContent=totals.white;$('#liveBlackScore').textContent=totals.black;
  $('#liveUndo').disabled=!available||!draft.events.length||draft.published;
  $('#liveReview').disabled=!available;$('#liveReopen').hidden=!draft?.published;
  $('#liveScoreSaveStatus').textContent=available?(draft.published?'Resultado publicado · anotaciones guardadas':(navigator.onLine?'':'Sin conexión · ')+'Guardado en este celular'):'Sin anotaciones disponibles';
  for(const team of ['white','black']){
   const list=available?draft[team]:[],counts=available?draft.events.filter(e=>e.team===team).reduce((map,e)=>(map[e.player]=(map[e.player]||0)+1,map),{}):{};
   $('#live'+(team==='white'?'White':'Black')+'Players').innerHTML=list.map((player,index)=>`<button type="button" class="live-player" data-team="${team}" data-index="${index}"${draft.published?' disabled':''}><span>${esc(player)}</span><b>${counts[player]||0}</b><i aria-hidden="true">+1</i></button>`).join('')+(available?`<button type="button" class="live-unknown" data-team="${team}" data-unknown="true"${draft.published?' disabled':''}>Gol sin identificar <b>${counts['']||0}</b></button>`:'');
  }
  const last=draft?.events.at(-1);$('#liveLastGoal').textContent=last?`Último gol: ${last.player||'sin identificar'} · ${last.team==='white'?'Claro':'Oscuro'}${last.assist?' · Pase: '+last.assist:''}`:'Tocá al jugador que hizo el gol.';
  $('#liveGoalHistory').innerHTML=draft?.events.length?[...draft.events].reverse().map((e,i)=>`<li><span>${draft.events.length-i}. ${esc(e.player||'Sin identificar')} · ${e.team==='white'?'Claro':'Oscuro'}${ChiquiGoals.supportsAssists()?`<small>Pase: ${esc(e.assist||(e.assistDecision==='none'?'Sin asistencia':'Pendiente'))}</small>`:''}</span>${e.player&&!draft.published&&(ChiquiGoals.supportsAssists())?`<button type="button" data-assist-event="${esc(e.id)}">${e.assist||e.assistDecision==='none'?'Editar pase':'Agregar pase'}</button>`:''}${!e.player&&!draft.published&&ChiquiGoals.supportsVoting()?`<select class="live-goal-assignment" data-assign-event="${esc(e.id)}" aria-label="Asignar jugador al gol ${draft.events.length-i}"><option value="">Asignar goleador</option>${draft[e.team].map((p,index)=>`<option value="${index}">${esc(p)}</option>`).join('')}</select>`:''}</li>`).join(''):'<li>Todavía no se anotaron goles.</li>';
 }
 function loadSelected(){
  assistEvent=null;$('#liveAssistPanel').hidden=true;
  current=matches.find(m=>String(m.number)===$('#liveMatchSelect').value);draft=null;
  if(!current){render();return}
  try{
   draft=read(current);if(!draft)save(fresh(current));
   const changed=JSON.stringify(draft.white)!==JSON.stringify(current.white)||JSON.stringify(draft.black)!==JSON.stringify(current.black);
   const totals=score(draft),officialChanged=current.played&&(totals.white!==Number(current.whiteGoals)||totals.black!==Number(current.blackGoals));
   message(changed?'Los equipos cambiaron. Se conservan los jugadores y goles de tus anotaciones; para usar los equipos nuevos, reiniciá desde “Opciones del partido”.':officialChanged?'El resultado oficial es distinto de estas anotaciones. Se conserva tu registro local; revisalo antes de volver a publicar.':current.played&&!draft.published?'Este partido ya tiene un resultado oficial. Revisá tus anotaciones antes de volver a publicarlo.':'');
  }catch(error){message(errorText(error),true)}
  render();
 }
 function setMatches(items){
  const previous=$('#liveMatchSelect').value;
  matches=items.filter(m=>Number.isInteger(Number(m.number))&&Number(m.number)>0&&m.white?.length&&m.black?.length).map(m=>({...m,number:Number(m.number),white:[...m.white],black:[...m.black]})).sort((a,b)=>a.number-b.number);
  $('#liveMatchSelect').innerHTML=matches.map(m=>`<option value="${m.number}">Fecha ${m.number}${m.played?' · Resultado publicado':' · A disputar'}</option>`).join('');
  const fallback=matches.find(m=>!m.played)||matches.at(-1);
  $('#liveMatchSelect').value=matches.some(m=>String(m.number)===previous)?previous:String(fallback?.number||'');
  $('#openLiveScore').disabled=!matches.length;$('#liveScoreAvailability').hidden=Boolean(matches.length);
  if(dialog.open)loadSelected();
 }
 async function keepAwake(){
  if(!dialog.open||document.visibilityState!=='visible'||!navigator.wakeLock?.request||wakeLock)return;
  try{const lock=await navigator.wakeLock.request('screen');if(!dialog.open){await lock.release();return}wakeLock=lock;lock.addEventListener('release',()=>{if(wakeLock===lock)wakeLock=null})}catch{}
 }
 function open(){if(!authorized()||!matches.length)return;loadSelected();dialog.showModal();document.body.classList.add('live-score-open');keepAwake();}
 function close(){if(dialog.open)dialog.close();}
 function chooseAssist(id){
  if(!authorized()||!draft||draft.published||!ChiquiGoals.supportsAssists())return;
  const goal=draft.events.find(e=>e.id===id);if(!goal?.player)return;assistEvent=id;
  $('#liveAssistTitle').textContent='Gol de '+goal.player+' · ¿Quién dio el pase?';
  $('#liveAssistChoices').innerHTML=draft[goal.team].filter(p=>ChiquiSheets.key(p)!==ChiquiSheets.key(goal.player)).map((p,index)=>`<button type="button" data-assist-index="${index}">${esc(p)}</button>`).join('');
  $('#liveAssistPanel').hidden=false;$('#liveAssistPanel').scrollIntoView({block:'nearest'});
 }
 function assignAssist(player){
  if(!authorized()||!draft||draft.published||!assistEvent)return;
  try{const latest=read(current)||draft,goal=latest.events.find(e=>e.id===assistEvent);if(!goal||latest.published)return;
   if(player&&(!latest[goal.team].includes(player)||ChiquiSheets.key(player)===ChiquiSheets.key(goal.player)))throw new Error('Pase inválido');
   save({...latest,events:latest.events.map(e=>e.id===goal.id?{...e,assist:player||null,assistDecision:player?'assigned':'none'}:e)});
   assistEvent=null;$('#liveAssistPanel').hidden=true;render();message(player?'Pase de '+player+' guardado.':'Gol guardado sin asistencia.');
  }catch(error){message(errorText(error),true)}
 }
 function add(team,player){
  if(!authorized()||!draft||draft.published)return;
  try{const latest=read(current)||draft;if(latest.published){draft=latest;render();return}if(player&&!latest[team].includes(player))throw new Error('Jugador inválido');const goal=event(team,player);save({...latest,events:[...latest.events,goal]});message('Gol guardado.');render();chooseAssist(goal.id)}catch(error){message(errorText(error),true)}
 }
 function undo(){
  if(!authorized()||!draft||draft.published)return;
  try{const latest=read(current)||draft;if(!latest.events.length||latest.published)return;save({...latest,events:latest.events.slice(0,-1)});assistEvent=null;$('#liveAssistPanel').hidden=true;message('Último gol y su pase deshechos.');render()}catch(error){message(errorText(error),true)}
 }
 function renderReview(saved){
  const totals=score(saved),goals=saved.events.reduce((map,e)=>{const id=e.team+'\u0000'+e.player;const row=map.get(id)||{team:e.team,player:e.player,count:0};row.count++;map.set(id,row);return map},new Map());
  $('#liveScoreReview').hidden=false;$('#liveScoreReview p').textContent=ChiquiGoals.supportsVoting()?'Al publicar se actualizan los goles'+(ChiquiGoals.supportsAssists()?' y las asistencias. Los máximos goleadores y asistidores reciben cada uno un premio total de 0,5, dividido si hay empate. Los pases pendientes no cuentan.':'. El goleador recibe 0,5, dividido si hay empate.')+' Los jugadores solo votan al MVP.':'Estas anotaciones se guardan en este celular. Los goles de las estadísticas y los votos MVP se revisan en las declaraciones del partido.';
  $('#liveScoreReviewTitle').textContent=`Anotaciones de la fecha ${saved.number} · Claro ${totals.white}–${totals.black} Oscuro`;
  $('#liveScoreReviewPlayers').innerHTML=[...goals.values()].map(row=>`<li><span>${esc(row.player||'Sin identificar')} · ${row.team==='white'?'Claro':'Oscuro'}</span><b>${row.count}</b></li>`).join('')||'<li>Sin goles anotados.</li>';
 }
 function review(){
  if(!authorized()||!draft)return;
  if(ChiquiGoals.supportsVoting()&&draft.events.some(e=>!e.player)){message('Hay goles sin identificar. Abrí “Opciones del partido” y asigná el goleador a cada gol antes de publicar.',true);$('#liveGoalHistory').closest('details').open=true;$('#liveGoalHistory').scrollIntoView({block:'nearest'});return}
  const totals=score(draft);
  $('#resultMatch').value=draft.number;$('#resultWhite').value=totals.white;$('#resultBlack').value=totals.black;
  renderReview(draft);close();
  $('#resultMessage').className='form-message';$('#resultMessage').textContent='Marcador cargado desde tus anotaciones. Revisalo y tocá “Publicar resultado” para confirmarlo.';
  $('#resultForm').scrollIntoView({behavior:'smooth',block:'center'});$('#resultWhite').focus({preventScroll:true});
 }
 function restart(){
  if(!authorized()||!current||!confirm('¿Borrar las anotaciones de este partido en este celular y empezar de cero? El resultado oficial no se modifica.'))return;
  try{save({...fresh({...current,played:false}),published:false});assistEvent=null;$('#liveAssistPanel').hidden=true;message('Anotaciones reiniciadas.');render()}catch(error){message(errorText(error),true)}
 }
 function reopen(){
  if(!authorized()||!draft||!confirm('¿Volver a editar estas anotaciones? Después deberás revisar y publicar el resultado para cambiar el marcador oficial.'))return;
  try{save({...draft,published:false});message('Podés volver a anotar o deshacer goles.');render()}catch(error){message(errorText(error),true)}
 }
 function noteOfficialResult(match){
  const found=matches.find(m=>Number(m.number)===Number(match.matchNumber));if(!found)return;
  try{const saved=read(found);if(!saved)return;const totals=score(saved);if(totals.white!==Number(match.whiteGoals)||totals.black!==Number(match.blackGoals))return;const next={...saved,published:true,updatedAt:new Date().toISOString()};localStorage.setItem(key(found),JSON.stringify(next));if(current&&key(found)===key(current)){draft=next;render()}renderReview(next)}catch{}
 }
 $('#openLiveScore').addEventListener('click',open);$('#closeLiveScore').addEventListener('click',close);
 $('#liveMatchSelect').addEventListener('change',loadSelected);$('#liveUndo').addEventListener('click',undo);$('#liveReview').addEventListener('click',review);$('#liveReset').addEventListener('click',restart);$('#liveReopen').addEventListener('click',reopen);
 $('#livePlayers').addEventListener('click',e=>{const button=e.target.closest('button[data-team]');if(!button||button.disabled||!draft)return;const team=button.dataset.team,player=button.dataset.unknown?'':draft[team][Number(button.dataset.index)];if(typeof player==='string')add(team,player)});
 dialog.addEventListener('close',()=>{document.body.classList.remove('live-score-open');const lock=wakeLock;wakeLock=null;lock?.release().catch(()=>{})});
 document.addEventListener('visibilitychange',keepAwake);
 window.addEventListener('storage',e=>{if(dialog.open&&current&&e.key===key(current))loadSelected()});
 new MutationObserver(()=>{if(!authorized())close()}).observe($('#adminPanel'),{attributes:true,attributeFilter:['hidden']});
 function scorersForResult(match,whiteGoals,blackGoals){
  const saved=read(match);if(!saved)return null;
  if(saved.events.some(e=>!e.player))throw new Error('Hay goles sin identificar. Asigná cada goleador desde Opciones del partido.');
  const totals=score(saved);if(totals.white!==whiteGoals||totals.black!==blackGoals)throw new Error('El resultado no coincide con tus anotaciones. Corregí los goles desde el marcador en vivo y volvé a revisar.');
  const rows=new Map();saved.events.forEach(e=>{const id=e.team+'\u0000'+ChiquiSheets.key(e.player),row=rows.get(id)||{player:e.player,team:e.team,goals:0};row.goals++;rows.set(id,row)});return [...rows.values()];
 }
 $('#liveGoalHistory').addEventListener('change',e=>{const select=e.target.closest('select[data-assign-event]');if(!select||!authorized()||!draft||draft.published||select.value==='')return;try{const latest=read(current)||draft,goal=latest.events.find(x=>x.id===select.dataset.assignEvent);if(!goal||latest.published)return;const player=latest[goal.team][Number(select.value)];if(!player)return;save({...latest,events:latest.events.map(x=>x.id===goal.id?{...x,player,assist:x.assist===player?null:x.assist,assistDecision:x.assist===player?'pending':x.assistDecision}:x)});message('Goleador asignado y guardado.');render()}catch(error){message(errorText(error),true)}});
 function goalEventsForResult(match,whiteGoals,blackGoals){
  if(!ChiquiGoals.supportsAssists())return null;
  scorersForResult(match,whiteGoals,blackGoals);const saved=read(match);return saved?JSON.parse(JSON.stringify(saved.events)):null;
 }
 $('#liveAssistChoices').addEventListener('click',e=>{const button=e.target.closest('[data-assist-index]'),goal=draft?.events.find(x=>x.id===assistEvent);if(!button||!goal)return;const candidates=draft[goal.team].filter(p=>ChiquiSheets.key(p)!==ChiquiSheets.key(goal.player));assignAssist(candidates[Number(button.dataset.assistIndex)])});
 $('#liveSoloGoal').addEventListener('click',()=>assignAssist(null));
 $('#liveAssistLater').addEventListener('click',()=>{assistEvent=null;$('#liveAssistPanel').hidden=true;message('El gol sigue guardado. Podés agregar el pase después desde Opciones del partido.')});
 $('#liveGoalHistory').addEventListener('click',e=>{const button=e.target.closest('[data-assist-event]');if(button)chooseAssist(button.dataset.assistEvent)});
 window.addEventListener('online',render);window.addEventListener('offline',render);
 window.ChiquiLiveScore={goalEventsForResult,scorersForResult,setMatches,noteOfficialResult};
})();
