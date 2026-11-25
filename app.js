// CONFIGURACIÓN INICIAL: catálogos locales de respaldo y estado de la asesoría en curso.
const DATA={schoolName:"NOMBRE DE LA INSTITUCIÓN",period:"Septiembre-Diciembre 2026",careers:["Seleccione","IAEV","ICM","IRC","ITIID","LTF","ISA"],groups:["Seleccione","IAEV-PA-08","IAEV-PA-07","ITIID-IA-02","ITIID-SM-02","ISA-SA-06","ICM-CYM-03","IRC-MPR-02","LTF 08","SW 28"],subjects:["Seleccione","Matemáticas","Física","Cálculo","Estadística","Programación","Álgebra"],reasons:["Seleccione","Motivos académicos","Motivos familiares","Motivos personales","Motivos sociales"],sexos:["Seleccione","Hombre","Mujer"],turnos:["Seleccione","Matutino","Vespertino"]};
const $=s=>document.querySelector(s);let manualCatalogUsed=false,newStudent=false,manualEnd=null,activeCorrection=null;let operationId=null;let currentStart=null,timerId=null,remoteConfig=null,remoteRecords=[],savingAdvisory=false,secureUser=null;
function activeKey(){return `asesoria_activa_${String(currentUser()?.usuario||'').toLowerCase()}`}
// Respaldo local opcional de cambios aún no confirmados. No se activa en equipos compartidos.
const recoveryPrefix='tutor_pending_v1_';const recoveryTTL=24*60*60*1000;
let recoveryEnabled=false,recoveryKey=null,recoveredKey=null,recoveredRaw=null,recoveryExpires=0;
function recoveryOwner(){return currentUser()?.id||null}
function sweepRecovery(){try{for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);if(!k?.startsWith(recoveryPrefix))continue;try{const x=JSON.parse(localStorage.getItem(k));if(!x||!Number.isFinite(x.expires)||x.expires<=Date.now())localStorage.removeItem(k)}catch(e){localStorage.removeItem(k)}}}catch(e){}}
function enableRecovery(){recoveryExpires=0;recoveryKey=null;recoveredKey=null;recoveredRaw=null;recoveryEnabled=!!recoveryOwner()&&$('#recoveryConsent')?.checked===true;const choice=$('#recoveryConsent');if(choice)choice.checked=false;}
function saveRecovery(payload){if(!recoveryEnabled||!recoveryOwner())return false;try{if(!recoveryKey){recoveryKey=recoveryPrefix+recoveryOwner()+'_'+crypto.randomUUID();recoveryExpires=recoveryExpires||Date.now()+recoveryTTL;}if(Date.now()>=recoveryExpires){localStorage.removeItem(recoveryKey);recoveryEnabled=false;return false;}const clean={};for(const k of ['operationId','start','newStudent','manualCatalogUsed','newSubject','activeCorrection','manualEnd','period','periodId','revision'])if(Object.hasOwn(payload,k))clean[k]=payload[k];clean.fields={};for(const k of ['matricula','nombre','sexo','carrera','grupo','turno','materia','motivo','psico','comentarios'])if(Object.hasOwn(payload.fields||{},k))clean.fields[k]=payload.fields[k];localStorage.setItem(recoveryKey,JSON.stringify({owner:recoveryOwner(),expires:recoveryExpires,payload:clean}));return true}catch(e){return false}}
function clearRecovery(payload,terminal=false){try{const owner=recoveryOwner();if(!owner||!payload?.operationId)return;const keys=terminal?Array.from({length:localStorage.length},(_,i)=>localStorage.key(i)).filter(k=>k?.startsWith(recoveryPrefix+owner+'_')):[recoveryKey,recoveredKey];for(const key of keys){if(!key)continue;const raw=localStorage.getItem(key);if(!raw)continue;let x;try{x=JSON.parse(raw)}catch(e){continue}if(x.owner!==owner||x.payload?.operationId!==payload.operationId)continue;if(terminal||((key===recoveryKey||raw===recoveredRaw)&&draftContent(x.payload)===draftContent(payload)))localStorage.removeItem(key)}}catch(e){}}
function offerRecovery(saved){sweepRecovery();if(!recoveryOwner())return saved;try{const candidates=[];for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(!key?.startsWith(recoveryPrefix+recoveryOwner()+'_'))continue;const raw=localStorage.getItem(key),x=JSON.parse(raw);if(x.owner===recoveryOwner()&&x.expires>Date.now()&&x.payload?.operationId&&x.payload?.fields)candidates.push({key,raw,...x})}candidates.sort((a,b)=>b.expires-a.expires);for(const x of candidates){if(saved&&saved.operationId!==x.payload.operationId)continue;if(saved&&draftContent(saved)===draftContent(x.payload)){recoveryEnabled=true;recoveryExpires=x.expires;recoveredKey=x.key;recoveredRaw=x.raw;return saved}if(confirm('Existe una copia local pendiente de respaldo del '+new Date(x.payload.start).toLocaleString('es-MX')+'. ¿Desea intentar recuperarla?')){recoveryEnabled=true;recoveryExpires=x.expires;recoveredKey=x.key;recoveredRaw=x.raw;return x.payload}}}catch(e){}return saved}
let draftQueue=Promise.resolve(),draftRevision=0,draftPeriod=null,draftPeriodId=null,draftTimer=null,draftConflict=false,draftCompleted=false,draftSyncOk=false;
async function draftFetch(url,options={}){const controller=new AbortController();const external=options.signal;const abort=()=>controller.abort(external?.reason);if(external?.aborted)abort();else external?.addEventListener('abort',abort,{once:true});const deadline=setTimeout(()=>controller.abort(),60000);try{const response=await fetch(url,{...options,signal:controller.signal});const bytes=await response.arrayBuffer();return {ok:response.ok,status:response.status,json:async()=>JSON.parse(new TextDecoder().decode(bytes))}}finally{clearTimeout(deadline);external?.removeEventListener('abort',abort)}}
function persistActiveSession(immediate=false){if(!currentStart||!currentUser())return;draftSyncOk=false;const fields={};['matricula','nombre','sexo','carrera','grupo','turno','materia','motivo','psico','comentarios'].forEach(id=>fields[id]=$("#"+id)?.value||'');const payload={operationId,start:currentStart.toISOString(),fields,newStudent,manualCatalogUsed,newSubject:$("#materia")?.selectedOptions?.[0]?.dataset.manual==="true",activeCorrection,manualEnd:manualEnd?.toISOString(),period:draftPeriod,periodId:draftPeriodId,revision:draftRevision};try{sessionStorage.setItem(activeKey(),JSON.stringify(payload))}catch(e){}const localProtected=saveRecovery(payload);if(recoveryEnabled&&!localProtected)$('#draftStatus').textContent='No se pudo guardar la copia local; no cierre la pestaña hasta confirmar el respaldo.';clearTimeout(draftTimer);const owner=currentUser()?.usuario;const flush=()=>{draftQueue=draftQueue.catch(()=>{}).then(async()=>{if(currentUser()?.usuario!==owner||operationId!==payload.operationId||draftConflict)return;try{const r=await draftFetch('/api/advisory-draft',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,revision:draftRevision})});const d=await r.json();if(d.completed){draftCompleted=true;clearRecovery(payload,true);return;}if(r.status===409){draftConflict=true;throw Error('conflict');}if(!r.ok)throw Error(d.message||'No fue posible respaldar el borrador');draftRevision=d.revision;draftSyncOk=false;draftPeriod=d.period||draftPeriod;draftPeriodId=d.periodId||draftPeriodId;let local=null;try{local=JSON.parse(sessionStorage.getItem(activeKey())||'null')}catch(e){}if(local?.operationId===payload.operationId&&draftContent(local)===draftContent(payload)){draftSyncOk=true;local.revision=d.revision;local.period=draftPeriod;local.periodId=draftPeriodId;try{sessionStorage.setItem(activeKey(),JSON.stringify(local))}catch(e){}clearRecovery(payload);}$('#draftStatus').textContent=draftSyncOk?'Borrador respaldado en servidor':'Cambios locales pendientes de respaldo';}catch(e){draftSyncOk=false;$('#draftStatus').textContent=draftConflict?'Conflicto: recargue para recuperar el borrador del servidor':'Borrador local: '+(e.message||'respaldo remoto pendiente');}})};if(immediate)flush();else draftTimer=setTimeout(flush,600);}

function draftContent(d){d=d||{};const fields={};for(const k of ['matricula','nombre','sexo','carrera','grupo','turno','materia','motivo','psico','comentarios'])fields[k]=String(d.fields?.[k]||'');return JSON.stringify({operationId:d.operationId||null,start:d.start||null,fields,newStudent:!!d.newStudent,manualCatalogUsed:!!d.manualCatalogUsed,newSubject:!!d.newSubject,activeCorrection:d.activeCorrection||null,manualEnd:d.manualEnd||null})}
function clearActiveSession(){if(currentUser()){clearRecovery({operationId},true);try{sessionStorage.removeItem(activeKey())}catch(e){}}}
async function restoreActiveAdvisory(){if(!currentUser())return;let saved;try{saved=JSON.parse(sessionStorage.getItem(activeKey())||'null')}catch(error){}saved=offerRecovery(saved);try{const r=await draftFetch('/api/advisory-draft'+(saved?.operationId?'?operationId='+encodeURIComponent(saved.operationId):''));if(!r.ok)throw Error();const d=await r.json();if(d.completed||d.discarded){if(saved)clearRecovery(saved,true);clearActiveSession();saved=null;}if(d.draft){if(saved&&saved.operationId===d.draft.operationId&&saved.revision===d.draft.revision&&draftContent(saved)===draftContent(d.draft)){saved={...saved,period:d.draft.period||saved.period,periodId:d.draft.periodId||saved.periodId};clearRecovery(saved);}else if(saved&&draftContent(saved)!==draftContent(d.draft)){try{sessionStorage.setItem(activeKey()+'_conflict',JSON.stringify(saved));sessionStorage.setItem(activeKey()+'_conflict_'+saved.operationId,JSON.stringify(saved))}catch(e){} if(saved.operationId===d.draft.operationId && confirm('Hay cambios locales y remotos distintos. ¿Recuperar sus cambios locales sobre la revisión remota? Cancelar conserva la versión remota y una copia local.')){saved={...saved,revision:d.draft.revision,period:d.draft.period,periodId:d.draft.periodId};}else{if(recoveryEnabled&&saved)saveRecovery(saved);recoveryKey=null;recoveredKey=null;recoveredRaw=null;saved=d.draft;} $('#draftStatus').textContent='Copia local en conflicto conservada según disponibilidad del almacenamiento.';}else saved=d.draft;}else if(saved){saved={...saved,revision:0};}}catch(e){$('#draftStatus').textContent='No se pudo verificar el borrador; vuelva a cargar.';return;}draftRevision=saved?.revision||0;draftConflict=false;draftPeriod=saved?.period||null;draftPeriodId=saved?.periodId||null;if(!saved?.start||!saved.fields)return;operationId=saved.operationId||crypto.randomUUID();currentStart=new Date(saved.start);if(Number.isNaN(currentStart.getTime())){clearActiveSession();currentStart=null;return}activeCorrection=saved.activeCorrection||null;manualCatalogUsed=!!saved.manualCatalogUsed;newStudent=!!saved.newStudent;manualEnd=saved.manualEnd?new Date(saved.manualEnd):null;const f=saved.fields;ensureOption("carrera",f.carrera);for(const id of ['matricula','nombre','sexo','carrera'])if($("#"+id))$("#"+id).value=f[id]||'';updateGroupsForCareer();ensureOption("grupo",f.grupo);ensureOption("materia",f.materia);if(f.materia&&!appConfig().subjects.includes(f.materia))$("#materia").querySelectorAll("option").forEach(o=>{if(o.value===f.materia)o.dataset.manual="true"});for(const id of ['grupo','turno','materia','motivo','psico','comentarios'])if($("#"+id))$("#"+id).value=f[id]||'';setStudentFields(false);$("#iniciar").disabled=true;$("#finalizar").disabled=false;$("#status").textContent='ASESORÍA EN CURSO';clearInterval(timerId);timerId=setInterval(updateTimer,1000);updateTimer();try{sessionStorage.setItem(activeKey(),JSON.stringify(saved))}catch(e){}}
// CONFIGURACIÓN Y CATÁLOGOS: consulta la configuración institucional y los datos remotos del servidor.
function appConfig(){
  if(remoteConfig)return remoteConfig;
  let school={}; let cats={}; let periods=[];
  try{school=JSON.parse(localStorage.getItem("school_config_demo")||"{}")}catch(e){}
  try{cats=JSON.parse(localStorage.getItem("catalogs_demo")||"{}")}catch(e){}
  try{periods=JSON.parse(localStorage.getItem("periods_demo")||"[]")}catch(e){}
  return {
    ...DATA,
    schoolName:school.schoolName||DATA.schoolName,
    period:(periods[0]||DATA.period),
    careers:(cats.carreras&&cats.carreras.length?['Seleccione',...cats.carreras]:DATA.careers),
    groups:(cats.grupos&&cats.grupos.length?['Seleccione',...cats.grupos]:DATA.groups),
    subjects:(cats.materias&&cats.materias.length?['Seleccione',...cats.materias]:DATA.subjects),
    reasons:(cats.motivos&&cats.motivos.length?['Seleccione',...cats.motivos]:DATA.reasons),
    periods:(periods.length?periods:[DATA.period])
  };
}

async function loadRemoteConfig(){
  try{
    const response=await draftFetch("/api/bootstrap?refresh="+Date.now(),{cache:"no-store",headers:{Accept:"application/json"}});
    if(!response.ok)return false;
    const payload=await response.json(),d=payload.data;
    if(!payload.ok||!d)return false;
    const periodNames=(d.periods||[]).map(x=>x.name);
    const currentPeriod=d.current_period?.name||(d.periods||[]).find(x=>x.active)?.name||periodNames[0]||DATA.period;
    const careerCodes=new Map((d.careers||[]).map(x=>[x.id,x.code]));
    const groupsByCareer={};
    for(const group of d.groups||[]){const code=careerCodes.get(group.career_id);if(code)(groupsByCareer[code]||(groupsByCareer[code]=[])).push(group.name)}
    remoteConfig={
      ...DATA,
      schoolName:d.school?.school_name||DATA.schoolName,
      timezone:d.school?.timezone||"America/Mexico_City",period:currentPeriod,periodId:d.current_period?.id||null,
      careers:["Seleccione",...(d.careers||[]).map(x=>x.code)],
      groups:["Seleccione",...(d.groups||[]).map(x=>x.name)],
      subjects:["Seleccione",...(d.subjects||[]).map(x=>x.name)],
      reasons:["Seleccione",...(d.reasons||[]).map(x=>x.name)],
      periods:periodNames.length?periodNames:[DATA.period],
      groupsByCareer
    };
    localStorage.setItem("catalogs_demo",JSON.stringify({carreras:remoteConfig.careers.slice(1),grupos:remoteConfig.groups.slice(1),materias:remoteConfig.subjects.slice(1),motivos:remoteConfig.reasons.slice(1)}));
    localStorage.setItem("periods_demo",JSON.stringify(remoteConfig.periods));
    localStorage.setItem("school_config_demo",JSON.stringify({schoolName:remoteConfig.schoolName}));
    return true;
  }catch(error){return false}
}

let refreshingPeriodCatalog=false;
function applyPeriodCatalog(){
  const C=appConfig();
  if($("#periodName"))$("#periodName").textContent=C.period;
  const filter=$("#periodFilter");
  if(!filter)return;
  const previous=filter.value||"all";
  filter.replaceChildren();const allOption=document.createElement('option');allOption.value='all';allOption.textContent='Todos los cuatrimestres';filter.append(allOption,...C.periods.map(p=>{const option=document.createElement('option');option.value=String(p);option.textContent=String(p);return option}));
  filter.value=Array.from(filter.options).some(option=>option.value===previous)?previous:"all";
}
async function refreshPeriodCatalog(){
  if(refreshingPeriodCatalog||savingAdvisory)return;
  refreshingPeriodCatalog=true;
  try{if(await loadRemoteConfig()&&!savingAdvisory){applyPeriodCatalog();updateGroupsForCareer(true);renderHistory()}}finally{refreshingPeriodCatalog=false}
}

// CAMPOS Y ALUMNOS: carga listas, vincula grupo con carrera y busca o presenta alumnos nuevos/existentes.
function records(){return Array.isArray(remoteRecords)?remoteRecords:[]}
function fill(id,arr){const e=$("#"+id);if(!e)return;e.replaceChildren(...arr.map(value=>{const option=document.createElement('option');option.value=String(value);option.textContent=String(value);return option}))}
function updateGroupsForCareer(preserveSelection=false){const career=$("#carrera")?.value,group=$("#grupo"),previous=group?.value;if(!career||career==="Seleccione"){fill("grupo",["Seleccione"]);return}if(!remoteConfig?.groupsByCareer)return;fill("grupo",["Seleccione",...(remoteConfig.groupsByCareer[career]||[])]);if(preserveSelection&&group){if(manualCatalogUsed&&previous)ensureOption("grupo",previous);if(Array.from(group.options).some(option=>option.value===previous))group.value=previous}}
function setStudentFields(){["sexo","carrera","grupo","turno"].forEach(id=>$("#"+id).disabled=false);$("#nombre").readOnly=false;$("#manualCatalog").hidden=false}
function showFoundStudent(f){manualCatalogUsed=false;newStudent=false;$("#manualCatalog").hidden=true;$("#nombre").value=f.nombre||f.full_name||"";$("#sexo").value=f.sexo||f.sex||"";$("#carrera").value=f.carrera||f.career||"Seleccione";updateGroupsForCareer();$("#grupo").value=f.grupo||f.group_name||"Seleccione";$("#turno").value=f.turno||f.shift||"Seleccione";$("#materia").value=Array.from($("#materia").options).some(o=>o.value===f.last_subject)?f.last_subject:"Seleccione";setStudentFields(false);$("#status").textContent=currentStart?"ASESORÍA EN CURSO":"ALUMNO ENCONTRADO";persistActiveSession()}
function showNewStudent(){manualCatalogUsed=false;newStudent=true;$("#manualCatalog").hidden=false;$("#nombre").value="";$("#sexo").value="Seleccione";$("#carrera").value="Seleccione";$("#grupo").value="Seleccione";$("#turno").value="Seleccione";$("#materia").value="Seleccione";setStudentFields(true);$("#status").textContent="NUEVO ALUMNO";$("#nombre").focus();persistActiveSession()}
let studentSearchGeneration=0, studentSearchPending=false, studentSearchField=null;
function closeStudentSearch(restore=true){studentSearchGeneration++;studentSearchPending=false;$('#studentResults').hidden=true;$('#studentMatches').replaceChildren();$('#buscar').disabled=false;if(restore)$('#status').textContent=currentStart?'ASESORÍA EN CURSO':'SIN INICIAR';}
function studentSearchMessage(message){$('#studentResults').hidden=false;$('#studentResultsMessage').textContent=message;$('#studentMatches').replaceChildren();}
function selectStudent(student){closeStudentSearch(false);$('#matricula').value=student.enrollment;showFoundStudent(student);}
async function findStudent(event){if(savingAdvisory)return;const enrollment=$('#matricula').value.trim(),name=$('#nombre').value.trim();const byName=!!name&&(!enrollment||studentSearchField==='nombre');const term=byName?name:enrollment;if(!term){studentSearchMessage('Capture la matrícula o el nombre del alumno.');return;}closeStudentSearch(false);const generation=studentSearchGeneration;studentSearchPending=true;$('#buscar').disabled=true;$('#status').textContent='BUSCANDO ALUMNO...';const owner=currentUser()?.usuario;const valid=()=>generation===studentSearchGeneration&&!savingAdvisory&&currentUser()?.usuario===owner;try{const response=await draftFetch('/api/students/'+encodeURIComponent(term)+'?mode='+(byName?'name':'enrollment'),{headers:{Accept:'application/json'}});if(!valid())return;if(response.status===401){closeStudentSearch();showLogin();return;}if(!response.ok)throw Error('database_error');const payload=await response.json();if(!valid())return;const matches=Array.isArray(payload.matches)?payload.matches:[];const student=payload.student||(matches.length===1?matches[0]:null);if(student){selectStudent(student);return;}if(matches.length){studentSearchMessage('Seleccione al alumno correcto. Se muestran hasta 20 coincidencias.');for(const item of matches){const row=document.createElement('div');row.className='student-match';const details=document.createElement('span');details.textContent=[item.full_name,item.enrollment,item.career,item.group_name].filter(Boolean).join(' · ');const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent='Seleccionar';button.addEventListener('click',()=>{if(valid())selectStudent(item)});row.append(details,button);$('#studentMatches').append(row);}$('#status').textContent='SELECCIONE AL ALUMNO';return;}if(byName){studentSearchMessage('No se encontró ese nombre. Verifique los datos o busque por matrícula para registrar un alumno nuevo.');$('#status').textContent='ALUMNO NO ENCONTRADO';}else{closeStudentSearch(false);showNewStudent();}}catch(error){if(valid()){studentSearchMessage('No fue posible consultar la base de datos. Intente nuevamente.');$('#status').textContent='SIN CONEXIÓN';}}finally{if(generation===studentSearchGeneration){studentSearchPending=false;$('#buscar').disabled=false;}}}
// CICLO DE ASESORÍA: valida el alumno, inicia el cronómetro, guarda la asesoría y limpia el formulario.
function validateFinish(){if(studentSearchPending||$("#studentMatches").children.length){alert("Seleccione al alumno antes de finalizar.");return false;}if(!$("#matricula").value.trim()||!$("#nombre").value.trim()){alert("Primero capture/busque la matrícula y el nombre del alumno.");return false}if(!$("#sexo").value||$("#sexo").value==="Seleccione"||
!$("#carrera").value||$("#carrera").value==="Seleccione"||
!$("#grupo").value||$("#grupo").value==="Seleccione"||
!$("#turno").value||$("#turno").value==="Seleccione"||
!$("#materia").value||$("#materia").value==="Seleccione"||
!$("#motivo").value||$("#motivo").value==="Seleccione"||
!$("#psico").value||$("#psico").value==="Seleccione"){
alert("Complete todas las casillas obligatorias antes de finalizar la asesoría.");
return false}return true}
function startSession(){if(currentStart||savingAdvisory||studentSearchPending||$("#studentMatches").children.length)return;operationId=crypto.randomUUID();enableRecovery();draftCompleted=false;draftRevision=0;draftConflict=false;draftPeriod=appConfig().period;draftPeriodId=appConfig().periodId;currentStart=new Date();$("#iniciar").disabled=true;$("#finalizar").disabled=false;$("#status").textContent="ASESORÍA EN CURSO";persistActiveSession();timerId=setInterval(updateTimer,1000);updateTimer()}
function updateTimer(){if(!currentStart)return;$("#discardDraft").disabled=false;const total=Math.max(0,Math.floor(((manualEnd?+manualEnd:Date.now())-currentStart)/1000)),hours=Math.floor(total/3600),minutes=Math.floor(total%3600/60),seconds=total%60;$("#timer").textContent=`${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`}
function resetForm(focusMatricula=true){closeStudentSearch(false);studentSearchField=null;$("#discardDraft").disabled=!currentStart;manualCatalogUsed=false;newStudent=false;manualEnd=null;activeCorrection=null;$("#manualCatalog").hidden=true;$("#matricula").value="";$("#sexo").selectedIndex=0;$("#nombre").value="";$("#sexo").value="Seleccione";$("#carrera").value="Seleccione";$("#grupo").value="Seleccione";$("#turno").value="Seleccione";$("#materia").value="Seleccione";$("#motivo").value="Seleccione";$("#psico").value="No";$("#comentarios").value="";setStudentFields(false);$("#status").textContent="SIN INICIAR";$("#timer").textContent="00:00:00";if(focusMatricula)$("#matricula").focus()}
async function finishSession(){
  if(!currentStart||savingAdvisory)return;savingAdvisory=true;
  const locked=typeof document!=="undefined"?[".grid",".actions",".advisor-line"].map(selector=>document.querySelector(selector)).filter(Boolean):[];const previousInert=locked.map(el=>el.inert);locked.forEach(el=>{el.inert=true});
  try {
  try { const check=await draftFetch('/api/advisory-draft?operationId='+encodeURIComponent(operationId)); if(!check.ok)throw Error(); const state=await check.json(); if(state.completed){clearActiveSession();clearInterval(timerId);currentStart=null;savingAdvisory=false;$('#iniciar').disabled=false;$('#finalizar').disabled=true;resetForm();await loadRemoteAdvisories();renderHistory();alert('La asesoría ya estaba guardada.');return;} if(state.discarded){savingAdvisory=false;alert('La asesoría fue descartada. Recargue la página.');return;} } catch(e){savingAdvisory=false;alert('No se pudo verificar la operación. Sus datos permanecen en el formulario.');return;}
  if(!validateFinish()){savingAdvisory=false;return;}
  operationId=operationId||crypto.randomUUID();manualEnd=manualEnd||new Date();persistActiveSession(true);
  await draftQueue;
  if(draftCompleted){clearActiveSession();clearInterval(timerId);currentStart=null;savingAdvisory=false;draftCompleted=false;$('#iniciar').disabled=false;$('#finalizar').disabled=true;resetForm();await loadRemoteAdvisories();renderHistory();alert('La asesoría ya estaba guardada.');return;}
  if(draftConflict){savingAdvisory=false;alert("Conflicto de borrador. Recargue la página.");return;}
  if(!draftSyncOk){savingAdvisory=false;alert("No se confirmó el respaldo del borrador. Sus datos permanecen en el formulario; vuelva a intentar.");return;}
  if(!draftPeriodId||!draftPeriod){savingAdvisory=false;alert("No se pudo identificar el cuatrimestre original. Sus datos permanecen en el borrador; consulte a Administración si no existe un periodo único para esa fecha.");return;}
  const end=manualEnd||(manualEnd=new Date()),start=currentStart,mins=Math.max(0,Math.round((end-start)/60000));
  const sd={matricula:$("#matricula").value.trim(),nombre:$("#nombre").value.trim(),sexo:$("#sexo").value,carrera:$("#carrera").value,grupo:$("#grupo").value,turno:$("#turno").value};
  const record={id:operationId,...sd,materia:$("#materia").value,motivo:$("#motivo").value,comentarios:$("#comentarios").value,psico:$("#psico").value,asesor:(currentUser()?.usuario||$("#advisorName").textContent),periodo:draftPeriod,periodId:draftPeriodId,revision:draftRevision,fecha:start.toLocaleDateString("es-MX",{timeZone:appConfig().timezone||"America/Mexico_City"}),inicio:start.toLocaleTimeString("es-MX",{timeZone:appConfig().timezone||"America/Mexico_City"}),fin:end.toLocaleTimeString("es-MX",{timeZone:appConfig().timezone||"America/Mexico_City"}),duracionMinutos:mins,estado:"FINALIZADA",creado:new Date().toISOString(),inicioIso:start.toISOString(),finIso:end.toISOString()};
  $("#finalizar").disabled=true;$("#status").textContent="GUARDANDO...";
  let savedRemote=false;
  try{
    const response=await draftFetch("/api/advisories",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({...record,nuevoCatalogo:manualCatalogUsed,nuevaMateria:$("#materia").selectedOptions[0]?.dataset.manual==="true",activeCorrection,inicio:record.inicioIso,fin:record.finIso})});
    const payload=await response.json().catch(()=>({}));
    if(response.ok)savedRemote=true;
    else if(response.status===400){savingAdvisory=false;$("#finalizar").disabled=false;$("#status").textContent="REVISE LOS DATOS";alert(payload.message||"Revise los datos de la asesoría.");return}
    else if(response.status===401){savingAdvisory=false;$("#finalizar").disabled=false;showLogin();alert("Su sesión terminó. Ingrese nuevamente antes de guardar.");return}
    else {savingAdvisory=false;$("#finalizar").disabled=false;$("#status").textContent="ERROR AL GUARDAR";alert(payload.message||"No fue posible guardar en PostgreSQL. La información permanece en el formulario para volver a intentar.");return}
  }catch(error){savingAdvisory=false;$("#finalizar").disabled=false;$("#status").textContent="SIN CONEXIÓN";alert("No se confirmó el resultado del guardado. La asesoría podría haberse registrado; vuelva a intentar con la misma operación.");return}
  if(savedRemote){await loadRemoteConfig();fill("carrera",appConfig().careers);fill("materia",appConfig().subjects);await loadRemoteAdvisories();}
  clearActiveSession();$("#draftStatus").textContent="";clearInterval(timerId);timerId=null;currentStart=null;savingAdvisory=false;$("#iniciar").disabled=false;$("#finalizar").disabled=true;resetForm();renderHistory();
  alert("Asesoría guardada correctamente en la base de datos. El formulario está listo para el siguiente alumno.");
  } finally {locked.forEach((el,i)=>{el.inert=previousInert[i]});savingAdvisory=false;}
}
// HISTORIAL DEL ASESOR: aplica filtros, construye la tabla y prepara impresión/exportación CSV.
function inRange(x,r,period){if(r==='all')return true;if(r==='quarter')return x.periodo===(period&&period!=='all'?period:appConfig().period);const d=new Date(x.inicioIso||x.creado),n=new Date();if(!Number.isFinite(+d))return false;const day=v=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:appConfig().timezone||'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(v).map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}`};const ds=day(d),ns=day(n);if(r==='day')return ds===ns;if(r==='month')return ds.slice(0,7)===ns.slice(0,7);if(r==='week'){const w=new Date(ns+'T00:00:00Z');w.setUTCDate(w.getUTCDate()-w.getUTCDay());return ds>=w.toISOString().slice(0,10)&&ds<=ns}return true}
function fmt(m){m=Number(m)||0;return `${Math.floor(m/60)}h ${String(m%60).padStart(2,"0")}m`}
function escapeHTML(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function renderHistory(){const b=$("#history tbody");if(!b)return;const range=$("#rangeFilter").value,period=$("#periodFilter").value,rows=records().filter(x=>inRange(x,range,period)&&(period==="all"||x.periodo===period)),rowHTML=rows.map(x=>`<tr>${[x.fecha,x.inicio,x.fin,x.matricula,x.nombre,x.sexo||"",x.carrera,x.grupo,x.materia,x.motivo,x.comentarios||"",x.asesor,fmt(x.duracionMinutos),x.psico].map(v=>`<td>${escapeHTML(v)}</td>`).join("")}</tr>`).join("");b.innerHTML=rowHTML;const pb=$("#printTable tbody");if(pb)pb.innerHTML=rowHTML;Array.from(b.rows).forEach((tr,i)=>{const x=rows[i],td=tr.insertCell();td.className="record-actions";if(x.asesor===currentUser()?.usuario){for(const [action,label] of [['edit','Editar'],['cancel','Eliminar']]){const btn=document.createElement('button');btn.type='button';btn.textContent=label;btn.className='record-action record-'+action;btn.addEventListener('click',()=>correctRecord(x,action));td.append(btn)}}});if($("#printSchoolName"))$("#printSchoolName").textContent=appConfig().schoolName;if($("#printPeriod"))$("#printPeriod").textContent="REGISTRO DE ASESORÍAS · "+(period==="all"?appConfig().period:period);if($("#printAdvisorName"))$("#printAdvisorName").textContent=$("#advisorName")?.textContent||""}
function filteredRecords(){const range=$("#rangeFilter")?.value||"all",period=$("#periodFilter")?.value||"all";return records().filter(x=>inRange(x,range,period)&&(period==="all"||x.periodo===period))}
function spreadsheetSafe(v){const text=String(v??'');return /^[=+\-@]/.test(text)?`'${text}`:text}
function exportCSV(){const h=["Fecha","Inicio","Fin","Matrícula","Alumno","Sexo","Carrera","Grupo","Turno","Materia","Motivo","Comentarios","Psicopedagogía","Asesor","Periodo","Duración minutos"],rows=filteredRecords(),csv=[h,...rows.map(x=>[x.fecha,x.inicio,x.fin,x.matricula,x.nombre,x.sexo,x.carrera,x.grupo,x.turno,x.materia,x.motivo,x.comentarios,x.psico,x.asesor,x.periodo,x.duracionMinutos])].map(a=>a.map(v=>`"${spreadsheetSafe(v).replaceAll('"','""')}"`).join(",")).join("\n");const a=document.createElement("a"),url=URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}));a.href=url;a.download="historial_asesorias.csv";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}

// ACCESO DEL ASESOR: inicia/restaura/cierra la sesión y sincroniza los registros con la API.
async function loadRemoteAdvisories(){
  try{
    const response=await draftFetch("/api/advisories",{headers:{Accept:"application/json"}});
    if(!response.ok)return false;
    const payload=await response.json();
    const databaseRecords=(payload.advisories||[]).map(x=>{const start=new Date(x.inicioIso),end=new Date(x.finIso);return {...x,fecha:start.toLocaleDateString("es-MX",{timeZone:appConfig().timezone||"America/Mexico_City"}),inicio:start.toLocaleTimeString("es-MX",{timeZone:appConfig().timezone||"America/Mexico_City"}),fin:end.toLocaleTimeString("es-MX",{timeZone:appConfig().timezone||"America/Mexico_City"})}});
    remoteRecords=databaseRecords;
    renderHistory();return true;
  }catch(error){return false}
}

function currentUser(){return secureUser}
function showLogin(){
  const s=$("#loginScreen"); if(s){s.style.display="flex";s.setAttribute("aria-hidden","false")}
  document.body.classList.add("locked");
  $("#loginUser")?.focus();
}
function hideLogin(){
  const s=$("#loginScreen"); if(s){s.style.display="none";s.setAttribute("aria-hidden","true")}
  document.body.classList.remove("locked");
}
async function doLogin(){
  const user=($("#loginUser")?.value||"").trim();
  const pass=$("#loginPassword")?.value||"";
  const msg=$("#loginMsg");
  if(msg)msg.textContent="Verificando acceso...";
  try{
    const response=await draftFetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({username:user,password:pass})});
    const payload=await response.json().catch(()=>({}));
    if(response.ok&&payload.user){
      secureUser=payload.user;
      remoteRecords=[];
      if(msg)msg.textContent="";
      applySession();renderHistory();hideLogin();await loadRemoteAdvisories();await restoreActiveAdvisory();return;
    }
    if(response.status===400||response.status===401){
      if(msg)msg.textContent=payload.message||(response.status===400?"Escriba su usuario.":"Usuario o contraseña incorrectos.");
      return;
    }
  }catch(error){if(msg)msg.textContent="No fue posible comunicarse con el servidor."}
}
async function restoreRemoteSession(){
  try{
    const response=await draftFetch("/api/session",{headers:{Accept:"application/json"}});
    if(response.status===401){
      secureUser=null;
      return false;
    }
    if(!response.ok)return false;
    const payload=await response.json();
    if(payload.ok&&payload.user){secureUser=payload.user;return true}
  }catch(error){}
  return false;
}
function applySession(){
  const u=currentUser();
  if(!u){showLogin();return}
  if($("#advisorName"))$("#advisorName").textContent=u.usuario;
  if($("#advisorUser"))$("#advisorUser").textContent=u.usuario;
  document.title="Registro de Asesorías · "+u.usuario;
}
async function logout(){
  if(savingAdvisory)return;
  if(currentStart&&!confirm("Hay una asesoría en curso. ¿Desea respaldarla antes de cerrar la sesión?"))return;
  savingAdvisory=true;
  const locked=typeof document!=="undefined"?[".grid",".actions",".advisor-line"].map(selector=>document.querySelector(selector)).filter(Boolean):[];const previousInert=locked.map(el=>el.inert);locked.forEach(el=>{el.inert=true});
  try{
    if(currentStart){persistActiveSession(true);await draftQueue;
      if(!draftCompleted&&(!draftSyncOk||draftConflict)){alert("No se confirmó el respaldo. La sesión seguirá abierta; vuelva a intentar.");return;}}
    const response=await draftFetch("/api/logout",{method:"POST",headers:{Accept:"application/json"}});
    if(!response.ok)throw Error('logout');
  }catch(error){alert("No se pudo confirmar el cierre de sesión. Vuelva a intentar.");return;}
  finally{locked.forEach((el,i)=>{el.inert=previousInert[i]});savingAdvisory=false;}
  secureUser=null;
  if($("#recoveryConsent"))$("#recoveryConsent").checked=false;
  remoteRecords=[];
  clearInterval(timerId); timerId=null; currentStart=null;
  resetForm(false);
  renderHistory();
  showLogin();
}

document.addEventListener("DOMContentLoaded",async()=>{['asesorias_demo','alumnos_demo','asesor_users_demo','asesor_session_persistente','asesor_session_backup'].forEach(key=>localStorage.removeItem(key));sweepRecovery();await loadRemoteConfig();const C=appConfig();if($("#schoolName"))$("#schoolName").textContent=C.schoolName;if($("#advisorName"))$("#advisorName").textContent="";fill("carrera",C.careers);fill("grupo",C.groups);fill("materia",C.subjects);fill("motivo",C.reasons);fill("turno",C.turnos||["Seleccione","Matutino","Vespertino"]);fill("sexo",C.sexos);applyPeriodCatalog();setStudentFields(false);renderHistory();
await restoreRemoteSession();applySession();if(currentUser()){await loadRemoteAdvisories();await restoreActiveAdvisory()}
$("#loginBtn")?.addEventListener("click",doLogin); const advisorPasswordToggle=$("#toggleAdvisorPassword");advisorPasswordToggle?.addEventListener("click",()=>{const field=$("#loginPassword");if(!field)return;const visible=field.type==="password";field.type=visible?"text":"password";advisorPasswordToggle.textContent=visible?"Ocultar":"Ver";advisorPasswordToggle.setAttribute("aria-label",visible?"Ocultar contraseña":"Mostrar contraseña");advisorPasswordToggle.setAttribute("aria-pressed",String(visible));});
$("#loginUser")?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();$("#loginPassword")?.focus()}});
$("#loginPassword")?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();doLogin()}});
$("#logoutBtn")?.addEventListener("click",logout);
document.querySelector('.grid')?.addEventListener('input',()=>{if(currentStart)persistActiveSession()});
$("#carrera")?.addEventListener("change",()=>{updateGroupsForCareer();persistActiveSession()});
$("#cancelStudentSearch")?.addEventListener("click",()=>closeStudentSearch());for(const id of ["matricula","nombre"]){$("#"+id)?.addEventListener("input",()=>{studentSearchField=id;if(studentSearchPending||!$("#studentResults").hidden)closeStudentSearch();});}$("#buscar")?.addEventListener("click",findStudent);$("#matricula")?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();findStudent()}});$("#nombre")?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();findStudent()}});$("#iniciar")?.addEventListener("click",startSession);$("#finalizar")?.addEventListener("click",finishSession);$("#rangeFilter")?.addEventListener("change",renderHistory);$("#periodFilter")?.addEventListener("change",renderHistory);$("#export")?.addEventListener("click",exportCSV);$("#print")?.addEventListener("click",()=>{renderHistory();window.print()})});
window.addEventListener("focus",()=>{sweepRecovery();refreshPeriodCatalog()});
let recoverySweepTimer=setInterval(sweepRecovery,60000);
window.addEventListener("pagehide",()=>{clearInterval(recoverySweepTimer);recoverySweepTimer=null});
window.addEventListener("pageshow",()=>{sweepRecovery();if(recoverySweepTimer===null)recoverySweepTimer=setInterval(sweepRecovery,60000)});
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"){sweepRecovery();refreshPeriodCatalog()}});
window.addEventListener('beforeunload',()=>{if(currentStart)persistActiveSession(true)});

function ensureOption(id,value){const el=$("#"+id);if(value&&!Array.from(el.options).some(o=>o.value===value))el.add(new Option(value,value));}
function localDateValue(date){const d=new Date(date);if(!Number.isFinite(+d))return '';const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:appConfig().timezone||'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(d).map(p=>[p.type,p.value]));return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`}
function parseInstitutionalTime(value){const text=String(value||'');if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(text))return new Date(NaN);const target=text.length===16?text+':00':text;const utc=Date.parse(target+'Z');if(!Number.isFinite(utc))return new Date(NaN);const offsets=new Set();for(const delta of [-86400000,0,86400000]){const probe=utc+delta;offsets.add(Date.parse(localDateValue(probe)+'Z')-probe)}const matches=[...offsets].map(offset=>new Date(utc-offset)).filter(d=>localDateValue(d)===target);return matches.length===1?matches[0]:new Date(NaN)}
const correctionDialog=()=>$('#correctionDialog');
function openCorrection(title,subtitle,fields,submitLabel,handler){
 const d=correctionDialog(),form=$('#correctionForm'),area=$('#correctionFields'),error=$('#correctionError'),save=$('#correctionSave');
 if(d.open||savingAdvisory)return; $('#correctionTitle').textContent=title;$('#correctionSubtitle').textContent=subtitle;const durationNode=$('#correctionDuration');area.after(durationNode);area.replaceChildren();error.textContent='';save.textContent=submitLabel;save.disabled=false;let busy=false;
 for(const field of fields){const [key,label,value,kind,options,max]=field;const headings={matricula:'DATOS DEL ALUMNO',materia:'DATOS DE LA ASESORÍA',inicio:'HORARIO DE LA ASESORÍA',justificacion:'JUSTIFICACIÓN'};if(headings[key]){const h=document.createElement('h3');h.className='correction-section correction-wide';h.textContent=headings[key];area.append(h)}const wrap=document.createElement('label');wrap.textContent=label; if(kind==='textarea'||key==='nombre')wrap.className='correction-wide';const el=document.createElement(kind==='select'?'select':kind==='textarea'?'textarea':'input');el.name=key;if(kind==='select'){for(const v of [...new Set([value,...options])].filter(Boolean)){const o=document.createElement('option');o.value=v;o.textContent=v;el.append(o)}}else if(kind!=='textarea'){el.type=kind||'text';if(kind==='datetime-local')el.step='1'}if(max)el.maxLength=max;el.value=value??'';el.required=key!=='comentarios'&&kind!=='readonly';if(kind==='readonly'){el.type='text';el.readOnly=true;}wrap.append(el);area.append(wrap)}
 const duration=$('#correctionDuration');function preview(){const a=form.elements.inicio,b=form.elements.fin;duration.hidden=!a||!b;if(a&&b){const reason=form.elements.justificacion?.closest('label');if(reason&&duration.parentNode!==area){area.insertBefore(duration,reason.previousElementSibling);duration.classList.add('correction-wide');}const n=Math.round((parseInstitutionalTime(b.value)-parseInstitutionalTime(a.value))/60000);duration.textContent=Number.isFinite(n)&&n>=0?'Duración calculada: '+fmt(n):'Revise el horario'}}form.oninput=preview;preview();
 const close=()=>{if(!busy)d.close()};$('#correctionClose').onclick=close;$('#correctionCancel').onclick=close;d.oncancel=e=>{if(busy)e.preventDefault()};
 form.onsubmit=async e=>{e.preventDefault();if(busy||savingAdvisory)return;busy=true;save.disabled=true;error.textContent='';try{await handler(Object.fromEntries(new FormData(form)));d.close()}catch(err){error.textContent=err.message}finally{busy=false;save.disabled=false}};d.showModal();
}
const reasonField=['justificacion','Motivo de la modificación (obligatorio)','','textarea',null,500];
function timeFields(start,end){return [['inicio','Fecha y hora de inicio',localDateValue(start),'datetime-local'],['fin','Fecha y hora de término',localDateValue(end),'datetime-local']]}
function checkedTimes(body){const x=parseInstitutionalTime(body.inicio),y=parseInstitutionalTime(body.fin);if(!body.inicio||!body.fin||!Number.isFinite(+x)||!Number.isFinite(+y))throw Error('Introduzca fechas y horas válidas.');if(y<x)throw Error('La hora de término no puede ser anterior al inicio.');if(y-x>43200000)throw Error('La duración no puede superar 12 horas.');return [x,y]}
function unchangedCorrectionTimes(body,record){if(!Number.isFinite(+parseInstitutionalTime(body.inicio))||!Number.isFinite(+parseInstitutionalTime(body.fin)))return false;return localDateValue(parseInstitutionalTime(body.inicio))===localDateValue(record.inicioIso)&&localDateValue(parseInstitutionalTime(body.fin))===localDateValue(record.finIso)}
async function correctRecord(x,action){const cfg=appConfig();let fields=[];if(action==='edit')fields=[['matricula','Matrícula',x.matricula,'text',null,40],['nombre','Nombre completo',x.nombre,'text',null,160],['sexo','Sexo',x.sexo,'select',['Hombre','Mujer']],['carrera','Carrera (código)',x.carrera,'text',null,30],['grupo','Grupo',x.grupo,'text',null,80],['turno','Turno',x.turno,'select',['Matutino','Vespertino']],['materia','Materia',x.materia,'select',cfg.subjects],['motivo','Motivo',x.motivo,'select',cfg.reasons],['psico','Canalización a psicopedagogía',x.psico,'select',['No','Sí']],['asesor','Asesor',x.asesor,'readonly'],['periodo','Cuatrimestre',x.periodo,'readonly'],['comentarios','Comentarios',x.comentarios,'textarea',null,2000],...timeFields(x.inicioIso,x.finIso)];if(action==='time')fields=timeFields(x.inicioIso,x.finIso);openCorrection({edit:'Editar registro de asesoría',time:'Corregir horario',cancel:'Eliminar asesoría'}[action],x.nombre+' · '+x.matricula+(action==='cancel'?' · Dejará de contabilizarse en reportes.':''),[...fields,reasonField],action==='cancel'?'Confirmar anulación':'Guardar cambios',async body=>{if(!body.justificacion.trim())throw Error('Indique el motivo.');if(action==='edit'||action==='time'){if(action==='edit'&&body.inicio&&body.fin&&unchangedCorrectionTimes(body,x)){delete body.inicio;delete body.fin;}else [body.inicio,body.fin]=checkedTimes(body).map(d=>d.toISOString());}const r=await draftFetch('/api/advisories/'+encodeURIComponent(x.id),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,action})});const p=await r.json();if(!r.ok)throw Error(p.message||'No se pudo guardar');const refreshed=await loadRemoteAdvisories();$('#correctionNotice').textContent=refreshed?'Cambio guardado correctamente.':'Cambio guardado; actualice el historial.';});}
document.addEventListener('DOMContentLoaded',()=>{ $('#manualCatalog').addEventListener('click',()=>{if(savingAdvisory)return;openCorrection('Captura de carrera y grupo','Alumno nuevo',[['career','Código de carrera',$('#carrera').value==='Seleccione'?'':$('#carrera').value,'text',null,30],['group','Grupo','','text',null,80]],'Aplicar datos',async b=>{if(savingAdvisory)throw Error('La asesoría se está guardando.');const c=b.career.trim(),g=b.group.trim();if(!c||!g)throw Error('Complete ambos campos.');ensureOption('carrera',c);$('#carrera').value=c;updateGroupsForCareer();ensureOption('grupo',g);$('#grupo').value=g;manualCatalogUsed=true;persistActiveSession();});});$('#adjustActive').addEventListener('click',()=>{if(!currentStart||savingAdvisory){$('#correctionNotice').textContent='Inicie una asesoría antes de ajustar el horario.';return}openCorrection('Corregir horario en curso','El ajuste se guardará al finalizar la asesoría.',[...timeFields(currentStart,manualEnd||new Date()),reasonField],'Aplicar horario',async b=>{if(!currentStart||savingAdvisory)throw Error('No hay asesoría disponible.');if(!b.justificacion.trim())throw Error('Indique el motivo.');const t=checkedTimes(b);if(+t[1]>Date.now()+300000)throw Error('La hora de término está en el futuro. Revise el reloj del dispositivo.');activeCorrection={reason:b.justificacion,originalStart:activeCorrection?.originalStart||currentStart.toISOString(),originalEnd:activeCorrection?.originalEnd||(manualEnd||new Date()).toISOString()};[currentStart,manualEnd]=t;persistActiveSession();updateTimer();$('#correctionNotice').textContent='Horario ajustado. Pulse FIN DE ASESORÍA para guardar.';});});});

document.addEventListener('DOMContentLoaded',()=>{$('#manualSubject').onclick=()=>{if(savingAdvisory||!currentUser())return;openCorrection('Capturar materia','La materia se incorporará al catálogo al guardar la asesoría.',[['subject','Nombre de la materia','','text',null,160]],'Aplicar materia',async b=>{const name=b.subject.trim().replace(/\s+/g,' ');if(!name||name==='Seleccione')throw Error('Capture una materia válida.');const select=$('#materia');const existing=[...select.options].find(o=>o.value.toLowerCase()===name.toLowerCase());if(existing)select.value=existing.value;else{const o=new Option(name,name);o.dataset.manual='true';select.add(o);select.value=name;}persistActiveSession();});};});

async function discardDraft(){if(!currentStart||savingAdvisory||!confirm('¿Descartar la asesoría en curso? No se eliminarán asesorías finalizadas.'))return;savingAdvisory=true;clearTimeout(draftTimer);try{await draftQueue;const r=await draftFetch('/api/advisory-draft',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({operationId,revision:draftRevision})});if(!r.ok)throw Error();clearActiveSession();clearInterval(timerId);currentStart=null;$('#iniciar').disabled=false;$('#finalizar').disabled=true;$('#draftStatus').textContent='';resetForm();}catch(e){alert('No se pudo descartar. Recargue y verifique el borrador.');}finally{savingAdvisory=false;}}
document.addEventListener('DOMContentLoaded',()=>$('#discardDraft').addEventListener('click',discardDraft));
