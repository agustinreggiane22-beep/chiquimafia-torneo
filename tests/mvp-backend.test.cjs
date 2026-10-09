const {test}=require('node:test'),assert=require('node:assert/strict'),{createBackend}=require('./apps-script-harness.cjs');
function fixture(){const b=createBackend();assert(b.call('saveLineup',{pin:'test-pin',item:{matchNumber:2,date:'2026-10-03',white:['LORIA','DIEGO','JOACO','MATU'],black:['LUCAS','PABLO','KEVIN','GONZA']}}).ok);return b}
const publish=(b,scorers,extra={})=>b.call('saveResult',{pin:'test-pin',item:{matchNumber:2,whiteGoals:scorers.filter(x=>x.team==='white').reduce((s,x)=>s+x.goals,0),blackGoals:scorers.filter(x=>x.team==='black').reduce((s,x)=>s+x.goals,0),scorers,...extra}});
const vote=(b,player,candidate)=>b.call('voteMvp',{item:{matchNumber:2,player,candidate,createdAt:'1999-01-01',status:'approved'}});
test('server owns dates, rejects legacy goal declarations and validates admin/score/rosters before writes',()=>{
 const b=fixture();assert(!b.call('submit',{item:{player:'LORIA',goals:999,status:'approved'}}).ok);assert(!b.call('saveResult',{pin:'wrong',item:{matchNumber:2,whiteGoals:9,blackGoals:0,scorers:[]}}).ok);
 assert(!publish(b,[{player:'OUTSIDE',team:'white',goals:1}]).ok);assert(!publish(b,[{player:'LORIA',team:'black',goals:1}]).ok);assert(!publish(b,[{player:'LORIA',team:'white',goals:.5}]).ok);assert(!publish(b,[{player:'LORIA',team:'white',goals:1},{player:'Loria',team:'white',goals:1}]).ok);assert(!publish(b,[],{whiteGoals:1}).ok);assert.equal(b.state().results.length,0);
 assert(publish(b,[{player:'LORIA',team:'white',goals:5},{player:'LUCAS',team:'black',goals:4}]).ok);const r=b.state().matchRecords[0];assert.equal(r.opensAt,'2026-10-03T23:00:00.000Z');assert.equal(r.closesAt,'2026-10-05T23:00:00.000Z');assert.deepEqual(r.scorerAwards,[{player:'LORIA',points:.5}]);
 b.properties.delete('ADMIN_PIN');assert.equal(b.call('auth',{}).authenticated,false);
});
test('exact 48-hour window, duplicate aliases and own/outside votes are enforced on the server; private votes need PIN',()=>{
 const b=fixture();publish(b,[]);b.setTime('2026-10-03T22:59:59.999Z');assert(!vote(b,'LORIA','DIEGO').ok);b.setTime('2026-10-03T23:00:00Z');assert(vote(b,'LORIA','DIEGO').ok);assert(!vote(b,'loria','PABLO').ok);assert(vote(b,'JOACO','DIEGO').ok);assert(!vote(b,'JOACOREGGI','LUCAS').ok);assert(!vote(b,'LUCAS','Lucas').ok);assert(!vote(b,'OUTSIDE','DIEGO').ok);assert(!vote(b,'PABLO','OUTSIDE').ok);
 const state=b.state();assert.equal(state.matchRecords[0].voteCount,null);assert.deepEqual(state.matchRecords[0].mvpAwards,[]);assert(!JSON.stringify(state).includes('candidate'));assert(!b.call('listMvpVotes',{}).ok);assert.equal(b.call('listMvpVotes',{pin:'test-pin'}).items.length,2);
 b.setTime('2026-10-05T22:59:59.999Z');assert(vote(b,'PABLO','LUCAS').ok);b.setTime('2026-10-05T23:00:00Z');assert(!vote(b,'KEVIN','LUCAS').ok);assert.deepEqual(b.state().mvps.map(x=>({player:x.player,points:x.points})),[{player:'DIEGO',points:1}]);assert.equal(b.state().matchRecords[0].voteCount,3);
});
test('two and three-way ties split each award budget; repeated closures/publication never accumulate points',()=>{
 const b=fixture();publish(b,[{player:'LORIA',team:'white',goals:2},{player:'LUCAS',team:'black',goals:2}]);assert.deepEqual(b.state().matchRecords[0].scorerAwards,[{player:'LORIA',points:.25},{player:'LUCAS',points:.25}]);vote(b,'LORIA','DIEGO');vote(b,'LUCAS','PABLO');b.setTime('2026-10-05T23:00:00Z');let awards=b.state().mvps;assert.deepEqual(awards.map(x=>x.points),[.5,.5]);const timestamp=b.state().matchRecords[0].closedAt;b.run('closeMvpVoting');assert.equal(b.state().mvps.length,2);assert.equal(b.state().matchRecords[0].closedAt,timestamp);
 assert(publish(b,[{player:'LORIA',team:'white',goals:1},{player:'LUCAS',team:'black',goals:1},{player:'DIEGO',team:'white',goals:1}]).ok);assert.equal(b.state().mvps.length,2);assert.equal(b.state().matchRecords[0].closed,true);assert.equal(b.state().matchRecords[0].scorerAwards.reduce((s,x)=>s+x.points,0),.5);assert(!b.call('confirmMvp',{pin:'test-pin',matchNumber:2,player:'LORIA'}).ok);assert(!b.call('deleteMvp',{pin:'test-pin',matchNumber:2}).ok);
 const c=fixture();publish(c,[]);vote(c,'LORIA','DIEGO');vote(c,'LUCAS','PABLO');vote(c,'MATU','KEVIN');c.setTime('2026-10-05T23:00:00Z');assert.equal(c.state().mvps.length,3);assert.equal(c.state().mvps.reduce((s,x)=>s+x.points,0),1);
});
test('0–0, no voters and only two voters close correctly without inventing awards',()=>{
 const b=fixture();publish(b,[]);b.setTime('2026-10-06T00:00:00Z');assert.deepEqual(b.state().mvps,[]);assert.deepEqual(b.state().matchRecords[0].scorerAwards,[]);assert(b.state().matchRecords[0].closed);
 const c=fixture();publish(c,[]);vote(c,'LORIA','DIEGO');vote(c,'LUCAS','DIEGO');c.setTime('2026-10-05T23:00:00Z');assert.equal(c.state().mvps[0].player,'DIEGO');assert.equal(c.state().mvps[0].points,1);
});
test('retry after partial Sheet failure repairs the ledger without duplicate records; old data remains intact',()=>{
 const b=fixture();const legacy=b.context.sheet_();legacy.appendRow(['old','2026-01-01',2,'','LORIA','white',9,'DIEGO','','approved','']);b.context.mvpSheet_().appendRow([1,'PABLO','2026-01-01']);
 b.failRecord();assert(!publish(b,[{player:'LORIA',team:'white',goals:5}]).ok);assert(publish(b,[{player:'LORIA',team:'white',goals:5}]).ok);assert(publish(b,[{player:'LORIA',team:'white',goals:5}]).ok);assert.equal(b.state().matchRecords.length,1);assert.equal(b.state().results.length,1);assert.equal(b.call('list').items[0].goals,9);assert.equal(b.state().mvps[0].player,'PABLO');
 assert(!b.call('saveLineup',{pin:'test-pin',item:{matchNumber:2,date:'2026-10-10',white:['LORIA'],black:['LUCAS']}}).ok);
});
test('automation setup is idempotent and installs a server timer independent of visitors',()=>{
 const b=fixture();publish(b,[]);assert.equal(b.state().automationReady,false);b.run('setupTournamentAutomation');b.run('setupTournamentAutomation');assert.equal(b.triggers.filter(t=>t.minutes===5).length,1);assert.equal(b.triggers.filter(t=>t.at).length,1);assert.equal(b.triggers.find(t=>t.at).at,Date.parse('2026-10-05T23:00:00Z'));assert(b.state().automationReady);
 b.setTime('2026-10-05T23:00:00Z');b.run('closeMvpVoting');assert(b.state().matchRecords[0].closed);
});
test('season archive contains fractional MVP/scorer points and official goals without double counting legacy submissions; deletion removes votes/ledger',()=>{
 const b=fixture();publish(b,[{player:'LORIA',team:'white',goals:2},{player:'LUCAS',team:'black',goals:2}]);vote(b,'LORIA','DIEGO');vote(b,'LUCAS','PABLO');b.setTime('2026-10-05T23:00:00Z');b.run('saveSeasonHistory_','TEST');const history=b.state().history;assert.equal(history.find(x=>x.player==='LORIA').points,2.25);assert.equal(history.find(x=>x.player==='DIEGO').points,2.5);assert.equal(history.find(x=>x.player==='LORIA').goals,2);assert.equal(history.find(x=>x.player==='DIEGO').mvps,.5);
 assert(b.call('deleteDate',{pin:'test-pin',matchNumber:2}).ok);assert.equal(b.state().matchRecords.length,0);assert.equal(b.call('listMvpVotes',{pin:'test-pin'}).items.length,0);assert.equal(b.state().mvps.length,0);
});
test('adding official scorers to a historical result preserves its existing MVP and never reopens voting',()=>{
 const b=fixture();b.context.saveResult_({matchNumber:2,whiteGoals:1,blackGoals:0});b.context.confirmMvp_(2,'DIEGO');assert(publish(b,[{player:'LORIA',team:'white',goals:1}]).ok);assert.equal(b.state().matchRecords[0].closed,true);assert.equal(b.state().mvps[0].player,'DIEGO');assert.equal(b.state().mvps[0].points,1);
});
