(()=>{'use strict';const $=s=>document.querySelector(s);let chosen='';$('#toggleAdminPreview').onclick=()=>{const panel=$('#demoAdminQuick');panel.hidden=!panel.hidden;$('#toggleAdminPreview').textContent=panel.hidden?'Ver vista de admin':'Volver a vista de jugador';$('.admin-preview-toggle span').textContent=panel.hidden?'Ahora ves el inicio como jugador.':'Así se vería el acceso rápido solo para el admin.'};$('.sample-vote').addEventListener('click',e=>{const b=e.target.closest('[data-demo-vote]');if(!b)return;chosen=b.dataset.demoVote;$('.sample-vote').querySelectorAll('button').forEach(node=>node.setAttribute('aria-pressed',String(node===b)));$('#demoVoteConfirmation').hidden=false;$('#demoVoteChoice').textContent='¿Confirmás tu voto de ejemplo para '+chosen+'?';$('#demoVoteMessage').textContent=''});$('#confirmDemoVote').onclick=()=>{if(!chosen)return;$('#demoVoteConfirmation').hidden=true;$('#demoVoteMessage').textContent='Voto de prueba para '+chosen+' registrado en esta vista. No se envió al torneo.'};
// Keep the original classification columns and place news inside each player cell.
const sampleStats=[[2,2,0,0,4,1,0],[2,2,0,0,4,1,0],[2,1,1,0,3,0,0],[2,1,0,1,3,0,0],[2,0,1,1,4,0,0]];
const news=[['↑ Subió 2 puestos','⭐ Más MVP'],['↑ Subió 3 puestos','⭐ Más MVP'],['🤝 Más asistencias'],[],[]];
$('#demoStandings').querySelectorAll('tr').forEach((row,index)=>{
 const cell=row.children[1],name=cell.querySelector('.player-name');cell.querySelector('.badge')?.remove();
 const player=document.createElement('div');player.className='original-player-cell';
 const initial=document.createElement('span');initial.className='original-player-initial';initial.textContent=name.textContent.slice(0,2);
 const details=document.createElement('div');details.append(name);
 if(news[index].length){const labels=document.createElement('div');labels.className='inline-player-news';news[index].forEach(text=>{const label=document.createElement('span');label.textContent=text;labels.append(label)});details.append(labels)}
 player.append(initial,details);cell.replaceChildren(player);
 sampleStats[index].forEach(value=>{const td=document.createElement('td');td.textContent=value;row.append(td)});
});
})();
