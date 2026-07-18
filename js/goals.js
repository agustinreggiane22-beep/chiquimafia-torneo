(function(){
  'use strict';
  const STORAGE_KEY='chiquimafia_goal_submissions_v1';
  const MVP_KEY='chiquimafia_official_mvp_v1';
  const LINEUP_KEY='chiquimafia_lineups_v1', SANCTION_KEY='chiquimafia_sanctions_v1', PLAYOFF_KEY='chiquimafia_playoffs_v1';
  const API=()=>String(window.CHIQUI_CONFIG.goalsApiUrl||'').trim();
  const localRead=()=>{try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]')}catch{return[]}};
  const localWrite=items=>localStorage.setItem(STORAGE_KEY,JSON.stringify(items));
  async function request(action,payload={}){
    if(!API())return null;
    const response=await fetch(API(),{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,...payload})});
    if(!response.ok)throw new Error('No se pudo conectar con el registro de goles');
    const result=await response.json();if(result.ok===false)throw new Error(result.error||'Operación rechazada');return result;
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
  async function approvedTotals(){return (await list()).filter(x=>x.status==='approved').reduce((acc,x)=>{acc[x.player]=(acc[x.player]||0)+Number(x.goals||0);return acc},{})}
  async function mvpAwards(){const remote=await request('listMvp').catch(()=>null);if(remote)return remote.items||[];try{return JSON.parse(localStorage.getItem(MVP_KEY)||'[]')}catch{return[]}}
  async function confirmMvp(matchNumber,player,pin){const remote=await request('confirmMvp',{matchNumber,player,pin});if(remote)return remote.item;const items=await mvpAwards(),existing=items.find(x=>String(x.matchNumber)===String(matchNumber));if(existing)existing.player=player;else items.push({matchNumber,player,confirmedAt:new Date().toISOString()});localStorage.setItem(MVP_KEY,JSON.stringify(items));return items.find(x=>String(x.matchNumber)===String(matchNumber))}
  async function mvpTotals(){return (await mvpAwards()).reduce((acc,x)=>(acc[x.player]=(acc[x.player]||0)+1,acc),{})}
  async function deleteMvp(matchNumber,pin){const remote=await request('deleteMvp',{matchNumber,pin});if(remote)return;localStorage.setItem(MVP_KEY,JSON.stringify((await mvpAwards()).filter(x=>String(x.matchNumber)!==String(matchNumber))))}
  const localList=key=>{try{return JSON.parse(localStorage.getItem(key)||'[]')}catch{return[]}};
  async function lineups(){const remote=await request('listLineups').catch(()=>null);return remote?.items||localList(LINEUP_KEY)}
  async function saveLineup(item,pin){const remote=await request('saveLineup',{item,pin});if(remote)return remote.item;const items=localList(LINEUP_KEY),index=items.findIndex(x=>String(x.matchNumber)===String(item.matchNumber));index>=0?items[index]=item:items.push(item);localStorage.setItem(LINEUP_KEY,JSON.stringify(items));return item}
  async function sanctions(){const remote=await request('listSanctions').catch(()=>null);return remote?.items||localList(SANCTION_KEY)}
  async function addSanction(item,pin){const remote=await request('addSanction',{item,pin});if(remote)return remote.item;const saved={id:crypto.randomUUID?.()||String(Date.now()),...item,points:-Math.abs(Number(item.points)),createdAt:new Date().toISOString()},items=localList(SANCTION_KEY);items.push(saved);localStorage.setItem(SANCTION_KEY,JSON.stringify(items));return saved}
  async function deleteSanction(id,pin){const remote=await request('deleteSanction',{id,pin});if(remote)return;localStorage.setItem(SANCTION_KEY,JSON.stringify(localList(SANCTION_KEY).filter(x=>x.id!==id)))}
  async function deleteSubmission(id,pin){const remote=await request('deleteSubmission',{id,pin});if(remote)return;localWrite(localRead().filter(x=>x.id!==id))}
  async function playoffResults(){const remote=await request('listPlayoffs').catch(()=>null);return remote?.items||localList(PLAYOFF_KEY)}
  async function savePlayoff(item,pin){const remote=await request('savePlayoff',{item,pin});if(remote)return remote.item;const items=localList(PLAYOFF_KEY),key=item.round+'-'+item.slot,index=items.findIndex(x=>x.key===key),saved={...item,key};index>=0?items[index]=saved:items.push(saved);localStorage.setItem(PLAYOFF_KEY,JSON.stringify(items));return saved}
  async function resetSeason(seasonName,pin){const remote=await request('resetSeason',{seasonName,pin});if(remote)return;[STORAGE_KEY,MVP_KEY,LINEUP_KEY,SANCTION_KEY,PLAYOFF_KEY].forEach(key=>localStorage.removeItem(key))}
  window.ChiquiGoals={list,submit,decide,authenticate,approvedTotals,mvpAwards,confirmMvp,mvpTotals,deleteMvp,lineups,saveLineup,sanctions,addSanction,deleteSanction,deleteSubmission,playoffResults,savePlayoff,resetSeason,isShared:()=>Boolean(API())};
})();
