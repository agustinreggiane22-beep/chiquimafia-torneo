const {test}=require('node:test'),assert=require('node:assert/strict'),{createBackend}=require('./apps-script-harness.cjs');
const names=Array.from({length:18},(_,i)=>'P'+String(i+1).padStart(2,'0'));
const lineup={matchNumber:1,date:'2026-10-03',white:names.slice(0,8),black:names.slice(8,16),substitutes:names.slice(16)};
const save=(b,item=lineup,pin='test-pin')=>b.call('saveLineup',{pin,item});
function fixture(){const b=createBackend();names.forEach(name=>assert(b.call('addPlayer',{pin:'test-pin',name}).ok));assert(save(b).ok);return b}
test('substitute migration appends a column and preserves old dates and custom columns',()=>{
 const old=['matchNumber','date','white','black','updatedAt','note'];const row=[9,'2026-11-01','["A"]','["B"]','old-time','keep'];const b=createBackend({'Equipos Web':[old,row]});assert(save(b).ok);const rows=b.sheets.get('Equipos Web').rows;assert.deepEqual(rows[0],[...old,'substitutes']);assert.deepEqual(rows[1],row);assert.equal(b.state().capabilities.substitutesV1,true);assert.deepEqual(JSON.parse(b.call('listLineups').items.find(x=>x.matchNumber===1).substitutes),names.slice(16));
 assert(save(b,{...lineup,matchNumber:9,white:['A'],black:['B']}).ok);assert.equal(rows[1][5],'keep');
});
test('server validates PIN and rejects duplicates across starters and reserves',()=>{
 const b=fixture();assert(!save(b,{...lineup,substitutes:['p01']}).ok);assert(!save(b,{...lineup,substitutes:['P17','p17']}).ok);assert(!save(b,{...lineup,substitutes:'P17'}).ok);assert(!save(b,lineup,'wrong').ok);assert.deepEqual(JSON.parse(b.state().lineups[0].substitutes),names.slice(16));
});
test('omitting substitutes keeps them; explicit empty list removes them',()=>{
 const b=fixture(),{substitutes,...oldClient}=lineup;assert(save(b,oldClient).ok);assert.deepEqual(JSON.parse(b.state().lineups[0].substitutes),substitutes);assert(save(b,{...lineup,substitutes:[]}).ok);assert.deepEqual(JSON.parse(b.state().lineups[0].substitutes),[]);
});
test('reserves cannot vote, score or earn attendance, and replacements count only when published',()=>{
 const b=fixture();assert.equal(b.run('validParticipant_',1,'P17'),false);assert(!b.call('saveResult',{pin:'test-pin',item:{matchNumber:1,whiteGoals:1,blackGoals:0,scorers:[{player:'P17',team:'white',goals:1}]}}).ok);assert.equal(b.state().results.length,0);
 const changed={...lineup,white:['P17',...lineup.white.slice(1)],substitutes:['P18']};assert(save(b,changed).ok);assert.equal(b.state().results.length,0);assert(b.call('saveResult',{pin:'test-pin',item:{matchNumber:1,whiteGoals:0,blackGoals:0,scorers:[]}}).ok);
 assert(!b.call('voteMvp',{item:{matchNumber:1,player:'P18',candidate:'P17'}}).ok);assert(!b.call('voteMvp',{item:{matchNumber:1,player:'P17',candidate:'P18'}}).ok);assert(b.call('voteMvp',{item:{matchNumber:1,player:'P17',candidate:'P02'}}).ok);
 assert(!save(b,lineup).ok,'cannot replace players after official score');
 b.run('saveSeasonHistory_','RESERVES');const rows=b.state().history;assert.equal(rows.find(r=>r.player==='P17').attendance,1);assert.equal(rows.find(r=>r.player==='P18')?.attendance||0,0);assert.equal(rows.find(r=>r.player==='P01')?.attendance||0,0);
});
test('archive preserves reserve lists and a new season has no old reserves',()=>{
 const b=fixture();assert(b.call('resetSeason',{pin:'test-pin',seasonName:'RESERVES'}).ok);assert.equal(b.state().lineups.length,0);const archived=b.sheets.get('ARCHIVO RESERVES - Equipos Web').rows;assert.deepEqual(JSON.parse(archived[1][archived[0].indexOf('substitutes')]),names.slice(16));
});
