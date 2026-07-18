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
    const h = rows[at]; const resultIx = headerIndex(h,['g/p/e']); const mvpIx=headerIndex(h,['mvp']); const dateIx=headerIndex(h,['fecha']); const matchIx=headerIndex(h,['partido']);
    return rows.slice(at + 1).map((r,i) => ({ date:clean(r[dateIx]), number:number(r[matchIx])||i+1, white:r.slice(1,9).map(clean).filter(Boolean), black:r.slice(9,17).map(clean).filter(Boolean), result:clean(r[resultIx]), mvp:clean(r[mvpIx]) })).filter(m=>m.date && (m.white.length || m.black.length));
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
    const at=rows.findIndex(r=>r.some(c=>key(c)==='matchnumber')&&r.some(c=>key(c)==='whitegoals')&&r.some(c=>key(c)==='blackgoals'));if(at<0)return[];
    const h=rows[at],col=a=>headerIndex(h,a),ix={match:col(['matchnumber']),white:col(['whitegoals']),black:col(['blackgoals']),winner:col(['winner']),played:col(['played']),updated:col(['updatedat'])};
    return rows.slice(at+1).map(r=>({matchNumber:number(r[ix.match]),whiteGoals:number(r[ix.white]),blackGoals:number(r[ix.black]),winner:clean(r[ix.winner]),played:['true','si','sí','1'].includes(key(r[ix.played])),updatedAt:clean(r[ix.updated])})).filter(x=>x.matchNumber>0);
  }
  async function fetchText(source) {
    const live=window.CHIQUI_CONFIG.sheetBase+source.gid+'&_='+Date.now();
    try { const response=await fetch(live,{cache:'no-store'}); if(!response.ok)throw new Error('HTTP '+response.status); return {text:await response.text(),live:true}; }
    catch(error){ const response=await fetch(source.fallback,{cache:'no-store'}); if(!response.ok)throw error; return {text:await response.text(),live:false}; }
  }
  async function loadAll() {
    const loaded=await Promise.all(window.CHIQUI_CONFIG.sources.map(async source=>{const result=await fetchText(source); const rows=parseCSV(result.text); return {gid:source.gid,type:identify(rows),rows,live:result.live};}));
    const byType=Object.fromEntries(loaded.map(x=>[x.type,x.rows]));
    return { standings:parseStandings(byType.standings||[]), matches:parseMatches(byType.matches||[]), players:parsePlayers(byType.players||[]), stats:parseStats(byType.stats||[]), history:parseHistory(byType.history||[]), pointsHistory:parsePointsHistory(byType.pointsHistory||[]), results:parseResults(byType.results||[]), mappings:loaded.map(x=>({gid:x.gid,type:x.type,live:x.live})), allLive:loaded.every(x=>x.live) };
  }
  window.ChiquiSheets={loadAll,key,clean,number};
})();
