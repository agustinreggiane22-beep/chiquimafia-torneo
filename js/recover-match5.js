(function(){
 'use strict';
 const $=s=>document.querySelector(s),key=window.ChiquiSheets.key;
 let recovered=null,ready=false,busy=false,completed=false;
 const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e};
 const list=value=>Array.isArray(value)?value:JSON.parse(value||'[]');
 function showCopy(){
  const totals=new Map();
  for(const e of recovered.goalEvents){if(!totals.has(e.player))totals.set(e.player,{goals:0,assists:0});totals.get(e.player).goals++;if(e.assist){if(!totals.has(e.assist))totals.set(e.assist,{goals:0,assists:0});totals.get(e.assist).assists++}}
  const table=node('table'),head=node('tr');for(const title of ['Jugador','Goles','Asist.'])head.append(node('th',title));table.append(head);
  for(const [name,t] of [...totals].sort((a,b)=>b[1].goals-a[1].goals||a[0].localeCompare(b[0]))){const row=node('tr');row.append(node('td',name),node('td',t.goals),node('td',t.assists));table.append(row)}
  $('#f5Recovered').replaceChildren(table);$('#f5Events').replaceChildren(...recovered.goalEvents.map(e=>node('li',(e.team==='white'?'Claro':'Oscuro')+' · '+e.player+' · Pase: '+(e.assist||(e.assistDecision==='none'?'Sin asistencia':'Pendiente')))));
 }
 async function getState(){
  const api=String(window.CHIQUI_CONFIG.goalsApiUrl||'');if(!api)throw Error('No está configurada la conexión con el torneo.');
  const response=await fetch(api+(api.includes('?')?'&':'?')+'mode=state&t='+Date.now(),{cache:'no-store'});if(!response.ok)throw Error('No se pudo conectar con Google. Revisá la conexión y tocá Volver a comprobar.');const state=await response.json();if(state.ok===false)throw Error(state.error||'El torneo no respondió correctamente.');window.ChiquiGoals.seedState(state);return state;
 }
 function prepare(state){
  const lineup=(state.lineups||[]).find(m=>Number(m.matchNumber)===5);if(!lineup)throw Error('La fecha 5 no tiene equipos guardados. Primero guardalos desde el administrador.');
  const teams={white:list(lineup.white),black:list(lineup.black)};$('#f5Teams').replaceChildren(...[['white','Equipo Claro'],['black','Equipo Oscuro']].map(([side,title])=>{const div=node('div');div.append(node('strong',title),node('p',teams[side].join('\n')));return div}));
  const existing=(state.results||[]).find(m=>Number(m.matchNumber)===5&&m.played!==false&&String(m.played)!=='false');
  if(existing){const record=(state.matchRecords||[]).find(m=>Number(m.matchNumber)===5),events=record?.goalEvents||[];const same=Number(existing.whiteGoals)===21&&Number(existing.blackGoals)===17&&events.length===38&&events.every((e,i)=>e.id===recovered.goalEvents[i].id&&key(e.player)===key(recovered.goalEvents[i].player)&&key(e.assist||'')===key(recovered.goalEvents[i].assist||''));if(same){completed=true;return null}throw Error('La fecha 5 ya tiene un resultado publicado. No se va a reemplazar desde esta recuperación. Mandá una captura de este aviso para revisar la corrección.');}
  if(!window.ChiquiGoals.supportsVoting()||!window.ChiquiGoals.supportsAssists())throw Error('El registro de Google necesita la versión que guarda goles y asistencias. No se publicó ningún cambio.');
  const all=[...teams.white,...teams.black].map(key);if(new Set(all).size!==all.length)throw Error('Hay jugadores repetidos en los equipos guardados. Corregilos desde el administrador antes de publicar.');
  const issues=new Set(),scorers=new Map(),goalEvents=[];
  for(const e of recovered.goalEvents){
   const player=teams[e.team].find(name=>key(name)===key(e.player));if(!player)issues.add(e.player+' debe estar en Equipo '+(e.team==='white'?'Claro':'Oscuro')+' según las capturas.');
   const assist=e.assist?teams[e.team].find(name=>key(name)===key(e.assist)):null;if(e.assist&&!assist)issues.add(e.assist+' dio un pase en Equipo '+(e.team==='white'?'Claro':'Oscuro')+' y no figura ahí.');
   if(player){const id=key(player),row=scorers.get(id)||{player,team:e.team,goals:0};row.goals++;scorers.set(id,row)}
   goalEvents.push({id:e.id,team:e.team,player:player||e.player,assist:assist||null,assistDecision:e.assistDecision});
  }
  if(issues.size)throw Error('Los equipos guardados no coinciden con las anotaciones:\n'+[...issues].join('\n')+'\nRevisá los equipos en el administrador y volvé a comprobar. No se modificó ningún equipo ni resultado.');
  const totals=goalEvents.reduce((t,e)=>(t[e.team]++,t),{white:0,black:0});if(goalEvents.length!==38||totals.white!==21||totals.black!==17||new Set(goalEvents.map(e=>e.id)).size!==38)throw Error('La copia no coincide con los 38 goles del 21–17. No se publicó ningún cambio.');
  return {matchNumber:5,whiteGoals:21,blackGoals:17,scorers:[...scorers.values()],goalEvents};
 }
 async function check(){ready=false;$('#f5Publish').disabled=true;$('#f5Status').className='';$('#f5Status').textContent='Comprobando los equipos…';try{const item=prepare(await getState());ready=Boolean(item);$('#f5Status').className='success';$('#f5Status').textContent=completed?'La copia recuperada ya está publicada.':'Los equipos y las 38 anotaciones coinciden. Podés revisar y publicar.';$('#f5Publish').disabled=!ready||busy||completed}catch(error){$('#f5Status').className='error';$('#f5Status').textContent=error.message||'No se pudo conectar con Google. Volvé a comprobar.'}}
 $('#f5Reload').onclick=()=>{if(!busy&&recovered)check()};
 $('#f5Form').onsubmit=async event=>{event.preventDefault();if(!ready||busy||completed)return;busy=true;$('#f5Publish').disabled=true;$('#f5Done').className='';$('#f5Done').textContent='Comprobando antes de publicar…';try{const state=await getState(),item=prepare(state);if(completed){$('#f5Done').textContent='La fecha 5 ya quedó publicada con esta copia.';return}const pin=$('#f5Pin').value;if(!await window.ChiquiGoals.authenticate(pin))throw Error('La contraseña del administrador no es correcta.');$('#f5Done').textContent='Publicando la fecha 5…';const saved=await window.ChiquiGoals.saveResult(item,pin);if(Number(saved.matchNumber)!==5||Number(saved.whiteGoals)!==21||Number(saved.blackGoals)!==17)throw Error('El registro devolvió otro resultado. Revisalo en el torneo.');completed=true;ready=false;$('#f5Pin').value='';$('#f5Done').className='success';$('#f5Done').textContent='Fecha 5 publicada: Claro 21–17 Oscuro, con los 38 goles y sus asistencias registradas. Ya podés volver al torneo.'}catch(error){$('#f5Done').className='error';$('#f5Done').textContent=(error.message||'No se pudo conectar con Google.')+' La copia recuperada sigue disponible.'}finally{busy=false;$('#f5Publish').disabled=completed||!ready}};
 (async()=>{try{const response=await fetch('data/recuperacion-fecha5.json',{cache:'no-store'});if(!response.ok)throw Error('No se pudo cargar la copia de las capturas.');recovered=await response.json();if(recovered.matchNumber!==5||!Array.isArray(recovered.goalEvents))throw Error('La copia no corresponde a la fecha 5.');showCopy();await check()}catch(error){$('#f5Status').className='error';$('#f5Status').textContent=error.message||'No se pudo cargar la copia.'}})();
})();
