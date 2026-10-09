(function(){
 'use strict';
 const $=selector=>document.querySelector(selector),esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
 let matches=[],records=[],current=null,voter='',candidate='',submitted=false,sending=false,timer=null,sequence=0,refreshing=false;
 const key=name=>ChiquiSheets.key(name),localKey=()=>`${ChiquiGoals.isPreview?.()?'chiquimafia_mvp_preview:':'chiquimafia_mvp_identity:'}${current?.number}:${String(current?.date).slice(0,10)}`;
 const record=()=>records.find(r=>Number(r.matchNumber)===current?.number),now=()=>ChiquiGoals.serverTime();
 const phase=()=>{const r=record();return !r?'unavailable':r.closed||now()>=Date.parse(r.closesAt)?'closed':now()<Date.parse(r.opensAt)?'scheduled':'open'};
 const date=value=>new Date(value).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires',weekday:'long',hour:'2-digit',minute:'2-digit',day:'numeric',month:'short'});
 function message(text,error=false){$('#mvpVoteMessage').textContent=text;$('#mvpVoteMessage').className='form-message'+(error?' error':' success')}
 function remember(){try{localStorage.setItem(localKey(),JSON.stringify({voter,submitted,candidate:submitted?candidate:''}))}catch{}}
 function restore(){voter='';candidate='';submitted=false;try{const saved=JSON.parse(localStorage.getItem(localKey())||'null');if(saved&&[...current.white,...current.black].some(p=>key(p)===key(saved.voter))){voter=saved.voter;submitted=Boolean(saved.submitted);candidate=submitted?saved.candidate:''}}catch{}}
 function teamColumns(identity=false){
  if(!current)return '<p>No hay equipos disponibles.</p>';
  return ['white','black'].map(team=>`<section class="mvp-team ${team==='black'?'mvp-team-dark':''}"><h4>${team==='white'?'⚪ Equipo Blanco':'⚫ Equipo Negro'}</h4><div>${current[team].map((player,index)=>{
   const selected=key(player)===key(candidate),own=voter&&key(player)===key(voter),disabled=!identity&&(own||phase()!=='open'||submitted||sending);
   return `<button type="button" style="--player-order:${index}" class="mvp-player${selected&&!identity?' selected':''}" data-team="${team}" data-index="${index}"${disabled?' disabled':''}${!identity?` aria-label="Elegir a ${esc(player)} como MVP" aria-pressed="${Boolean(selected)}"`:''}><strong>${esc(player)}</strong><span>${identity?'Soy yo':own?'Vos':selected?'✓':'+'}</span></button>`;
  }).join('')}</div></section>`).join('');
 }
 let rosterSignature='';
 function renderTeams(){
  const node=$('#mvpCandidateTeams'),signature=JSON.stringify(current&&[current.number,current.date,current.white,current.black]);
  if(signature!==rosterSignature){node.innerHTML=teamColumns();rosterSignature=signature}
  const progress=new Map((record()?.voteProgress||[]).map(row=>[key(row.player),Number(row.share)]));
  node.querySelectorAll('button[data-team]').forEach(button=>{
   const player=current[button.dataset.team][Number(button.dataset.index)],selected=key(player)===key(candidate),own=voter&&key(player)===key(voter),share=Math.max(0,Math.min(1,progress.get(key(player))||0));
   button.classList.toggle('selected',selected);button.classList.toggle('has-vote-progress',share>0);button.style.setProperty('--vote-share',`${share*100}%`);
   button.disabled=Boolean(own||phase()!=='open'||submitted||sending);button.setAttribute('aria-pressed',String(selected));button.querySelector('span').textContent=own?'Vos':selected?'✓':'+';
  });
 }
 const awardsSignature=()=>JSON.stringify(records.map(r=>[r.matchNumber,r.closed,r.mvpAwards,r.scorerAwards]));
 function panelVisible(){const box=$('#mvpVotingPanel').getBoundingClientRect();return box.bottom>0&&box.top<innerHeight}
 function clock(){
  const r=record(),state=phase(),node=$('#mvpWindowStatus');
  node.dataset.phase=state;$('#mvpVotingDialog').dataset.phase=state;
  if(!r){node.textContent='La votación estará disponible cuando se publique el partido.';return}
  if(state==='scheduled')node.textContent=`Abre ${date(r.opensAt)} · Hora de Argentina`;
  else if(state==='closed')node.textContent=r.closed?`Votación cerrada · ${date(r.closesAt)}`:'Votación cerrada · Actualizando el resultado…';
  else {const diff=Date.parse(r.closesAt)-now(),hours=Math.floor(diff/3600000),minutes=Math.floor(diff%3600000/60000);node.textContent=`Votación abierta · Quedan ${hours} h ${minutes} min · Cierra ${date(r.closesAt)}`}
 }
 function render(){
  clock();renderTeams();$('#mvpVoterName').textContent=voter?`Votás como ${voter}`:'Elegí tu nombre para votar';
  $('#mvpChooseVoter').textContent=voter?'Cambiar nombre':'Soy…';$('#mvpChooseVoter').disabled=!current||phase()!=='open'||sending;
  
  const showConfirm=Boolean(candidate&&!submitted&&phase()==='open');$('#mvpConfirmation').hidden=!showConfirm;$('#mvpTapHint').hidden=showConfirm||submitted||phase()==='closed';
  $('#mvpConfirmTitle').textContent=`¿Confirmás tu voto por ${candidate}?`;
  $('#mvpMatchSelect').disabled=sending;$('#mvpConfirmVote').disabled=!voter||sending;$('#mvpChangeChoice').disabled=sending;
  const r=record(),closed=phase()==='closed'&&r?.closed;$('#mvpClosedResult').hidden=!closed;
  if(closed){const awards=r.mvpAwards||[];$('#mvpClosedResult').innerHTML='<h4>MVP del partido</h4>'+(awards.length?awards.map(a=>`<div><strong>${esc(a.player)}</strong><b>+${Number(a.points).toLocaleString('es-AR',{maximumFractionDigits:3})} ${a.points===1?'punto':'puntos'}</b></div>`).join(''):'<p>No hubo votos dentro del plazo. Esta fecha queda sin premio de MVP.</p>')+`<p>${Number(r.voteCount||0)} votos recibidos · Resultado publicado</p>`}
  if(submitted)message(`✓ Tu voto por ${candidate} ya está registrado. No necesita aprobación.`);
 }
 async function loadSelected(){
  current=matches.find(m=>String(m.number)===$('#mvpMatchSelect').value)||null;candidate='';submitted=false;voter='';if(current)restore();message('');render();$('#mvpCandidateTeams').classList.add('mvp-enter');setTimeout(()=>$('#mvpCandidateTeams').classList.remove('mvp-enter'),700);
 }
 async function refresh(){
  if(refreshing||sending||document.hidden)return;refreshing=true;
  try{const previous=awardsSignature();records=await ChiquiGoals.matchRecords(true);render();if(previous!==awardsSignature())window.dispatchEvent(new Event('chiqui:voting-updated'));if(!$('#adminPanel').hidden)await renderAdmin()}catch{if(phase()==='closed')message('No se pudo consultar el resultado. Se actualizará cuando vuelva la conexión.',true)}finally{refreshing=false}
 }
 async function init(items){
  if(!ChiquiGoals.supportsVoting())return;
  $('#legacyGoalSubmission').hidden=true;$('#mvpVotingPanel').hidden=false;$('#votingNav').textContent='Votación de MVP';$('#votingTitle').textContent='Votación de MVP';$('#votingEyebrow').textContent='ELEGÍ AL MEJOR DEL PARTIDO';
  matches=items.filter(m=>m.white?.length&&m.black?.length).map(m=>({...m})).sort((a,b)=>b.number-a.number);
  const previous=$('#mvpMatchSelect').value;records=await ChiquiGoals.matchRecords();
  $('#mvpMatchSelect').innerHTML=matches.map(m=>`<option value="${m.number}">Fecha ${m.number}</option>`).join('');
  const open=matches.find(m=>{const r=records.find(r=>Number(r.matchNumber)===m.number);return r&&!r.closed&&now()<Date.parse(r.closesAt)}),fallback=open||matches.find(m=>m.played)||matches[0];
  $('#mvpMatchSelect').value=matches.some(m=>String(m.number)===previous)?previous:String(fallback?.number||'');await loadSelected();
  if(timer)clearInterval(timer);timer=setInterval(()=>{const old=$('#mvpWindowStatus').dataset.phase;clock();if(old!==phase())render();if(old!=='closed'&&phase()==='closed')refresh();else if(panelVisible()||!$('#adminPanel').hidden)refresh()},30000);
 }
 async function confirmVote(){
  if(sending||!voter||!candidate||submitted||phase()!=='open')return;
  sending=true;render();message('Registrando tu voto…');
  try{const saved=await ChiquiGoals.voteMvp({matchNumber:current.number,player:voter,candidate});submitted=true;candidate=saved.candidate||candidate;remember();message(`✓ Tu voto por ${candidate} ya está registrado. No necesita aprobación.`);try{records=await ChiquiGoals.matchRecords(true)}catch{}if(!$('#adminPanel').hidden)await renderAdmin()}
  catch(error){message(error.message,true)}finally{sending=false;render();}
 }
 let adminSequence=0;
 async function renderAdmin(){
  const token=++adminSequence,pin=sessionStorage.getItem('chiqui_admin_pin');if(!pin||$('#adminPanel').hidden)return;
  const [rows,all,legacy,awards]=await Promise.all([ChiquiGoals.matchRecords(),ChiquiGoals.mvpVotes(pin),ChiquiGoals.list(),ChiquiGoals.mvpAwards()]);if(token!==adminSequence)return;
  const select=$('#voteMatch'),previous=select.value,rounds=[...new Set([...matches.map(m=>m.number),...rows.map(r=>Number(r.matchNumber))])].sort((a,b)=>b-a);
  select.innerHTML=rounds.map(n=>`<option value="${n}">Fecha ${n}</option>`).join('');select.value=rounds.includes(Number(previous))?previous:String(rows.find(r=>!r.closed)?.matchNumber||rounds[0]||'');
  const r=rows.find(r=>Number(r.matchNumber)===Number(select.value)),votes=r?all.filter(v=>Number(v.matchNumber)===Number(select.value)):legacy.filter(v=>Number(v.matchNumber)===Number(select.value)&&v.mvpVote&&v.status!=='rejected').map(v=>({player:v.player,candidate:v.mvpVote})),totals=new Map();votes.forEach(v=>{const id=key(v.candidate),row=totals.get(id)||{player:v.candidate,count:0};row.count++;totals.set(id,row)});
  $('#pendingCount').textContent='Votos registrados automáticamente';$('#voteDateSummary').textContent=r?`Fecha ${r.matchNumber} · ${votes.length} votos · ${r.closed?'Cerrada':'Cierra '+date(r.closesAt)}`:'Esta fecha conserva sus votos anteriores; no tiene una votación automática.';
  $('#mvpVoteResults').innerHTML=(!ChiquiGoals.automationReady()?'<p class="form-message error">Falta activar el cierre automático: ejecutá setupTournamentAutomation en Apps Script.</p>':'')+(!r&&awards.some(a=>Number(a.matchNumber)===Number(select.value))?'<div class="official-mvp">MVP histórico: '+awards.filter(a=>Number(a.matchNumber)===Number(select.value)).map(a=>esc(a.player)).join(' y ')+'</div>':'')+(r?.closed?'<div class="official-mvp">'+((r.mvpAwards||[]).map(a=>`<span>MVP: <strong>${esc(a.player)}</strong> · +${Number(a.points).toLocaleString('es-AR',{maximumFractionDigits:3})} pts</span>`).join('')||'Sin votos: no se asignó un MVP.')+'</div>':'')+([...totals.values()].sort((a,b)=>b.count-a.count).map((row,i)=>`<div class="vote-row"><span>${i+1}</span><strong>${esc(row.player)}</strong><b>${row.count} ${row.count===1?'voto':'votos'}</b></div>`).join('')||'<p class="empty-state">Todavía no hay votos para esta fecha.</p>')+`<details class="mvp-private-votes"><summary>Ver quién votó a quién (${votes.length})</summary>${votes.map(v=>`<p><strong>${esc(v.player)}</strong> → ${esc(v.candidate)}</p>`).join('')}</details>`+(r?`<p class="admin-help">Goleador: ${(r.scorerAwards||[]).map(a=>`${esc(a.player)} (+${Number(a.points).toLocaleString('es-AR',{maximumFractionDigits:3})} pts)`).join(' · ')||'Sin premio de goleador'}</p>`:'');
  const section=$('.admin-voting');[...section.children].filter(e=>e!==section.querySelector('.vote-summary')).forEach(e=>e.hidden=true);select.onchange=()=>renderAdmin().catch(error=>{$('#voteDateSummary').textContent=error.message});
 }
 $('#mvpMatchSelect').addEventListener('change',()=>{if(!sending)loadSelected()});
 $('#mvpCandidateTeams').addEventListener('click',e=>{const button=e.target.closest('button[data-team]');if(!button||button.disabled||sending)return;candidate=current[button.dataset.team][Number(button.dataset.index)];message(voter?'':'Elegí tu nombre para confirmar el voto.');render();});
 $('#mvpChooseVoter').addEventListener('click',()=>{if(!current)return;$('#mvpVoterTeams').innerHTML=teamColumns(true);$('#mvpVoterDialog').hidden=false;$('#mvpVoterDialog').scrollIntoView({behavior:'smooth',block:'nearest'})});
 $('#mvpVoterTeams').addEventListener('click',e=>{const button=e.target.closest('button[data-team]');if(!button)return;voter=current[button.dataset.team][Number(button.dataset.index)];submitted=false;if(key(voter)===key(candidate))candidate='';remember();$('#mvpVoterDialog').hidden=true;message('');render()});
 $('#mvpCloseVoter').addEventListener('click',()=>$('#mvpVoterDialog').hidden=true);$('#mvpChangeChoice').addEventListener('click',()=>{candidate='';render()});$('#mvpConfirmVote').addEventListener('click',confirmVote);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&current&&(panelVisible()||phase()==='closed'&&!record()?.closed))refresh()});
 window.ChiquiVoting={init,renderAdmin,refresh};
})();
