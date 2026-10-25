const {test}=require('node:test'),assert=require('node:assert/strict'),{createBackend}=require('./apps-script-harness.cjs');
function fixture(){const b=createBackend();assert(b.call('saveLineup',{pin:'test-pin',item:{matchNumber:2,date:'2026-10-03',white:['LORIA','DIEGO','JOACO','MATU'],black:['LUCAS','PABLO','KEVIN','GONZA']}}).ok);return b}
const publish=(b,scorers,extra={})=>b.call('saveResult',{pin:'test-pin',item:{matchNumber:2,whiteGoals:scorers.filter(x=>x.team==='white').reduce((s,x)=>s+x.goals,0),blackGoals:scorers.filter(x=>x.team==='black').reduce((s,x)=>s+x.goals,0),scorers,...extra}});
const vote=(b,player,candidate)=>b.call('voteMvp',{item:{matchNumber:2,player,candidate,createdAt:'1999-01-01',status:'approved'}});
test('server owns dates, rejects legacy goal declarations and validates admin/score/rosters before writes',()=>{
 const b=fixture();assert(!b.call('submit',{item:{player:'LORIA',goals:999,status:'approved'}}).ok);assert(!b.call('saveResult',{pin:'wrong',item:{matchNumber:2,whiteGoals:9,blackGoals:0,scorers:[]}}).ok);
 assert(!publish(b,[{player:'OUTSIDE',team:'white',goals:1}]).ok);assert(!publish(b,[{player:'LORIA',team:'black',goals:1}]).ok);assert(!publish(b,[{player:'LORIA',team:'white',goals:.5}]).ok);assert(!publish(b,[{player:'LORIA',team:'white',goals:1},{player:'Loria',team:'white',goals:1}]).ok);assert(!publish(b,[],{whiteGoals:1}).ok);assert.equal(b.state().results.length,0);
 assert(publish(b,[{player:'LORIA',team:'white',goals:5},{player:'LUCAS',team:'black',goals:4}]).ok);const r=b.state().matchRecords[0];assert.equal(r.opensAt,'2026-10-03T22:00:00.000Z');assert.equal(r.closesAt,'2026-10-05T22:00:00.000Z');assert.deepEqual(r.scorerAwards,[{player:'LORIA',points:.5}]);
 b.properties.delete('ADMIN_PIN');assert.equal(b.call('auth',{}).authenticated,false);
});
test('exact 48-hour window, duplicate aliases and own/outside votes are enforced on the server; private votes need PIN',()=>{
 const b=fixture();publish(b,[]);b.setTime('2026-10-03T21:59:59.999Z');assert(!vote(b,'LORIA','DIEGO').ok);b.setTime('2026-10-03T22:00:00Z');assert(vote(b,'LORIA','DIEGO').ok);assert(!vote(b,'loria','PABLO').ok);assert(vote(b,'JOACO','DIEGO').ok);assert(!vote(b,'JOACOREGGI','LUCAS').ok);assert(!vote(b,'LUCAS','Lucas').ok);assert(!vote(b,'OUTSIDE','DIEGO').ok);assert(!vote(b,'PABLO','OUTSIDE').ok);
 const state=b.state();assert.equal(state.matchRecords[0].voteCount,null);assert.deepEqual(state.matchRecords[0].mvpAwards,[]);assert(!JSON.stringify(state).includes('candidate'));assert(!b.call('listMvpVotes',{}).ok);assert.equal(b.call('listMvpVotes',{pin:'test-pin'}).items.length,2);
 b.setTime('2026-10-05T21:59:59.999Z');assert(vote(b,'PABLO','LUCAS').ok);b.setTime('2026-10-05T22:00:00Z');assert(!vote(b,'KEVIN','LUCAS').ok);assert.deepEqual(b.state().mvps.map(x=>({player:x.player,points:x.points})),[{player:'DIEGO',points:1}]);assert.equal(b.state().matchRecords[0].voteCount,3);
});
test('two and three-way ties split each award budget; repeated closures/publication never accumulate points',()=>{
 const b=fixture();publish(b,[{player:'LORIA',team:'white',goals:2},{player:'LUCAS',team:'black',goals:2}]);assert.deepEqual(b.state().matchRecords[0].scorerAwards,[{player:'LORIA',points:.25},{player:'LUCAS',points:.25}]);vote(b,'LORIA','DIEGO');vote(b,'LUCAS','PABLO');b.setTime('2026-10-05T22:00:00Z');let awards=b.state().mvps;assert.deepEqual(awards.map(x=>x.points),[.5,.5]);const timestamp=b.state().matchRecords[0].closedAt;b.run('closeMvpVoting');assert.equal(b.state().mvps.length,2);assert.equal(b.state().matchRecords[0].closedAt,timestamp);
 assert(publish(b,[{player:'LORIA',team:'white',goals:1},{player:'LUCAS',team:'black',goals:1},{player:'DIEGO',team:'white',goals:1}]).ok);assert.equal(b.state().mvps.length,2);assert.equal(b.state().matchRecords[0].closed,true);assert.equal(b.state().matchRecords[0].scorerAwards.reduce((s,x)=>s+x.points,0),.5);assert(!b.call('confirmMvp',{pin:'test-pin',matchNumber:2,player:'LORIA'}).ok);assert(!b.call('deleteMvp',{pin:'test-pin',matchNumber:2}).ok);
 const c=fixture();publish(c,[]);vote(c,'LORIA','DIEGO');vote(c,'LUCAS','PABLO');vote(c,'MATU','KEVIN');c.setTime('2026-10-05T22:00:00Z');assert.equal(c.state().mvps.length,3);assert.equal(c.state().mvps.reduce((s,x)=>s+x.points,0),1);
});
test('0–0, no voters and only two voters close correctly without inventing awards',()=>{
 const b=fixture();publish(b,[]);b.setTime('2026-10-06T00:00:00Z');assert.deepEqual(b.state().mvps,[]);assert.deepEqual(b.state().matchRecords[0].scorerAwards,[]);assert(b.state().matchRecords[0].closed);
 const c=fixture();publish(c,[]);vote(c,'LORIA','DIEGO');vote(c,'LUCAS','DIEGO');c.setTime('2026-10-05T22:00:00Z');assert.equal(c.state().mvps[0].player,'DIEGO');assert.equal(c.state().mvps[0].points,1);
});
test('retry after partial Sheet failure repairs the ledger without duplicate records; old data remains intact',()=>{
 const b=fixture();const legacy=b.context.sheet_();legacy.appendRow(['old','2026-01-01',2,'','LORIA','white',9,'DIEGO','','approved','']);b.context.mvpSheet_().appendRow([1,'PABLO','2026-01-01']);
 b.failRecord();assert(!publish(b,[{player:'LORIA',team:'white',goals:5}]).ok);assert(publish(b,[{player:'LORIA',team:'white',goals:5}]).ok);assert(publish(b,[{player:'LORIA',team:'white',goals:5}]).ok);assert.equal(b.state().matchRecords.length,1);assert.equal(b.state().results.length,1);assert.equal(b.call('list').items[0].goals,9);assert.equal(b.state().mvps[0].player,'PABLO');
 assert(!b.call('saveLineup',{pin:'test-pin',item:{matchNumber:2,date:'2026-10-10',white:['LORIA'],black:['LUCAS']}}).ok);
});
test('automation setup is idempotent and installs a server timer independent of visitors',()=>{
 const b=fixture();publish(b,[]);assert.equal(b.state().automationReady,false);b.run('setupTournamentAutomation');b.run('setupTournamentAutomation');assert.equal(b.triggers.filter(t=>t.minutes===5).length,1);assert.equal(b.triggers.filter(t=>t.at).length,1);assert.equal(b.triggers.find(t=>t.at).at,Date.parse('2026-10-05T22:00:00Z'));assert(b.state().automationReady);
 b.setTime('2026-10-05T22:00:00Z');b.run('closeMvpVoting');assert(b.state().matchRecords[0].closed);
});
test('season archive contains fractional MVP/scorer points and official goals without double counting legacy submissions; deletion removes votes/ledger',()=>{
 const b=fixture();publish(b,[{player:'LORIA',team:'white',goals:2},{player:'LUCAS',team:'black',goals:2}]);vote(b,'LORIA','DIEGO');vote(b,'LUCAS','PABLO');b.setTime('2026-10-05T22:00:00Z');b.run('saveSeasonHistory_','TEST');const history=b.state().history;assert.equal(history.find(x=>x.player==='LORIA').points,2.25);assert.equal(history.find(x=>x.player==='DIEGO').points,2.5);assert.equal(history.find(x=>x.player==='LORIA').goals,2);assert.equal(history.find(x=>x.player==='DIEGO').mvps,.5);
 assert(b.call('deleteDate',{pin:'test-pin',matchNumber:2}).ok);assert.equal(b.state().matchRecords.length,0);assert.equal(b.call('listMvpVotes',{pin:'test-pin'}).items.length,0);assert.equal(b.state().mvps.length,0);
});
test('adding official scorers to a historical result preserves its existing MVP and never reopens voting',()=>{
 const b=fixture();b.context.saveResult_({matchNumber:2,whiteGoals:1,blackGoals:0});b.context.confirmMvp_(2,'DIEGO');assert(publish(b,[{player:'LORIA',team:'white',goals:1}]).ok);assert.equal(b.state().matchRecords[0].closed,true);assert.equal(b.state().mvps[0].player,'DIEGO');assert.equal(b.state().mvps[0].points,1);
});
test('public progress uses the unique eligible roster as denominator and never publishes voter identities',()=>{
 const b=createBackend(),white=['LORIA','DIEGO','FRANCO','MATU','VALEN','BILLO','DARIO','INVITADO'],black=['LUCAS','AUGUSTO','LIHUEL','PABLO','GONZA','AGUS','LAUTY','KEVIN'];
 assert(b.call('saveLineup',{pin:'test-pin',item:{matchNumber:2,date:'2026-10-03',white,black}}).ok);assert(publish(b,[]).ok);
 const voters=[...white,...black].filter(p=>p!=='LORIA'&&p!=='DIEGO').slice(0,9);voters.forEach((player,i)=>assert(vote(b,player,i<6?'LORIA':'DIEGO').ok));
 const record=b.state().matchRecords[0];assert.deepEqual(record.voteProgress,[{player:'LORIA',share:6/16},{player:'DIEGO',share:3/16}]);assert.equal(record.voteCount,null);assert.deepEqual(record.mvpAwards,[]);assert(!JSON.stringify(record).includes('candidate'));assert(!JSON.stringify(record.voteProgress).includes('FRANCO'));
 const c=fixture();assert(publish(c,[]).ok);assert(vote(c,'LORIA','DIEGO').ok);assert.equal(c.state().matchRecords[0].voteProgress[0].share,1/8);
});
test('19:00 migration advances unresolved old windows, persists once and schedules the earlier close',()=>{
 const b=fixture();publish(b,[]);const record=b.run('rawMatchRecords_')[0];record.opensAt='2026-10-03T23:00:00.000Z';record.closesAt='2026-10-05T23:00:00.000Z';b.run('writeMatchRecord_',record);b.properties.delete('MVP_WINDOW_19H_MIGRATED');b.properties.set('MVP_AUTOMATION_READY','true');b.run('scheduleVotingClose_',record);
 b.setTime('2026-10-03T21:59:59.999Z');const early=vote(b,'LORIA','DIEGO');assert.equal(early.ok,false);assert(early.error.includes('19:00'));const shifted=b.run('rawMatchRecords_')[0];assert.equal(shifted.opensAt,'2026-10-03T22:00:00.000Z');assert.equal(shifted.closesAt,'2026-10-05T22:00:00.000Z');assert.equal(Date.parse(shifted.closesAt)-Date.parse(shifted.opensAt),48*3600000);assert(b.triggers.some(t=>t.at===Date.parse(shifted.closesAt)));
 b.setTime('2026-10-03T22:00:00Z');assert(vote(b,'LORIA','DIEGO').ok);const count=b.triggers.length;assert.equal(b.state().matchRecords[0].opensAt,shifted.opensAt);assert.equal(b.triggers.length,count);assert.equal(b.run('rawMatchRecords_')[0].updatedAt,shifted.updatedAt);
});
test('moving an existing vote to 19:00 keeps ballots and awards exactly once at the earlier Monday deadline',()=>{
 const b=fixture();publish(b,[]);assert(vote(b,'LORIA','DIEGO').ok);const record=b.run('rawMatchRecords_')[0];record.opensAt='2026-10-03T23:00:00.000Z';record.closesAt='2026-10-05T23:00:00.000Z';b.run('writeMatchRecord_',record);b.properties.delete('MVP_WINDOW_19H_MIGRATED');const ballots=b.call('listMvpVotes',{pin:'test-pin'}).items;
 b.setTime('2026-10-05T21:59:59.999Z');assert(vote(b,'LUCAS','DIEGO').ok);b.setTime('2026-10-05T22:00:00Z');assert(!vote(b,'KEVIN','PABLO').ok);assert.equal(b.state().mvps[0].player,'DIEGO');assert.equal(b.state().mvps[0].points,1);assert.equal(b.call('listMvpVotes',{pin:'test-pin'}).items.length,ballots.length+1);assert.equal(b.state().matchRecords[0].voteCount,2);b.setTime('2026-10-05T23:00:00Z');b.run('closeMvpVoting');assert.equal(b.state().mvps.length,1);
});
test('schedule change preserves closed historical records and leaves custom windows untouched',()=>{
 const b=fixture();publish(b,[]);vote(b,'LORIA','DIEGO');b.setTime('2026-10-05T23:00:00Z');b.run('closeMvpVoting');const record=b.run('rawMatchRecords_')[0];record.opensAt='2026-10-03T23:00:00.000Z';record.closesAt='2026-10-05T23:00:00.000Z';b.run('writeMatchRecord_',record);b.properties.delete('MVP_WINDOW_19H_MIGRATED');const before=b.run('rawMatchRecords_');b.state();assert.deepEqual(b.run('rawMatchRecords_'),before);
 const c=fixture();publish(c,[]);const custom=c.run('rawMatchRecords_')[0];custom.opensAt='2026-10-04T00:00:00.000Z';custom.closesAt='2026-10-06T00:00:00.000Z';c.run('writeMatchRecord_',custom);c.properties.delete('MVP_WINDOW_19H_MIGRATED');const original=c.run('rawMatchRecords_');c.state();assert.deepEqual(c.run('rawMatchRecords_'),original);
});
test('19:00 upgrade handles the long Date strings already stored by Apps Script',()=>{
 const b=fixture();publish(b,[]);const record=b.run('rawMatchRecords_')[0];record.matchDate='Sat Oct 03 2026 04:00:00 GMT-0300 (hora estándar de Argentina)';record.opensAt='2026-10-03T23:00:00.000Z';record.closesAt='2026-10-05T23:00:00.000Z';b.run('writeMatchRecord_',record);b.properties.delete('MVP_WINDOW_19H_MIGRATED');const revised=b.state().matchRecords[0];assert.equal(revised.opensAt,'2026-10-03T22:00:00.000Z');assert.equal(revised.closesAt,'2026-10-05T22:00:00.000Z');
});
test('published goal corrections compare calendar days across Sheet Dates and localized legacy strings without losing votes',()=>{
 const b=fixture();assert(publish(b,[{player:'DIEGO',team:'white',goals:1},{player:'LUCAS',team:'black',goals:2}]).ok);assert(vote(b,'LORIA','DIEGO').ok);
 const old=b.run('rawMatchRecords_')[0];old.matchDate='Sat Oct 03 2026 04:00:00 GMT-0300 (hora estándar de Argentina)';b.run('writeMatchRecord_',old);
 const lineup=b.sheets.get('Equipos Web');assert(lineup);lineup.rows[1][1]=new b.context.Date('2026-10-03T07:00:00Z');
 const ballots=b.call('listMvpVotes',{pin:'test-pin'}).items;
 assert(publish(b,[{player:'DIEGO',team:'white',goals:4},{player:'LUCAS',team:'black',goals:2}]).ok);
 const corrected=b.state().matchRecords[0];assert.equal(corrected.matchDate,'2026-10-03');assert.equal(corrected.scorers.find(x=>x.player==='DIEGO').goals,4);assert.equal(corrected.opensAt,old.opensAt);assert.equal(corrected.closesAt,old.closesAt);assert.deepEqual(b.call('listMvpVotes',{pin:'test-pin'}).items,ballots);
 lineup.rows[1][1]=new b.context.Date('2026-10-04T07:00:00Z');const before=b.state();const refused=publish(b,[{player:'DIEGO',team:'white',goals:5},{player:'LUCAS',team:'black',goals:2}]);assert.equal(refused.ok,false);assert(refused.error.includes('cambiar su día'));assert.deepEqual(b.state().results,before.results);assert.deepEqual(b.state().matchRecords,before.matchRecords);
});
test('date 4 correction adds three Diego goals, keeps existing events and ballots, and is idempotent',()=>{
 const b=createBackend({},'2026-10-25T23:30:00Z'),white=['GONZA','AGUSREGGI','MATI BILLO','LIHUEL','KEVIN','LUCAS','VALEN','NAHUEL'],black=['MATU','DIEGO','AUGUSTO','LUCHO','DARIO','PABLO','AXEL','NACHO'];
 const scorers=[['NAHUEL','white',5],['KEVIN','white',1],['LIHUEL','white',2],['MATI BILLO','white',4],['GONZA','white',2],['MATU','black',1],['DIEGO','black',1],['AUGUSTO','black',5],['LUCHO','black',4],['PABLO','black',2],['AXEL','black',2],['NACHO','black',2]].map(([player,team,goals])=>({player,team,goals}));
 const record={matchDate:'Sat Oct 24 2026 04:00:00 GMT-0300 (hora estándar de Argentina)',scorers,goalEvents:scorers.flatMap(r=>Array.from({length:r.goals},(_,i)=>({id:r.player+i,team:r.team,player:r.player,assist:null,assistDecision:'none'}))),scorerAwards:[{player:'NAHUEL',points:.25},{player:'AUGUSTO',points:.25}],closesAt:'2026-10-26T22:00:00.000Z'};
 assert(b.call('saveLineup',{pin:'test-pin',item:{matchNumber:4,date:'2026-10-24',white,black}}).ok);
 assert(b.call('saveResult',{pin:'test-pin',item:{matchNumber:4,whiteGoals:14,blackGoals:17,scorers:record.scorers,goalEvents:record.goalEvents}}).ok);assert(b.call('voteMvp',{item:{matchNumber:4,player:'MATU',candidate:'LUCHO'}}).ok);
 const old=b.run('rawMatchRecords_')[0];old.matchDate=record.matchDate;b.run('writeMatchRecord_',old);b.sheets.get('Equipos Web').rows[1][1]=new b.context.Date('2026-10-24T07:00:00Z');
 const item={matchNumber:4,whiteGoals:14,blackGoals:20,scorers:record.scorers.map(r=>r.player==='DIEGO'?{...r,goals:4}:r),goalEvents:[...record.goalEvents,...Array.from({length:3},(_,i)=>({id:'missing-diego-'+i,team:'black',player:'DIEGO',assist:null,assistDecision:'pending'}))]};
 assert(b.call('saveResult',{pin:'test-pin',item}).ok);assert(b.call('saveResult',{pin:'test-pin',item}).ok);
 const after=b.state();assert.equal(after.results.length,1);assert.equal(after.results[0].blackGoals,20);assert.equal(after.matchRecords[0].goalEvents.length,34);assert.deepEqual(after.matchRecords[0].goalEvents.slice(0,31),record.goalEvents);assert.equal(after.matchRecords[0].scorers.find(r=>r.player==='DIEGO').goals,4);assert.deepEqual(after.matchRecords[0].scorerAwards,record.scorerAwards);assert.equal(b.call('listMvpVotes',{pin:'test-pin'}).items.length,1);assert.equal(after.matchRecords[0].closesAt,record.closesAt);
});
