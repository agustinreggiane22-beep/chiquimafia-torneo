const {test}=require('node:test'),assert=require('node:assert/strict'),{createBackend}=require('./apps-script-harness.cjs');
const white=['LORIA','DIEGO','FRANCO','MATU','VALEN','BILLO','DARIO','NAHUEL'],black=['LUCAS','AUGUSTO','LIHUEL','PABLO','GONZA','AGUS','LAUTY','KEVIN'];
function fixture(){const b=createBackend({},'2026-10-24T23:00:00Z');assert(b.call('saveLineup',{pin:'test-pin',item:{matchNumber:4,date:'2026-10-24',white,black}}).ok);const created=b.call('createLiveSession',{pin:'test-pin',item:{matchNumber:4,events:[]}});assert(created.ok);return{b,token:created.token}}
const operation=(b,token,operation)=>b.call('applyLiveOperation',{token,operation});
const goal=(id,player='LORIA',team='white')=>({id,type:'add',event:{id:'goal-'+id,player,team,assist:null,assistDecision:'pending'}});
test('sharing needs admin PIN; scoped link reveals no PIN, ballots or other sessions',()=>{
 const {b,token}=fixture();assert(!b.call('createLiveSession',{pin:'wrong',item:{matchNumber:4,events:[]}}).ok);assert(!b.call('getLiveSession',{token:token+'x'}).ok);assert(!operation(b,'bad',goal('1')).ok);
 const joined=b.call('getLiveSession',{token});assert(joined.ok);const text=JSON.stringify(joined);assert(!text.includes('secret'));assert(!text.includes('test-pin'));assert(!text.includes('candidate'));assert(!JSON.stringify(b.state()).includes(token));
 assert.equal(b.call('createLiveSession',{pin:'test-pin',item:{matchNumber:4,events:[]}}).token,token);
});
test('concurrent device operations merge, retries deduplicate, and conflicting passes do not overwrite',()=>{
 const {b,token}=fixture();assert(operation(b,token,goal('a')).ok);assert(operation(b,token,goal('b','LUCAS','black')).ok);assert(operation(b,token,goal('a')).ok);
 let state=b.call('getLiveSession',{token}).session;assert.equal(state.events.length,2);
 const pass={id:'pass1',type:'assist',eventId:'goal-a',expectedRevision:0,player:'DIEGO'};assert(operation(b,token,pass).ok);assert(operation(b,token,pass).ok);
 assert(!operation(b,token,{...pass,id:'pass2',player:'FRANCO'}).ok);state=b.call('getLiveSession',{token}).session;assert.equal(state.events[0].assist,'DIEGO');assert.equal(state.events[0].revision,1);
 assert(!operation(b,token,{id:'remove-old',type:'remove',eventId:'goal-a',expectedRevision:0}).ok);assert(operation(b,token,{id:'remove',type:'remove',eventId:'goal-b',expectedRevision:0}).ok);assert(operation(b,token,{id:'remove',type:'remove',eventId:'goal-b',expectedRevision:0}).ok);assert.equal(b.call('getLiveSession',{token}).session.events.length,1);
});
test('shared edits enforce teams, no self-assist, immutable event identities and lineup changes',()=>{
 const {b,token}=fixture();assert(!operation(b,token,goal('bad','LUCAS')).ok);assert(operation(b,token,goal('a')).ok);assert(!operation(b,token,{id:'again',type:'add',event:goal('a').event}).ok);
 assert(!operation(b,token,{id:'self',type:'assist',eventId:'goal-a',expectedRevision:0,player:'LORIA'}).ok);assert(!operation(b,token,{id:'opponent',type:'assist',eventId:'goal-a',expectedRevision:0,player:'LUCAS'}).ok);assert(!operation(b,token,{id:'bogus',type:'reset',eventId:'goal-a',expectedRevision:0}).ok);
 assert(b.call('saveLineup',{pin:'test-pin',item:{matchNumber:4,date:'2026-10-24',white:['NICO',...white.slice(1)],black}}).ok);assert(!operation(b,token,goal('b')).ok);assert(!b.call('getLiveSession',{token}).ok);
});
test('only admin publishes; stale publication fails, exact ledger closes sharing and creates awards once',()=>{
 const {b,token}=fixture();const add=goal('a');assert(operation(b,token,add).ok);assert(operation(b,token,{id:'pass',type:'assist',eventId:'goal-a',expectedRevision:0,player:'DIEGO'}).ok);
 const item={matchNumber:4,whiteGoals:1,blackGoals:0,scorers:[{player:'LORIA',team:'white',goals:1}],goalEvents:[{id:'goal-a',team:'white',player:'LORIA',assist:'DIEGO',assistDecision:'assigned'}]};
 assert(!b.call('saveResult',{item}).ok);assert(!b.call('saveResult',{pin:'test-pin',item:{...item,goalEvents:[{...item.goalEvents[0],assist:null,assistDecision:'none'}]}}).ok);assert.equal(b.state().results.length,0);
 assert(b.call('saveResult',{pin:'test-pin',item}).ok);assert.equal(b.call('getLiveSession',{token}).session.closed,true);assert(!operation(b,token,goal('later')).ok);assert(operation(b,token,add).ok);assert(b.call('saveResult',{pin:'test-pin',item}).ok);
 const state=b.state();assert.equal(state.results.length,1);assert.equal(state.matchRecords.length,1);assert.deepEqual(state.matchRecords[0].assistAwards,[{player:'DIEGO',points:.5}]);assert.deepEqual(state.matchRecords[0].scorerAwards,[{player:'LORIA',points:.5}]);assert(b.call('voteMvp',{item:{matchNumber:4,player:'DIEGO',candidate:'LORIA'}}).ok);
});
test('unknown scorers can be assigned and closing the season invalidates shared access',()=>{
 const {b,token}=fixture();assert(operation(b,token,goal('unknown','','white')).ok);assert(operation(b,token,{id:'assign',type:'assign',eventId:'goal-unknown',expectedRevision:0,player:'DIEGO'}).ok);
 assert.equal(b.call('getLiveSession',{token}).session.events[0].player,'DIEGO');b.run('resetSeason_','TEST');assert(!b.call('getLiveSession',{token}).ok);
});
