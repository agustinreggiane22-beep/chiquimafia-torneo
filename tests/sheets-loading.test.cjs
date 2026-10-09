const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../js/sheets.js'),'utf8');
function setup(){
 let now=0,nextId=0,script;const timers=new Map(),seeded=[];
 const context={window:{CHIQUI_CONFIG:{goalsApiUrl:'https://example.test/exec'},ChiquiGoals:{seedState:value=>seeded.push(value)}},document:{createElement(){return{remove(){this.removed=true}}},head:{appendChild(value){script=value}}},Date:class extends Date{static now(){return now}},setTimeout(fn,delay){const id=++nextId;timers.set(id,{fn,at:now+delay});return id},clearTimeout(id){timers.delete(id)}};
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
