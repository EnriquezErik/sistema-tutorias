const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('app.js','utf8');
async function run(){
 const alerts=[];let calls=0;const ctx={currentStart:new Date(),savingAdvisory:false,operationId:'test',draftQueue:Promise.resolve(),draftCompleted:false,draftConflict:false,draftSyncOk:false,validateFinish:()=>true,persistActiveSession:()=>{},alert:x=>alerts.push(x),draftFetch:async()=>{calls++;return {ok:true,json:async()=>({completed:false})}}};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('async function finishSession()'),source.indexOf('// HISTORIAL DEL ASESOR')),ctx);
 await ctx.finishSession();assert.equal(calls,1);assert.equal(ctx.savingAdvisory,false);assert(ctx.currentStart);assert.match(alerts[0],/No se confirmó/);
 for(const [file,name,limit] of [['app.js','draftFetch',12000],['admin.js','adminFetch',30000]]){
  let callback,signal;const c=vm.createContext({AbortController,setTimeout:(fn,ms)=>{assert.equal(ms,limit);callback=fn;return 1},clearTimeout(){},fetch:async(_,opt)=>{signal=opt.signal;return {ok:true}}});
  vm.runInContext(fs.readFileSync(file,'utf8').split('\n').find(l=>l.startsWith('function '+name+'(')),c);
  await c[name]('/test');assert.equal(signal.aborted,false);callback();assert.equal(signal.aborted,true);
  const external=new AbortController();await c[name]('/test',{signal:external.signal});external.abort();assert.equal(signal.aborted,true);
 }
 console.log('Respaldo obligatorio antes de finalizar y cancelación de solicitudes: OK (simulación)');
}
run().catch(e=>{console.error(e);process.exitCode=1});
