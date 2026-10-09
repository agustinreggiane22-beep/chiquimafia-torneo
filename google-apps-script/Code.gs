const SHEET_NAME = 'Goles Web';
const MVP_SHEET_NAME = 'MVP Web';
const LINEUP_SHEET_NAME = 'Equipos Web';
const SANCTION_SHEET_NAME = 'Sanciones Web';
const RESULTS_SHEET_NAME = 'Resultados Web';
const PLAYERS_SHEET_NAME = 'Jugadores Web';
const PLAYOFF_SHEET_NAME = 'Playoffs Web';
const DELETED_DATES_SHEET_NAME = 'Fechas Eliminadas Web';
const HISTORY_SHEET_NAME = 'Historial Torneos Web';
const FUND_SHEET_NAME = 'Caja Web';
const MATCH_RECORDS_SHEET_NAME = 'Registro Partido Web';
const MVP_VOTES_SHEET_NAME = 'Votos MVP Web';

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    if (body.action === 'submit') throw new Error('Los goles los registra el administrador. Usá Votación de MVP.');
    if (body.action === 'voteMvp') return json_({ok:true,item:voteMvp_(body.item)});
    if (body.action === 'listMatchRecords') { closeMvpVoting(); return json_({ok:true,items:listMatchRecords_(),serverNow:new Date().toISOString()}); }
    if (body.action === 'listMvpVotes') { requirePin_(body.pin); closeMvpVoting(); return json_({ok:true,items:listMvpVotes_()}); }
    if (body.action === 'list') return json_({ ok: true, items: list_() });
    if (body.action === 'auth') return json_({ ok: true, authenticated: validPin_(body.pin) });
    if (body.action === 'listMvp') { closeMvpVoting(); return json_({ok:true,items:listMvp_()}); }
    if (body.action === 'confirmMvp') {
      if (!validPin_(body.pin)) throw new Error('PIN incorrecto');
      if (findMatchRecord_(body.matchNumber)) throw new Error('El MVP de esta fecha se publica automáticamente al cerrar la votación.');
      if (!validParticipant_(body.matchNumber, body.player)) throw new Error('El MVP debe haber participado en esa fecha.');
      return json_({ ok: true, item: confirmMvp_(body.matchNumber, body.player) });
    }
    if (body.action === 'deleteMvp') { requirePin_(body.pin); if(findMatchRecord_(body.matchNumber)) throw new Error('Esta fecha usa votación automática.'); deleteMvp_(body.matchNumber); return json_({ ok:true }); }
    if (body.action === 'listLineups') return json_({ ok:true, items:listRows_(LINEUP_SHEET_NAME,['matchNumber','date','white','black','updatedAt']) });
    if (body.action === 'saveLineup') { requirePin_(body.pin); return json_({ok:true,item:saveVotingLineup_(body.item)}); }
    if (body.action === 'listResults') return json_({ok:true,items:listResults_()});
    if (body.action === 'saveResult') { requirePin_(body.pin); return json_({ok:true,item:saveOfficialMatch_(body.item)}); }
    if (body.action === 'listSanctions') return json_({ok:true,items:listRows_(SANCTION_SHEET_NAME,['id','player','points','reason','createdAt'])});
    if (body.action === 'addSanction') { requirePin_(body.pin); return json_({ok:true,item:addSanction_(body.item)}); }
    if (body.action === 'deleteSanction') { requirePin_(body.pin); deleteRowById_(SANCTION_SHEET_NAME,body.id); return json_({ok:true}); }
    if (body.action === 'deleteSubmission') { requirePin_(body.pin); deleteRowById_(SHEET_NAME,body.id); return json_({ok:true}); }
    if (body.action === 'clearGoals') { requirePin_(body.pin); clearGoals_(body.id); return json_({ok:true}); }
    if (body.action === 'listDeletedDates') return json_({ok:true,items:listRows_(DELETED_DATES_SHEET_NAME,['matchNumber','deletedAt'])});
    if (body.action === 'deleteDate') { requirePin_(body.pin); deleteDate_(body.matchNumber); return json_({ok:true}); }
    if (body.action === 'listWebPlayers') return json_({ok:true,items:listWebPlayers_()});
    if (body.action === 'addPlayer') { requirePin_(body.pin); return json_({ok:true,item:setWebPlayer_(body.name,'active')}); }
    if (body.action === 'deletePlayer') { requirePin_(body.pin); return json_({ok:true,item:setWebPlayer_(body.name,'deleted')}); }
    if (body.action === 'listPlayoffs') return json_({ok:true,items:listRows_(PLAYOFF_SHEET_NAME,['key','round','slot','player1','player2','score1','score2','winner','updatedAt'])});
    if (body.action === 'savePlayoff') { requirePin_(body.pin); return json_({ok:true,item:savePlayoff_(body.item)}); }
    if (body.action === 'saveFund') { requirePin_(body.pin); return json_({ok:true,item:saveFund_(body.amount)}); }
    if (body.action === 'addHistoricalChampion') { requirePin_(body.pin); return json_({ok:true,item:addHistoricalChampion_(body.item)}); }
    if (body.action === 'deleteHistoricalChampion') { requirePin_(body.pin); deleteHistoricalChampion_(body.season,body.player); return json_({ok:true}); }
    if (body.action === 'resetSeason') { requirePin_(body.pin); resetSeason_(body.seasonName); return json_({ok:true}); }
    if (body.action === 'decide') {
      if (!validPin_(body.pin)) throw new Error('PIN incorrecto');
      return json_({ ok: true, item: decide_(body.id, body.status) });
    }
    throw new Error('Acción desconocida');
  } catch (error) { return json_({ ok: false, error: error.message }); }
}

function doGet(e) {
  const payload = e && e.parameter && e.parameter.mode === 'state' ? tournamentState_() : {
    ok: true,
    version: '2026-07-18-resultados-v4',
    results: listResults_()
  };
  const callback = e && e.parameter ? String(e.parameter.callback || '') : '';
  if (callback && /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) {
    return ContentService
      .createTextOutput(callback + '(' + JSON.stringify(payload) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return json_(payload);
}

function tournamentState_() {
  closeMvpVoting();
  return {
    ok: true,
    version: '2026-10-09-mvp-v2',
    capabilities: {matchVotingV2:true},
    automationReady: automationReady_(),
    serverNow: new Date().toISOString(),
    matchRecords: listMatchRecords_(),
    players: listWebPlayers_(),
    lineups: listRows_(LINEUP_SHEET_NAME,['matchNumber','date','white','black','updatedAt']),
    results: listResults_(),
    mvps: listMvp_(),
    sanctions: listRows_(SANCTION_SHEET_NAME,['id','player','points','reason','createdAt']),
    deletedDates: listRows_(DELETED_DATES_SHEET_NAME,['matchNumber','deletedAt']),
    playoffs: listRows_(PLAYOFF_SHEET_NAME,['key','round','slot','player1','player2','score1','score2','winner','updatedAt']),
    history: listRows_(HISTORY_SHEET_NAME,['season','player','champion','points','goals','attendance','mvps','placement','archivedAt']),
    fund: currentFund_()
  };
}

function resultsSheet_() {
  return genericSheet_(RESULTS_SHEET_NAME, [
    'matchNumber', 'whiteGoals', 'blackGoals', 'winner', 'played', 'updatedAt'
  ]);
}

function listResults_() {
  const values = resultsSheet_().getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values.shift();
  return values
    .filter(row => row[0] !== '' && row[0] != null)
    .map(row => Object.fromEntries(headers.map((header, index) => [header, row[index]])));
}

function saveResult_(item) {
  const matchNumber = Number(item && item.matchNumber);
  const whiteGoals = Number(item && item.whiteGoals);
  const blackGoals = Number(item && item.blackGoals);
  if (!matchNumber || !Number.isFinite(whiteGoals) || !Number.isFinite(blackGoals) || whiteGoals < 0 || blackGoals < 0) {
    throw new Error('Completá una fecha y un marcador válidos.');
  }
  const winner = whiteGoals === blackGoals ? 'draw' : whiteGoals > blackGoals ? 'white' : 'black';
  const saved = {
    matchNumber: matchNumber,
    whiteGoals: whiteGoals,
    blackGoals: blackGoals,
    winner: winner,
    played: true,
    updatedAt: new Date().toISOString()
  };
  const sheet = resultsSheet_();
  const values = sheet.getDataRange().getValues();
  const index = values.findIndex((row, rowIndex) => rowIndex > 0 && String(row[0]) === String(matchNumber));
  const row = [saved.matchNumber, saved.whiteGoals, saved.blackGoals, saved.winner, saved.played, saved.updatedAt];
  if (index >= 0) sheet.getRange(index + 1, 1, 1, row.length).setValues([row]);
  else sheet.appendRow(row);
  return saved;
}

function syncResultToTournamentSheet_(result) {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  const resultLabel = result.winner === 'draw' ? 'Empate' : result.winner === 'white' ? 'Gana E1' : 'Gana E2';
  const ignored = [SHEET_NAME, MVP_SHEET_NAME, LINEUP_SHEET_NAME, SANCTION_SHEET_NAME, RESULTS_SHEET_NAME];

  for (const candidate of book.getSheets()) {
    if (ignored.includes(candidate.getName()) || candidate.getLastRow() < 2) continue;
    const values = candidate.getDataRange().getDisplayValues();
    const headerIndex = values.findIndex(row => {
      const headers = row.map(normalize_);
      return headers.includes('PARTIDO') && headers.includes('G/P/E');
    });
    if (headerIndex < 0) continue;

    const headers = values[headerIndex].map(normalize_);
    const matchColumn = headers.indexOf('PARTIDO');
    const resultColumn = headers.indexOf('G/P/E');
    const whiteGoalsColumn = headers.indexOf('GOLES CLARO WEB');
    const blackGoalsColumn = headers.indexOf('GOLES OSCURO WEB');
    const rowIndex = values.findIndex((row, index) => index > headerIndex && String(row[matchColumn]).trim() === String(result.matchNumber));
    if (rowIndex < 0) continue;

    candidate.getRange(rowIndex + 1, resultColumn + 1).setValue(resultLabel);
    if (whiteGoalsColumn >= 0) candidate.getRange(rowIndex + 1, whiteGoalsColumn + 1).setValue(result.whiteGoals);
    if (blackGoalsColumn >= 0) candidate.getRange(rowIndex + 1, blackGoalsColumn + 1).setValue(result.blackGoals);
    SpreadsheetApp.flush();
    return;
  }

  throw new Error('No se encontró la fecha en la hoja original de partidos.');
}

function sheet_() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = book.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = book.insertSheet(SHEET_NAME);
    sheet.appendRow(['id','createdAt','matchNumber','matchDate','player','team','goals','mvpVote','note','status','reviewedAt']);
    sheet.setFrozenRows(1);
  }
  const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
  if (!headers.includes('mvpVote')) {
    const goalsColumn = headers.indexOf('goals') + 1;
    sheet.insertColumnAfter(goalsColumn);
    sheet.getRange(1,goalsColumn + 1).setValue('mvpVote');
  }
  return sheet;
}

function submit_(item) {
  const sheet = sheet_(), rows = list_();
  if (!validParticipant_(item.matchNumber, item.player)) throw new Error('Solo pueden votar los jugadores que participaron en esa fecha.');
  if (!validParticipant_(item.matchNumber, item.mvpVote)) throw new Error('El voto MVP debe ser para un jugador que participó en esa fecha.');
  if (String(item.player).trim() === String(item.mvpVote).trim()) throw new Error('No podés votarte a vos mismo como MVP.');
  if (rows.some(x => String(x.matchNumber) === String(item.matchNumber) && x.player === item.player && x.status !== 'rejected')) throw new Error('Ya existe una declaración para ese jugador en esta fecha.');
  sheet.appendRow([item.id,item.createdAt,item.matchNumber,item.matchDate,item.player,item.team,item.goals,item.mvpVote||'',item.note||'',item.status||'pending','']);
  return item;
}

function validParticipant_(matchNumber, player) {
  const wantedPlayer = normalize_(player);
  if (!wantedPlayer) return false;
  const custom = listRows_(LINEUP_SHEET_NAME,['matchNumber','date','white','black','updatedAt']).find(x => String(x.matchNumber) === String(matchNumber));
  if (custom) {
    let white=[],black=[];
    try { white=JSON.parse(custom.white||'[]'); black=JSON.parse(custom.black||'[]'); } catch(error) {}
    return [...white,...black].some(name => normalize_(name) === wantedPlayer);
  }
  const sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  for (const candidate of sheets) {
    if ([SHEET_NAME,MVP_SHEET_NAME,LINEUP_SHEET_NAME,SANCTION_SHEET_NAME].includes(candidate.getName()) || candidate.getLastRow() < 2) continue;
    const values = candidate.getDataRange().getDisplayValues();
    const headerIndex = values.findIndex(row => row.some(v => normalize_(v) === 'JUGADOR 1') && row.some(v => normalize_(v) === 'JUGADOR 16'));
    if (headerIndex < 0) continue;
    const headers = values[headerIndex].map(normalize_);
    const matchColumn = headers.indexOf('PARTIDO');
    const playerColumns = headers.map((value,index) => /^JUGADOR ([1-9]|1[0-6])$/.test(value) ? index : -1).filter(index => index >= 0);
    const row = values.slice(headerIndex + 1).find(r => String(r[matchColumn]).trim() === String(matchNumber).trim());
    if (!row) continue;
    return playerColumns.some(column => normalize_(row[column]) === wantedPlayer);
  }
  throw new Error('No se encontró la hoja de partidos para validar la fecha.');
}

function mvpSheet_() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = book.getSheetByName(MVP_SHEET_NAME);
  if (!sheet) { sheet = book.insertSheet(MVP_SHEET_NAME); sheet.appendRow(['matchNumber','player','confirmedAt']); sheet.setFrozenRows(1); }
  return sheet;
}

function listLegacyMvp_() {
  const values = mvpSheet_().getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values.shift();
  return values.filter(r => r[0] !== '').map(row => Object.fromEntries(headers.map((h,i) => [h,row[i]])));
}

function confirmMvp_(matchNumber, player) {
  const sheet = mvpSheet_(), values = sheet.getDataRange().getValues();
  const rowIndex = values.findIndex((row,i) => i > 0 && String(row[0]) === String(matchNumber));
  const row = [matchNumber,player,new Date().toISOString()];
  if (rowIndex >= 0) sheet.getRange(rowIndex + 1,1,1,3).setValues([row]); else sheet.appendRow(row);
  return { matchNumber: matchNumber, player: player, confirmedAt: row[2] };
}

function deleteMvp_(matchNumber) {
  const sheet=mvpSheet_(), values=sheet.getDataRange().getValues();
  const index=values.findIndex((row,i)=>i>0&&String(row[0])===String(matchNumber));
  if(index>=0) sheet.deleteRow(index+1);
}

function requirePin_(pin) { if(!validPin_(pin)) throw new Error('PIN incorrecto'); }

function genericSheet_(name,headers) {
  const book=SpreadsheetApp.getActiveSpreadsheet(); let sheet=book.getSheetByName(name);
  if(!sheet){sheet=book.insertSheet(name);sheet.appendRow(headers);sheet.setFrozenRows(1)} return sheet;
}

function listRows_(name,headers) {
  const values=genericSheet_(name,headers).getDataRange().getValues(); if(values.length<2)return[];
  const columns=values.shift(); return values.filter(r=>r[0]!==''&&r[0]!=null).map(row=>Object.fromEntries(columns.map((h,i)=>[h,row[i]])));
}

function saveLineup_(item) {
  const white=Array.isArray(item.white)?item.white:[], black=Array.isArray(item.black)?item.black:[];
  if(!item.matchNumber||white.length===0||black.length===0)throw new Error('Completá ambos equipos.');
  if(new Set([...white,...black].map(normalize_)).size!==white.length+black.length)throw new Error('Un jugador no puede estar en los dos equipos.');
  const sheet=genericSheet_(LINEUP_SHEET_NAME,['matchNumber','date','white','black','updatedAt']),values=sheet.getDataRange().getValues();
  const row=[item.matchNumber,item.date||'',JSON.stringify(white),JSON.stringify(black),new Date().toISOString()];
  const index=values.findIndex((r,i)=>i>0&&String(r[0])===String(item.matchNumber));
  if(index>=0)sheet.getRange(index+1,1,1,row.length).setValues([row]);else sheet.appendRow(row); return item;
}

function addSanction_(item) {
  if(!item.player||!Number(item.points))throw new Error('Indicá jugador y puntos de sanción.');
  const saved={id:Utilities.getUuid(),player:item.player,points:-Math.abs(Number(item.points)),reason:item.reason||'',createdAt:new Date().toISOString()};
  genericSheet_(SANCTION_SHEET_NAME,['id','player','points','reason','createdAt']).appendRow([saved.id,saved.player,saved.points,saved.reason,saved.createdAt]);return saved;
}

function deleteRowById_(name,id) {
  const sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);if(!sheet)return;
  const values=sheet.getDataRange().getValues(),index=values.findIndex((r,i)=>i>0&&String(r[0])===String(id));if(index>=0)sheet.deleteRow(index+1);
}

function clearGoals_(id) {
  const sheet = sheet_(), values = sheet.getDataRange().getValues(), headers = values[0];
  const idColumn = headers.indexOf('id'), goalsColumn = headers.indexOf('goals');
  const index = values.findIndex((row, rowIndex) => rowIndex > 0 && String(row[idColumn]) === String(id));
  if (index >= 0 && goalsColumn >= 0) sheet.getRange(index + 1, goalsColumn + 1).setValue(0);
}

function listWebPlayers_() {
  let players = listRows_(PLAYERS_SHEET_NAME,['name','status','updatedAt']);
  if (!players.length) {
    seedPlayersFromExistingSheet_();
    players = listRows_(PLAYERS_SHEET_NAME,['name','status','updatedAt']);
  }
  return players;
}

function seedPlayersFromExistingSheet_() {
  const book = SpreadsheetApp.getActiveSpreadsheet(), target = genericSheet_(PLAYERS_SHEET_NAME,['name','status','updatedAt']);
  for (const candidate of book.getSheets()) {
    if (candidate.getName() === PLAYERS_SHEET_NAME || candidate.getLastRow() < 2) continue;
    const values = candidate.getDataRange().getDisplayValues();
    for (let rowIndex = 0; rowIndex < Math.min(values.length,10); rowIndex++) {
      const column = values[rowIndex].findIndex(value => normalize_(value) === 'JUGADORES');
      if (column < 0) continue;
      const names = [...new Set(values.slice(rowIndex + 1).map(row => normalize_(row[column])).filter(Boolean))];
      if (!names.length) continue;
      const now = new Date().toISOString();
      target.getRange(2,1,names.length,3).setValues(names.map(name => [name,'active',now]));
      return;
    }
  }
}

function setWebPlayer_(name,status) {
  const normalized = normalize_(name);
  if (!normalized) throw new Error('Escribí el nombre del jugador.');
  const sheet = genericSheet_(PLAYERS_SHEET_NAME,['name','status','updatedAt']);
  const values = sheet.getDataRange().getValues();
  const index = values.findIndex((row,rowIndex) => rowIndex > 0 && normalize_(row[0]) === normalized);
  const saved = {name: normalized, status: status, updatedAt: new Date().toISOString()};
  const row = [saved.name,saved.status,saved.updatedAt];
  if (index >= 0) sheet.getRange(index + 1,1,1,row.length).setValues([row]); else sheet.appendRow(row);
  return saved;
}

function deleteDate_(matchNumber) {
  const number = String(matchNumber);
  [LINEUP_SHEET_NAME,RESULTS_SHEET_NAME,MVP_SHEET_NAME,MATCH_RECORDS_SHEET_NAME,MVP_VOTES_SHEET_NAME].forEach(name => {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
    if (!sheet) return;
    const values = sheet.getDataRange().getValues();
    for (let index = values.length - 1; index > 0; index--) if (String(values[index][0]) === number) sheet.deleteRow(index + 1);
  });
  const submissions = sheet_(), values = submissions.getDataRange().getValues(), headers = values[0], matchColumn = headers.indexOf('matchNumber');
  for (let index = values.length - 1; index > 0; index--) if (String(values[index][matchColumn]) === number) submissions.deleteRow(index + 1);
  const deleted = genericSheet_(DELETED_DATES_SHEET_NAME,['matchNumber','deletedAt']);
  deleted.appendRow([matchNumber,new Date().toISOString()]);
}

function savePlayoff_(item) {
  const sheet = genericSheet_(PLAYOFF_SHEET_NAME,['key','round','slot','player1','player2','score1','score2','winner','updatedAt']);
  const key = String(item.round) + '-' + String(item.slot), values = sheet.getDataRange().getValues();
  const saved = Object.assign({},item,{key:key,updatedAt:new Date().toISOString()});
  const row = [key,saved.round,saved.slot,saved.player1,saved.player2,saved.score1,saved.score2,saved.winner,saved.updatedAt];
  const index = values.findIndex((value,rowIndex) => rowIndex > 0 && String(value[0]) === key);
  if (index >= 0) sheet.getRange(index + 1,1,1,row.length).setValues([row]); else sheet.appendRow(row);
  return saved;
}

function resetSeason_(seasonName) {
  const book = SpreadsheetApp.getActiveSpreadsheet(), label = String(seasonName || 'Temporada').trim().slice(0,35);
  saveSeasonHistory_(label);
  const names = [SHEET_NAME,MVP_SHEET_NAME,LINEUP_SHEET_NAME,SANCTION_SHEET_NAME,RESULTS_SHEET_NAME,PLAYOFF_SHEET_NAME,DELETED_DATES_SHEET_NAME,MATCH_RECORDS_SHEET_NAME,MVP_VOTES_SHEET_NAME];
  names.forEach(name => {
    const sheet = book.getSheetByName(name);
    if (!sheet) return;
    if (sheet.getLastRow() > 1) {
      const base = ('ARCHIVO ' + label + ' - ' + name).slice(0,90); let archiveName = base, counter = 2;
      while (book.getSheetByName(archiveName)) archiveName = (base.slice(0,85) + ' ' + counter++).slice(0,90);
      sheet.copyTo(book).setName(archiveName);
      sheet.deleteRows(2,sheet.getLastRow()-1);
    }
  });
  SpreadsheetApp.flush();
}

function currentFund_(){const items=listRows_(FUND_SHEET_NAME,['amount','updatedAt']);return items.length?items[items.length-1]:{amount:0,updatedAt:''};}
function saveFund_(amount){const value=Math.max(0,Number(amount)||0),sheet=genericSheet_(FUND_SHEET_NAME,['amount','updatedAt']),stamp=new Date().toISOString();if(sheet.getLastRow()>1)sheet.getRange(2,1,1,2).setValues([[value,stamp]]);else sheet.appendRow([value,stamp]);return{amount:value,updatedAt:stamp};}
function addHistoricalChampion_(item){
  item=item||{};
  const season=String(item.season||'Temporada').trim(),player=String(item.player||'').trim();
  if(!player)throw new Error('Falta elegir el jugador.');
  const sheet=genericSheet_(HISTORY_SHEET_NAME,['season','player','champion','points','goals','attendance','mvps','placement','archivedAt']),stamp=new Date().toISOString(),values=sheet.getDataRange().getValues(),champion=!/::(P2|P3|GOLEADOR|MVP)$/.test(season),row=[season,player,champion,Number(item.points||0),Number(item.goals||0),Number(item.attendance||0),Number(item.mvps||0),Number(item.place||item.placement||0)||'',stamp],index=values.findIndex((value,rowIndex)=>rowIndex>0&&String(value[0]).trim()===season&&normalize_(value[1])===normalize_(player));
  if(index>=0)sheet.getRange(index+1,1,1,row.length).setValues([row]);else sheet.appendRow(row);
  return{season:season,player:player,champion:champion,points:row[3],goals:row[4],attendance:row[5],mvps:row[6],placement:row[7],archivedAt:stamp};
}
function deleteHistoricalChampion_(season,player){
  const sheet=genericSheet_(HISTORY_SHEET_NAME,['season','player','champion','points','goals','attendance','mvps','placement','archivedAt']),values=sheet.getDataRange().getValues();
  for(let index=values.length-1;index>0;index--)if(String(values[index][0]).trim()===String(season||'').trim()&&normalize_(values[index][1])===normalize_(player))sheet.deleteRow(index+1);
}
function saveSeasonHistory_(season) {
  closeMvpVoting();
  const lineups=listRows_(LINEUP_SHEET_NAME,['matchNumber','date','white','black','updatedAt']),results=new Map(listResults_().map(x=>[Number(x.matchNumber),x])),records=rawMatchRecords_(),managed=new Set(records.map(r=>Number(r.matchNumber))),rows=new Map();
  const add=name=>{const id=participantKey_(name);if(!id)return null;if(!rows.has(id))rows.set(id,{player:String(name).trim(),points:0,goals:0,attendance:0,mvps:0});return rows.get(id)};
  listWebPlayers_().filter(x=>x.status!=='deleted').forEach(x=>add(x.name));
  lineups.filter(match=>Number(match.matchNumber)<=18).forEach(match=>{
    const result=results.get(Number(match.matchNumber));if(!result||String(result.played)==='false')return;
    const parse=x=>Array.isArray(x)?x:JSON.parse(x||'[]');
    [[parse(match.white),'white'],[parse(match.black),'black']].forEach(([names,team])=>names.forEach(name=>{const row=add(name);row.attendance++;row.points+=result.winner==='draw'?2:result.winner===team?3:1}));
  });
  listMvp_().forEach(item=>{const row=add(item.player),points=Number(item.points??1);if(row){row.mvps+=points;if(Number(item.matchNumber)<=18)row.points+=points}});
  records.forEach(record=>{record.scorers.forEach(item=>{const row=add(item.player);if(row)row.goals+=item.goals});if(Number(record.matchNumber)<=18)record.scorerAwards.forEach(award=>{const row=add(award.player);if(row)row.points+=award.points})});
  list_().filter(item=>item.status==='approved'&&!managed.has(Number(item.matchNumber))).forEach(item=>{const row=add(item.player);if(row)row.goals+=Number(item.goals||0)});
  listRows_(SANCTION_SHEET_NAME,['id','player','points','reason','createdAt']).forEach(item=>{const row=add(item.player);if(row)row.points+=Number(item.points||0)});
  const ranking=[...rows.values()].filter(row=>row.attendance||row.goals||row.mvps),playoffs=listRows_(PLAYOFF_SHEET_NAME,['key','round','slot','player1','player2','score1','score2','winner','updatedAt']),final=playoffs.find(x=>x.key==='final-1'),third=playoffs.find(x=>x.key==='third-1');
  const champion=final?.winner||[...ranking].sort((a,b)=>b.points-a.points)[0]?.player||'',runner=final?(final.winner===final.player1?final.player2:final.player1):'';
  const sheet=genericSheet_(HISTORY_SHEET_NAME,['season','player','champion','points','goals','attendance','mvps','placement','archivedAt']),stamp=new Date().toISOString();
  ranking.forEach(row=>sheet.appendRow([season,row.player,participantKey_(row.player)===participantKey_(champion),row.points,row.goals,row.attendance,row.mvps,participantKey_(row.player)===participantKey_(champion)?1:participantKey_(row.player)===participantKey_(runner)?2:participantKey_(row.player)===participantKey_(third?.winner)?3:'',stamp]));
}


function normalize_(value) {
  return String(value || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
}

function list_() {
  const values = sheet_().getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values.shift();
  return values.filter(r => r[0]).map(row => Object.fromEntries(headers.map((h,i) => [h,row[i]])));
}

function decide_(id, status) {
  if (!['approved','rejected'].includes(status)) throw new Error('Estado inválido');
  const sheet = sheet_(), values = sheet.getDataRange().getValues(), headers = values[0];
  const idCol = headers.indexOf('id'), statusCol = headers.indexOf('status'), reviewedCol = headers.indexOf('reviewedAt');
  const index = values.findIndex((row,i) => i > 0 && String(row[idCol]) === String(id));
  if (index < 0) throw new Error('Solicitud inexistente');
  sheet.getRange(index + 1,statusCol + 1).setValue(status);
  sheet.getRange(index + 1,reviewedCol + 1).setValue(new Date().toISOString());
  return list_().find(x => String(x.id) === String(id));
}

function validPin_(pin) { const configured=PropertiesService.getScriptProperties().getProperty('ADMIN_PIN'); return Boolean(configured)&&String(pin)===String(configured); }
function json_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }// Official match goals and MVP voting. Old seasons/declarations remain readable.
function locked_(operation) {
  const lock=LockService.getScriptLock();lock.waitLock(20000);
  try{return operation()}finally{lock.releaseLock()}
}
function participantKey_(name) {
  const id=normalize_(name).replace(/[^A-Z0-9]/g,'');return id==='JOACO'?'JOACOREGGI':id;
}
function matchLineup_(number) {
  const item=listRows_(LINEUP_SHEET_NAME,['matchNumber','date','white','black','updatedAt']).find(x=>Number(x.matchNumber)===Number(number));
  if(!item)throw new Error('Primero guardá los equipos de esta fecha.');
  const parse=value=>Array.isArray(value)?value:JSON.parse(value||'[]');
  return {...item,white:parse(item.white),black:parse(item.black)};
}
function rawMatchRecords_() {
  return listRows_(MATCH_RECORDS_SHEET_NAME,['matchNumber','record','updatedAt']).map(row=>JSON.parse(row.record));
}
function findMatchRecord_(number){return rawMatchRecords_().find(x=>Number(x.matchNumber)===Number(number))}
function writeMatchRecord_(record) {
  const sheet=genericSheet_(MATCH_RECORDS_SHEET_NAME,['matchNumber','record','updatedAt']),values=sheet.getDataRange().getValues();
  record.updatedAt=new Date().toISOString();
  const row=[record.matchNumber,JSON.stringify(record),record.updatedAt],index=values.findIndex((r,i)=>i>0&&Number(r[0])===Number(record.matchNumber));
  if(index>=0)sheet.getRange(index+1,1,1,3).setValues([row]);else sheet.appendRow(row);
}
function listMatchRecords_() {
  // Votes themselves are available only through the PIN-protected endpoint.
  return rawMatchRecords_().map(record=>({...record,closed: Boolean(record.closed),mvpAwards:record.closed?record.mvpAwards||[]:[],voteCount:record.closed?Number(record.voteCount||0):null}));
}
function votingWindow_(value) {
  let iso;
  if(value instanceof Date)iso=Utilities.formatDate(value,'America/Argentina/Buenos_Aires','yyyy-MM-dd');
  else {
    const raw=String(value||'').trim(),match=raw.match(/^(\d{4}-\d{2}-\d{2})/),parts=raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    iso=match?match[1]:parts?parts[3]+'-'+parts[2].padStart(2,'0')+'-'+parts[1].padStart(2,'0'):'';
  }
  const day=new Date(iso+'T12:00:00Z');if(!iso||!Number.isFinite(day.getTime())||day.toISOString().slice(0,10)!==iso)throw new Error('Confirmá el día del partido antes de abrir la votación.');
  // Saturday of the match's Monday–Sunday week, in Argentine time (UTC−3).
  const weekday=day.getUTCDay();day.setUTCDate(day.getUTCDate()+(weekday===0?-1:6-weekday));
  const opensAt=new Date(day.toISOString().slice(0,10)+'T20:00:00-03:00'),closesAt=new Date(opensAt.getTime()+48*60*60*1000);
  return {opensAt:opensAt.toISOString(),closesAt:closesAt.toISOString()};
}
function validateScorers_(items,lineup,whiteGoals,blackGoals) {
  if(!Array.isArray(items))throw new Error('Revisá los goleadores desde el marcador en vivo antes de publicar.');
  const seen=new Set(),totals={white:0,black:0};
  const scorers=items.map(item=>{
    if(!item||!['white','black'].includes(item.team)||!Number.isInteger(item.goals)||item.goals<0)throw new Error('Los goles individuales deben ser números enteros positivos o cero.');
    const player=lineup[item.team].find(name=>participantKey_(name)===participantKey_(item.player));
    if(!player)throw new Error('Cada goleador debe pertenecer al equipo guardado para este partido.');
    const id=participantKey_(player);if(seen.has(id))throw new Error('Hay un goleador repetido.');seen.add(id);totals[item.team]+=item.goals;
    return {player,team:item.team,goals:item.goals};
  });
  if(totals.white!==whiteGoals||totals.black!==blackGoals)throw new Error('Los goles individuales no coinciden con el marcador. Revisá las anotaciones antes de publicar.');
  return scorers;
}
function splitAward_(items,budget,valueOf) {
  const best=Math.max(0,...items.map(valueOf));if(!best)return [];
  const winners=items.filter(item=>valueOf(item)===best);
  return winners.map(item=>({player:item.player,points:budget/winners.length}));
}
function saveOfficialMatch_(item) {
  return locked_(()=>{
    const number=Number(item&&item.matchNumber),whiteGoals=Number(item&&item.whiteGoals),blackGoals=Number(item&&item.blackGoals);
    if(!Number.isInteger(number)||number<1||![whiteGoals,blackGoals].every(n=>Number.isInteger(n)&&n>=0&&n<=999))throw new Error('Completá una fecha y un marcador válidos.');
    const lineup=matchLineup_(number),existing=findMatchRecord_(number),oldResult=listResults_().find(x=>Number(x.matchNumber)===number);
    // Manual historical corrections preserve historical goals/MVP. A new match requires its scorer ledger.
    if(!Array.isArray(item.scorers)&&oldResult&&!existing)return saveResult_(item);
    let scorers;
    if(Array.isArray(item.scorers))scorers=validateScorers_(item.scorers,lineup,whiteGoals,blackGoals);
    else if(existing)scorers=validateScorers_(existing.scorers,lineup,whiteGoals,blackGoals);
    else throw new Error('Anotá los goles desde Marcador en vivo y tocá Revisar resultado.');
    const window=votingWindow_(lineup.date),hasVotes=listMvpVotes_().some(v=>Number(v.matchNumber)===number);
    if(existing&&existing.matchDate!==String(lineup.date)&&hasVotes)throw new Error('Esta fecha ya tiene votos. No se puede cambiar su día al publicar.');
    const legacyAwards=!existing&&oldResult?listLegacyMvp_().filter(a=>Number(a.matchNumber)===number):[];
    const initial=legacyAwards.length?{...window,closed:true,closedAt:legacyAwards[0].confirmedAt,mvpAwards:legacyAwards.map(a=>({player:a.player,points:Number(a.points??1)})),voteCount:0,legacyMvp:true}:{...window,closed:false,mvpAwards:[],voteCount:0};
    const record={...(existing||{}),matchNumber:number,matchDate:String(lineup.date),scorers,scorerAwards:splitAward_(scorers,0.5,x=>x.goals),...(existing?{}:initial)};
    const saved=saveResult_(item);writeMatchRecord_(record);SpreadsheetApp.flush();
    if(automationReady_())scheduleVotingClose_(record);
    return {...saved,scorers};
  });
}
function listMvpVotes_(){return listRows_(MVP_VOTES_SHEET_NAME,['matchNumber','player','candidate','createdAt'])}
function voteMvp_(item) {
  return locked_(()=>{
    if(!item)throw new Error('Elegí tu nombre y a quién querés votar.');
    const number=Number(item.matchNumber),record=findMatchRecord_(number),now=Date.now();
    if(!record)throw new Error('Esta fecha todavía no tiene votación de MVP abierta.');
    if(record.closed||now>=Date.parse(record.closesAt))throw new Error('La votación de esta fecha ya terminó.');
    if(now<Date.parse(record.opensAt))throw new Error('La votación abre el sábado a las 20:00.');
    if(!listResults_().some(x=>Number(x.matchNumber)===number&&String(x.played)!=='false'))throw new Error('El partido todavía no tiene resultado publicado.');
    const lineup=matchLineup_(number),players=[...lineup.white,...lineup.black];
    const player=players.find(name=>participantKey_(name)===participantKey_(item.player)),candidate=players.find(name=>participantKey_(name)===participantKey_(item.candidate));
    if(!player||!candidate)throw new Error('Solo pueden votar y recibir votos los jugadores de este partido.');
    if(participantKey_(player)===participantKey_(candidate))throw new Error('No podés votarte a vos mismo.');
    if(listMvpVotes_().some(v=>Number(v.matchNumber)===number&&participantKey_(v.player)===participantKey_(player)))throw new Error('Ya votaste en esta fecha. Cada jugador tiene un solo voto.');
    const saved={matchNumber:number,player,candidate,createdAt:new Date().toISOString()};
    genericSheet_(MVP_VOTES_SHEET_NAME,['matchNumber','player','candidate','createdAt']).appendRow([number,player,candidate,saved.createdAt]);
    SpreadsheetApp.flush();return saved;
  });
}
function closeMvpVoting() {
  const due=record=>!record.closed&&Date.now()>=Date.parse(record.closesAt);
  if(!rawMatchRecords_().some(due))return;
  return locked_(()=>{
    const pending=rawMatchRecords_().filter(due);if(!pending.length)return;
    const votes=listMvpVotes_();
    pending.forEach(record=>{
      const totals=new Map();votes.filter(v=>Number(v.matchNumber)===Number(record.matchNumber)).forEach(v=>{
        const id=participantKey_(v.candidate),row=totals.get(id)||{player:v.candidate,votes:0};row.votes++;totals.set(id,row);
      });
      record.mvpAwards=splitAward_([...totals.values()],1,x=>x.votes);record.voteCount=[...totals.values()].reduce((sum,row)=>sum+row.votes,0);record.closed=true;record.closedAt=new Date().toISOString();writeMatchRecord_(record);
    });SpreadsheetApp.flush();
  });
}
function listMvp_() {
  const records=rawMatchRecords_(),managed=new Set(records.map(r=>Number(r.matchNumber)));
  return listLegacyMvp_().filter(item=>!managed.has(Number(item.matchNumber))).concat(records.filter(r=>r.closed).flatMap(r=>(r.mvpAwards||[]).map(a=>({...a,matchNumber:r.matchNumber,confirmedAt:r.closedAt,automatic:true}))));
}
function automationReady_(){return PropertiesService.getScriptProperties().getProperty('MVP_AUTOMATION_READY')==='true'}
function scheduleVotingClose_(record) {
  if(record.closed||Date.parse(record.closesAt)<=Date.now())return;
  const properties=PropertiesService.getScriptProperties(),key='MVP_TRIGGER_'+record.matchNumber+'_'+record.closesAt;
  if(properties.getProperty(key))return;
  const trigger=ScriptApp.newTrigger('closeMvpVoting').timeBased().at(new Date(record.closesAt)).create();properties.setProperty(key,trigger.getUniqueId());
}
// Run once in the Apps Script editor and authorize Google's trigger permission.
function setupTournamentAutomation() {
  const properties=PropertiesService.getScriptProperties(),id=properties.getProperty('MVP_PERIODIC_TRIGGER_ID');
  if(!ScriptApp.getProjectTriggers().some(t=>t.getUniqueId()===id)){const trigger=ScriptApp.newTrigger('closeMvpVoting').timeBased().everyMinutes(5).create();properties.setProperty('MVP_PERIODIC_TRIGGER_ID',trigger.getUniqueId())}
  PropertiesService.getScriptProperties().setProperty('MVP_AUTOMATION_READY','true');
  rawMatchRecords_().forEach(scheduleVotingClose_);closeMvpVoting();
}

function saveVotingLineup_(item) {
  return locked_(()=>{
    const existing=findMatchRecord_(item.matchNumber);
    if(existing){
      const previous=matchLineup_(item.matchNumber),changed=String(previous.date)!==String(item.date)||JSON.stringify(previous.white)!==JSON.stringify(item.white)||JSON.stringify(previous.black)!==JSON.stringify(item.black);
      if(changed)throw new Error('Esta fecha ya está publicada con goles oficiales. Conservá sus equipos y día; para otro partido, usá una fecha nueva.');
    }
    return saveLineup_(item);
  });
}
