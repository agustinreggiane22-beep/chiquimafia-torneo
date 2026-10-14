(()=>{'use strict';
const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const white=['LORIA','DIEGO','FRANCO','MATU','VALEN','DARIO','BILLO','JOACOREGGI'],black=['LUCAS','PABLO','GONZA','AUGUSTO','LIHUEL','AGUS','LAUTY','KEVIN'];
const players=[{name:'JOACOREGGI',points:6.25,goals:4,assists:2,mvp:1,form:['Victoria','Victoria'],badge:'👑 Nuevo líder',color:'gold'},{name:'FRANCO',points:6,goals:4,assists:1,mvp:1,form:['Victoria','Victoria'],badge:'↑ Subió 3 puestos',color:''},{name:'LORIA',points:4.25,goals:3,assists:3,mvp:0,form:['Empate','Victoria'],badge:'🔥 Mejor racha',color:'green'},{name:'DIEGO',points:4,goals:3,assists:2,mvp:0,form:['Victoria','Derrota']},{name:'LUCAS',points:3,goals:4,assists:0,mvp:0,form:['Empate','Derrota']}];
const storageKey='chiquimafia-demo-features-goals-v1';let events=[],pending=null,storageAvailable=true;
try{const saved=JSON.parse(localStorage.getItem(storageKey)||'[]');if(Array.isArray(saved))events=saved.filter(e=>['white','black'].includes(e.team)&&(e.team==='white'?white:black).includes(e.player)&&(!e.assist||(e.team==='white'?white:black).includes(e.assist)&&e.assist!==e.player)).map(e=>({...e,assist:e.assist||null}))}catch{storageAvailable=false}
const number=v=>Number(v).toLocaleString('es-AR',{maximumFractionDigits:2});
function persist(){try{localStorage.setItem(storageKey,JSON.stringify(events));storageAvailable=true}catch{storageAvailable=false}updateStatus()}
function updateStatus(){$('#draftStatus').textContent=events.length?`${events.length} goles de prueba guardados${storageAvailable?' en este celular.':' solo mientras esta página siga abierta.'}`:'Sin goles de prueba todavía.';$('#scoreStatus').textContent=storageAvailable?'Guardado en este celular · solo prueba':'El navegador no permite guardar. Mantené esta página abierta.'}
$('#demoStandings').innerHTML=players.map((p,i)=>`<tr><td><span class="rank ${i===0?'first':''}">${i+1}</span></td><td><button class="player-name" data-profile="${i}" aria-label="Ver ficha de ${p.name}">${p.name}</button>${p.badge?`<span class="badge ${p.color}">${p.badge}</span>`:''}</td><td class="points">${number(p.points)}</td></tr>`).join('');
$('#demoStandings').addEventListener('click',e=>{const button=e.target.closest('[data-profile]');if(!button)return;const i=Number(button.dataset.profile),p=players[i];$('#profileContent').innerHTML=`<h2>${p.name}</h2><span class="profile-place">Puesto ${i+1} · datos de ejemplo</span><div class="profile-points">${number(p.points)}<small>puntos</small></div><div class="profile-stats">${[['⚽',p.goals,'goles'],['🤝',p.assists,'asistencias'],['⭐',p.mvp,'MVP'],['📅',p.form.length,'partidos']].map(([icon,value,label])=>`<div><span>${icon}</span><strong>${value}<small>${label}</small></strong></div>`).join('')}</div><p class="hint">Últimas fechas</p><div class="form-chips">${p.form.map(f=>`<span class="${f==='Empate'?'draw':f==='Derrota'?'loss':''}">${f}</span>`).join('')}</div>`;$('#playerDialog').showModal()});
for(const dialog of document.querySelectorAll('dialog')){dialog.querySelector('.close').onclick=()=>dialog.close();dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}})}
$('.close-profile').onclick=()=>$('#playerDialog').close();
function renderScore(){
 const counts=team=>events.filter(e=>e.team===team).length;$('#scoreValue').textContent=`${counts('white')} — ${counts('black')}`;
 $('#teamLists').innerHTML=[['white',white,'⚪ Equipo Claro'],['black',black,'Equipo Oscuro ⚫']].map(([team,list,title])=>`<div class="team-column ${team==='black'?'dark':''}"><h3>${title}</h3>${list.map(player=>`<div class="goal-row"><b>${player}</b><button data-team="${team}" data-scorer="${player}" aria-label="Anotar gol de ${player}">+</button></div>`).join('')}</div>`).join('');
 $('#goalHistory').innerHTML=[...events].reverse().map(e=>`<li><b>${esc(e.player)}</b> · ${e.team==='white'?'Claro':'Oscuro'} · ${e.assist?'Pase de '+esc(e.assist):e.decision==='pending'?'Asistencia pendiente':'Sin asistencia'}</li>`).join('')||'<li>Todavía no anotaste goles.</li>';
 $('#undoGoal').disabled=events.length===0;updateStatus();
 const event=events.find(e=>e.id===pending);$('#assistPanel').hidden=!event;$('#teamLists').hidden=Boolean(event);
 if(event){$('#assistTitle').textContent='GOL DE '+event.player+' · ¿QUIÉN ASISTIÓ?';$('#assistChoices').innerHTML=(event.team==='white'?white:black).filter(p=>p!==event.player).map(p=>`<button data-assister="${p}">${p}</button>`).join('')}
}
$('#openScore').onclick=()=>{pending=events.find(e=>e.decision==='pending')?.id||null;renderScore();$('#scoreDialog').showModal()};
$('#teamLists').addEventListener('click',e=>{const b=e.target.closest('[data-scorer]');if(!b)return;const id=globalThis.crypto?.randomUUID?.()||Date.now()+'-'+Math.random();events.push({id,player:b.dataset.scorer,team:b.dataset.team,assist:null,decision:'pending'});pending=id;persist();renderScore();$('#assistPanel').scrollIntoView({block:'nearest'})});
function assist(player){const event=events.find(e=>e.id===pending);if(!event)return;event.assist=player;event.decision=player?'assigned':'solo';pending=null;persist();renderScore()}
$('#assistChoices').addEventListener('click',e=>{const b=e.target.closest('[data-assister]');if(b)assist(b.dataset.assister)});$('#soloGoal').onclick=()=>assist(null);
$('#undoGoal').onclick=()=>{events.pop();pending=null;persist();renderScore()};
$('#resetDemo').onclick=()=>{events=[];pending=null;persist();renderScore();$('#draftStatus').textContent='Se borraron únicamente los goles de esta prueba.'};
$('#doneScore').onclick=()=>$('#scoreDialog').close();
renderScore();
})();
