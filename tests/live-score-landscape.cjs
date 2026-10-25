const {chromium}=require('playwright'),assert=require('node:assert/strict'),{createBackend}=require('./apps-script-harness.cjs');
(async()=>{
 const backend=createBackend(),white=['LORIA','DIEGO','FRANCO','MATU','VALEN','MATI BILLO','DARIO','NAHUEL'],black=['LUCAS','AUGUSTO','LIHUEL','PABLO','GONZA','AGUSREGGI','LAUTY','KEVIN'];
 for(const name of [...white,...black])assert(backend.call('addPlayer',{pin:'test-pin',name}).ok);
 assert(backend.call('saveLineup',{pin:'test-pin',item:{matchNumber:1,date:'2026-10-24',white,black}}).ok);
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://script.google.com/**',route=>{const request=route.request();if(request.method()==='GET')return route.fulfill({json:backend.state()});const body=JSON.parse(request.postData());return route.fulfill({json:backend.call(body.action,body)})});
  const load=async()=>{await page.goto(process.env.CHIQUI_TEST_URL||'http://127.0.0.1:8096/');await page.waitForFunction(()=>document.querySelector('#syncStatus').textContent==='En vivo')};
  await load();await page.locator('#adminPin').fill('test-pin');await page.locator('#adminLoginForm button').click();await page.waitForFunction(()=>!document.querySelector('#adminPanel').hidden);await page.locator('#openLiveScore').click();
  const normalFont=await page.locator('#liveWhitePlayers .live-player span').first().evaluate(e=>parseFloat(getComputedStyle(e).fontSize));
  for(const size of [{width:667,height:375},{width:844,height:390},{width:932,height:430},{width:1024,height:600}]){
   await page.setViewportSize(size);
   const geometry=await page.evaluate(()=>{const dialog=document.querySelector('#liveScoreDialog').getBoundingClientRect(),footer=document.querySelector('.live-score-footer').getBoundingClientRect(),button=document.querySelector('#liveWhitePlayers .live-player'),players=document.querySelector('#liveWhitePlayers');return{dialog:{x:dialog.x,y:dialog.y,width:dialog.width,height:dialog.height},footerBottom:footer.bottom,font:parseFloat(getComputedStyle(button.querySelector('span')).fontSize),target:button.getBoundingClientRect().height,scroll:players.scrollHeight,viewport:players.clientHeight,overflow:document.querySelector('#liveScoreDialog').scrollWidth>document.querySelector('#liveScoreDialog').clientWidth}});
   assert.equal(Math.round(geometry.dialog.width),size.width);assert.equal(Math.round(geometry.dialog.height),size.height);assert(geometry.font>normalFont);assert(geometry.target>=76);assert(geometry.footerBottom<=size.height+1);assert.equal(geometry.overflow,false);
   await page.locator('#liveWhitePlayers .live-player').last().scrollIntoViewIfNeeded();assert(await page.locator('#liveWhitePlayers .live-player').last().isVisible());
  }
  await page.setViewportSize({width:844,height:390});await context.setOffline(true);
  await page.locator('#liveWhitePlayers .live-player').filter({hasText:'LORIA'}).click();
  assert.equal(await page.locator('#liveWhiteScore').textContent(),'1');assert(await page.locator('#liveAssistPanel').isVisible());assert.equal(await page.locator('#liveAssistChoices button').count(),7);
  const pass=page.locator('#liveAssistChoices button').filter({hasText:/^DIEGO$/});assert((await pass.boundingBox()).height>=72);assert.equal(await pass.evaluate(e=>parseFloat(getComputedStyle(e).fontSize)),18);await pass.click();assert(await page.locator('#liveAssistPanel').isHidden());
  await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('#liveWhiteScore').textContent(),'1');assert((await page.locator('#liveLastGoal').textContent()).includes('DIEGO'));
  await page.setViewportSize({width:844,height:390});await page.locator('#liveBlackPlayers .live-player').filter({hasText:'KEVIN'}).click();await page.locator('#liveSoloGoal').click();assert.equal(await page.locator('#liveBlackScore').textContent(),'1');
  await page.screenshot({path:'/tmp/chiqui-landscape-score.png'});
  await context.setOffline(false);await page.locator('#closeLiveScore').click();await load();await page.locator('#openLiveScore').click();assert.equal(await page.locator('#liveWhiteScore').textContent(),'1');assert.equal(await page.locator('#liveBlackScore').textContent(),'1');assert.deepEqual(errors,[]);
  console.log('PASS: four landscape sizes use full screen and larger targets; last player reachable; assist choices enlarged; portrait/landscape rotation and offline entry preserve goals and passes after reload. No real writes.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
