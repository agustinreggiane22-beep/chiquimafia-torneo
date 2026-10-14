/* Two compact ranking views, derived from saved match data only. */
(function(root){
'use strict';
const colors=['#b52940','#1677aa','#95700a','#18774f','#7957aa'];
const key=name=>String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function series(type,players,matches,records,submissions,awards){
 const played=[...matches].filter(m=>m.played).sort((a,b)=>Number(a.number)-Number(b.number));
 const rounds=[...new Set(played.map(m=>Number(m.number)))];
 const managed=new Map(records.map(r=>[Number(r.matchNumber),r]));
 return {rounds:[0,...rounds],lines:players.slice(0,5).map((row,index)=>{
  let total=0,streak=0,best=0;
  const values=[0];
  for(const round of rounds){
   const match=played.find(m=>Number(m.number)===round),record=managed.get(round);
   if(type==='streak'){
    const white=(match.white||[]).some(p=>key(p)===key(row.player)),black=(match.black||[]).some(p=>key(p)===key(row.player));
    const winner=match.winner||(key(match.result).includes('ganae1')?'white':key(match.result).includes('ganae2')?'black':'draw');
    if(white||black){streak=(winner==='white'&&white||winner==='black'&&black)?streak+1:0;best=Math.max(best,streak)}
    total=best;
   }else{
    const items=type==='goals'?(record?record.scorers||[]:submissions.filter(s=>s.status==='approved'&&Number(s.matchNumber)===round)):type==='assists'?record?.assists||[]:awards.filter(a=>Number(a.matchNumber)===round);
    total+=items.filter(x=>key(x.player)===key(row.player)).reduce((sum,x)=>sum+Number(type==='goals'?x.goals||0:type==='assists'?x.assists||0:x.points??1),0);
   }
   values.push(total);
  }
  return {player:row.player,color:colors[index],values};
 })};
}
function graph(model,type){
 if(model.rounds.length<2||!model.lines.some(l=>l.values.some(v=>v>0)))return '<p class="empty-state">Todavía no hay datos por fecha para mostrar la evolución.</p>';
 const max=Math.max(1,...model.lines.flatMap(l=>l.values)),x=i=>36+i*286/(model.rounds.length-1),y=v=>157-v/max*127,format=v=>Number(v).toLocaleString('es-AR',{maximumFractionDigits:2});
 const grid=[0,.5,1].map(n=>`<line x1="36" x2="322" y1="${y(max*n)}" y2="${y(max*n)}" stroke="#bfd9e6" stroke-dasharray="3 5"/><text x="29" y="${y(max*n)+4}" text-anchor="end">${format(max*n)}</text>`).join('');
 const labels=model.rounds.map((r,i)=>i===0||i===model.rounds.length-1||model.rounds.length<=7?`<text x="${x(i)}" y="178" text-anchor="middle">${r?'F'+r:'Inicio'}</text>`:'').join('');
 const lines=model.lines.map(l=>`<polygon fill="${l.color}" opacity=".06" points="36,157 ${l.values.map((v,i)=>`${x(i)},${y(v)}`).join(' ')} 322,157"/><polyline class="evolution-line" fill="none" stroke="${l.color}" stroke-width="3.5" stroke-linejoin="round" points="${l.values.map((v,i)=>`${x(i)},${y(v)}`).join(' ')}"/>${l.values.map((v,i)=>`<circle cx="${x(i)}" cy="${y(v)}" r="4" fill="${l.color}" stroke="#fff" stroke-width="2"><title>${esc(l.player)} · ${model.rounds[i]?'Fecha '+model.rounds[i]:'Inicio'}: ${format(v)}</title></circle>`).join('')}`).join('');
 return `<div class="evolution-heading"><strong>EVOLUCIÓN</strong><svg class="evolution-trend-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17l6-6 4 4 8-10M15 5h6v6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div><p class="evolution-caption">${type==='streak'?'Mejor racha alcanzada por fecha':'Total acumulado por fecha'}</p><svg viewBox="0 0 340 190" role="img" aria-label="Evolución de los cinco jugadores del ranking por fecha"><g font-family="Inter,sans-serif" font-size="10" fill="#52687b">${grid}${labels}</g>${lines}</svg><ul class="evolution-legend">${model.lines.map(l=>`<li><i style="background:${l.color}"></i><b>${esc(l.player)}</b><span>${format(l.values.at(-1))}</span></li>`).join('')}</ul><small class="evolution-note">Datos guardados por partido.${type==='mvp'?' Los empates conservan su fracción de punto.':''}</small><details class="evolution-data"><summary>Ver valores por fecha</summary><div><table><thead><tr><th>Jugador</th>${model.rounds.slice(1).map(n=>`<th>F${n}</th>`).join('')}</tr></thead><tbody>${model.lines.map(l=>`<tr><th>${esc(l.player)}</th>${l.values.slice(1).map(v=>`<td>${format(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`;
}
function mount(id,type,model){
 const ranking=document.getElementById(id);if(!ranking)return;
 const card=ranking.closest('article');let track=card.querySelector('.ranking-slides');
 if(!track){
  const controls=document.createElement('nav');controls.className='ranking-view-controls';controls.setAttribute('aria-label','Vista de '+type);
  controls.innerHTML='<button type="button" aria-label="Ver ranking de barras" title="Ranking" aria-pressed="true" data-view="0"><span></span></button><button type="button" aria-label="Ver evolución por fecha" title="Evolución" aria-pressed="false" data-view="1"><span></span></button>';
  track=document.createElement('div');track.className='ranking-slides';track.tabIndex=0;track.setAttribute('aria-label','Deslizá para cambiar entre ranking y evolución');
  const first=document.createElement('section');first.className='ranking-slide';first.setAttribute('aria-label','Ranking Top 5');ranking.before(track);first.append(ranking);track.append(first);track.after(controls);
  const second=document.createElement('section');second.className='ranking-slide evolution-slide';second.setAttribute('aria-label','Evolución por fecha');track.append(second);
  const activate=n=>track.scrollTo({left:n*track.clientWidth,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  controls.addEventListener('click',e=>{const button=e.target.closest('[data-view]');if(button)activate(Number(button.dataset.view))});
  track.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();activate(e.key==='ArrowRight'?1:0)}});
  track.addEventListener('scroll',()=>controls.querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===(track.scrollLeft>track.clientWidth/2?1:0)))),{passive:true});
  const hint=document.createElement('small');hint.className='ranking-swipe-hint';hint.textContent='← Deslizá para cambiar de vista →';controls.after(hint);
 }
 const chart=track.querySelector('.evolution-slide'),markup=graph(model,type);if(chart.dataset.content!==markup){chart.innerHTML=markup;chart.dataset.content=markup}
}
async function update(data,rankings){
 const [records,submissions,awards]=await Promise.all([ChiquiGoals.matchRecords(),ChiquiGoals.list(),ChiquiGoals.mvpAwards()]);
 for(const [type,rows] of Object.entries(rankings))mount(type+'Ranking',type,series(type,rows,data.matches,records,submissions,awards));
}
if(typeof module!=='undefined'&&module.exports)module.exports={series};
else root.ChiquiRankingEvolution={update};
})(typeof window==='undefined'?globalThis:window);
