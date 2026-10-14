const test=require('node:test'),assert=require('node:assert/strict'),{series}=require('../js/ranking-evolution.js');
const matches=[{number:2,played:true,white:['A'],black:['B'],winner:'black'},{number:1,played:true,white:['A'],black:['B'],winner:'white'},{number:3,played:false,white:['A'],black:['B']}],players=[{player:'A'},{player:'B'}];
test('Goals use official records instead of duplicate declarations; ordered played dates only',()=>{
 const model=series('goals',players,matches,[{matchNumber:1,scorers:[{player:'a',goals:2}]}],[{matchNumber:1,player:'A',goals:99,status:'approved'},{matchNumber:2,player:'A',goals:1,status:'approved'},{matchNumber:2,player:'B',goals:8,status:'pending'}],[]);
 assert.deepEqual(model.rounds,[0,1,2]);assert.deepEqual(model.lines.map(l=>l.values),[[0,2,3],[0,0,0]]);
});
test('Assists and tied MVP preserve fractional values and zero-match empty state',()=>{
 const records=[{matchNumber:1,assists:[{player:'A',assists:2}]}],awards=[{matchNumber:1,player:'A',points:.5},{matchNumber:1,player:'B',points:.5},{matchNumber:2,player:'B',points:1}];
 assert.deepEqual(series('assists',players,matches,records,[],[]).lines[0].values,[0,2,2]);
 assert.deepEqual(series('mvp',players,matches,[],[],awards).lines.map(l=>l.values),[[0,.5,.5],[0,.5,1.5]]);
 assert.deepEqual(series('mvp',players,[],[],[],[]).rounds,[0]);
});
test('Best streak does not decrease on defeat; missed matches do not reset it',()=>{
 const games=[{number:1,played:true,white:['A'],black:['B'],winner:'white'},{number:2,played:true,white:['C'],black:['B'],winner:'white'},{number:3,played:true,white:['A'],black:['B'],winner:'white'},{number:4,played:true,white:['A'],black:['B'],winner:'draw'}];
 assert.deepEqual(series('streak',players,games,[],[],[]).lines[0].values,[0,1,1,2,2]);
});
