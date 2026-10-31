const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[],remote=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:'))remote.push(r.url())});
  const url=(process.env.CHIQUI_TEST_URL||'http://127.0.0.1:8101/')+'recuperar-anotaciones.html';await page.goto(url);
  assert((await page.locator('#recoveryStatus').textContent()).includes('No encontramos'));
  const draft={version:1,number:5,date:'2026-10-31',white:['FRANCO','LIHUEL'],black:['LUCHO'],events:[{id:'g1',team:'white',player:'FRANCO',assist:'LIHUEL',assistDecision:'assigned'},{id:'g2',team:'white',player:'FRANCO',assist:null,assistDecision:'none'},{id:'g3',team:'black',player:'LUCHO',assist:null,assistDecision:'pending'}],published:false,updatedAt:'2026-10-31T22:00:00Z'};
  await page.evaluate(d=>{localStorage.setItem('chiquimafia_live_score_v1:5:2026-10-31',JSON.stringify(d));localStorage.setItem('chiquimafia_shared_score_v1:copia-local:2:123',JSON.stringify({...d,number:2}));localStorage.setItem('chiquimafia_recovery_backup_v1:fecha5:123',JSON.stringify({...d,number:4}));localStorage.setItem('chiquimafia_live_score_v1:broken','{corrupt but preserved');localStorage.setItem('chiqui_admin_pin','private-do-not-export');localStorage.setItem('chiquimafia_shared_score_v1:secret-session',JSON.stringify({token:'private-token'}));Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>window.copied=text}})},draft);
  const before=await page.evaluate(()=>({...localStorage}));await page.reload();
  assert((await page.locator('#recoveryStatus').textContent()).includes('4 copia(s)'));assert.equal(await page.locator('article').count(),4);
  const card=page.locator('[data-recovery-index="0"]');assert.equal(await card.locator('h2').textContent(),'Fecha 5');assert((await card.locator('.score').textContent()).includes('Claro 2 — 1 Oscuro'));
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>window.copied=text}}));await card.getByRole('button',{name:'Copiar anotaciones',exact:true}).click();const report=await page.evaluate(()=>window.copied);
  for(const text of ['FRANCO: 2','LIHUEL: 1','LUCHO: 1','Sin asistencia','Pendiente','goles'])assert(report.toLowerCase().includes(text.toLowerCase()));assert(!report.includes('private-'));
  await page.evaluate(()=>{Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{window.sharedBackup=await data.files[0].text()}})});await card.getByRole('button',{name:'Compartir copia',exact:true}).click();await page.waitForFunction(()=>window.sharedBackup);const backup=JSON.parse(await page.evaluate(()=>window.sharedBackup));assert.deepEqual(backup.snapshot.events,draft.events);assert.deepEqual(backup.snapshot.white,draft.white);assert.equal(backup.snapshot.number,5);assert(!JSON.stringify(backup).includes('private-'));
  const downloaded=page.waitForEvent('download');await card.getByRole('link',{name:'Guardar copia',exact:true}).click();const file=await downloaded;assert.equal(file.suggestedFilename(),'chiquimafia-fecha-5-anotaciones.json');const saved=JSON.parse(await fs.readFile(await file.path(),'utf8'));assert.deepEqual(saved.snapshot.events,draft.events);
  const corruptDownload=page.waitForEvent('download');await page.getByRole('link',{name:'Guardar copia para revisar',exact:true}).click();const corruptFile=await corruptDownload;assert.equal(await fs.readFile(await corruptFile.path(),'utf8'),'{corrupt but preserved');
  for(const width of [320,390,768]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))}
  assert.deepEqual(await page.evaluate(()=>({...localStorage})),before);assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);
  const other=await browser.newContext(),otherPage=await other.newPage();await otherPage.goto(url);assert((await otherPage.locator('#recoveryStatus').textContent()).includes('No encontramos'));await other.close();
  await context.close();console.log('PASS: local-only recovery, full goals/assists text and JSON, native sharing/download, corrupt-note rescue, no PIN/token export, no storage writes or remote requests, independent phones, 3 widths.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
