const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../js/goals.js'),'utf8');
function setup(handler=()=>({ok:true,items:[]})){
  let now=0;const calls=[],storage=new Map();
  const context={window:{CHIQUI_CONFIG:{goalsApiUrl:'https://example.test/exec'}},Date:class extends Date{static now(){return now}},crypto:{randomUUID:()=> 'test-id'},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},fetch:async(url,options)=>{const body=JSON.parse(options.body);calls.push(body);const data=await handler(body);return{ok:true,json:async()=>data}}};
  vm.createContext(context);vm.runInContext(source,context);
  return{api:context.window.ChiquiGoals,calls,tick:n=>now+=n};
}
const fields={players:[{name:'A',status:'active'}],lineups:[{matchNumber:1}],results:[{matchNumber:1}],mvps:[{matchNumber:1,player:'A'}],sanctions:[{id:'s',player:'A',points:-1}],deletedDates:[],playoffs:[]};
test('initial state supplies all available lists without additional requests',async()=>{
 const {api,calls}=setup();api.seedState(fields);
 const lists=await Promise.all([api.webPlayers(),api.lineups(),api.results(),api.mvpAwards(),api.sanctions(),api.deletedDates(),api.playoffResults()]);
 assert.equal(lists[0][0].name,'A');assert.equal(lists[4][0].points,-1);assert.equal(calls.length,0);
});
test('older backend without submissions fetches goals once for concurrent renderers',async()=>{
 const {api,calls}=setup(()=>({ok:true,items:[{player:'A',status:'approved',goals:2}]}));api.seedState(fields);
 const [list,totals]=await Promise.all([api.list(),api.approvedTotals(),api.list()]);assert.equal(list.length,1);assert.equal(totals.A,2);assert.equal(calls.length,1);
 await api.list();assert.equal(calls.length,1);
});
test('mutating a returned list does not alter the cached data',async()=>{
 const {api}=setup();api.seedState(fields);const list=await api.webPlayers();list[0].name='changed';list.push({name:'extra'});
 const again=await api.webPlayers();assert.equal(again.length,1);assert.equal(again[0].name,'A');
});
test('cached lists expire and can refresh changes from another device',async()=>{
 const {api,calls,tick}=setup(()=>({ok:true,items:[{name:'B'}]}));api.seedState(fields);tick(30000);assert.equal((await api.webPlayers())[0].name,'B');assert.equal(calls.length,1);
});
test('successful administrator write invalidates state and reads updated data',async()=>{
 let points=-1;const {api,calls}=setup(body=>{if(body.action==='addSanction'){points=-3;return{ok:true,item:{id:'s',player:'A',points}}}return{ok:true,items:[{id:'s',player:'A',points}]}});
 api.seedState(fields);await api.addSanction({player:'A',points:3},'test-pin');assert.equal((await api.sanctions())[0].points,-3);assert.deepEqual(calls.map(x=>x.action),['addSanction','listSanctions']);
});
test('authentication and rejected writes do not invalidate valid reads',async()=>{
 const {api,calls}=setup(body=>body.action==='auth'?{ok:true,authenticated:true}:{ok:false,error:'Rejected'});api.seedState(fields);
 assert.equal(await api.authenticate('test-pin'),true);await assert.rejects(api.addSanction({},'test-pin'),/Rejected/);await api.sanctions();assert.equal(calls.length,2);
});
test('failed reads are retried rather than cached as successful empty lists',async()=>{
 let fail=true;const {api,calls}=setup(()=>{if(fail){fail=false;throw Error('Offline')}return{ok:true,items:[{player:'A',status:'approved',goals:2}]}});
 assert.equal((await api.list()).length,0);assert.equal((await api.list()).length,1);assert.equal(calls.length,2);
});
test('a pending read from before a write cannot repopulate the new cache',async()=>{
 let finish;const {api,calls}=setup(body=>{if(body.action==='listSanctions'&&calls.filter(x=>x.action==='listSanctions').length===1)return new Promise(r=>finish=r);if(body.action==='addSanction')return{ok:true,item:{points:-3}};return{ok:true,items:[{points:-3}]}});
 const old=api.sanctions();await api.addSanction({points:3},'test-pin');finish({ok:true,items:[{points:-1}]});await old;assert.equal((await api.sanctions())[0].points,-3);assert.equal(calls.length,3);
});
