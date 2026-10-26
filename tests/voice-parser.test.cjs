const {test}=require('node:test'),assert=require('node:assert/strict'),{parse}=require('../demos/voice-parser.js');
test('voice demo recognizes an explicit goal and a same-team pass with accent/case variants',()=>{
 const x=parse('¡GOL DE LORIA, asistencia de DIEGO!');assert.equal(x.scorer,'LORIA');assert.equal(x.assist,'DIEGO');assert.equal(x.team,'white');assert.equal(x.error,'');assert.equal(x.decision,'assigned');
 assert.equal(parse('Gol de Darío, pase de Matute').assist,'MATU');assert.equal(parse('Gol de Gloria, asistió Diego').scorer,'LORIA');
});
test('individual goal and an omitted pass remain distinct without inventing assists',()=>{assert.equal(parse('Gol de Augusto sin asistencia').decision,'none');assert.equal(parse('Gol de Kevin, jugada individual').decision,'none');assert.equal(parse('Gol de Loria').decision,'pending');assert.equal(parse('Gol de Loria').assist,null)});
test('unknown/ambiguous names, opposing passes and self-assists require correction',()=>{assert(parse('Gol de alguien').error);assert.equal(parse('Gol de Agus').scorer,null);assert(parse('Gol de Loria y Diego').error);assert(parse('Gol de Loria asistencia de Loria').error);assert(parse('Gol de Loria pase de Kevin').error);assert(parse('Gol de Loria asistencia de alguien').error)});
