(function(){
  'use strict';
  const PROFILE_KEY='chiquimafia_team_profiles_v1',DETAILS_KEY='chiquimafia_match_image_details_v1';
  let backgroundPromise,preparedImage;
  const $=selector=>document.querySelector(selector);
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  const roles={goalkeeper:'Arquero',defender:'Defensor',midfielder:'Volante',forward:'Delantero',utility:'Polifuncional'};
  const levelLabels={1:'Malo',3:'Bueno',5:'Excelente'};
  const categoryLevel=value=>Number(value)<=2?1:Number(value)>=4?5:3;
  let profiles={},guests=[],teams={white:[],black:[]},pickerTarget=null;

  function readProfiles(){try{return JSON.parse(localStorage.getItem(PROFILE_KEY)||'{}')}catch{return{}}}
  function writeProfiles(){localStorage.setItem(PROFILE_KEY,JSON.stringify(profiles))}
  function names(){return[...new Set([...document.querySelectorAll('#playerOptions option')].map(option=>option.value).filter(Boolean).concat(guests))].sort((a,b)=>a.localeCompare(b))}
  function playerData(name){const row=$(`.generator-player[data-name="${CSS.escape(name)}"]`);return{name,role:row?.querySelector('.generator-role').value||profiles[name]?.role||'utility',level:categoryLevel(row?.querySelector('.generator-level').value||profiles[name]?.level||3)}}
  function renderRoster(){
    const roster=$('#generatorRoster');if(!roster)return;
    const checked=new Set([...roster.querySelectorAll('.generator-player')].filter(row=>row.querySelector('.generator-check').checked).map(row=>ChiquiSheets.key(row.dataset.name)));
    roster.innerHTML=names().map((name,index)=>{
      const saved=profiles[name]||{role:'utility',level:3},level=categoryLevel(saved.level);
      return `<article class="generator-player" data-name="${esc(name)}"><label class="generator-player-name"><input class="generator-check" type="checkbox"${checked.has(ChiquiSheets.key(name))?' checked':''}><strong>${esc(name)}</strong></label><label class="generator-position"><span>Posición</span><select class="generator-role" aria-label="Posición de ${esc(name)}">${Object.entries(roles).map(([value,label])=>`<option value="${value}"${saved.role===value?' selected':''}>${label}</option>`).join('')}</select></label><label class="generator-skill"><span>Nivel</span><select class="generator-level" aria-label="Nivel de ${esc(name)}" data-level="${level}">${[1,3,5].map(value=>`<option value="${value}"${level===value?' selected':''}>${levelLabels[value]}</option>`).join('')}</select></label></article>`;
    }).join('');
    const update=event=>{
      const row=event.target.closest('.generator-player');if(!row||(!event.target.matches('.generator-role')&&!event.target.matches('.generator-level')))return;
      const input=row.querySelector('.generator-level'),level=Number(input.value);
      input.dataset.level=String(level);
      profiles[row.dataset.name]={role:row.querySelector('.generator-role').value,level};writeProfiles();
    };
    roster.oninput=update;roster.onchange=update;
  }
  function teamScore(team){const total=team.reduce((sum,p)=>sum+p.level,0),counts={};team.forEach(p=>counts[p.role]=(counts[p.role]||0)+1);return{total,counts}}
  function cost(white,black){const a=teamScore(white),b=teamScore(black);let value=Math.abs(a.total-b.total)*12+Math.abs(white.length-black.length)*50;for(const role of Object.keys(roles))value+=Math.abs((a.counts[role]||0)-(b.counts[role]||0))*(role==='goalkeeper'?18:5);return value}
  function shuffle(items){const copy=[...items];for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]]}return copy}
  function balance(players){let best=null;for(let attempt=0;attempt<5000;attempt++){const mixed=shuffle(players),cut=Math.ceil(mixed.length/2),white=mixed.slice(0,cut),black=mixed.slice(cut),score=cost(white,black);if(!best||score<best.score)best={white,black,score};if(score===0)break}return best}
  function currentDuel(){return window.ChiquiGoals?.duelForMatch(Number($('#generatorMatch').value))}
  function isCaptain(name){const duel=currentDuel();return Boolean(duel&&[duel.whitePlayer,duel.blackPlayer].some(player=>ChiquiSheets.key(player)===ChiquiSheets.key(name)))}
  function captainBadges(){const duel=currentDuel();for(const [side,player] of [['white',duel?.whitePlayer],['black',duel?.blackPlayer]]){const badge=$('#'+side+'CaptainBadge');if(badge){badge.hidden=!player;badge.textContent=player?'⚔️ Capitán: '+player:''}}document.querySelectorAll('.lineup-player').forEach(input=>{input.dataset.captain=String(isCaptain(input.value));input.title=isCaptain(input.value)?'Capitán del desafío':''})}
  async function useCaptains(number){
    const duel=window.ChiquiGoals?.duelForMatch(number);if(!duel||duel.status!=='pending')return;const lineup=(await ChiquiGoals.lineups()).find(item=>Number(item.matchNumber)===number);if(lineup&&(Number($('#generatorMatch').value)!==number||!teams.white.length&&!teams.black.length)){const parse=value=>Array.isArray(value)?value:JSON.parse(value||'[]');loadSavedTeams({number,date:lineup.date,white:parse(lineup.white),black:parse(lineup.black)})}
    if(Number($('#generatorMatch').value)!==number){teams={white:[],black:[]};$('#generatorMatch').value=number}else if($('#teamBuildMode').value==='manual')readManualTeams();
    const captains=[duel.whitePlayer,duel.blackPlayer],other=team=>team.filter(p=>!captains.some(name=>ChiquiSheets.key(name)===ChiquiSheets.key(p.name)));
    teams={white:[playerData(duel.whitePlayer),...other(teams.white)],black:[playerData(duel.blackPlayer),...other(teams.black)]};$('#teamBuildMode').value='manual';$('#balancedTeamFields').hidden=true;$('#manualTeamFields').hidden=false;copyToLineup();renderTeams();captainBadges();$('#generatorMessage').textContent='⚔️ Capitanes preparados en equipos opuestos. Cargá los jugadores que eligió cada uno y guardá los equipos.';
  }
  window.ChiquiTeamGenerator={useCaptains};
  function renderTeams(){hideImageActions();captainBadges();$('#editGeneratedTeams').hidden=!teams.white.length&&!teams.black.length;const wrap=$('#generatedTeams');wrap.hidden=$('#teamBuildMode').value==='manual';const render=(team,target,side)=>{$(target).innerHTML=team.map((p,index)=>`<div class="generated-player"><span><button class="edit-generated-name" type="button" data-edit-side="${side}" data-edit-index="${index}" aria-label="Editar a ${esc(p.name)}"><b>${esc(p.name)}${isCaptain(p.name)?' ⚔️':''}</b><span aria-hidden="true"> ✎</span></button> <small>${roles[p.role]} · ${levelLabels[categoryLevel(p.level)]}</small></span><button type="button" data-swap="${side}" data-index="${index}" title="Cambiar de equipo">↔</button></div>`).join('')};render(teams.white,'#generatedWhite','white');render(teams.black,'#generatedBlack','black');$('#whiteStrength').textContent=`Nivel: ${levelLabels[categoryLevel(teamScore(teams.white).total/(teams.white.length||1))]}`;$('#blackStrength').textContent=`Nivel: ${levelLabels[categoryLevel(teamScore(teams.black).total/(teams.black.length||1))]}`;$('#generatorMessage').textContent=Math.abs(teamScore(teams.white).total-teamScore(teams.black).total)<=2?'Equipos parejos por nivel y posición.':'Equipos generados. Revisá el reparto de niveles y posiciones antes de guardar.'}
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
    copyToLineup();renderTeams();$('#generatorMatch').dispatchEvent(new Event('change'));
    $('#generatorMessage').className='form-message success';
    $('#generatorMessage').textContent=`Fecha ${match.number} cargada. Tocá «Editar nombres de los equipos» para cambiar un jugador, o prepará la imagen.`;
  }
  function refreshChoiceButtons(){
    document.querySelectorAll('.lineup-player-row').forEach(row=>{const input=row.querySelector('.lineup-player'),button=row.querySelector('.choose-lineup-player');if(!input||!button)return;button.textContent=input.value.trim()?'Cambiar':'Elegir';button.setAttribute('aria-label',input.value.trim()?'Cambiar a '+input.value.trim():`Elegir jugador ${Number(button.dataset.chooseIndex)+1} del Equipo ${button.dataset.chooseSide==='white'?'Claro':'Oscuro'}`)});
  }
  function copyToLineup(){
    const fill=(selector,players)=>{const container=$(selector),side=selector==='#whiteSelectors'?'white':'black',label=side==='white'?'Claro':'Oscuro';while(container.children.length<players.length){const row=container.firstElementChild.cloneNode(true),index=container.children.length,input=row.querySelector('.lineup-player'),button=row.querySelector('.choose-lineup-player');input.placeholder=`Jugador ${index+1} o invitado`;input.setAttribute('aria-label',`Jugador ${index+1} del Equipo ${label}`);button.dataset.chooseIndex=String(index);button.dataset.chooseSide=side;container.appendChild(row)}[...container.querySelectorAll('.lineup-player')].forEach((input,index)=>input.value=players[index]?.name||'')};
    fill('#whiteSelectors',teams.white);fill('#blackSelectors',teams.black);refreshChoiceButtons();
  }
  function pickerChoices(){
    if(!pickerTarget)return[];const occupied=new Set([...document.querySelectorAll('#manualTeamFields .lineup-player')].filter(input=>input!==pickerTarget.input).map(input=>ChiquiSheets.key(input.value)).filter(Boolean));
    return [...new Map(names().filter(name=>!occupied.has(ChiquiSheets.key(name))&&ChiquiSheets.key(name)!==ChiquiSheets.key(pickerTarget.input.value)).map(name=>[ChiquiSheets.key(name),name])).values()];
  }
  function renderPickerChoices(){
    const query=$('#teamPickerSearch').value.trim().toLocaleLowerCase('es'),choices=pickerChoices().filter(name=>name.toLocaleLowerCase('es').includes(query));
    $('#teamPickerChoices').innerHTML=choices.map(name=>`<button type="button" data-picker-name="${esc(name)}">${esc(name)}</button>`).join('')||'<p class="admin-help">No hay jugadores disponibles con ese nombre. Podés agregar un invitado abajo.</p>';
  }
  function openPlayerPicker(side,index){
    if($('#teamBuildMode').value!=='manual')copyToLineup();
    const input=document.querySelectorAll(`${side==='white'?'#whiteSelectors':'#blackSelectors'} .lineup-player`)[index];if(!input)return;
    pickerTarget={side,index,input,match:$('#generatorMatch').value};
    $('#teamPickerTitle').textContent=input.value.trim()?'Reemplazar a '+input.value.trim():'Elegir jugador';
    $('#teamPickerSide').textContent=`Equipo ${side==='white'?'Claro':'Oscuro'} · Elegí con un toque. Se muestran jugadores que no están en los otros lugares.`;
    $('#teamPickerSearch').value='';$('#teamPickerGuest').value='';$('#teamPickerMessage').textContent='';$('#teamPickerGuestDetails').open=false;renderPickerChoices();$('#teamPlayerPicker').showModal();
  }
  function chooseReplacement(name){
    if(!pickerTarget)return;name=String(name||'').trim();if(!name)return;
    const key=ChiquiSheets.key(name),message=$('#teamPickerMessage');
    if(pickerTarget.match!==$('#generatorMatch').value){message.textContent='La fecha cambió. Cerrá y volvé a elegir el jugador.';return}
    const other=[...document.querySelectorAll('#manualTeamFields .lineup-player')].some(input=>input!==pickerTarget.input&&ChiquiSheets.key(input.value)===key);
    if(other){message.textContent='Ese jugador ya está en uno de los equipos. Elegí otro.';return}
    const canonical=names().find(player=>ChiquiSheets.key(player)===key)||name,previous=pickerTarget.input.value.trim();
    if(!names().some(player=>ChiquiSheets.key(player)===key)){guests.push(canonical);renderRoster()}
    pickerTarget.input.value=canonical;readManualTeams();refreshChoiceButtons();
    const msg=$('#generatorMessage');msg.className='form-message success';msg.textContent=previous?`${canonical} reemplaza a ${previous}. Tocá «Guardar y publicar equipos» para confirmar.`:`${canonical} agregado. Tocá «Guardar y publicar equipos» para confirmar.`;
    $('#teamPlayerPicker').close();
  }
  function readManualTeams(){
    const read=selector=>[...document.querySelectorAll(`${selector} .lineup-player`)].map(input=>input.value.trim()).filter(Boolean).map(playerData);
    teams={white:read('#whiteSelectors'),black:read('#blackSelectors')};renderTeams();refreshChoiceButtons();
  }
  function changeBuildMode(){const manual=$('#teamBuildMode').value==='manual';$('#manualTeamFields').hidden=!manual;$('#balancedTeamFields').hidden=manual;if(manual){copyToLineup();readManualTeams()}else{const selected=teams.white.concat(teams.black).map(p=>p.name);guests=[...new Set(guests.concat(selected.filter(name=>!names().includes(name))))];renderRoster();document.querySelectorAll('.generator-player').forEach(row=>{row.querySelector('.generator-check').checked=selected.includes(row.dataset.name)});renderTeams()}$('#generatorMessage').textContent=manual?'Elegí los jugadores de cada equipo y guardá el partido.':'Marcá los jugadores para generar equipos parejos.'}
  function editTeams(side='white',index=0){
    if(!teams.white.length&&!teams.black.length)return;
    $('#teamBuildMode').value='manual';changeBuildMode();
    const input=document.querySelectorAll(`${side==='white'?'#whiteSelectors':'#blackSelectors'} .lineup-player`)[index];
    if(input){const button=input.closest('.lineup-player-row')?.querySelector('.choose-lineup-player');input.scrollIntoView({behavior:'smooth',block:'center'});button?.focus({preventScroll:true})}
    $('#generatorMessage').className='form-message';
    $('#generatorMessage').textContent='Tocá «Cambiar» al lado del jugador, elegí el reemplazo y tocá «Guardar y publicar equipos».';
  }
  async function publish(){
    if($('#teamBuildMode').value==='manual')readManualTeams();
    const msg=$('#generatorMessage'),matchNumber=Number($('#generatorMatch').value),date=$('#generatorDate').value,pin=sessionStorage.getItem('chiqui_admin_pin'),button=$('#publishGeneratedTeams');
    const fail=text=>{msg.className='form-message error';msg.textContent=text};
    if(!teams.white.length||!teams.black.length){fail('Completá ambos equipos antes de guardar.');return}
    if(!Number.isInteger(matchNumber)||matchNumber<1||!date){fail('Completá un número de partido válido y el día.');return}
    const names=teams.white.concat(teams.black).map(p=>ChiquiSheets.key(p.name));if(new Set(names).size!==names.length){fail('Hay un jugador repetido. Cada jugador debe aparecer una sola vez.');return}
    button.disabled=true;
    try{await ChiquiGoals.saveLineup({matchNumber,date,white:teams.white.map(p=>p.name),black:teams.black.map(p=>p.name),...(ChiquiGoals.supportsSubstitutes()?{substitutes:[]}:{})},pin);copyToLineup();msg.className='form-message success';msg.textContent='✓ Equipos guardados y publicados. Ya podés compartir la imagen.'}catch(error){fail(error.message)}finally{button.disabled=false}
  }
  function imageDetails(){try{return JSON.parse(localStorage.getItem(DETAILS_KEY)||'{}')}catch{return{}}}
  function restoreImageDetails(){const details=imageDetails()[$('#generatorMatch').value]||{};$('#generatorTime').value=details.time??'17:00';$('#generatorVenue').value=details.venue??'El Más Grande'}
  function saveImageDetails(){const details=imageDetails();details[$('#generatorMatch').value]={time:$('#generatorTime').value,venue:$('#generatorVenue').value.trim()};try{localStorage.setItem(DETAILS_KEY,JSON.stringify(details))}catch{}}
  function loadBackground(){if(!backgroundPromise)backgroundPromise=new Promise(resolve=>{const image=new Image(),timer=setTimeout(()=>resolve(null),12000);image.onload=()=>{clearTimeout(timer);resolve(image)};image.onerror=()=>{clearTimeout(timer);resolve(null)};image.src='assets/match-red-background.webp'});return backgroundPromise}
  function imageSignature(){return JSON.stringify({teams,number:$('#generatorMatch').value,duel:currentDuel()?[currentDuel().whitePlayer,currentDuel().blackPlayer]:null,date:$('#generatorDate').value,time:$('#generatorTime').value,venue:$('#generatorVenue').value.trim()})}
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
      function drawSwords(x,y){ctx.save();ctx.translate(x,y);ctx.strokeStyle='#e3c17c';ctx.lineWidth=3;ctx.lineCap='round';for(const angle of [-0.65,0.65]){ctx.save();ctx.rotate(angle);ctx.beginPath();ctx.moveTo(0,-15);ctx.lineTo(0,6);ctx.moveTo(-5,6);ctx.lineTo(5,6);ctx.moveTo(0,6);ctx.lineTo(0,14);ctx.stroke();ctx.restore()}ctx.restore()}
      const drawTeam=(team,left)=>{
        const rowHeight=Math.min(80,650/Math.max(8,team.length));
        team.forEach((player,index)=>{
          const y=470+index*rowHeight;
          const captain=isCaptain(player.name);ctx.textAlign=left?'right':'left';text(player.name,left?456:624,y,35,'#fff',captain?312:348,900);if(captain)drawSwords(left?124:958,y-10);
          text((isCaptain(player.name)?'CAPITÁN · ':'')+roles[player.role],left?456:624,y+27,18,isCaptain(player.name)?'#e3c17c':'#a6a6a6',348,500);
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
  function init(){if(!$('#generatorRoster'))return;if(!document.querySelector('#playerOptions option')){setTimeout(init,500);return}profiles=readProfiles();renderRoster();if(currentDuel()?.status==='pending')useCaptains(Number($('#generatorMatch').value)).catch(error=>$('#generatorMessage').textContent=error.message);$('#teamPickerChoices').onclick=event=>{const button=event.target.closest('[data-picker-name]');if(button)chooseReplacement(button.dataset.pickerName)};$('#teamPickerSearch').oninput=renderPickerChoices;$('#teamPickerGuestForm').onsubmit=event=>{event.preventDefault();chooseReplacement($('#teamPickerGuest').value)};$('#closeTeamPicker').onclick=()=>$('#teamPlayerPicker').close();$('#cancelTeamPicker').onclick=()=>$('#teamPlayerPicker').close();$('#teamPlayerPicker').addEventListener('close',()=>{pickerTarget=null});$('#manualTeamFields').addEventListener('click',event=>{const button=event.target.closest('[data-choose-side]');if(button)openPlayerPicker(button.dataset.chooseSide,Number(button.dataset.chooseIndex))});$('#teamBuildMode').onchange=changeBuildMode;$('#manualTeamFields').addEventListener('input',readManualTeams);$('#addGeneratorGuest').onclick=()=>{const input=$('#generatorGuest'),name=input.value.trim();if(!name)return;if(!guests.some(x=>x.toLowerCase()===name.toLowerCase()))guests.push(name);input.value='';renderRoster();const row=[...document.querySelectorAll('.generator-player')].find(x=>x.dataset.name===name);if(row)row.querySelector('.generator-check').checked=true};$('#balanceTeams').onclick=()=>{const selected=[...document.querySelectorAll('.generator-player')].filter(row=>row.querySelector('.generator-check').checked).map(row=>playerData(row.dataset.name));if(selected.length>16){$('#generatorMessage').className='form-message error';$('#generatorMessage').textContent='Elegí hasta 16 jugadores para armar los equipos de 8 contra 8.';return}if(selected.length<2){$('#generatorMessage').className='form-message error';$('#generatorMessage').textContent='Elegí por lo menos dos jugadores.';return}teams=balance(selected);copyToLineup();renderTeams()};$('#editGeneratedTeams').onclick=()=>editTeams();$('#generatedTeams').onclick=event=>{const edit=event.target.closest('[data-edit-side]');if(edit){openPlayerPicker(edit.dataset.editSide,Number(edit.dataset.editIndex));return}const button=event.target.closest('[data-swap]');if(!button)return;const from=button.dataset.swap,to=from==='white'?'black':'white',index=Number(button.dataset.index);teams[to].push(teams[from].splice(index,1)[0]);copyToLineup();renderTeams()};$('#publishGeneratedTeams').onclick=publish;restoreImageDetails();$('#generatorMatch').addEventListener('change',()=>{restoreImageDetails();captainBadges()});window.addEventListener('chiqui:duels-updated',()=>{captainBadges();if(preparedImage&&preparedImage.signature!==imageSignature())hideImageActions()});$('#generatorTime').addEventListener('change',saveImageDetails);$('#generatorVenue').addEventListener('change',saveImageDetails);$('#previewTeamsImage').onclick=()=>shareImage(false);$('#downloadTeamsImage').onclick=()=>{if(preparedImage&&preparedImage.signature===imageSignature())downloadPreparedImage();else shareImage(true)};$('#shareTeamsImage').onclick=sharePreparedImage;['#generatorMatch','#generatorDate','#generatorTime','#generatorVenue'].forEach(selector=>$(selector).addEventListener('input',hideImageActions))}
  window.addEventListener('chiqui:load-generator-lineup',event=>loadSavedTeams(event.detail));
  window.addEventListener('chiqui:players-changed',()=>{renderRoster()});
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
