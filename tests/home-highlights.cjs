const {chromium}=require('playwright'),assert=require('node:assert/strict'),{createBackend}=require('./apps-script-harness.cjs');
(async()=>{
 const b=createBackend(),white=['LORIA','DIEGO','FRANCO','MATU','VALEN','DARIO','BILLO','JOACO'],black=['LUCAS','PABLO','GONZA','AUGUSTO','LIHUEL','AGUS','LAUTY','KEVIN'];
 for(const name of [...white,...black])assert(b.call('addPlayer',{pin:'test-pin',name}).ok);
 assert(b.call('saveLineup',{pin:'test-pin',item:{matchNumber:1,date:'2026-10-03',white,black}}).ok);
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try {
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://script.google.com/**',r=>{if(r.request().method()==='GET')return r.fulfill({json:b.state()});const body=JSON.parse(r.request().postData());assert(/^list/.test(body.action),'Unexpected public write '+body.action);return r.fulfill({json:b.call(body.action,body)})});
  const load=async()=>{await page.goto(process.env.CHIQUI_TEST_URL||'http://127.0.0.1:8065/');await page.waitForFunction(()=>document.querySelector('#syncStatus').textContent==='En vivo')};
  await load();assert.equal(await page.locator('#standingsBody [title="Líder en asistencias"]').count(),0);
  const goalEvents=[],scorers=[];for(let i=0;i<5;i++){scorers.push({player:white[i],team:'white',goals:5-i});for(let j=0;j<5-i;j++)goalEvents.push({id:'w'+i+'-'+j,player:white[i],team:'white',assist:white[(i+1)%5]})}
  goalEvents.push({id:'tie',player:'LORIA',team:'white',assist:'FRANCO'});scorers[0].goals++;
  black.forEach((player,i)=>{scorers.push({player,team:'black',goals:1});goalEvents.push({id:'b'+i,player,team:'black',assist:black[(i+1)%black.length]})});
  assert(b.call('saveResult',{pin:'test-pin',item:{matchNumber:1,whiteGoals:16,blackGoals:8,scorers,goalEvents}}).ok);
  for(const [player,candidate] of [['LORIA','DIEGO'],['LUCAS','FRANCO'],['MATU','VALEN']])assert(b.call('voteMvp',{item:{matchNumber:1,player,candidate}}).ok);
  b.setTime('2026-10-06T00:00:00Z');await load();
  assert.equal(await page.locator('#homeHighlights,.home-highlight').count(),0);assert.equal(await page.locator('#featuredMatch .match-award').count(),3);assert((await page.locator('#featuredMatch .match-award.mvp strong').textContent()).includes('DIEGO'));assert((await page.locator('#featuredMatch .match-award.mvp strong').textContent()).includes('FRANCO'));assert((await page.locator('#featuredMatch .match-award.mvp strong').textContent()).includes('VALEN'));
  assert.equal(await page.locator('#statHighlights .stat-box').count(),5);assert.equal(await page.locator('.stat-box.stat-leader').count(),1);
  assert.deepEqual(await page.locator('#statHighlights>.stat-box>span').allTextContents(),['Más goles','Más MVP','Más asistencias','Mejor racha','Líder']);
  for(const id of ['goalsRanking','mvpRanking','assistsRanking','streakRanking'])assert.equal(await page.locator('#'+id+' .rank-row').count(),5,id);
  const names=await page.locator('#standingsBody tr').filter({has:page.locator('[title="Líder en asistencias"]')}).locator('.player-cell>span:nth-child(2)').allTextContents();assert.deepEqual([...names].sort(),['DIEGO','FRANCO']);
  const leader=await page.locator('#standingsBody tr').first().locator('.player-cell>span:nth-child(2)').textContent();assert.equal(await page.locator('.stat-leader strong').textContent(),leader);
  assert.equal(await page.locator('.stat-box').first().evaluate(e=>getComputedStyle(e).animationName),'chiqui-float');
  for(const [type,hash] of [['mvp','#mvpRankingCard'],['goals','#goalsRankingCard'],['assists','#assistsRankingCard']]){await page.locator('#featuredMatch .match-award.'+type).click();await page.waitForURL(url=>url.hash===hash)}await page.locator('#featuredMatch .featured-button').click();await page.waitForURL(url=>url.hash==='#fechas');assert.equal(await page.locator('#matchFilter').inputValue(),'played');
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.stat-box').first().evaluate(e=>getComputedStyle(e).animationName),'none');
  for(const width of [360,390,768,1440]){
   await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   const rects=await page.evaluate(()=>Object.fromEntries(['goalsRankingCard','mvpRankingCard','assistsRankingCard','streakRankingCard','statsLeaderCard'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return[id,{x:r.x,y:r.y,bottom:r.bottom,width:r.width}]})));
   assert(Math.abs(rects.goalsRankingCard.x-rects.assistsRankingCard.x)<1);assert(Math.abs(rects.mvpRankingCard.x-rects.streakRankingCard.x)<1);
   assert(rects.assistsRankingCard.y>=rects.goalsRankingCard.bottom);assert(rects.streakRankingCard.y>=rects.mvpRankingCard.bottom);
   assert(rects.statsLeaderCard.y>=Math.max(rects.assistsRankingCard.bottom,rects.streakRankingCard.bottom));assert(rects.statsLeaderCard.width>rects.goalsRankingCard.width*1.9);
   assert(await page.evaluate(()=>document.querySelector('.top5-grid').getBoundingClientRect().top>=document.querySelector('#statsLeaderCard').getBoundingClientRect().bottom));
   assert(await page.locator('#goalsRanking').evaluate(e=>e.clientHeight<=300&&getComputedStyle(e).overflowY==='auto'));
  }
  await page.setViewportSize({width:390,height:844});await page.locator('#statHighlights').screenshot({path:'/tmp/chiqui-restored-stat-cards.png'});assert.deepEqual(errors,[]);
  console.log('PASS: original animated colored cards in 2x2 order, full-width leader, Top 5 scrollable lists, awards inside last-match card with links, real points and tied assist badges, reduced motion and four screens. All data simulated.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
