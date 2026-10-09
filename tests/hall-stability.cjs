const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try {
  const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const state={ok:true,capabilities:{matchVotingV2:true,voteProgress:true},automationReady:true,serverNow:new Date().toISOString(),players:['A','B'].map(name=>({name,status:'active'})),lineups:[{matchNumber:1,date:'2026-10-03',white:['A'],black:['B']}],results:[{matchNumber:1,whiteGoals:1,blackGoals:0,winner:'white',played:true}],matchRecords:[],mvps:[],sanctions:[],deletedDates:[],playoffs:[],submissions:[],fund:{amount:0},history:[{season:'Anterior',player:'A',champion:true},{season:'Actual',player:'B',champion:true}]};
  const fields={list:'submissions',listMvp:'mvps',listMatchRecords:'matchRecords',listSanctions:'sanctions',listPlayoffs:'playoffs',listWebPlayers:'players',listLineups:'lineups',listResults:'results',listDeletedDates:'deletedDates'};
  await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({body:'',contentType:'text/css'}));
  await page.route('https://script.google.com/**',r=>{if(r.request().method()==='GET')return r.fulfill({json:state});const body=JSON.parse(r.request().postData());assert(body.action in fields,'unexpected write '+body.action);return r.fulfill({json:{ok:true,items:state[fields[body.action]]}})});
  await page.goto(process.env.CHIQUI_TEST_URL||'http://127.0.0.1:8000/');
  await page.waitForFunction(()=>document.querySelector('#syncStatus').textContent==='En vivo');
  await page.locator('#fameSeasonSelect').selectOption('Anterior');
  await page.locator('.fame-cabinet-art').scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>document.querySelector('.fame-cabinet-art').complete&&document.querySelector('.fame-cabinet-art').naturalWidth>0);
  await page.locator('.fame-cabinet-art').evaluate(image=>image.decode());
  await page.evaluate(()=>{window.__fameImage=document.querySelector('.fame-cabinet-art');window.__fameChanges=0;new MutationObserver(()=>window.__fameChanges++).observe(document.querySelector('#hallOfFame'),{childList:true,subtree:true})});
  // Mobile browser bars change viewport height while scrolling.
  for(const height of [740,844,690,844]){
   await page.setViewportSize({width:390,height});await page.evaluate(()=>window.dispatchEvent(new Event('resize')));
   await page.locator('#estadisticas').scrollIntoViewIfNeeded();await page.locator('#historia').scrollIntoViewIfNeeded();
   assert(await page.evaluate(()=>document.querySelector('.fame-cabinet-art')===window.__fameImage));
  }
  // Rotation and chart resizing must also keep the decoded trophy image.
  for(const width of [360,768,1440,390]){
   await page.setViewportSize({width,height:844});await page.waitForTimeout(180);
   assert(await page.evaluate(()=>document.querySelector('.fame-cabinet-art')===window.__fameImage));
  }
  await page.evaluate(()=>window.dispatchEvent(new Event('chiqui:voting-updated')));await page.waitForTimeout(300);
  assert(await page.evaluate(()=>document.querySelector('.fame-cabinet-art')===window.__fameImage));
  assert.equal(await page.locator('#fameSeasonSelect').inputValue(),'Anterior');
  assert.equal(await page.locator('.fame-champion strong').textContent(),'A');
  assert.equal(await page.evaluate(()=>window.__fameChanges),0);
  assert.deepEqual(errors,[]);
  console.log('PASS: decoded cabinet retained through mobile toolbar changes, scrolling, rotation, chart resize and live vote refresh; selected season retained; no real writes.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
