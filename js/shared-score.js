(function(){
 'use strict';
 const $=s=>document.querySelector(s),PREFIX='chiquimafia_shared_score_v1:';
 let session=null,token='',pending=[],rejection='',callbacks={},busy=false,lastEvents='';
 const id=()=>crypto.randomUUID?.()||Date.now()+'-'+Math.random().toString(36).slice(2);
 const active=()=>Boolean(session&&token);
 const localKey=()=>PREFIX+token;
 const matchKey=match=>PREFIX+'match:'+match.number+':'+String(match.date).slice(0,10);
 const hasAdmin=()=>!$('#adminPanel').hidden&&Boolean(sessionStorage.getItem('chiqui_admin_pin'));
 function persist(){localStorage.setItem(localKey(),JSON.stringify({session,token,pending}));localStorage.setItem(matchKey({number:session.matchNumber,date:session.date}),token)}
 function optimistic(){
  if(!session)return null;
  const next=JSON.parse(JSON.stringify(session));
  if(next.closed)return next;
  for(const op of pending){
   if(op.type==='add'){if(!next.events.some(e=>e.id===op.event.id))next.events.push({...op.event,revision:0});continue}
   const index=next.events.findIndex(e=>e.id===op.eventId);if(index<0)continue;const goal=next.events[index];
   if(op.type==='remove')next.events.splice(index,1);
   else if(op.type==='assist')Object.assign(goal,{assist:op.player||null,assistDecision:op.player?'assigned':'none',revision:goal.revision+1});
   else if(op.type==='assign')Object.assign(goal,{player:op.player,assist:goal.assist===op.player?null:goal.assist,assistDecision:goal.assist===op.player?'pending':goal.assistDecision,revision:goal.revision+1});
  }
  return next;
 }
 function status(){
  if(!active())return;
  const text=rejection?'Cambio pendiente de revisión':!navigator.onLine?'Sin conexión · '+pending.length+' cambio(s) pendientes':pending.length?'Sincronizando · '+pending.length+' cambio(s) pendientes':busy?'Comprobando cambios…':session.closed?'Resultado publicado · anotador cerrado':'Compartido · sincronizado';
  $('#sharedSyncStatus').textContent=text;$('#sharedResolve').hidden=!rejection;$('#sharedResolve').title=rejection;
  $('#sharedCopyLink').hidden=!hasAdmin();$('#sharedLink').hidden=!hasAdmin();
  callbacks.status?.(text);
 }
 function emit(force=false){
  const snapshot=optimistic(),signature=JSON.stringify([snapshot.events,snapshot.closed]);
  if(force||signature!==lastEvents){lastEvents=signature;callbacks.snapshot?.(snapshot)}
  status();
 }
 async function request(action,payload){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
  try{
   const response=await fetch(window.CHIQUI_CONFIG.goalsApiUrl,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,...payload}),signal:controller.signal});
   if(!response.ok)throw Error('No se pudo conectar. Las anotaciones siguen guardadas en este celular.');
   const result=await response.json();if(result.ok===false){const error=Error(result.error||'No se pudo guardar el cambio.');error.rejected=true;throw error}return result;
  }finally{clearTimeout(timer)}
 }
 function activate(sharedToken,remote){
  token=sharedToken;session=remote;pending=[];rejection='';
  const saved=localStorage.getItem(localKey());if(saved){const parsed=JSON.parse(saved);if(Array.isArray(parsed.pending))pending=parsed.pending}
  persist();$('#sharedSessionBar').hidden=false;$('#sharedLink').value=new URL('?anotar='+encodeURIComponent(token),location.href).href;$('#sharedReentry').hidden=false;emit(true);
 }
 async function join(sharedToken){
  const saved=localStorage.getItem(PREFIX+sharedToken);
  if(saved&&!navigator.onLine){const parsed=JSON.parse(saved);activate(sharedToken,parsed.session);return}
  try{const result=await request('getLiveSession',{token:sharedToken});activate(sharedToken,result.session);await sync()}catch(error){if(!saved)throw error;activate(sharedToken,JSON.parse(saved).session);callbacks.error?.('Se recuperaron las anotaciones guardadas. Falta conexión para sincronizar.')}
 }
 async function create(match,draft){
  if(!hasAdmin())return;
  const result=await request('createLiveSession',{pin:sessionStorage.getItem('chiqui_admin_pin'),item:{matchNumber:match.number,events:draft.events}});
  const remoteIds=new Set(result.session.events.map(e=>e.id));
  if(draft.events.some(e=>!remoteIds.has(e.id))){
   if(!confirm('Ya hay un anotador compartido para este partido. ¿Abrir sus anotaciones? Se conservará una copia de las anotaciones de este celular.'))return;
   localStorage.setItem(PREFIX+'copia-local:'+match.number+':'+Date.now(),JSON.stringify(draft));
  }
  activate(result.token,result.session);await sync();
 }
 function enqueue(operation){
  if(!active()||session.closed)throw Error('El anotador compartido ya está cerrado.');
  const op={...operation,id:id()};pending.push(op);
  try{persist()}catch(error){pending.pop();throw error}
  emit();sync();
 }
 async function sync(){
  if(!active()||busy||!navigator.onLine)return;
  busy=true;status();
  try{
   if(rejection){const result=await request('getLiveSession',{token});session=result.session;persist();emit();return}
   while(pending.length){
    const op=pending[0],result=await request('applyLiveOperation',{token,operation:op});
    session=result.session;pending.shift();persist();emit();
   }
   const result=await request('getLiveSession',{token});session=result.session;persist();emit();
  }catch(error){
   if(error.rejected&&pending.length){rejection=error.message;callbacks.error?.(error.message+' El cambio sigue guardado para revisar.');}
   else if(error.rejected)callbacks.error?.(error.message);
   else callbacks.error?.('No se pudo sincronizar. Tus anotaciones siguen guardadas; se reintentará al recuperar conexión.');
  }finally{busy=false;status()}
 }
 function canPublish(){return active()&&!pending.length&&!busy&&!rejection&&!session.closed&&navigator.onLine}
 function restore(match){
  if(active())return false;
  const savedToken=localStorage.getItem(matchKey(match));if(!savedToken)return false;
  const saved=localStorage.getItem(PREFIX+savedToken);if(!saved)return false;
  activate(savedToken,JSON.parse(saved).session);sync();return true;
 }
 function detach(){session=null;token='';pending=[];rejection='';lastEvents='';$('#sharedSessionBar').hidden=true;$('#sharedReentry').hidden=true}
 $('#sharedCopyLink').addEventListener('click',async()=>{
  const field=$('#sharedLink');try{await navigator.clipboard.writeText(field.value);$('#sharedSyncStatus').textContent='Enlace copiado: mandáselo a la otra persona.'}catch{field.hidden=false;field.focus();field.select();$('#sharedSyncStatus').textContent='Seleccioná y copiá el enlace para compartirlo.'}
 });
 $('#sharedSync').addEventListener('click',sync);
 $('#sharedResolve').addEventListener('click',()=>{
  if(!rejection||!confirm(rejection+' ¿Aceptar la versión compartida para este cambio? Se conservará una copia del cambio rechazado en este celular.'))return;
  const backup=JSON.parse(localStorage.getItem(localKey()+':rechazados')||'[]');backup.push({operation:pending[0],reason:rejection});localStorage.setItem(localKey()+':rechazados',JSON.stringify(backup));pending.shift();rejection='';persist();emit();sync();
 });
 window.addEventListener('online',()=>{status();sync()});window.addEventListener('offline',status);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')sync()});
 setInterval(()=>{if(active()&&$('#liveScoreDialog').open&&document.visibilityState==='visible')sync()},4000);
 window.ChiquiSharedScore={active,create,join,enqueue,sync,canPublish,restore,detach,updateStatus:status,snapshot:optimistic,pendingCount:()=>pending.length,closed:()=>Boolean(session?.closed),init:handlers=>{callbacks=handlers}};
})();
