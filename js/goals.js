(function(){
  'use strict';
  const STORAGE_KEY='chiquimafia_goal_submissions_v1';
  const MVP_KEY='chiquimafia_official_mvp_v1';
  const LINEUP_KEY='chiquimafia_lineups_v1', SANCTION_KEY='chiquimafia_sanctions_v1', PLAYOFF_KEY='chiquimafia_playoffs_v1', DELETED_DATES_KEY='chiquimafia_deleted_dates_v1', PLAYERS_KEY='chiquimafia_web_players_v1', RESULTS_KEY='chiquimafia_results_v1';
  const API=()=>String(window.CHIQUI_CONFIG.goalsApiUrl||'').trim();
  const localRead=()=>{try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]')}catch{return[]}};
  const localWrite=items=>localStorage.setItem(STORAGE_KEY,JSON.stringify(items));
  // Reuse one snapshot during rendering; fetch fresh data after any successful write.
  const READ_FIELDS={listWebPlayers:'players',listLineups:'lineups',listResults:'results',listMvp:'mvps',listSanctions:'sanctions',listDeletedDates:'deletedDates',listPlayoffs:'playoffs',list:'submissions',listMatchRecords:'matchRecords'};
  const READ_TTL=30000,readCache=new Map(),pendingReads=new Map();
  let readGeneration=0,capabilities={},serverOffset=0,latestMatchRecords=[],automationReady=false;
  const copy=value=>JSON.parse(JSON.stringify(value));
  function clearReadCache(){readGeneration+=1;readCache.clear();pendingReads.clear()}
  function seedState(state){
    clearReadCache();
    capabilities=state.capabilities||{};automationReady=Boolean(state.automationReady);serverOffset=Date.parse(state.serverNow||'')-Date.now()||0;latestMatchRecords=copy(state.matchRecords||[]);
    const now=Date.now();
    Object.entries(READ_FIELDS).forEach(([action,field])=>{
      if(Array.isArray(state[field]))readCache.set(action,{value:{ok:true,items:copy(state[field])},at:now});
    });
  }
  async function sendRequest(action,payload){
    const response=await fetch(API(),{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,...payload})});
    if(!response.ok)throw new Error('No se pudo conectar con el registro de goles');
    const result=await response.json();if(result.ok===false)throw new Error(result.error||'Operación rechazada');return result;
  }
  async function request(action,payload={}){
    if(!API())return null;
    if(!Object.prototype.hasOwnProperty.call(READ_FIELDS,action)){
      const result=await sendRequest(action,payload);
      if(action!=='auth'&&action!=='listMvpVotes')clearReadCache();
      return result;
    }
    const cached=readCache.get(action);
    if(cached&&Date.now()-cached.at<READ_TTL)return copy(cached.value);
    let pending=pendingReads.get(action);
    if(!pending){
      const generation=readGeneration;
      pending=sendRequest(action,payload).then(result=>{
        if(generation===readGeneration&&Array.isArray(result.items))readCache.set(action,{value:copy(result),at:Date.now()});
        return result;
      }).finally(()=>{if(pendingReads.get(action)===pending)pendingReads.delete(action)});
      pendingReads.set(action,pending);
    }
    return copy(await pending);
  }
  async function list(){const remote=await request('list').catch(()=>null);return remote?.items||localRead()}
  async function submit(input){
    const item={id:(crypto.randomUUID?.()||Date.now()+'-'+Math.random()),createdAt:new Date().toISOString(),status:'pending',...input};
    const remote=await request('submit',{item});if(remote)return remote.item||item;
    const items=localRead();const duplicate=items.some(x=>x.matchNumber===item.matchNumber&&x.player===item.player&&x.status!=='rejected');
    if(duplicate)throw new Error('Ya existe una declaración para ese jugador en esta fecha.');items.push(item);localWrite(items);return item;
  }
  async function authenticate(pin){const remote=await request('auth',{pin});return remote?Boolean(remote.authenticated):pin===window.CHIQUI_CONFIG.adminPin}
  async function decide(id,status,pin){
    const remote=await request('decide',{id,status,pin});if(remote)return remote.item;
    const items=localRead(),item=items.find(x=>x.id===id);if(!item)throw new Error('No se encontró la solicitud');item.status=status;item.reviewedAt=new Date().toISOString();localWrite(items);return item;
  }
  function canonicalTotals(items,valueOf){const grouped=new Map();items.forEach(item=>{const raw=String(item.player||'').trim(),id=window.ChiquiSheets?.key?ChiquiSheets.key(raw):raw.toLowerCase().replace(/[^a-z0-9]/g,''),current=grouped.get(id),preferred=id==='joacoreggi'?'JOACOREGGI':(!current||(/\s/.test(raw)&&!/\s/.test(current.player))?raw:current.player);grouped.set(id,{player:preferred,value:Number(current?.value||0)+Number(valueOf(item)||0)})});return Object.fromEntries([...grouped.values()].map(x=>[x.player,x.value]))}
  async function matchRecords(refresh=false){if(!capabilities.matchVotingV2)return [];if(refresh){readCache.delete('listMatchRecords');readCache.delete('listMvp')}const remote=await request('listMatchRecords');if(remote.serverNow)serverOffset=Date.parse(remote.serverNow)-Date.now()||0;latestMatchRecords=remote.items||[];return copy(latestMatchRecords)}
  async function approvedTotals(){const [items,records]=await Promise.all([list(),matchRecords()]),managed=new Set(records.map(x=>Number(x.matchNumber)));return canonicalTotals(items.filter(x=>x.status==='approved'&&!managed.has(Number(x.matchNumber))).concat(records.flatMap(x=>x.scorers||[])),x=>x.goals)}
  function scorerPoints(player,rounds=18){const id=window.ChiquiSheets?.key?ChiquiSheets.key(player):player;return latestMatchRecords.filter(r=>Number(r.matchNumber)<=rounds).flatMap(r=>r.scorerAwards||[]).filter(a=>(window.ChiquiSheets?.key?ChiquiSheets.key(a.player):a.player)===id).reduce((sum,a)=>sum+Number(a.points||0),0)}
  async function voteMvp(item){if(!capabilities.matchVotingV2)throw new Error('La nueva votación necesita actualizar Apps Script.');return (await request('voteMvp',{item})).item}
  async function mvpVotes(pin){if(!capabilities.matchVotingV2)return [];return (await request('listMvpVotes',{pin})).items||[]}
  function supportsVoting(){return Boolean(capabilities.matchVotingV2)}
  function serverTime(){return Date.now()+serverOffset}
  async function mvpAwards(){const remote=await request('listMvp').catch(()=>null);if(remote)return remote.items||[];try{return JSON.parse(localStorage.getItem(MVP_KEY)||'[]')}catch{return[]}}
  async function confirmMvp(matchNumber,player,pin){const remote=await request('confirmMvp',{matchNumber,player,pin});if(remote)return remote.item;const items=await mvpAwards(),existing=items.find(x=>String(x.matchNumber)===String(matchNumber));if(existing)existing.player=player;else items.push({matchNumber,player,confirmedAt:new Date().toISOString()});localStorage.setItem(MVP_KEY,JSON.stringify(items));return items.find(x=>String(x.matchNumber)===String(matchNumber))}
  async function mvpTotals(){return canonicalTotals(await mvpAwards(),x=>Number(x.points??1))}
  async function deleteMvp(matchNumber,pin){const remote=await request('deleteMvp',{matchNumber,pin});if(remote)return;localStorage.setItem(MVP_KEY,JSON.stringify((await mvpAwards()).filter(x=>String(x.matchNumber)!==String(matchNumber))))}
  const localList=key=>{try{return JSON.parse(localStorage.getItem(key)||'[]')}catch{return[]}};
  async function lineups(){const remote=await request('listLineups').catch(()=>null);return remote?.items||localList(LINEUP_KEY)}
  async function saveLineup(item,pin){const remote=await request('saveLineup',{item,pin}),saved={...(remote?.item||item),updatedAt:remote?.item?.updatedAt||new Date().toISOString()},items=localList(LINEUP_KEY),index=items.findIndex(x=>String(x.matchNumber)===String(saved.matchNumber));index>=0?items[index]=saved:items.push(saved);localStorage.setItem(LINEUP_KEY,JSON.stringify(items));localStorage.setItem(DELETED_DATES_KEY,JSON.stringify(localList(DELETED_DATES_KEY).filter(x=>String(x.matchNumber)!==String(saved.matchNumber))));window.dispatchEvent(new CustomEvent('chiqui:lineup-saved',{detail:saved}));return saved}
  function jsonpResults(){return new Promise((resolve,reject)=>{if(!API()){resolve(null);return}const name='__chiquiResults'+Date.now()+Math.random().toString(36).slice(2),script=document.createElement('script'),finish=value=>{clearTimeout(timer);delete window[name];script.remove();resolve(value)};window[name]=payload=>finish(payload);script.src=API()+'?callback='+encodeURIComponent(name)+'&t='+Date.now();script.onerror=()=>{clearTimeout(timer);delete window[name];script.remove();reject(new Error('No se pudieron leer los resultados'))};const timer=setTimeout(()=>{delete window[name];script.remove();reject(new Error('Tiempo agotado'))},12000);document.head.appendChild(script)})}
  async function results(){const remote=await request('listResults').catch(()=>null);if(Array.isArray(remote?.items))return remote.items;const jsonp=await jsonpResults().catch(()=>null);if(Array.isArray(jsonp?.results))return jsonp.results;return localList(RESULTS_KEY)}
  async function saveResult(item,pin){const remote=await request('saveResult',{item,pin});if(remote)return remote.item;const items=localList(RESULTS_KEY),index=items.findIndex(x=>String(x.matchNumber)===String(item.matchNumber)),whiteGoals=Number(item.whiteGoals),blackGoals=Number(item.blackGoals),saved={...item,whiteGoals,blackGoals,winner:whiteGoals===blackGoals?'draw':whiteGoals>blackGoals?'white':'black',played:true};index>=0?items[index]=saved:items.push(saved);localStorage.setItem(RESULTS_KEY,JSON.stringify(items));return saved}
  async function sanctions(){const remote=await request('listSanctions').catch(()=>null);return remote?.items||localList(SANCTION_KEY)}
  async function addSanction(item,pin){const remote=await request('addSanction',{item,pin});if(remote)return remote.item;const saved={id:crypto.randomUUID?.()||String(Date.now()),...item,points:-Math.abs(Number(item.points)),createdAt:new Date().toISOString()},items=localList(SANCTION_KEY);items.push(saved);localStorage.setItem(SANCTION_KEY,JSON.stringify(items));return saved}
  async function deleteSanction(id,pin){const remote=await request('deleteSanction',{id,pin});if(remote)return;localStorage.setItem(SANCTION_KEY,JSON.stringify(localList(SANCTION_KEY).filter(x=>x.id!==id)))}
  async function deleteSubmission(id,pin){const remote=await request('deleteSubmission',{id,pin});if(remote)return;localWrite(localRead().filter(x=>x.id!==id))}
  async function clearGoals(id,pin){const remote=await request('clearGoals',{id,pin});if(remote)return;const items=localRead(),item=items.find(x=>x.id===id);if(item)item.goals=0;localWrite(items)}
  async function deletedDates(){const remote=await request('listDeletedDates').catch(()=>null);return remote?.items||localList(DELETED_DATES_KEY)}
  async function deleteDate(matchNumber,pin){const remote=await request('deleteDate',{matchNumber,pin});if(remote)return;localWrite(localRead().filter(x=>String(x.matchNumber)!==String(matchNumber)));localStorage.setItem(MVP_KEY,JSON.stringify((await mvpAwards()).filter(x=>String(x.matchNumber)!==String(matchNumber))));localStorage.setItem(LINEUP_KEY,JSON.stringify(localList(LINEUP_KEY).filter(x=>String(x.matchNumber)!==String(matchNumber))));const deleted=localList(DELETED_DATES_KEY);if(!deleted.some(x=>String(x.matchNumber)===String(matchNumber)))deleted.push({matchNumber,deletedAt:new Date().toISOString()});localStorage.setItem(DELETED_DATES_KEY,JSON.stringify(deleted))}
  async function webPlayers(){const remote=await request('listWebPlayers').catch(()=>null);return remote?.items||localList(PLAYERS_KEY)}
  async function setWebPlayer(name,status,pin){const action=status==='active'?'addPlayer':'deletePlayer',remote=await request(action,{name,pin});if(remote)return remote.item;const items=localList(PLAYERS_KEY),normalized=String(name).trim().toUpperCase(),index=items.findIndex(x=>x.name===normalized),saved={name:normalized,status,updatedAt:new Date().toISOString()};index>=0?items[index]=saved:items.push(saved);localStorage.setItem(PLAYERS_KEY,JSON.stringify(items));return saved}
  async function playoffResults(){const remote=await request('listPlayoffs').catch(()=>null);return remote?.items||localList(PLAYOFF_KEY)}
  async function savePlayoff(item,pin){const remote=await request('savePlayoff',{item,pin});if(remote)return remote.item;const items=localList(PLAYOFF_KEY),key=item.round+'-'+item.slot,index=items.findIndex(x=>x.key===key),saved={...item,key};index>=0?items[index]=saved:items.push(saved);localStorage.setItem(PLAYOFF_KEY,JSON.stringify(items));return saved}
  async function resetSeason(seasonName,pin){const remote=await request('resetSeason',{seasonName,pin});if(remote)return;[STORAGE_KEY,MVP_KEY,LINEUP_KEY,SANCTION_KEY,PLAYOFF_KEY,DELETED_DATES_KEY,PLAYERS_KEY].forEach(key=>localStorage.removeItem(key))}
  async function addHistoricalChampion(item,pin){const remote=await request('addHistoricalChampion',{item,pin});if(!remote)throw new Error('Esta función necesita Google Apps Script.');return remote.item}
  async function deleteHistoricalChampion(season,player,pin){const remote=await request('deleteHistoricalChampion',{season,player,pin});if(!remote)throw new Error('Esta función necesita Google Apps Script.')}
  async function saveFund(amount,pin){const remote=await request('saveFund',{amount,pin});if(!remote)throw new Error('No se pudo guardar la caja.');return remote.item}
  window.ChiquiGoals={savedScorers:matchNumber=>copy(latestMatchRecords.find(r=>Number(r.matchNumber)===Number(matchNumber))?.scorers||null),automationReady:()=>automationReady,supportsVoting,matchRecords,scorerPoints,voteMvp,mvpVotes,serverTime,seedState,list,submit,decide,authenticate,approvedTotals,mvpAwards,confirmMvp,mvpTotals,deleteMvp,lineups,saveLineup,results,saveResult,sanctions,addSanction,deleteSanction,deleteSubmission,clearGoals,deletedDates,deleteDate,webPlayers,setWebPlayer,playoffResults,savePlayoff,resetSeason,addHistoricalChampion,deleteHistoricalChampion,saveFund,isShared:()=>Boolean(API())};
})();
