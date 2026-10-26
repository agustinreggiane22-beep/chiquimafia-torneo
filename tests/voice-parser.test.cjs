const {test}=require('node:test'),assert=require('node:assert/strict'),{parse}=require('../demos/voice-parser.js');
test('voice demo recognizes an explicit goal and a same-team pass with accent/case variants',()=>{
 const x=parse('¡GOL DE LORIA, asistencia de DIEGO!');assert.equal(x.scorer,'LORIA');assert.equal(x.assist,'DIEGO');assert.equal(x.team,'white');assert.equal(x.error,'');assert.equal(x.decision,'assigned');
 assert.equal(parse('Gol de Darío, pase de Matute').assist,'MATU');assert.equal(parse('Gol de Gloria, asistió Diego').scorer,'LORIA');
});
test('individual goal and an omitted pass remain distinct without inventing assists',()=>{assert.equal(parse('Gol de Augusto sin asistencia').decision,'none');assert.equal(parse('Gol de Kevin, jugada individual').decision,'none');assert.equal(parse('Gol de Loria').decision,'pending');assert.equal(parse('Gol de Loria').assist,null)});
test('unknown/ambiguous names, opposing passes and self-assists require correction',()=>{assert(parse('Gol de alguien').error);assert.equal(parse('Gol de Agus').scorer,'AGUSREGGI');assert(parse('Gol de Loria y Diego').error);assert(parse('Gol de Loria asistencia de Loria').error);assert(parse('Gol de Loria pase de Kevin').error);assert(parse('Gol de Loria asistencia de alguien').error)});
test('real spoken names distinguish Agustin Reggi/K and resolve Joaquin/Joaco aliases',()=>{
 const ambiguous=parse('Gol de Agustín, asistencia de Joaquín');assert.equal(ambiguous.scorer,null);assert.deepEqual(ambiguous.candidates,['AGUSREGGI','AGUSTIN K']);assert(ambiguous.error.includes('Agustín Kotick'));
 for(const phrase of ['Gol de Agustín Reggiane, asistencia de Joaquín','Gol de Agustin Reggiane, asistencia de Joaquin','Gol de AGUSTÍN REGGIANE, asistencia de JOAQUÍN','Gol de Agustín Reggi, asistencia de Joaquín','Gol de Agus Reggi, pase de Joaco','Gol de Agus, pase de Joaco']){const result=parse(phrase);assert.equal(result.scorer,'AGUSREGGI');assert.equal(result.assist,'JOACOREGGI');assert.equal(result.error,'')}
 for(const phrase of ['Gol de Agustín K, asistencia de Diego','Gol de Agustín Kotick, asistencia de Darío','Gol de Agustin Kotick, asistencia de Dario','Gol de Agustín Cotick, asistencia de Diego','Gol de Kotick, asistencia de Diego']){const k=parse(phrase);assert.equal(k.scorer,'AGUSTIN K');assert(['DIEGO','DARIO'].includes(k.assist));assert.equal(k.error,'')}
 assert(parse('Gol de Agustín Reggiane y Agustín Kotick').error);
 assert(parse('Gol de Agustín y Diego').error);
});
