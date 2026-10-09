const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://script.google.com/**',r=>r.abort());
 await page.goto((process.env.CHIQUI_TEST_URL||'http://127.0.0.1:8007/')+'vista-previa-votacion.html');await page.locator('#mvpVotingPanel').waitFor({state:'visible'});
 const player=name=>page.locator('#mvpCandidateTeams .mvp-player').filter({has:page.locator('strong',{hasText:new RegExp('^'+name+'$')})});
 await page.locator('#exampleVotingPreview').click();await page.waitForFunction(()=>document.querySelector('#mvpCandidateTeams .has-vote-progress'));
 const share=async name=>player(name).evaluate(e=>parseFloat(e.style.getPropertyValue('--vote-share')));
 assert.equal(await share('LORIA'),37.5);assert.equal(await share('DIEGO'),18.75);assert.equal(await share('PABLO'),0);
 assert.equal(await player('LORIA').textContent(),'LORIA+');assert.equal(await player('DIEGO').textContent(),'DIEGO+');
 const ratio=await player('LORIA').evaluate(e=>parseFloat(getComputedStyle(e,'::before').width)/e.clientWidth);assert(Math.abs(ratio-.375)<.01);
 await page.evaluate(()=>window.originalCard=document.querySelector('#mvpCandidateTeams button'));await page.evaluate(()=>ChiquiVoting.refresh());assert(await page.evaluate(()=>window.originalCard===document.querySelector('#mvpCandidateTeams button')),'polling preserves cards for smooth width transitions');
 for(const width of [360,390,768]){await page.setViewportSize({width,height:844});assert(await page.locator('#mvpVotingDialog').evaluate(e=>e.scrollWidth<=e.clientWidth));}
 await page.setViewportSize({width:390,height:844});await page.locator('#cargar-goles').screenshot({path:'/tmp/chiqui-mvp-live-bars.png'});
 await page.locator('#mvpChooseVoter').click();await page.locator('#mvpVoterTeams .mvp-player').filter({hasText:'LORIA'}).click();await player('DIEGO').click();await page.locator('#mvpConfirmVote').click();await page.waitForFunction(()=>document.querySelectorAll('#mvpCandidateTeams .has-vote-progress')[1].style.getPropertyValue('--vote-share')==='25%');
 assert.equal(await share('DIEGO'),25);assert.equal(await share('LORIA'),37.5);
 await page.evaluate(()=>localStorage.setItem('chiquimafia_mvp_identity:test-sentinel','preserve'));await page.locator('#resetVotingPreview').click();await page.waitForFunction(()=>document.querySelector('#mvpVotingPanel').hidden===false);assert.equal(await share('LORIA'),0);assert.equal(await page.evaluate(()=>localStorage.getItem('chiquimafia_mvp_identity:test-sentinel')),'preserve');assert.deepEqual(errors,[]);
 console.log('PASS: proportional bars, no numbers, stable cards, mobile layout, confirmed vote updates immediately, isolated reset. Screenshot: /tmp/chiqui-mvp-live-bars.png');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
