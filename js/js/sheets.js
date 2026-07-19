(function () {
  'use strict';
  const clean = value => String(value ?? '').replace(/\u00a0/g, ' ').trim();
  const key = value => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const number = value => {
    const raw = clean(value).replace(/\s/g, '');
    if (!raw || /#(error|n\/a|name)/i.test(raw)) return 0;
    const normalized = raw.includes(',') && raw.includes('.') ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(',', '.');
    const parsed = Number(normalized.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  };
  function parseCSV(text) {
    const rows = []; let row = []; let field = ''; let quoted = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i], next = text[i + 1];
      if (char === '"' && quoted && next === '"') { field += '"'; i++; }
      else if (char === '"') quoted = !quoted;
      else if (char === ',' && !quoted) { row.push(field); field = ''; }
      else if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && next === '\n') i++;
        row.push(field); if (row.some(cell => clean(cell))) rows.push(row); row = []; field = '';
      } else field += char;
    }
    row.push(field); if (row.some(cell => clean(cell))) rows.push(row);
    return rows;
  }
  function identify(rows) {
    const sample = key(rows.slice(0, 8).flat().join('|'));
    if (sample.includes('ranking') && sample.includes('total puntos') && sample.includes('zona')) return 'standings';
    if (sample.includes('jugador 1') && sample.includes('jugador 16') && sample.includes('g/p/e')) return 'matches';
    if (sample.includes('jugadores') && sample.includes('lista torneo')) return 'players';
    if (sample.includes('jugador') && sample.includes('mmr') && sample.includes('total puntos')) return 'stats';
    if (sample.includes('fecha') && sample.includes('suma')) return 'pointsHistory';
    if (sample.includes('jugador') && /\d{1,2}\/\d{1,2}\/\d{4}/.test(sample)) return 'history';
    if (sample.includes('domador') && sample.includes('diferencia')) return 'derived';
    if (sample.includes('matchnumber') && sample.includes('whitegoals') && sample.includes('blackgoals')) return 'results';
    return 'unknown';
  }
  function findHeader(rows, required) {
    return rows.findIndex(row => required.every(term => row.some(cell => key(cell).includes(term))));
  }
  function headerIndex(header, aliases) {
    const exact = header.findIndex(cell => aliases.some(alias => key(cell) === alias));
    if (exact >= 0) return exact;
    return header.findIndex(cell => aliases.some(alias => alias.length > 2 && key(cell).includes(alias)));
  }
  function parseStandings(rows) {
    const at = findHeader(rows, ['ranking', 'jugador', 'total puntos']); if (at < 0) return [];
    const h = rows[at]; const col = aliases => headerIndex(h, aliases);
    const ix = { rank: col(['ranking']), player: col(['jugador']), points: col(['total puntos']), played: col(['pj']), wins: col(['g']), losses: col(['p']), draws: col(['e']), mvp: col(['mvps', 'mvp']) };
    return rows.slice(at + 1).map(r => ({ rank:number(r[ix.rank]), player:clean(r[ix.player]), points:number(r[ix.points]), played:number(r[ix.played]), wins:number(r[ix.wins]), draws:number(r[ix.draws]), losses:number(r[ix.losses]), mvp:number(r[ix.mvp]) })).filter(x => x.player && x.rank > 0).sort((a,b)=>a.rank-b.rank);
  }
  function parseMatches(rows) {
    const at = findHeader(rows, ['jugador 1', 'jugador 16', 'g/p/e']); if (at < 0) return [];
    const h = rows[at]; const resultIx = headerIndex(h,['g/p/e']); const mvpIx=headerIndex(h,['mvp']); const dateIx=headerIndex(h,['fecha']); const matchIx=headerIndex(h,['partido']),whiteGoalsIx=headerIndex(h,['goles claro web']),blackGoalsIx=headerIndex(h,['goles oscuro web']);
    return rows.slice(at + 1).map((r,i) => ({ date:clean(r[dateIx]), number:number(r[matchIx])||i+1, white:r.slice(1,9).map(clean).filter(Boolean), black:r.slice(9,17).map(clean).filter(Boolean), result:clean(r[resultIx]), mvp:clean(r[mvpIx]),whiteGoals:whiteGoalsIx>=0?number(r[whiteGoalsIx]):undefined,blackGoals:blackGoalsIx>=0?number(r[blackGoalsIx]):undefined })).filter(m=>m.date && (m.white.length || m.black.length));
  }
  function parsePlayers(rows) {
    const at=findHeader(rows,['jugadores']); if(at<0)return[]; const ix=headerIndex(rows[at],['jugadores']); return [...new Set(rows.slice(at+1).map(r=>clean(r[ix])).filter(Boolean))];
  }
  function parseStats(rows) {
    const at=findHeader(rows,['jugador','total puntos']); if(at<0)return[]; const h=rows[at], col=a=>headerIndex(h,a);
    const ix={player:col(['jugador']),played:col(['pj']),wins:col(['g']),losses:col(['p']),draws:col(['e']),mvp:col(['mvps','mvp']),points:col(['total puntos'])};
    return rows.slice(at+1).map(r=>({player:clean(r[ix.player]),played:number(r[ix.played]),wins:number(r[ix.wins]),losses:number(r[ix.losses]),draws:number(r[ix.draws]),mvp:number(r[ix.mvp]),points:number(r[ix.points])})).filter(x=>x.player);
  }
  function parseHistory(rows) {
    const at=rows.findIndex(r=>r.some(c=>key(c)==='jugador')&&r.some(c=>/\d{1,2}\/\d{1,2}\/\d{4}/.test(clean(c)))); if(at<0)return[];
    const h=rows[at], playerIx=headerIndex(h,['jugador']); const dates=h.map((v,i)=>({label:clean(v),i})).filter(x=>/\d{1,2}\/\d{1,2}\/\d{4}/.test(x.label));
    return rows.slice(at+1).map(r=>({player:clean(r[playerIx]),values:dates.map(d=>({date:d.label,value:number(r[d.i])})).filter(x=>x.value!==0)})).filter(x=>x.player);
  }
  function parsePointsHistory(rows) {
    const at=rows.findIndex(r=>r.some(c=>key(c)==='suma')&&r.some(c=>/\d{1,2}\/(mar|abr|may|jun|jul|ago)/i.test(clean(c)))); if(at<0)return[];
    const h=rows[at], playerIx=Math.max(0,headerIndex(h,['suma'])-1); const dates=h.map((v,i)=>({label:clean(v),i})).filter(x=>/\d{1,2}\/[a-z]{3}/i.test(x.label));
    return rows.slice(at+1).map(r=>{
      let accumulated=0;
      const values=dates.map(d=>{accumulated+=number(r[d.i]);return{date:d.label,value:accumulated}});
      return {player:clean(r[playerIx]),values};
    }).filter(x=>x.player&&x.values.some(v=>v.value!==0));
  }
  function parseResults(rows) {
    const at=rows.findIndex(r=>r.some(c=>key(c)==='matchnumber')&&r.some(c=>key(c)==='whitegoals')&&r.some(c=>key(c)==='blackgoals'));
    if(at<0)return rows.map(r=>({matchNumber:number(r[0]),whiteGoals:number(r[1]),blackGoals:number(r[2]),winner:clean(r[3]),played:['true','si','sí','1'].includes(key(r[4])),updatedAt:clean(r[5])})).filter(x=>x.matchNumber>0);
    const h=rows[at],col=a=>headerIndex(h,a),ix={match:col(['matchnumber']),white:col(['whitegoals']),black:col(['blackgoals']),winner:col(['winner']),played:col(['played']),updated:col(['updatedat'])};
    return rows.slice(at+1).map(r=>({matchNumber:number(r[ix.match]),whiteGoals:number(r[ix.white]),blackGoals:number(r[ix.black]),winner:clean(r[ix.winner]),played:['true','si','sí','1'].includes(key(r[ix.played])),updatedAt:clean(r[ix.updated])})).filter(x=>x.matchNumber>0);
  }
  function readState(){return new Promise((resolve,reject)=>{const api=String(window.CHIQUI_CONFIG.goalsApiUrl||'').trim();if(!api){reject(new Error('Falta configurar Google Apps Script'));return}const callback='__chiquiState'+Date.now()+Math.random().toString(36).slice(2),script=document.createElement('script'),finish=value=>{clearTimeout(timer);delete window[callback];script.remove();resolve(value)};window[callback]=payload=>finish(payload);script.src=api+'?mode=state&callback='+encodeURIComponent(callback)+'&t='+Date.now();script.onerror=()=>{clearTimeout(timer);delete window[callback];script.remove();reject(new Error('No se pudo leer el torneo'))};const timer=setTimeout(()=>{delete window[callback];script.remove();reject(new Error('La conexión con el torneo demoró demasiado'))},15000);document.head.appendChild(script)})}
  const array=value=>{if(Array.isArray(value))return value;if(typeof value==='string'){try{return JSON.parse(value)}catch{return[]}}return[]};
  function buildTournament(state){
    const scoring=window.CHIQUI_CONFIG.points||{attendance:1,win:2,draw:1,loss:0,mvp:1};
    const deleted=new Set((state.deletedDates||[]).map(x=>String(x.matchNumber))),active=(state.players||[]).filter(x=>x.status!=='deleted').map(x=>clean(x.name)),results=(state.results||[]).filter(x=>!deleted.has(String(x.matchNumber))),resultMap=new Map(results.map(x=>[String(x.matchNumber),x]));
    const matches=(state.lineups||[]).filter(x=>!deleted.has(String(x.matchNumber))).map(x=>{const result=resultMap.get(String(x.matchNumber));return{number:number(x.matchNumber),date:clean(x.date),white:array(x.white).map(clean).filter(Boolean),black:array(x.black).map(clean).filter(Boolean),result:result?result.winner==='draw'?'Empate':result.winner==='white'?'Gana E1':'Gana E2':'',winner:result?.winner||'',played:Boolean(result&&String(result.played)!=='false'),whiteGoals:result?number(result.whiteGoals):undefined,blackGoals:result?number(result.blackGoals):undefined,mvp:''}}).sort((a,b)=>a.number-b.number);
    const names=[...new Set([...active,...matches.flatMap(match=>[...match.white,...match.black])])],rows=new Map(names.map(player=>[key(player),{rank:0,player,points:0,played:0,wins:0,draws:0,losses:0,mvp:0}])),mvpByMatch=new Map((state.mvps||[]).map(x=>[String(x.matchNumber),clean(x.player)])),mvpBonuses=new Map(names.map(player=>[key(player),0])),historyMap=new Map(names.map(player=>[key(player),[]]));
    matches.filter(match=>match.played).forEach(match=>{const whiteOutcome=match.winner==='draw'?'draw':match.winner==='white'?'win':'loss',blackOutcome=match.winner==='draw'?'draw':match.winner==='black'?'win':'loss';[[match.white,whiteOutcome],[match.black,blackOutcome]].forEach(([players,outcome])=>[...new Set(players.map(clean))].forEach(player=>{const row=rows.get(key(player));if(!row)return;row.played+=1;row.points+=Number(scoring.attendance||0);if(outcome==='win'){row.wins+=1;row.points+=Number(scoring.win||0)}else if(outcome==='draw'){row.draws+=1;row.points+=Number(scoring.draw||0)}else{row.losses+=1;row.points+=Number(scoring.loss||0)}}));const mvp=mvpByMatch.get(String(match.number));if(mvp){match.mvp=mvp;mvpBonuses.set(key(mvp),(mvpBonuses.get(key(mvp))||0)+Number(scoring.mvp||0))}names.forEach(player=>{const row=rows.get(key(player));historyMap.get(key(player)).push({date:'Fecha '+match.number,value:row.points+(mvpBonuses.get(key(player))||0)})})});
    const standings=[...rows.values()].sort((a,b)=>(b.points+(mvpBonuses.get(key(b.player))||0))-(a.points+(mvpBonuses.get(key(a.player))||0))||b.wins-a.wins||a.player.localeCompare(b.player));standings.forEach((row,index)=>row.rank=index+1);
    const history=names.map(player=>({player,values:historyMap.get(key(player))||[]}));
    return{standings,matches,players:names,stats:standings.map(x=>({...x})),history,pointsHistory:history,historicalStats:state.history||[],fund:state.fund||{amount:0,goal:0},results:[],mappings:[{type:'Google Apps Script',live:true}],allLive:true};
  }
  async function loadAll(){const state=await readState();if(!state||state.ok===false)throw new Error(state?.error||'No se pudo cargar el torneo');return buildTournament(state)}
  window.ChiquiSheets={loadAll,key,clean,number};
})();
