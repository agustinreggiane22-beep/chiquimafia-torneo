const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try {
  const page=await browser.newPage({viewport:{width:390,height:844},timezoneId:'America/Argentina/Buenos_Aires',reducedMotion:'reduce'}),errors=[],calls=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
  const state={ok:true,players:['A','B','C'].map(name=>({name,status:'active'})),lineups:[{matchNumber:1,date:'2026-10-03T07:00:00.000Z',white:['A','C'],black:['B']},{matchNumber:19,date:'2027-02-06',white:['A'],black:['B']}],results:[{matchNumber:1,whiteGoals:5,blackGoals:3,winner:'white',played:true}],mvps:[],sanctions:[],deletedDates:[],playoffs:[],fund:{amount:0},history:[{season:'Anterior',player:'A',champion:true,attendance:0,goals:0,mvps:0},{season:'Apertura 2026',player:'A',champion:true,attendance:18},{season:'Apertura 2026 ::P2',player:'B',champion:false},{season:'Apertura 2026 ::P3',player:'C',champion:false},{season:'Apertura 2026 ::MVP',player:'C',champion:false,mvps:4},{season:'Apertura 2026 ::GOLEADOR',player:'B',champion:false,goals:12}]};
  const submissions=[],fields={listWebPlayers:'players',listLineups:'lineups',listResults:'results',listMvp:'mvps',listSanctions:'sanctions',listDeletedDates:'deletedDates',listPlayoffs:'playoffs'};
  let failAuth=false;
  await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({body:'',contentType:'text/css'}));
  await page.route('https://script.google.com/**',r=>{
   let response=state;
   if(r.request().method()==='POST'){
    const body=JSON.parse(r.request().postData());calls.push(body.action);
    if(body.action in fields)response={ok:true,items:state[fields[body.action]]};
    else if(body.action==='list')response={ok:true,items:submissions};
    else if(body.action==='auth'){response=failAuth?{ok:false,error:'Error simulado de conexión'}:{ok:true,authenticated:body.pin==='test-pin'};failAuth=false;}
    else if(body.action==='submit'){
     if(submissions.some(x=>x.player===body.item.player&&x.matchNumber===body.item.matchNumber&&x.status!=='rejected'))response={ok:false,error:'Ya existe una declaración para ese jugador en esta fecha.'};
     else {submissions.push(body.item);response={ok:true,item:body.item};}
    }else if(body.action==='decide'){const item=submissions.find(x=>x.id===body.id);item.status=body.status;response={ok:true,item};}
    else if(body.action==='confirmMvp'){const item={matchNumber:body.matchNumber,player:body.player};state.mvps.push(item);response={ok:true,item};}
    else if(body.action==='saveResult'){
     const item={...body.item,winner:body.item.whiteGoals===body.item.blackGoals?'draw':body.item.whiteGoals>body.item.blackGoals?'white':'black',played:true};Object.assign(state.results.find(x=>x.matchNumber===item.matchNumber),item);response={ok:true,item};
    }else if(body.action==='addSanction'){const item={...body.item,id:'sanction-test',points:-Math.abs(body.item.points)};state.sanctions.push(item);response={ok:true,item};}
    else if(body.action==='deleteSanction'){state.sanctions=state.sanctions.filter(x=>x.id!==body.id);response={ok:true};}
    else if(body.action==='addHistoricalChampion'){const item={...body.item,champion:body.item.place===1};state.history.push(item);response={ok:true,item};}
    else if(body.action==='saveFund'){state.fund={amount:body.amount};response={ok:true,item:state.fund};}
    else throw new Error('Unexpected test action '+body.action);
   }
   return r.fulfill({json:response,headers:{'access-control-allow-origin':'*'}});
  });
  const load=async()=>{await page.goto(process.env.CHIQUI_TEST_URL||'http://127.0.0.1:8000/');await page.waitForFunction(()=>document.querySelector('#syncStatus').textContent==='En vivo')};
  const points=player=>page.locator('#standingsBody tr').evaluateAll((rows,player)=>rows.find(row=>row.querySelector('.player-cell>span:nth-child(2)').textContent===player).children[2].textContent,player);
  await load();await page.evaluate(()=>window.scrollTo(0,document.querySelector('#fechas').offsetTop-100));await page.waitForFunction(()=>document.querySelector('#mainNav a.active').hash==='#fechas');await page.evaluate(()=>window.scrollTo(0,0));await page.waitForFunction(()=>document.querySelector('#mainNav a.active').hash==='#inicio');assert.equal(await page.locator('#phaseLabel').textContent(),'Fase regular','scheduling playoffs must not finish the regular season');
  await page.locator('#matchFilter').selectOption('played');assert((await page.locator('#matchesGrid .match-top span').textContent()).includes('3 de octubre'));assert(!(await page.locator('#matchesGrid').textContent()).includes('T07:00'));
  const currentSeason=page.locator('.fame-season').filter({has:page.locator('h3',{hasText:'Apertura 2026'})});
  assert.equal(await currentSeason.locator('.fame-champion strong').textContent(),'A');assert.deepEqual(await currentSeason.locator('.fame-podium strong').allTextContents(),['B','C']);assert.deepEqual(await currentSeason.locator('.fame-awards strong').allTextContents(),['C','B','A']);
  assert.equal(await page.locator('.fame-season').count(),1,'only one cabinet is displayed');
  await page.locator('#fameSeasonSelect').selectOption('Anterior');
  const older=page.locator('.fame-season').filter({has:page.locator('h3',{hasText:'Anterior'})});assert.equal(await older.locator('.fame-awards').count(),0,'no invented MVP or scorer when historic totals are zero');
  assert.equal(await older.locator('.fame-champion .fame-engraving').textContent(),'A');
  await page.locator('#fameSeasonSelect').selectOption('Apertura 2026');
  assert(!await page.locator('#mvpVote option').evaluateAll(es=>es.some(e=>e.value===document.querySelector('#goalPlayer').value)));
  await page.locator('#goalCount').fill('6');await page.locator('#goalForm button').click();assert.equal(calls.filter(x=>x==='submit').length,0,'too many goals are rejected before posting');
  await page.locator('#goalCount').fill('2');await page.locator('#mvpVote').selectOption('B');await page.locator('#goalForm button').click();await page.waitForFunction(()=>document.querySelector('#goalMessage').textContent.includes('pendientes de aprobación'));assert.equal(submissions.length,1);
  await page.locator('#goalCount').fill('2');await page.locator('#mvpVote').selectOption('B');await page.locator('#goalForm button').click();await page.waitForFunction(()=>document.querySelector('#goalMessage').classList.contains('error'));assert.equal(submissions.length,1);
  failAuth=true;await page.locator('#adminPin').fill('test-pin');await page.locator('#adminLoginForm button').click();await page.waitForFunction(()=>document.querySelector('#adminLoginMessage').textContent.includes('Error simulado'));assert.equal(await page.locator('#adminPanel').isVisible(),false);
  await page.locator('#adminPin').fill('wrong-pin');await page.locator('#adminLoginForm button').click();await page.waitForFunction(()=>document.querySelector('#adminLoginMessage').textContent.includes('PIN incorrecto'));
  await page.locator('#adminPin').fill('test-pin');await page.locator('#adminLoginForm button').click();await page.waitForFunction(()=>document.querySelector('#pendingGoals .pending-card'));
  await page.locator('#pendingGoals [data-action="approved"]').click();await page.waitForFunction(()=>document.querySelector('#pendingGoals .pending-card')===null);assert.equal(submissions[0].status,'approved');await page.waitForFunction(()=>document.querySelector('#goalsRanking').textContent.includes('2'));await page.waitForFunction(()=>document.querySelector('#featuredMatch .compact-awards').textContent.includes('Goleador: A'));assert((await page.locator('#goalsRanking').textContent()).includes('2'));
  await page.locator('#mvpVoteResults .confirm-mvp').click();await page.waitForFunction(()=>document.querySelector('#mvpVoteResults .official-mvp'));await page.waitForFunction(()=>[...document.querySelectorAll('#standingsBody tr')].some(row=>row.querySelector('.player-cell>span:nth-child(2)').textContent==='B'&&row.children[2].textContent==='2'));assert.equal(await points('B'),'2');await page.waitForFunction(()=>document.querySelector('#featuredMatch .compact-awards').textContent.includes('MVP: B'));assert((await page.locator('#matchesGrid').textContent()).includes('MVP: B'));
  const savedCount=calls.filter(x=>x==='saveResult').length;await page.locator('#resultMatch').fill('99');await page.locator('#resultWhite').fill('0');await page.locator('#resultBlack').fill('0');await page.locator('#resultForm button').click();await page.waitForFunction(()=>document.querySelector('#resultMessage').textContent.includes('no existe'));assert.equal(calls.filter(x=>x==='saveResult').length,savedCount);
  await page.locator('#resultMatch').fill('1');await page.locator('#resultWhite').fill('0');await page.locator('#resultBlack').fill('2');await page.locator('#resultForm button').click();await page.waitForFunction(()=>document.querySelector('#resultMessage').textContent.includes('finalizada'));assert.equal(await points('B'),'4');assert.equal(await points('A'),'1');
  await page.locator('#resultWhite').fill('2');await page.locator('#resultBlack').fill('2');await page.locator('#resultForm button').click();await page.waitForFunction(()=>document.querySelector('#resultMessage').textContent.includes('Claro 2 - 2'));assert.equal(await points('B'),'3');assert.equal(await points('A'),'2');assert((await page.locator('#statHighlights .stat-box').first().textContent()).includes('3 puntos'));
  await page.locator('#disciplineTools summary').click();await page.locator('#sanctionPlayer').selectOption('B');await page.locator('#sanctionPoints').fill('1.5');await page.locator('#sanctionReason').fill('Prueba');await page.locator('#sanctionForm button').click();await page.waitForFunction(()=>document.querySelector('#sanctionsList .sanction-row'));await page.waitForFunction(()=>[...document.querySelectorAll('#standingsBody tr')].some(row=>row.querySelector('.player-cell>span:nth-child(2)').textContent==='B'&&row.children[2].textContent==='1,5'));assert.equal(await points('B'),'1,5');await page.waitForFunction(()=>document.querySelector('#statHighlights .stat-box strong').textContent==='A');
  await page.locator('#sanctionsList button').click();await page.waitForFunction(()=>document.querySelector('#sanctionsList .sanction-row')===null);await page.waitForFunction(()=>[...document.querySelectorAll('#standingsBody tr')].some(row=>row.querySelector('.player-cell>span:nth-child(2)').textContent==='B'&&row.children[2].textContent==='3'));assert.equal(await points('B'),'3');
  await page.locator('#fundTools summary').click();await page.locator('#fundInput').fill('4500');await page.locator('#fundForm button').click();await page.waitForFunction(()=>document.querySelector('#fundMessage').textContent==='Caja actualizada.');assert((await page.locator('#fundAmount').textContent()).includes('4.500'));
  await page.locator('#adminLogout').click();assert.equal(await page.locator('#adminPanel').isVisible(),false);
  await load();assert.equal(await points('B'),'3');assert.equal(await points('A'),'2');
  for(const width of [360,390,768,1440]){
   await page.setViewportSize({width,height:900});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page must fit width '+width);
   assert(await page.locator('#hallOfFame').evaluate(e=>e.scrollWidth<=e.clientWidth),'hall must fit width '+width);
  }
  await page.locator('#historia').screenshot({path:'/tmp/chiqui-hall-desktop.png'});await page.setViewportSize({width:390,height:844});await page.locator('#historia').screenshot({path:'/tmp/chiqui-hall-mobile.png'});
  await page.locator('#adminPin').fill('test-pin');await page.locator('#adminLoginForm button').click();await page.locator('.admin-season-tools>summary').click();
  await page.locator('#restoreSeason').fill('Temporada recuperada');await page.locator('#restoreChampion').selectOption('C');await page.locator('#restoreRunner').selectOption('B');await page.locator('#restoreThird').selectOption('A');await page.locator('#restoreScorer').selectOption('B');await page.locator('#restoreMvp').selectOption('C');
  await page.locator('#restorePodiumForm button').click();await page.waitForFunction(()=>document.querySelector('#restorePodiumMessage').textContent.includes('Podio guardado'));
  assert.equal(state.history.filter(x=>x.season.startsWith('Temporada recuperada')).length,5);assert.equal(state.history.find(x=>x.season==='Temporada recuperada ::P2').points,3,'archived points include the regular-season MVP bonus');
  await load();const recovered=page.locator('.fame-season').filter({has:page.locator('h3',{hasText:'Temporada recuperada'})});assert.equal(await recovered.locator('.fame-champion strong').textContent(),'C');assert.deepEqual(await recovered.locator('.fame-podium strong').allTextContents(),['B','A']);
  state.history.push({season:'Clausura 2026',player:'B',champion:true},{season:'Apertura 2027',player:'C',champion:true});
  await load();assert.equal(await page.locator('#fameSeasonSelect option').count(),5);assert.equal(await page.locator('.fame-season').count(),1);assert.equal(await page.locator('.fame-champion strong').textContent(),'C');
  await page.locator('#fameSeasonSelect').selectOption('Clausura 2026');assert.equal(await page.locator('.fame-champion .fame-engraving').textContent(),'B');
  await page.locator('#fameSeasonSelect').selectOption('Apertura 2026');assert.deepEqual(await page.locator('.fame-podium strong').allTextContents(),['B','C']);assert.deepEqual(await page.locator('.fame-awards strong').allTextContents(),['C','B','A']);
  state.history=[];await load();assert.equal(await page.locator('.fame-empty').count(),1);assert.equal(await page.locator('.fame-awards').count(),0);assert.equal(await page.locator('#fameSeasonSelect').count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS: historical podium/figures/attendance grouped by season and no fake zero-total awards; readable dates; future playoff scheduling; goals and cross-team MVP submission/duplicates/limits; login failures/retry/logout; approvals/MVP; editing stored result twice and reload consistency; fractional sanctions/removal; fund balance; empty history; four viewport sizes; no real tournament writes.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
