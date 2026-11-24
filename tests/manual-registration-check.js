const assert=require('assert'),fs=require('fs'),vm=require('vm');
const app=fs.readFileSync('app.js','utf8'),server=fs.readFileSync('server.js','utf8');
const fields={};let alerts=0,persisted=0;const ctx={ $:s=>fields[s]??=( {value:'',disabled:false,textContent:''}),currentStart:null,savingAdvisory:false,timerId:null,alert:()=>alerts++,persistActiveSession:()=>persisted++,setInterval:()=>1,updateTimer:()=>{},Date};vm.createContext(ctx);
vm.runInContext(app.slice(app.indexOf('function validateFinish()'),app.indexOf('function updateTimer()')),ctx);
vm.runInContext('startSession()',ctx);assert(ctx.currentStart);assert.equal(alerts,0);assert.equal(persisted,1);assert.equal(vm.runInContext('validateFinish()',ctx),false);assert.equal(alerts,1);
for(const [k,v] of Object.entries({matricula:'123',nombre:'Prueba',sexo:'Hombre',carrera:'IAEV',grupo:'G1',turno:'Matutino',materia:'Matemáticas',motivo:'Académico',psico:'No'}))ctx.$('#'+k).value=v;
assert.equal(vm.runInContext('validateFinish()',ctx),true);assert(server.includes('STUDENT_UPDATED_AT_REGISTRATION'));assert(server.includes('student_snapshot'));assert(fs.readFileSync('database/006_historial_datos_alumno.sql','utf8').includes('where a.student_id=s.id and a.student_snapshot is null'));console.log('Inicio sin datos y validación al finalizar: OK (simulación JS); historial: comprobación estática.');
