const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try {
  const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const names=Array.from({length:8},(_,i)=>'JUGADOR '+(i+1));
  const state={ok:true,players:names.map(name=>({name,status:'active'})),lineups:[17,18].map(matchNumber=>({matchNumber,date:'2026-10-10',white:names.slice(0,4),black:names.slice(4)})),results:[17,18].map(matchNumber=>({matchNumber,whiteGoals:0,blackGoals:0,winner:'draw',played:true})),mvps:[],sanctions:[],deletedDates:[],playoffs:[],history:[],fund:{amount:0}};
  let failNextSave=false;const actions=[];
  await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({body:'',contentType:'text/css'}));
  await page.route('https://script.google.com/**',r=>{
   let response=state;
   if(r.request().method()==='POST'){
    const body=JSON.parse(r.request().postData());actions.push(body.action);response={ok:true,items:[]};
    if(body.action==='auth')response={ok:true,authenticated:true};
    if(body.action==='listPlayoffs')response={ok:true,items:state.playoffs};
    if(body.action==='addHistoricalChampion'){const item={...body.item,champion:body.item.place===1};state.history.push(item);response={ok:true,item};}
    if(body.action==='resetSeason'){state.results=[];state.lineups=[];state.playoffs=[];state.mvps=[];state.sanctions=[];response={ok:true};}
    if(body.action==='savePlayoff'){
     if(failNextSave){failNextSave=false;response={ok:false,error:'Error simulado al guardar'};}
     else {
      const item={...body.item,key:body.item.round+'-'+body.item.slot,updatedAt:new Date().toISOString()};
      const prior=state.playoffs.find(x=>x.key===item.key);
      if(prior)Object.assign(prior,item);else state.playoffs.push(item);
      response={ok:true,item};
     }
    }
   }
   return r.fulfill({json:response,headers:{'access-control-allow-origin':'*'}});
  });
  const load=async()=>{await page.goto(process.env.CHIQUI_TEST_URL||'http://127.0.0.1:8000/');await page.waitForFunction(()=>document.querySelector('#syncStatus').textContent==='En vivo')};
  await load();
  const tableBefore=await page.locator('#standingsBody').textContent();
  const ranking=await page.locator('#standingsBody .player-cell').allTextContents();
  const top=ranking.map(text=>names.find(name=>text.includes(name)));
  assert.equal(new Set(top).size,8);
  const pairs=[[top[0],top[7]],[top[3],top[4]],[top[1],top[6]],[top[2],top[5]]];
  assert.deepEqual(await page.locator('#bracket .playoff-duel').evaluateAll(es=>es.slice(0,4).map(e=>[...e.querySelectorAll('.duel-player')].map(x=>x.textContent))),pairs);
  await page.locator('#adminPin').fill('test-pin');await page.locator('#adminLoginForm button').click();
  await page.locator('#playoffTools summary').click();
  const select=async(round,slot,players)=>{
   await page.locator('#playoffRound').selectOption(round);
   await page.waitForFunction(([round])=>document.querySelector('#playoffSlot').options.length===(round==='quarter'?4:round==='semi'?2:1),[round]);
   await page.locator('#playoffSlot').selectOption(String(slot));
   await page.waitForFunction(players=>document.querySelector('#playoffPlayer1').value===players[0]&&document.querySelector('#playoffPlayer2').value===players[1],players);
  };
  const save=async(round,slot,players,winner)=>{
   await select(round,slot,players);
   await page.locator('#playoffScore1').fill(winner===players[0]?'2':'1');await page.locator('#playoffScore2').fill(winner===players[1]?'2':'1');
   await page.locator('#playoffWinner').selectOption(winner);
   await page.locator('#playoffForm button[type="submit"]').click();
   await page.waitForFunction(()=>document.querySelector('#playoffMessage').textContent.includes('Resultado actual cargado'));
   assert.equal(state.playoffs.find(x=>x.key===round+'-'+slot).winner,winner);
  };
  // A rejected save must leave the bracket intact and permit retrying.
  await select('quarter',1,pairs[0]);await page.locator('#playoffScore1').fill('2');await page.locator('#playoffScore2').fill('1');
  failNextSave=true;await page.locator('#playoffForm button[type="submit"]').click();
  await page.waitForFunction(()=>document.querySelector('#playoffMessage').classList.contains('error'));
  assert.equal(state.playoffs.length,0);assert.equal(await page.locator('#bracket .completed').count(),0);
  const winners=pairs.map((pair,i)=>pair[i%2]);
  for(let i=0;i<4;i++)await save('quarter',i+1,pairs[i],winners[i]);
  assert.equal(await page.locator('#bracket .completed').count(),4);
  await save('semi',1,[winners[0],winners[1]],winners[1]);
  await save('semi',2,[winners[2],winners[3]],winners[2]);
  await save('third',1,[winners[0],winners[3]],winners[3]);
  await save('final',1,[winners[1],winners[2]],winners[2]);
  assert.deepEqual(await page.locator('#finalPodium strong').allTextContents(),[winners[2],winners[1],winners[3]]);
  assert.equal(await page.locator('#bracket .completed').count(),7);assert.equal(await page.locator('#homeChampionBanner').isVisible(),true);assert.equal(await page.locator('#homeChampionBanner>strong').textContent(),winners[2]);assert((await page.locator('#featuredMatch').textContent()).includes('Equipos: Claro 0–0 Oscuro'),'team score must not use the individual duel score');
  assert.equal(await page.locator('#standingsBody').textContent(),tableBefore);
  assert.deepEqual(await page.locator('#standingsBody .player-cell').allTextContents(),ranking);
  await load();
  assert.deepEqual(await page.locator('#finalPodium strong').allTextContents(),[winners[2],winners[1],winners[3]]);
  await page.setViewportSize({width:1440,height:1000});
  assert.equal(await page.locator('#finalPodium').isVisible(),true);
  await page.locator('.admin-season-tools>summary').click();await page.locator('#seasonArchiveName').fill('Prueba de cierre');await page.locator('#resetConfirmation').fill('INCORRECTO');await page.locator('#resetSeasonForm button').click();assert(!actions.includes('resetSeason'));
  await page.locator('#resetConfirmation').fill('FINALIZAR');page.on('dialog',dialog=>dialog.dismiss());await page.locator('#resetSeasonForm button').click();assert(!actions.includes('resetSeason'),'cancel must not reset');page.removeAllListeners('dialog');page.on('dialog',dialog=>dialog.accept());
  await page.locator('#resetSeasonForm button').click();await page.waitForFunction(()=>document.querySelector('#resetMessage').textContent.includes('Torneo reiniciado'));
  assert.equal(actions.filter(x=>x==='resetSeason').length,1);assert.equal(state.players.length,8);assert.equal(state.history.length,3,'zero totals must not create arbitrary scorer/MVP awards');assert.deepEqual(state.history.map(x=>x.player),[winners[2],winners[1],winners[3]]);
  assert.equal(await page.evaluate(()=>localStorage.getItem('chiquimafia_pending_podium_v1')),null);
  assert.deepEqual(errors,[]);
  console.log('PASS: top-eight seeding; rejected save and retry; four quarter-finals, two semi-finals, third place and final; winner/loser advancement; podium and home champion update immediately and survive reload; team/individual scores stay separate; standings unchanged; season close requires confirmation and archives podium without fake awards; mobile and desktop; no real backend writes.');
 } finally {await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
