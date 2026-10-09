const vm=require('node:vm'),fs=require('node:fs');
function createBackend(initial={},time='2026-10-03T23:00:00Z'){
 let current=Date.parse(time),locked=false,failNextRecord=false;const sheets=new Map(),properties=new Map([['ADMIN_PIN','test-pin']]),triggers=[];
 class Range{
  constructor(sheet,row=1,col=1,rows,cols){Object.assign(this,{sheet,row,col,rows,cols})}
  getValues(){const rows=this.rows??Math.max(1,this.sheet.rows.length),cols=this.cols??Math.max(1,this.sheet.getLastColumn());return Array.from({length:rows},(_,r)=>Array.from({length:cols},(_,c)=>this.sheet.rows[this.row-1+r]?.[this.col-1+c]??''))}
  getDisplayValues(){return this.getValues().map(row=>row.map(String))}
  setValues(values){if(this.sheet.name==='Registro Partido Web'&&failNextRecord){failNextRecord=false;throw Error('Fallo simulado de guardado')}
   values.forEach((row,r)=>row.forEach((value,c)=>{this.sheet.rows[this.row-1+r]??=[];this.sheet.rows[this.row-1+r][this.col-1+c]=value}));return this}
  setValue(value){return this.setValues([[value]])}
 }
 class Sheet{
  constructor(name,rows=[]){this.name=name;this.rows=rows}
  getName(){return this.name}getDataRange(){return new Range(this)}getRange(...args){return new Range(this,...args)}getLastRow(){return this.rows.length}getLastColumn(){return Math.max(0,...this.rows.map(r=>r.length))}
  appendRow(row){if(this.name==='Votos MVP Web'&&!locked)throw Error('Vote written without server lock');if(this.name==='Registro Partido Web'&&failNextRecord){failNextRecord=false;throw Error('Fallo simulado de guardado')}this.rows.push([...row]);return this}
  setFrozenRows(){}insertColumnAfter(col){this.rows.forEach(row=>row.splice(col,0,''))}deleteRow(index){this.rows.splice(index-1,1)}deleteRows(index,count){this.rows.splice(index-1,count)}
  copyTo(){const copy=new Sheet('Copy '+this.name,structuredClone(this.rows));sheets.set(copy.name,copy);return copy}setName(name){sheets.delete(this.name);this.name=name;sheets.set(name,this);return this}
 }
 const book={getSheetByName:name=>sheets.get(name)||null,insertSheet:name=>{const sheet=new Sheet(name);sheets.set(name,sheet);return sheet},getSheets:()=>[...sheets.values()]};
 for(const [name,rows] of Object.entries(initial))sheets.set(name,new Sheet(name,structuredClone(rows)));
 const OriginalDate=Date;class ClockDate extends OriginalDate{constructor(...args){super(...(args.length?args:[current]))}static now(){return current}}
 const context=vm.createContext({console,Date:ClockDate,SpreadsheetApp:{getActiveSpreadsheet:()=>book,flush(){}},LockService:{getScriptLock:()=>({waitLock(){if(locked)throw Error('Nested lock');locked=true},releaseLock(){locked=false}})},PropertiesService:{getScriptProperties:()=>({getProperty:key=>properties.get(key)??null,setProperty(key,value){properties.set(key,String(value));return this}})},Utilities:{getUuid:()=>require('node:crypto').randomUUID(),formatDate:value=>new OriginalDate(value).toLocaleDateString('en-CA',{timeZone:'America/Argentina/Buenos_Aires'})},ContentService:{MimeType:{JSON:'json',JAVASCRIPT:'javascript'},createTextOutput:text=>({text,setMimeType(){return this}})},ScriptApp:{EventType:{CLOCK:'clock'},getProjectTriggers:()=>triggers,newTrigger:handler=>{const spec={handler};const builder={timeBased(){return this},at(date){spec.at=+date;return this},everyMinutes(minutes){spec.minutes=minutes;return this},create(){const id='trigger-'+triggers.length,t={...spec,getUniqueId:()=>id,getHandlerFunction:()=>handler,getEventType:()=> 'clock'};triggers.push(t);return t}};return builder}}});
 vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../google-apps-script/Code.gs'),'utf8'),context);
 const clean=value=>JSON.parse(JSON.stringify(value));
 return {context,sheets,triggers,properties,setTime:value=>{current=+new OriginalDate(value)},now:()=>current,failRecord:()=>{failNextRecord=true},call(action,payload={}){return JSON.parse(context.doPost({postData:{contents:JSON.stringify({action,...payload})}}).text)},state(){return clean(context.tournamentState_())},run(name,...args){return clean(context[name](...args)??null)}};
}
module.exports={createBackend};
