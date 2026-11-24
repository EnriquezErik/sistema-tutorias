const assert=require('assert'),fs=require('fs'),vm=require('vm');
const app=fs.readFileSync('app.js','utf8'),server=fs.readFileSync('server.js','utf8');
const fields={};const ctx={$:s=>fields[s]??={value:'',options:[],focus(){}},manualCatalogUsed:false,newStudent:false,currentStart:null,updateGroupsForCareer(){},setStudentFields(){},persistActiveSession(){}};vm.createContext(ctx);
ctx.$('#materia').options=[{value:'Seleccione'},{value:'Física'}];
vm.runInContext(app.slice(app.indexOf('function showFoundStudent('),app.indexOf('async function findStudent(')),ctx);
vm.runInContext('showFoundStudent({last_subject:"Física"})',ctx);assert.equal(ctx.$('#materia').value,'Física');
vm.runInContext('showFoundStudent({last_subject:"Inactiva"})',ctx);assert.equal(ctx.$('#materia').value,'Seleccione');
vm.runInContext('showFoundStudent({last_subject:"Física"});showNewStudent()',ctx);assert.equal(ctx.$('#materia').value,'Seleccione');
assert(server.includes("a.student_id = s.id and a.status = 'FINALIZADA'"));assert(server.includes('order by a.ended_at desc, a.created_at desc, a.id desc limit 1) as last_subject'));console.log('Materia automática: simulación JS y revisión estática SQL OK');
