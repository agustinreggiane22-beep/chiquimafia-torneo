const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try {
  const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const lineup=n=>({matchNumber:n,date:'2026-10-10',white:['A'],black:['B']});
  const result=n=>({matchNumber:n,whiteGoals:0,blackGoals:0,winner:'draw',played:true});
  const state={ok:true,players:[{name:'A',status:'active'},{name:'B',status:'active'}],lineups:[lineup(17),lineup(18),lineup(19)],results:[result(17),result(19)],mvps:[],sanctions:[],deletedDates:[],playoffs:[],history:[],fund:{amount:0}};
  await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({body:'',contentType:'text/css'}));
  await page.route('https://script.google.com/**',r=>{
   let response=state;
   if(r.request().method()==='POST') {
    const body=JSON.parse(r.request().postData());response={ok:true,items:[]};
    if(body.action==='auth')response={ok:true,authenticated:true};
    if(body.action==='saveResult'){
     const item={...body.item,winner:'draw',played:true};
     Object.assign(state.results.find(x=>x.matchNumber===item.matchNumber),item);
     response={ok:true,item};
    }
   }
   return r.fulfill({json:response,headers:{'access-control-allow-origin':'*'}});
  });
  const load=async()=>{await page.goto(process.env.CHIQUI_TEST_URL||'http://127.0.0.1:8000/');await page.waitForFunction(()=>document.querySelector('#syncStatus').textContent==='En vivo')};
  const checkHidden=async()=>{
   assert.equal(await page.locator('#playoffs').isVisible(),false);
   assert.equal(await page.locator('#bracket .playoff-duel').count(),0);
   assert.equal(await page.locator('#mainNav a[href="#playoffs"]').getAttribute('hidden'),'');
   assert.equal(await page.locator('#featuredMatch a[href="#playoffs"]').count(),0);
  };
  await load();await checkHidden(); // Scheduled round 18 and a later result do not unlock the bracket.
  state.results.push({...result(18),played:false});await load();await checkHidden();
  await page.locator('#adminPin').fill('test-pin');await page.locator('#adminLoginForm button').click();
  await page.locator('#resultMatch').fill('18');await page.locator('#resultWhite').fill('0');await page.locator('#resultBlack').fill('0');
  await page.locator('#resultForm button[type="submit"]').click();
  await page.waitForFunction(()=>document.querySelector('#resultMessage').textContent.includes('finalizada'));
  assert.equal(await page.locator('#playoffs').isVisible(),true);
  assert.equal(await page.locator('#bracket .playoff-duel').count(),7);
  assert.equal(await page.locator('#mainNav a[href="#playoffs"]').getAttribute('hidden'),null);
  await page.locator('#menuButton').click();await page.locator('#mainNav a[href="#playoffs"]').click();
  assert.equal(new URL(page.url()).hash,'#playoffs');
  state.deletedDates.push({matchNumber:18});await load();await checkHidden();
  assert.deepEqual(errors,[]);
  console.log('PASS: playoffs hidden before round 18, including pending results; saving a completed 0–0 unlocks the bracket without reloading and mobile navigation; deleting round 18 hides both again.');
 } finally {await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
