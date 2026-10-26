(function(){
 'use strict';
 const $=s=>document.querySelector(s),parser=window.ChiquiVoiceParser,KEY='chiquimafia_voice_demo_v1',Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
 let goals=[],candidate=null,recognition=null,timer=null;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
 const status=(text,error=false)=>{$('#status').textContent=text;$('#status').classList.toggle('error',error)};
 try{const stored=JSON.parse(localStorage.getItem(KEY)||'[]');if(Array.isArray(stored))goals=stored.filter(g=>g&&parser.teams[g.team]?.includes(g.scorer)&&(!g.assist||parser.teams[g.team].includes(g.assist)&&g.assist!==g.scorer))}catch{$('#notice').textContent='No se pudieron leer las pruebas guardadas. Podés empezar una nueva.'}
 function renderGoals(){
  for(const team of ['white','black'])$('#'+team+'Score').textContent=goals.filter(g=>g.team===team).length;
  $('#history').innerHTML=goals.length?goals.slice(-6).reverse().map(g=>`<li><b>${esc(g.scorer.toLowerCase())}</b> · ${g.team==='white'?'Claro':'Oscuro'}<small>${g.assist?'Asistencia de '+esc(g.assist.toLowerCase()):g.decision==='none'?'Jugada sin asistencia':'Asistencia pendiente'}</small></li>`).join(''):'<li>Todavía no confirmaste ningún gol.</li>';
 }
 function renderCandidate(){
  $('#preview').hidden=!candidate;if(!candidate)return;
  $('#scorerName').textContent=candidate.scorer?.toLowerCase()||'Sin identificar';$('#teamName').textContent=candidate.team?'Equipo '+(candidate.team==='white'?'Claro':'Oscuro'):'';
  $('#assistName').textContent=candidate.assist?.toLowerCase()||(candidate.decision==='none'?'Sin asistencia':'Sin indicar');$('#assistDetail').textContent=candidate.decision==='pending'?'El pase quedaría pendiente.':'Revisá que el nombre sea correcto.';
  $('#previewError').textContent=candidate.error;$('#confirmGoal').disabled=!candidate.scorer||Boolean(candidate.error);
  $('#scorerChoices').innerHTML=Object.values(parser.teams).flat().map(name=>`<button type="button" data-scorer="${esc(name)}" aria-pressed="${candidate.scorer===name}">${esc(name.toLowerCase())}</button>`).join('');
  $('#assistChoices').innerHTML=(candidate.team?parser.teams[candidate.team].filter(name=>name!==candidate.scorer):[]).map(name=>`<button type="button" data-assist="${esc(name)}" aria-pressed="${candidate.assist===name}">${esc(name.toLowerCase())}</button>`).join('');
 }
 function stop(){if(recognition){const current=recognition;recognition=null;current.abort()}clearTimeout(timer);$('#mic').classList.remove('listening');$('#mic').textContent='🎙️ Decir un gol'}
 function interpret(){stop();const text=$('#transcript').value.trim();if(!text){candidate=null;renderCandidate();status('Decí o escribí quién hizo el gol.',true);return}candidate=parser.parse(text);$('#notice').textContent='';renderCandidate();status(candidate.error?'Revisá los nombres antes de confirmar.':'Listo para revisar. Todavía no se sumó ningún gol.',Boolean(candidate.error))}
 $('#mic').addEventListener('click',()=>{
  if(recognition){recognition.stop();return}
  if(!Recognition)return;
  candidate=null;renderCandidate();$('#transcript').value='';
  const current=new Recognition();recognition=current;current.lang='es-AR';current.interimResults=true;current.continuous=false;current.maxAlternatives=3;let received=false,failed=false;
  current.onstart=()=>{$('#mic').classList.add('listening');$('#mic').textContent='■ Terminar de hablar';status('Te escucho: «Gol de Loria, asistencia de Diego».')};
  current.onresult=e=>{if(recognition!==current)return;let text='',final=false;for(let i=0;i<e.results.length;i++){text+=e.results[i][0].transcript+' ';if(e.results[i].isFinal)final=true}$('#transcript').value=text.trim();if(final){received=true;interpret()}};
  current.onerror=e=>{
   if(recognition!==current)return;failed=true;
   const errors={'not-allowed':'El micrófono no tiene permiso. Habilitalo para esta página o escribí la frase abajo.','service-not-allowed':'Este navegador no permite el reconocimiento de voz. Probá abrir el enlace en Safari o Chrome, o escribí la frase.','audio-capture':'No se encontró un micrófono disponible.','network':'El reconocimiento no pudo conectarse. Probá con internet o escribí la frase.','no-speech':'No se escuchó una frase. Tocá el micrófono y probá de nuevo.','language-not-supported':'El navegador no reconoce este idioma. Podés escribir la frase para probar.'};status(errors[e.error]||'No se pudo reconocer la voz. Podés volver a intentar o escribir la frase.',true);
  };
  current.onend=()=>{if(recognition!==current)return;recognition=null;clearTimeout(timer);$('#mic').classList.remove('listening');$('#mic').textContent='🎙️ Decir un gol';if(!received&&!failed)status('No quedó una frase completa. Podés volver a intentar o revisar el texto que apareció.',true)};
  try{current.start();timer=setTimeout(()=>{if(recognition===current)current.stop()},15000)}catch{stop();status('No se pudo abrir el micrófono. Abrí el enlace en Safari o Chrome y revisá el permiso del micrófono.',true)}
 });
 $('#interpret').addEventListener('click',interpret);
 document.querySelectorAll('[data-example]').forEach(button=>button.addEventListener('click',()=>{$('#transcript').value=button.dataset.example;interpret()}));
 $('#transcript').addEventListener('input',()=>{candidate=null;renderCandidate()});
 $('#scorerChoices').addEventListener('click',e=>{const name=e.target.closest('[data-scorer]')?.dataset.scorer;if(!candidate||!name)return;candidate={scorer:name,team:Object.keys(parser.teams).find(team=>parser.teams[team].includes(name)),assist:null,decision:'pending',error:''};renderCandidate()});
 $('#assistChoices').addEventListener('click',e=>{const name=e.target.closest('[data-assist]')?.dataset.assist;if(!candidate||!name)return;Object.assign(candidate,{assist:name,decision:'assigned',error:''});renderCandidate()});
 function noPass(decision){if(!candidate)return;candidate.assist=null;candidate.decision=decision;if(candidate.scorer)candidate.error='';renderCandidate()}
 $('#noAssist').addEventListener('click',()=>noPass('none'));$('#laterAssist').addEventListener('click',()=>noPass('pending'));
 $('#discardGoal').addEventListener('click',()=>{candidate=null;renderCandidate();status('Anotación descartada. No se sumó al marcador.')});
 $('#confirmGoal').addEventListener('click',()=>{
  if(!candidate?.scorer||candidate.error)return;
  const saved={...candidate,id:crypto.randomUUID?.()||String(Date.now()),at:new Date().toISOString()},next=[...goals,saved];
  try{localStorage.setItem(KEY,JSON.stringify(next))}catch{status('No se pudo guardar la prueba en este navegador. El gol no se sumó.',true);return}
  goals=next;candidate=null;$('#transcript').value='';renderCandidate();renderGoals();$('#notice').textContent='✓ Gol de '+saved.scorer.toLowerCase()+' sumado solo a esta prueba.';status('Podés probar otro gol con el micrófono.');
 });
 $('#clearDemo').addEventListener('click',()=>{stop();try{localStorage.removeItem(KEY)}catch{status('No se pudo borrar el guardado de esta prueba.',true);return}goals=[];candidate=null;$('#transcript').value='';renderCandidate();renderGoals();$('#notice').textContent='Prueba borrada. El torneo real no se modificó.'});
 window.addEventListener('pagehide',stop);renderGoals();
 if(!Recognition){$('#mic').disabled=true;status('Este navegador no ofrece reconocimiento de voz. Probá abrir el enlace en Safari o Chrome; mientras tanto podés escribir o tocar una frase de ejemplo.',true)}
})();
