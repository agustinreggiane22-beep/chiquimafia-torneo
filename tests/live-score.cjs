const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'}),errors=[],actions=[];
  page.on('pageerror',e=>errors.push(e.message));
  const white=['LORIA','DIEGO','FRANCO','MATU','VALEN','MATI BILLO','DARIO','INVITADO'],black=['LUCAS','AUGUSTO','LIHUEL','PABLO','GONZA','AGUSREGGI','LAUTY','KEVIN'];
  const lineup=n=>({matchNumber:n,date:n===2?'2026-10-10':'2026-10-17',white,black});
  const state={ok:true,players:[...white,...black].map(name=>({name,status:'active'})),lineups:[lineup(2),lineup(3)],results:[],mvps:[],sanctions:[],deletedDates:[],playoffs:[],history:[],fund:{amount:0}};
  const fields={listWebPlayers:'players',listLineups:'lineups',listResults:'results',listMvp:'mvps',listSanctions:'sanctions',listDeletedDates:'deletedDates',listPlayoffs:'playoffs'};let rejectSave=false;
  await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({body:'',contentType:'text/css'}));
  await page.route('https://script.google.com/**',r=>{
   let response=state;
   if(r.request().method()==='POST'){
    const body=JSON.parse(r.request().postData());actions.push(body.action);
    if(body.action in fields)response={ok:true,items:state[fields[body.action]]};
    else if(body.action==='list')response={ok:true,items:[]};
    else if(body.action==='auth')response={ok:true,authenticated:true};
    else if(body.action==='saveResult'){
     if(rejectSave){rejectSave=false;response={ok:false,error:'Error simulado al publicar'};}
     else {const item={...body.item,played:true,winner:body.item.whiteGoals===body.item.blackGoals?'draw':body.item.whiteGoals>body.item.blackGoals?'white':'black'},prior=state.results.find(x=>x.matchNumber===item.matchNumber);if(prior)Object.assign(prior,item);else state.results.push(item);response={ok:true,item};}
    }else throw new Error('Unexpected mock action: '+body.action);
   }
   return r.fulfill({json:response,headers:{'access-control-allow-origin':'*'}});
  });
  const load=async()=>{await page.goto(process.env.CHIQUI_TEST_URL||'http://127.0.0.1:8000/');await page.waitForFunction(()=>document.querySelector('#syncStatus').textContent==='En vivo')};
  const login=async()=>{if(await page.locator('#adminLogin').isVisible()){await page.locator('#adminPin').fill('test-pin');await page.locator('#adminLoginForm button').click();await page.waitForFunction(()=>!document.querySelector('#adminPanel').hidden)}};
  const tap=(team,index)=>page.locator(team==='white'?'#liveWhitePlayers .live-player':'#liveBlackPlayers .live-player').nth(index).click();
  const totals=async(w,b)=>{assert.equal(await page.locator('#liveWhiteScore').textContent(),String(w));assert.equal(await page.locator('#liveBlackScore').textContent(),String(b));};
  await load();await page.evaluate(()=>document.querySelector('#openLiveScore').click());assert.equal(await page.locator('#liveScoreDialog').isVisible(),false,'public visitors cannot open the recorder');
  await login();await page.locator('#openLiveScore').click();assert.equal(await page.locator('#liveMatchSelect').inputValue(),'2');assert.equal(await page.locator('#liveWhitePlayers .live-player').count(),8);assert.equal(await page.locator('#liveBlackPlayers .live-player').count(),8);
  const beforeRecord=actions.length;await tap('white',0);await tap('white',0);await tap('black',7);await totals(2,1);assert.equal(await page.locator('#liveWhitePlayers .live-player').first().locator('b').textContent(),'2');assert.equal(actions.length,beforeRecord,'each goal stays local and must not write to the backend');
  await page.locator('#liveScoreDialog .live-score-content').evaluate(e=>e.scrollTop=e.scrollHeight);
  assert(await page.locator('.live-scoreboard').evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<innerHeight}),'score must stay visible with 8x8 players');assert(await page.locator('#liveUndo').isVisible());await page.locator('#liveUndo').click();await totals(2,0);
  await page.context().setOffline(true);await tap('black',0);await totals(2,1);await page.context().setOffline(false);
  await page.locator('#closeLiveScore').click();await load();await login();await page.locator('#openLiveScore').click();await totals(2,1);
  await page.locator('#liveMatchSelect').selectOption('3');await totals(0,0);await tap('white',7);await totals(1,0);await page.locator('#liveMatchSelect').selectOption('2');await totals(2,1);
  // Refusing a reset preserves every goal; accepting affects only this date's local notes.
  await page.locator('.live-score-options summary').click();page.once('dialog',d=>d.dismiss());await page.locator('#liveReset').click();await totals(2,1);page.once('dialog',d=>d.accept());await page.locator('#liveReset').click();await totals(0,0);assert.equal(state.results.length,0);
  await page.locator('.live-score-options summary').click();await tap('white',0);await page.locator('#liveBlackPlayers .live-unknown').click();await totals(1,1);
  await page.locator('#liveReview').click();assert.equal(await page.locator('#liveScoreDialog').isVisible(),false);assert.equal(await page.locator('#resultMatch').inputValue(),'2');assert.equal(await page.locator('#resultWhite').inputValue(),'1');assert.equal(await page.locator('#resultBlack').inputValue(),'1');assert((await page.locator('#liveScoreReview').textContent()).includes('LORIA'));assert((await page.locator('#liveScoreReview').textContent()).includes('Sin identificar'));assert.equal(state.results.length,0,'review must not publish');
  rejectSave=true;await page.locator('#resultForm button').click();await page.waitForFunction(()=>document.querySelector('#resultMessage').textContent.includes('Error simulado'));await page.locator('#openLiveScore').click();await totals(1,1);assert.equal(await page.locator('#liveUndo').isEnabled(),true);await page.locator('#closeLiveScore').click();
  await page.locator('#resultForm button').click();await page.waitForFunction(()=>document.querySelector('#resultMessage').textContent.includes('finalizada'));assert.equal(state.results.length,1);assert.equal(state.results[0].whiteGoals,1);assert.equal(state.results[0].blackGoals,1);
  await page.locator('#openLiveScore').click();await totals(1,1);assert.equal(await page.locator('#liveUndo').isEnabled(),false);assert.equal(await page.locator('#liveReopen').isVisible(),true);assert.equal(await page.locator('#liveWhitePlayers .live-player').first().isEnabled(),false);
  page.once('dialog',d=>d.accept());await page.locator('#liveReopen').click();await page.locator('#liveUndo').click();await totals(1,0);assert.equal(state.results[0].blackGoals,1,'editing notes must not silently change the official result');
  await page.locator('#liveReview').click();await page.locator('#resultForm button').click();await page.waitForFunction(()=>document.querySelector('#resultMessage').textContent.includes('Claro 1 - 0'));assert.equal(state.results.length,1);assert.equal(state.results[0].blackGoals,0);
  await page.locator('#openLiveScore').click();await page.locator('#liveMatchSelect').selectOption('3');await totals(1,0);
  // If persistent storage fails, do not show a goal as saved or increment the visible score.
  await page.evaluate(()=>{window.liveOriginalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.startsWith('chiquimafia_live_score_v1:'))throw new DOMException('Storage full','QuotaExceededError');return window.liveOriginalSetItem.call(this,k,v)}});await tap('white',0);await totals(1,0);assert((await page.locator('#liveScoreMessage').textContent()).includes('No se pudo guardar'));await page.evaluate(()=>Storage.prototype.setItem=window.liveOriginalSetItem);
  await page.locator('#closeLiveScore').click();await page.evaluate(()=>localStorage.setItem('chiquimafia_live_score_v1:3:2026-10-17','{corrupt'));await page.locator('#openLiveScore').click();assert.equal(await page.locator('#liveReview').isEnabled(),false);assert((await page.locator('#liveScoreMessage').textContent()).includes('no se pudieron leer'));
  await page.locator('.live-score-options summary').click();page.once('dialog',d=>d.accept());await page.locator('#liveReset').click();await totals(0,0);await page.locator('.live-score-options summary').click();await tap('black',7);await totals(0,1);
  for(const width of [360,390,768,1440]){await page.setViewportSize({width,height:844});assert(await page.locator('#liveScoreDialog').evaluate(e=>e.scrollWidth<=e.clientWidth&&e.getBoundingClientRect().width<=innerWidth),'recorder fits width '+width)}
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/chiqui-live-score-8x8.png'});
  await page.locator('#closeLiveScore').click();await page.locator('#adminLogout').click();await page.evaluate(()=>document.querySelector('#openLiveScore').click());assert.equal(await page.locator('#liveScoreDialog').isVisible(),false);
  await load();await login();await page.locator('#openLiveScore').click();assert.equal(await page.locator('#liveMatchSelect').inputValue(),'3');await totals(0,1);
  // Reused date numbers with a new date start separately; saved drafts are not overwritten.
  await page.locator('#closeLiveScore').click();await page.evaluate(({white,black})=>ChiquiLiveScore.setMatches([{number:3,date:'2027-01-02',white,black,played:false}]),{white,black});await page.locator('#openLiveScore').click();await totals(0,0);assert(await page.evaluate(()=>localStorage.getItem('chiquimafia_live_score_v1:3:2026-10-17').includes('KEVIN')));
  await page.locator('#closeLiveScore').click();await page.evaluate(()=>ChiquiLiveScore.setMatches([]));assert.equal(await page.locator('#openLiveScore').isEnabled(),false);assert.equal(await page.locator('#liveScoreAvailability').isVisible(),true);
  assert.deepEqual(errors,[]);console.log('PASS: 8x8 touch scoring and sticky score/actions; local persistence/reload/offline; undo/unknown goals; date isolation; reset confirmation; review without publication; publish failure/retry and correction; published-note lock; storage failure/corruption recovery; empty fixtures; logout/access; four widths; no real backend writes.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
