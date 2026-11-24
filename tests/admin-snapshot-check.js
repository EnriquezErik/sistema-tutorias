const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync('server.js','utf8');
const fn=source.slice(source.indexOf('async function apiAdminData('),source.indexOf('// CONSULTAS ESCALABLES'));
async function run(fail=false){
 const calls=[];let released=0,payload;const client={query:async q=>{calls.push(q);if(fail&&q.includes('from public.advisories a'))throw Error('simulated');return {rows:q.includes('from public.advisories a')?[{id:'one'},{id:'two'}]:[]}},release:()=>released++};
 const context={URL,Promise,requireAdmin:async()=>true,readSession:()=>({id:'admin'}),database:{connect:async()=>client},getBootstrap:async c=>{assert.equal(c,client);await c.query('bootstrap');return {}},advisoryRow:x=>x,sendJson:(_r,status,data)=>{assert.equal(status,200);payload=data}};
 vm.createContext(context);vm.runInContext(fn,context);
 const invoke=()=>context.apiAdminData({url:'/api/admin/data?refresh=1'},{});
 if(fail){await assert.rejects(invoke,/simulated/);assert.equal(calls.at(-1),'ROLLBACK');assert.equal(payload,undefined)}else{await invoke();assert.equal(calls.at(-1),'COMMIT');assert.deepEqual(payload.data.advisories.map(x=>x.id),['one','two']);assert.equal(calls.filter(q=>q.includes('from public.advisories a')).length,1)}
 assert.equal(calls[0],'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');assert.equal(released,1);
}
(async()=>{await run();await run(true);console.log('Snapshot administrativo: transacción, datos completos, rollback y liberación (simulados) OK')})().catch(e=>{console.error(e);process.exitCode=1});

// Ejecuta la función real del navegador con respuestas demoradas y comprueba que
// una actualización anterior no sustituya a la más reciente ni restaure datos tras salir.
async function browser(){
 const code=fs.readFileSync('admin.js','utf8');
 const load=code.slice(code.indexOf('async function loadAdminData()'),code.indexOf('async function adminLogin()'));
 const pending=[];const dashboard={value:'P'};let renders=0;
 const context={Date,Array,JSON,Error,centralAdminData:null,adminLoadGeneration:0,institutionalTimezone:'America/Mexico_City',admin$:id=>id==='#dashboardPeriod'?dashboard:null,
  adminFetch:(url)=>new Promise(resolve=>pending.push({url,resolve})),localStorage:{setItem(){}},ADMIN_KEYS:{catalogs:'c',periods:'p',school:'s'},applySchool(){},fillPeriodSelect(){},activePeriodName:()=> 'P',fillAdminFilters(){},renderAll(){renders++},location:{hash:''}};
 vm.createContext(context);vm.runInContext(load,context);
 const response=id=>({ok:true,status:200,json:async()=>({data:{catalogs:{},advisories:[{id,inicioIso:'2026-11-24T15:00:00Z',finIso:'2026-11-24T16:00:00Z'}]}})});
 const old=context.loadAdminData(),latest=context.loadAdminData();
 pending[1].resolve(response('latest'));assert.equal(await latest,true);
 pending[0].resolve(response('old'));assert.equal(await old,false);assert.equal(context.centralAdminData.advisories[0].id,'latest');assert.equal(renders,1);
 const afterLogout=context.loadAdminData();context.adminLoadGeneration++;context.centralAdminData=null;pending[2].resolve(response('late'));assert.equal(await afterLogout,false);assert.equal(context.centralAdminData,null);
 const invalid=context.loadAdminData();pending[3].resolve({ok:true,status:200,json:async()=>({data:{catalogs:{}}})});await assert.rejects(invalid,/incomplete_snapshot/);
 assert(pending.every(x=>x.url.startsWith('/api/admin/data?refresh=')));console.log('Snapshot administrativo: carga obsoleta, salida y respuesta incompleta (simulados) OK');
}
browser().catch(e=>{console.error(e);process.exitCode=1});
