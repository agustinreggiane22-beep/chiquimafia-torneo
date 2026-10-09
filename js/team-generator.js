(function(){
  'use strict';
  const PROFILE_KEY='chiquimafia_team_profiles_v1',DETAILS_KEY='chiquimafia_match_image_details_v1';
  let backgroundPromise,preparedImage;
  const $=selector=>document.querySelector(selector);
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  const roles={goalkeeper:'Arquero',defender:'Defensor',midfielder:'Volante',forward:'Delantero',utility:'Polifuncional'};
  let profiles={},guests=[],teams={white:[],black:[]};

  function readProfiles(){try{return JSON.parse(localStorage.getItem(PROFILE_KEY)||'{}')}catch{return{}}}
  function writeProfiles(){localStorage.setItem(PROFILE_KEY,JSON.stringify(profiles))}
  function names(){return[...new Set([...document.querySelectorAll('#playerOptions option')].map(option=>option.value).filter(Boolean).concat(guests))].sort((a,b)=>a.localeCompare(b))}
  function playerData(name){const row=$(`.generator-player[data-name="${CSS.escape(name)}"]`);return{name,role:row?.querySelector('.generator-role').value||profiles[name]?.role||'utility',level:Number(row?.querySelector('.generator-level').value||profiles[name]?.level||3)}}
  function renderRoster(){const roster=$('#generatorRoster');if(!roster)return;roster.innerHTML=names().map(name=>{const saved=profiles[name]||{role:'utility',level:3};return`<label class="generator-player" data-name="${esc(name)}"><input class="generator-check" type="checkbox"><strong>${esc(name)}</strong><select class="generator-role">${Object.entries(roles).map(([value,label])=>`<option value="${value}"${saved.role===value?' selected':''}>${label}</option>`).join('')}</select><select class="generator-level" aria-label="Nivel de ${esc(name)}">${[1,2,3,4,5].map(level=>`<option value="${level}"${Number(saved.level)===level?' selected':''}>Nivel ${level}</option>`).join('')}</select></label>`}).join('');roster.onchange=event=>{const row=event.target.closest('.generator-player');if(!row||(!event.target.matches('.generator-role')&&!event.target.matches('.generator-level')))return;profiles[row.dataset.name]={role:row.querySelector('.generator-role').value,level:Number(row.querySelector('.generator-level').value)};writeProfiles()}}
  function teamScore(team){const total=team.reduce((sum,p)=>sum+p.level,0),counts={};team.forEach(p=>counts[p.role]=(counts[p.role]||0)+1);return{total,counts}}
  function cost(white,black){const a=teamScore(white),b=teamScore(black);let value=Math.abs(a.total-b.total)*12+Math.abs(white.length-black.length)*50;for(const role of Object.keys(roles))value+=Math.abs((a.counts[role]||0)-(b.counts[role]||0))*(role==='goalkeeper'?18:5);return value}
  function shuffle(items){const copy=[...items];for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]]}return copy}
  function balance(players){let best=null;for(let attempt=0;attempt<5000;attempt++){const mixed=shuffle(players),cut=Math.ceil(mixed.length/2),white=mixed.slice(0,cut),black=mixed.slice(cut),score=cost(white,black);if(!best||score<best.score)best={white,black,score};if(score===0)break}return best}
  function renderTeams(){hideImageActions();const wrap=$('#generatedTeams');wrap.hidden=$('#teamBuildMode').value==='manual';const render=(team,target,side)=>{$(target).innerHTML=team.map((p,index)=>`<div class="generated-player"><span><b>${esc(p.name)}</b> <small>${roles[p.role]} · N${p.level}</small></span><button type="button" data-swap="${side}" data-index="${index}" title="Cambiar de equipo">↔</button></div>`).join('')};render(teams.white,'#generatedWhite','white');render(teams.black,'#generatedBlack','black');$('#whiteStrength').textContent=`Nivel ${teamScore(teams.white).total}`;$('#blackStrength').textContent=`Nivel ${teamScore(teams.black).total}`;$('#generatorMessage').textContent=`Diferencia de nivel: ${Math.abs(teamScore(teams.white).total-teamScore(teams.black).total)}.`}
  function loadSavedTeams(match){
    const selected=[...match.white,...match.black];
    guests=[...new Set(guests.concat(selected.filter(name=>!names().includes(name))))];
    renderRoster();
    teams={white:match.white.map(playerData),black:match.black.map(playerData)};
    document.querySelectorAll('.generator-player').forEach(row=>{row.querySelector('.generator-check').checked=selected.includes(row.dataset.name)});
    $('#generatorMatch').value=match.number;
    const raw=String(match.date||''),parts=raw.split('/');
    $('#generatorDate').value=/^\d{4}-\d{2}-\d{2}/.test(raw)?raw.slice(0,10):(parts.length===3?`${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`:'');
    restoreImageDetails();
    $('#teamsShareCanvas').hidden=true;
    copyToLineup();renderTeams();
    $('#generatorMessage').className='form-message success';
    $('#generatorMessage').textContent=`Fecha ${match.number} cargada. Ya podés descargar la imagen o modificar los equipos.`;
  }
  function copyToLineup(){
    const fill=(selector,players)=>{const container=$(selector);while(container.children.length<players.length){const input=container.firstElementChild.cloneNode();input.placeholder=`Jugador ${container.children.length+1} o invitado`;input.setAttribute('aria-label',`Jugador ${container.children.length+1} del Equipo ${selector==='#whiteSelectors'?'Claro':'Oscuro'}`);container.appendChild(input)}[...container.querySelectorAll('.lineup-player')].forEach((input,index)=>input.value=players[index]?.name||'')};
    fill('#whiteSelectors',teams.white);fill('#blackSelectors',teams.black);
  }
  function readManualTeams(){
    const read=selector=>[...document.querySelectorAll(`${selector} .lineup-player`)].map(input=>input.value.trim()).filter(Boolean).map(playerData);
    teams={white:read('#whiteSelectors'),black:read('#blackSelectors')};renderTeams();
  }
  function changeBuildMode(){const manual=$('#teamBuildMode').value==='manual';$('#manualTeamFields').hidden=!manual;$('#balancedTeamFields').hidden=manual;if(manual){copyToLineup();readManualTeams()}else{const selected=teams.white.concat(teams.black).map(p=>p.name);guests=[...new Set(guests.concat(selected.filter(name=>!names().includes(name))))];renderRoster();document.querySelectorAll('.generator-player').forEach(row=>{row.querySelector('.generator-check').checked=selected.includes(row.dataset.name)});renderTeams()}$('#generatorMessage').textContent=manual?'Elegí los jugadores de cada equipo y guardá el partido.':'Marcá los jugadores para generar equipos parejos.'}
  async function publish(){
    if($('#teamBuildMode').value==='manual')readManualTeams();
    const msg=$('#generatorMessage'),matchNumber=Number($('#generatorMatch').value),date=$('#generatorDate').value,pin=sessionStorage.getItem('chiqui_admin_pin'),button=$('#publishGeneratedTeams');
    const fail=text=>{msg.className='form-message error';msg.textContent=text};
    if(!teams.white.length||!teams.black.length){fail('Completá ambos equipos antes de guardar.');return}
    if(!Number.isInteger(matchNumber)||matchNumber<1||!date){fail('Completá un número de partido válido y el día.');return}
    const names=teams.white.concat(teams.black).map(p=>ChiquiSheets.key(p.name));if(new Set(names).size!==names.length){fail('Hay un jugador repetido. Cada jugador debe aparecer una sola vez.');return}
    button.disabled=true;
    try{await ChiquiGoals.saveLineup({matchNumber,date,white:teams.white.map(p=>p.name),black:teams.black.map(p=>p.name)},pin);copyToLineup();msg.className='form-message success';msg.textContent='✓ Equipos guardados y publicados. Ya podés compartir la imagen.'}catch(error){fail(error.message)}finally{button.disabled=false}
  }
  function imageDetails(){try{return JSON.parse(localStorage.getItem(DETAILS_KEY)||'{}')}catch{return{}}}
  function restoreImageDetails(){const details=imageDetails()[$('#generatorMatch').value]||{};$('#generatorTime').value=details.time??'18:00';$('#generatorVenue').value=details.venue??'El Más Grande'}
  function saveImageDetails(){const details=imageDetails();details[$('#generatorMatch').value]={time:$('#generatorTime').value,venue:$('#generatorVenue').value.trim()};try{localStorage.setItem(DETAILS_KEY,JSON.stringify(details))}catch{}}
  function loadBackground(){if(!backgroundPromise)backgroundPromise=new Promise(resolve=>{const image=new Image(),timer=setTimeout(()=>resolve(null),12000);image.onload=()=>{clearTimeout(timer);resolve(image)};image.onerror=()=>{clearTimeout(timer);resolve(null)};image.src='assets/match-red-background.webp'});return backgroundPromise}
  function imageSignature(){return JSON.stringify({teams,number:$('#generatorMatch').value,date:$('#generatorDate').value,time:$('#generatorTime').value,venue:$('#generatorVenue').value.trim()})}
  function hideImageActions(){$('#imageExportActions').hidden=true;$('#teamsSharePreview').hidden=true}
  function downloadPreparedImage(){const link=$('#saveTeamsImage');link.click();$('#generatorMessage').className='form-message success';$('#generatorMessage').textContent='Descarga solicitada. Si no se guarda, tocá «Compartir imagen» o «Abrir imagen».'}
  async function sharePreparedImage(){
    const message=$('#generatorMessage');
    if(!preparedImage||preparedImage.signature!==imageSignature()){await shareImage(false);if(preparedImage&&preparedImage.signature===imageSignature())message.textContent='Imagen preparada. Tocá «Compartir imagen» para elegir WhatsApp u otra aplicación.';return}
    try{
      const files=[preparedImage.file];
      if(!navigator.share||!navigator.canShare||!navigator.canShare({files})){message.textContent='Este navegador no permite compartir archivos directamente. Tocá «Descargar imagen» o «Abrir imagen» y guardala desde ahí.';return}
      // Invoke from this button click while the browser still has user activation.
      await navigator.share({files});
      message.className='form-message success';message.textContent='Imagen compartida.';
    }catch(error){if(error.name==='AbortError'){message.textContent='Compartir cancelado. La imagen sigue lista para guardar.';return}message.className='form-message error';message.textContent='No se pudo compartir. Tocá «Descargar imagen» o «Abrir imagen» para guardarla.'}
  }
  async function shareImage(download=true){
    const message=$('#generatorMessage');
    if($('#teamBuildMode').value==='manual')readManualTeams();
    if(!teams.white.length||!teams.black.length){message.className='form-message error';message.textContent='Elegí la fecha y tocá «Cargar equipos ya guardados» o generá nuevos equipos antes de descargar.';return}
    const button=download?$('#downloadTeamsImage'):$('#previewTeamsImage');button.disabled=true;
    try{
      saveImageDetails();
      const background=await loadBackground(),canvas=$('#teamsShareCanvas'),ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,date=$('#generatorDate').value,number=$('#generatorMatch').value,time=$('#generatorTime').value,venue=$('#generatorVenue').value.trim();
      const panel=(x,y,width,height,r,fill)=>{ctx.beginPath();ctx.roundRect(x,y,width,height,r);ctx.fillStyle=fill;ctx.fill()};
      const text=(value,x,y,size,color,maxWidth,weight=800)=>{ctx.fillStyle=color;ctx.font=`${weight} ${size}px Arial`;while(ctx.measureText(value).width>maxWidth&&size>13){size--;ctx.font=`${weight} ${size}px Arial`}ctx.fillText(value,x,y,maxWidth)};
      ctx.clearRect(0,0,w,h);ctx.fillStyle='#101010';ctx.fillRect(0,0,w,h);
      if(background){const scale=Math.max(w/background.width,h/background.height);ctx.drawImage(background,(w-background.width*scale)/2,(h-background.height*scale)/2,background.width*scale,background.height*scale)}
      ctx.fillStyle='rgba(0,0,0,.16)';ctx.fillRect(0,0,w,h);
      ctx.textAlign='center';text('EL TORNEO DEL BARRIO',w/2,83,23,'#bcbcbc',900,600);
      text('CHIQUIMAFIA',w/2,166,74,'#fff',960,900);
      panel(416,199,248,51,3,'#c7202c');text(`FECHA ${number}`,w/2,235,29,'#fff',220);
      ctx.fillStyle='#ffffff20';ctx.fillRect(98,288,884,1);
      panel(500,331,80,67,3,'#cf222e');text('VS',w/2,379,35,'#fff',70,900);
      text('EQUIPO CLARO',278,378,34,'#fff',370,900);text('EQUIPO OSCURO',806,378,34,'#fff',370,900);
      ctx.fillStyle='#b92c3480';ctx.fillRect(539,432,2,650);
      const drawTeam=(team,left)=>{
        const rowHeight=Math.min(80,650/Math.max(8,team.length));
        team.forEach((player,index)=>{
          const y=470+index*rowHeight;
          ctx.textAlign=left?'right':'left';text(player.name,left?456:624,y,35,'#fff',348,900);
          text(roles[player.role],left?456:624,y+27,18,'#a6a6a6',348,500);
          ctx.textAlign=left?'left':'right';text(String(index+1).padStart(2,'0'),left?478:602,y,25,'#bdbdbd',38,500);
        });
      };
      drawTeam(teams.white,true);drawTeam(teams.black,false);
      ctx.textAlign='center';ctx.fillStyle='#ffffff25';ctx.fillRect(98,1110,884,1);
      const formattedDate=date?new Intl.DateTimeFormat('es-AR',{weekday:'long',day:'numeric',month:'long'}).format(new Date(date+'T12:00:00')):'Día a confirmar';
      text(formattedDate.toUpperCase()+(time?` · ${time} HS`:''),w/2,1169,29,'#fff',940);
      text(venue||'Lugar a confirmar',w/2,1212,28,'#c6c6c6',940,500);
      text('NOS VEMOS EN LA CANCHA',w/2,1290,22,'#e9555e',900);
      const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('No se pudo crear el archivo PNG.')),'image/png'));
      const filename=`chiquimafia-fecha-${number||'proxima'}.png`,file=new File([blob],filename,{type:'image/png'}),url=URL.createObjectURL(file),oldUrl=preparedImage?.url;
      preparedImage={file,url,signature:imageSignature()};
      $('#teamsSharePreview').src=url;$('#teamsSharePreview').hidden=false;
      $('#saveTeamsImage').href=url;$('#saveTeamsImage').download=filename;$('#openTeamsImage').href=url;$('#imageExportActions').hidden=false;
      if(oldUrl)setTimeout(()=>URL.revokeObjectURL(oldUrl),60000);
      message.className='form-message success';message.textContent='Vista previa lista. Podés guardar el PNG o compartir la imagen.';
      if(download)downloadPreparedImage();
    }catch(error){message.className='form-message error';message.textContent='No se pudo preparar la imagen. '+error.message}finally{button.disabled=false}
  }
  function init(){if(!$('#generatorRoster'))return;if(!document.querySelector('#playerOptions option')){setTimeout(init,500);return}profiles=readProfiles();renderRoster();$('#teamBuildMode').onchange=changeBuildMode;$('#manualTeamFields').addEventListener('input',readManualTeams);$('#addGeneratorGuest').onclick=()=>{const input=$('#generatorGuest'),name=input.value.trim();if(!name)return;if(!guests.some(x=>x.toLowerCase()===name.toLowerCase()))guests.push(name);input.value='';renderRoster();const row=[...document.querySelectorAll('.generator-player')].find(x=>x.dataset.name===name);if(row)row.querySelector('.generator-check').checked=true};$('#balanceTeams').onclick=()=>{const selected=[...document.querySelectorAll('.generator-player')].filter(row=>row.querySelector('.generator-check').checked).map(row=>playerData(row.dataset.name));if(selected.length<2){$('#generatorMessage').className='form-message error';$('#generatorMessage').textContent='Elegí por lo menos dos jugadores.';return}teams=balance(selected);copyToLineup();renderTeams()};$('#generatedTeams').onclick=event=>{const button=event.target.closest('[data-swap]');if(!button)return;const from=button.dataset.swap,to=from==='white'?'black':'white',index=Number(button.dataset.index);teams[to].push(teams[from].splice(index,1)[0]);copyToLineup();renderTeams()};$('#publishGeneratedTeams').onclick=publish;restoreImageDetails();$('#generatorMatch').addEventListener('change',restoreImageDetails);$('#generatorTime').addEventListener('change',saveImageDetails);$('#generatorVenue').addEventListener('change',saveImageDetails);$('#previewTeamsImage').onclick=()=>shareImage(false);$('#downloadTeamsImage').onclick=()=>{if(preparedImage&&preparedImage.signature===imageSignature())downloadPreparedImage();else shareImage(true)};$('#shareTeamsImage').onclick=sharePreparedImage;['#generatorMatch','#generatorDate','#generatorTime','#generatorVenue'].forEach(selector=>$(selector).addEventListener('input',hideImageActions))}
  window.addEventListener('chiqui:load-generator-lineup',event=>loadSavedTeams(event.detail));
  window.addEventListener('chiqui:players-changed',()=>{renderRoster()});
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
