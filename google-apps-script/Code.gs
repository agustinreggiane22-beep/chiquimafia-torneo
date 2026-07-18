const SHEET_NAME = 'Goles Web';
const MVP_SHEET_NAME = 'MVP Web';
const LINEUP_SHEET_NAME = 'Equipos Web';
const SANCTION_SHEET_NAME = 'Sanciones Web';
const RESULTS_SHEET_NAME = 'Resultados Web';
const PLAYERS_SHEET_NAME = 'Jugadores Web';
const PLAYOFF_SHEET_NAME = 'Playoffs Web';
const DELETED_DATES_SHEET_NAME = 'Fechas Eliminadas Web';

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    if (body.action === 'submit') return json_({ ok: true, item: submit_(body.item) });
    if (body.action === 'list') return json_({ ok: true, items: list_() });
    if (body.action === 'auth') return json_({ ok: true, authenticated: validPin_(body.pin) });
    if (body.action === 'listMvp') return json_({ ok: true, items: listMvp_() });
    if (body.action === 'confirmMvp') {
      if (!validPin_(body.pin)) throw new Error('PIN incorrecto');
      if (!validParticipant_(body.matchNumber, body.player)) throw new Error('El MVP debe haber participado en esa fecha.');
      return json_({ ok: true, item: confirmMvp_(body.matchNumber, body.player) });
    }
    if (body.action === 'deleteMvp') { requirePin_(body.pin); deleteMvp_(body.matchNumber); return json_({ ok:true }); }
    if (body.action === 'listLineups') return json_({ ok:true, items:listRows_(LINEUP_SHEET_NAME,['matchNumber','date','white','black','updatedAt']) });
    if (body.action === 'saveLineup') { requirePin_(body.pin); return json_({ok:true,item:saveLineup_(body.item)}); }
    if (body.action === 'listResults') return json_({ok:true,items:listResults_()});
    if (body.action === 'saveResult') { requirePin_(body.pin); return json_({ok:true,item:saveResult_(body.item)}); }
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
  return {
    ok: true,
    version: '2026-07-18-torneo-independiente-v1',
    players: listWebPlayers_(),
    lineups: listRows_(LINEUP_SHEET_NAME,['matchNumber','date','white','black','updatedAt']),
    results: listResults_(),
    mvps: listMvp_(),
    sanctions: listRows_(SANCTION_SHEET_NAME,['id','player','points','reason','createdAt']),
    deletedDates: listRows_(DELETED_DATES_SHEET_NAME,['matchNumber','deletedAt']),
    playoffs: listRows_(PLAYOFF_SHEET_NAME,['key','round','slot','player1','player2','score1','score2','winner','updatedAt'])
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

function listMvp_() {
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
  [LINEUP_SHEET_NAME,RESULTS_SHEET_NAME,MVP_SHEET_NAME].forEach(name => {
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
  const names = [SHEET_NAME,MVP_SHEET_NAME,LINEUP_SHEET_NAME,SANCTION_SHEET_NAME,RESULTS_SHEET_NAME,PLAYOFF_SHEET_NAME,DELETED_DATES_SHEET_NAME];
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

function validPin_(pin) { return String(pin) === String(PropertiesService.getScriptProperties().getProperty('ADMIN_PIN')); }
function json_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
