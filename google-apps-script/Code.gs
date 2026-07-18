const SHEET_NAME = 'Goles Web';
const MVP_SHEET_NAME = 'MVP Web';
const LINEUP_SHEET_NAME = 'Equipos Web';
const SANCTION_SHEET_NAME = 'Sanciones Web';

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
    if (body.action === 'listSanctions') return json_({ok:true,items:listRows_(SANCTION_SHEET_NAME,['id','player','points','reason','createdAt'])});
    if (body.action === 'addSanction') { requirePin_(body.pin); return json_({ok:true,item:addSanction_(body.item)}); }
    if (body.action === 'deleteSanction') { requirePin_(body.pin); deleteRowById_(SANCTION_SHEET_NAME,body.id); return json_({ok:true}); }
    if (body.action === 'decide') {
      if (!validPin_(body.pin)) throw new Error('PIN incorrecto');
      return json_({ ok: true, item: decide_(body.id, body.status) });
    }
    throw new Error('Acción desconocida');
  } catch (error) { return json_({ ok: false, error: error.message }); }
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
