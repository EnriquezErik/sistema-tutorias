const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync('app.js','utf8');const elements={};let validated=0,cleared=0;
const ctx={currentStart:new Date(),savingAdvisory:false,operationId:'test',timerId:1,clearInterval(){},clearActiveSession(){cleared++},resetForm(){},loadRemoteAdvisories:async()=>{},renderHistory(){},alert(){},$:id=>elements[id]??=( {} ),draftFetch:async()=>({ok:true,json:async()=>({completed:true})}),validateFinish(){validated++;return false}};
vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('async function finishSession()'),source.indexOf('// HISTORIAL DEL ASESOR')),ctx);
(async()=>{await ctx.finishSession();assert.equal(validated,0);assert.equal(cleared,1);assert.equal(ctx.currentStart,null);assert.equal(ctx.savingAdvisory,false);console.log('Reintento completado antes de validar formulario: OK')})().catch(e=>{console.error(e);process.exitCode=1});
