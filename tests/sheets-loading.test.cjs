const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../js/sheets.js'),'utf8');
function setup(fetcher){
 let now=0,nextId=0,script;const timers=new Map(),seeded=[];
 const context={window:{CHIQUI_CONFIG:{goalsApiUrl:'https://example.test/exec'},ChiquiGoals:{seedState:value=>seeded.push(value)}},document:{createElement(){return{remove(){this.removed=true}}},head:{appendChild(value){script=value}}},Date:class extends Date{static now(){return now}},setTimeout(fn,delay){const id=++nextId;timers.set(id,{fn,at:now+delay});return id},clearTimeout(id){timers.delete(id)}};
 if(fetcher){context.fetch=fetcher;context.AbortController=AbortController}
 vm.createContext(context);vm.runInContext(source,context);
 function advance(ms){const end=now+ms;while(true){const entry=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!entry)break;timers.delete(entry[0]);now=entry[1].at;entry[1].fn()}now=end}
 return{api:context.window.ChiquiSheets,seeded,advance,script:()=>script,callback:()=>context.window[new URL(script.src).searchParams.get('callback')],window:context.window};
}
const state={ok:true,players:[{name:'A',status:'active'}],lineups:[],results:[],mvps:[]};
test('a valid response after 20 seconds still loads the tournament',async()=>{
 const r=setup(),pending=r.api.loadAll();r.advance(20000);r.callback()(state);const data=await pending;
 assert.equal(data.players[0],'A');assert.equal(r.seeded.length,1);assert.equal(r.script().removed,true);
});
test('timeout rejects at 45 seconds and safely ignores a late response',async()=>{
 const r=setup(),pending=r.api.loadAll(),rejected=assert.rejects(pending,/45 segundos/);r.advance(45000);await rejected;
 assert.equal(r.script().removed,true);assert.doesNotThrow(()=>r.callback()(state));assert.equal(r.seeded.length,0);
 r.advance(60000);assert.equal(r.callback(),undefined);
});
test('a script connection error explains the failing service',async()=>{
 const r=setup(),pending=r.api.loadAll(),rejected=assert.rejects(pending,/No se pudo conectar con Google Apps Script/);r.script().onerror();await rejected;
 assert.equal(r.script().removed,true);assert.doesNotThrow(()=>r.callback()(state));assert.equal(r.seeded.length,0);
});
test('backend errors are preserved and do not seed successful tournament data',async()=>{
 const r=setup(),pending=r.api.loadAll(),rejected=assert.rejects(pending,/Planilla no disponible/);r.callback()({ok:false,error:'Planilla no disponible'});await rejected;
 assert.equal(r.seeded.length,0);
});

test('direct JSON loads without injecting a remote script or including Google cookies',async()=>{
 let options,url;const r=setup(async(u,o)=>{url=u;options=o;return{ok:true,json:async()=>state}});
 const data=await r.api.loadAll();assert.equal(data.players[0],'A');assert.equal(r.script(),undefined);assert.equal(options.credentials,'omit');assert.equal(new URL(url).searchParams.get('mode'),'state');assert.equal(r.seeded.length,1);
});
test('a rejected direct request falls back to JSONP',async()=>{
 const r=setup(async()=>{throw Error('CORS rejection')}),pending=r.api.loadAll();await new Promise(resolve=>setImmediate(resolve));
 assert(r.script());r.callback()(state);assert.equal((await pending).players[0],'A');
});
test('a slow direct request leaves only the remaining time for JSONP',async()=>{
 const r=setup((url,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('Aborted'))))),pending=r.api.loadAll(),rejected=assert.rejects(pending,/45 segundos/);
 r.advance(20000);await new Promise(resolve=>setImmediate(resolve));assert(r.script());r.advance(25000);await rejected;assert.equal(r.script().removed,true);
});
test('application errors returned by direct JSON are not hidden by another request',async()=>{
 const r=setup(async()=>({ok:true,json:async()=>({ok:false,error:'Planilla no disponible'})}));await assert.rejects(r.api.loadAll(),/Planilla no disponible/);assert.equal(r.script(),undefined);assert.equal(r.seeded.length,0);
});
test('a loaded JSONP script that never calls back reports an invalid response immediately',async()=>{
 const r=setup(),pending=r.api.loadAll(),rejected=assert.rejects(pending,/sin los datos del torneo/);r.script().onload();await rejected;assert.equal(r.script().removed,true);
});

test('failure of both transports preserves the HTTP status of the direct request',async()=>{
 const r=setup(async()=>({ok:false,status:404})),pending=r.api.loadAll(),rejected=assert.rejects(pending,/HTTP 404/);await new Promise(resolve=>setImmediate(resolve));r.script().onload();await rejected;
});
