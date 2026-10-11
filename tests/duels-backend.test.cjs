const {test}=require('node:test'),assert=require('node:assert/strict'),{createBackend}=require('./apps-script-harness.cjs');
const white=['LORIA','DIEGO','MATU','FRANCO','VALEN','DARIO','BILLO','JOACO'],black=['LUCAS','PABLO','GONZA','AUGUSTO','LIHUEL','AGUS','LAUTY','KEVIN'];
function fixture(){const b=createBackend();for(const name of [...white,...black])assert(b.call('addPlayer',{pin:'test-pin',name}).ok);for(const [matchNumber,date] of [[1,'2026-10-03'],[2,'2026-10-10'],[3,'2026-10-17']])assert(b.call('saveLineup',{pin:'test-pin',item:{matchNumber,date,white,black}}).ok);return b}
const duel=(b,extra={},pin='test-pin')=>b.call('saveDuel',{pin,item:{matchNumber:1,challenger:'LORIA',challenged:'LUCAS',confirmed:true,...extra}});
function publish(b,w=1,k=0){const scorers=[];if(w)scorers.push({player:'LORIA',team:'white',goals:w});if(k)scorers.push({player:'LUCAS',team:'black',goals:k});return b.call('saveResult',{pin:'test-pin',item:{matchNumber:1,whiteGoals:w,blackGoals:k,scorers}})}
test('server validates PIN, acceptance, regular dates, opposite teams and registered participants',()=>{
 const b=fixture();assert(!duel(b,{},'wrong').ok);assert(!duel(b,{confirmed:false}).ok);assert(!duel(b,{matchNumber:19}).ok);assert(!duel(b,{challenged:'LORIA'}).ok);const played=fixture();publish(played,0,0);assert(!duel(played,{challenged:'DIEGO'}).ok);assert(!duel(b,{challenged:'OUTSIDE'}).ok);assert.equal(b.state().duels.length,0);
 b.call('deletePlayer',{pin:'test-pin',name:'LUCAS'});assert(!duel(b).ok);assert.equal(b.state().duels.length,0);
});
test('one accepted duel per date; repeated saves replace it and a pending result awards nothing',()=>{
 const b=fixture();assert(duel(b).ok);assert(duel(b).ok);assert(duel(b,{challenger:'DIEGO',challenged:'PABLO'}).ok);const d=b.state().duels;assert.equal(d.length,1);assert.equal(d[0].whitePlayer,'DIEGO');assert.equal(d[0].blackPlayer,'PABLO');assert.equal(d[0].challengedPlayer,'PABLO');assert.equal(d[0].status,'pending');assert.deepEqual(d[0].awards,[]);
 assert(!b.call('saveLineup',{pin:'test-pin',item:{matchNumber:1,date:'2026-10-03',white:[...white,'PABLO'],black:black.filter(n=>n!=='PABLO')}}).ok);
});
test('score corrections recalculate the half-point transfer without duplicating points or reopening MVP',()=>{
 const b=fixture();duel(b);assert(publish(b,2,1).ok);b.call('voteMvp',{item:{matchNumber:1,player:'LORIA',candidate:'DIEGO'}});let record=b.state().matchRecords[0],ends=record.closesAt;assert.deepEqual(b.state().duels[0].awards,[{player:'LORIA',points:.5},{player:'LUCAS',points:-.5}]);
 assert(publish(b,2,2).ok);assert.equal(b.state().duels[0].status,'draw');assert.deepEqual(b.state().duels[0].awards,[]);
 assert(publish(b,2,3).ok);assert(publish(b,2,3).ok);assert.deepEqual(b.state().duels[0].awards,[{player:'LORIA',points:-.5},{player:'LUCAS',points:.5}]);assert.equal(b.state().matchRecords[0].closesAt,ends);assert.equal(b.call('listMvpVotes',{pin:'test-pin'}).items.length,1);
 b.setTime('2026-10-05T23:00:00Z');assert(b.state().matchRecords[0].closed);const mvp=b.state().mvps;publish(b,4,3);assert.deepEqual(b.state().mvps,mvp);assert.equal(b.state().matchRecords[0].closesAt,ends);assert.equal(b.state().duels.length,1);
});
test('a 0–0 draw keeps both assistance points and assigns no duel award',()=>{
 const b=fixture();duel(b);publish(b,0,0);b.run('saveSeasonHistory_','DRAW');const rows=b.state().history;for(const name of ['LORIA','LUCAS']){assert.equal(rows.find(r=>r.player===name).points,2);assert.equal(rows.find(r=>r.player===name).attendance,1)}assert.deepEqual(b.state().duels[0].awards,[]);
});
test('deleting only a duel removes its transfer and preserves scores, goals and votes',()=>{
 const b=fixture();duel(b);publish(b,1,0);b.call('voteMvp',{item:{matchNumber:1,player:'LORIA',candidate:'DIEGO'}});assert(!b.call('deleteDuel',{matchNumber:1,pin:'wrong'}).ok);assert(b.call('deleteDuel',{matchNumber:1,pin:'test-pin'}).ok);assert.equal(b.state().duels.length,0);assert.equal(b.state().results[0].whiteGoals,1);assert.equal(b.state().matchRecords[0].scorers[0].goals,1);assert.equal(b.call('listMvpVotes',{pin:'test-pin'}).items.length,1);
});
test('duel cooldown and the challenged player’s five-goal defeat follow the original rules',()=>{
 const b=fixture();duel(b);publish(b,5,0);assert(!duel(b,{matchNumber:2}).ok);assert(duel(b,{matchNumber:2,challenger:'DIEGO',challenged:'PABLO'}).ok);assert(!duel(b,{matchNumber:3,challenger:'LUCAS',challenged:'MATU'}).ok);assert(duel(b,{matchNumber:3,challenger:'LORIA',challenged:'KEVIN'}).ok,'The challenger is not the challenged loser');
});
test('season archive includes transfers once, retains raw duel history and clears the next season',()=>{
 const b=fixture();duel(b);publish(b,1,0);b.setTime('2026-10-05T23:00:00Z');assert(b.call('resetSeason',{pin:'test-pin',seasonName:'DUEL TEST'}).ok);const state=b.state(),loria=state.history.find(r=>r.player==='LORIA'),lucas=state.history.find(r=>r.player==='LUCAS');assert.equal(loria.points,4);assert.equal(lucas.points,.5);assert.equal(loria.attendance,1);assert.equal(lucas.attendance,1);assert.equal(state.duels.length,0);assert.equal(state.players.length,16);assert(b.sheets.has('ARCHIVO DUEL TEST - Desafios Web'));assert.equal(b.sheets.get('ARCHIVO DUEL TEST - Desafios Web').getLastRow(),2);
 const c=fixture();duel(c);assert(c.call('deleteDate',{pin:'test-pin',matchNumber:1}).ok);assert.equal(c.state().duels.length,0);
});

test('a challenge can precede teams; both captains must later be present on opposite sides and swapped sides score correctly',()=>{
 const b=createBackend();for(const name of [...white,...black])assert(b.call('addPlayer',{pin:'test-pin',name}).ok);assert(duel(b,{challenger:'LUCAS',challenged:'LORIA'}).ok);assert.equal(b.state().lineups.length,0);assert.deepEqual(b.state().duels[0].awards,[]);
 assert(!b.call('saveLineup',{pin:'test-pin',item:{matchNumber:1,date:'2026-10-03',white:[...white,'LUCAS'],black:black.filter(n=>n!=='LUCAS')}}).ok);
 assert(b.call('saveLineup',{pin:'test-pin',item:{matchNumber:1,date:'2026-10-03',white,black}}).ok);assert.equal(b.state().duels[0].whitePlayer,'LORIA');assert.equal(b.state().duels[0].blackPlayer,'LUCAS');assert(publish(b,2,1).ok);assert.deepEqual(b.state().duels[0].awards,[{player:'LORIA',points:.5},{player:'LUCAS',points:-.5}]);
});
