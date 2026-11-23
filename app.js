// CONFIGURACIÓN INICIAL: catálogos locales de respaldo y estado de la asesoría en curso.
const DATA={schoolName:"NOMBRE DE LA INSTITUCIÓN",period:"Septiembre-Diciembre 2026",careers:["Seleccione","IAEV","ICM","IRC","ITIID","LTF","ISA"],groups:["Seleccione","IAEV-PA-08","IAEV-PA-07","ITIID-IA-02","ITIID-SM-02","ISA-SA-06","ICM-CYM-03","IRC-MPR-02","LTF 08","SW 28"],subjects:["Seleccione","Matemáticas","Física","Cálculo","Estadística","Programación","Álgebra"],reasons:["Seleccione","Motivos académicos","Motivos familiares","Motivos personales","Motivos sociales"],sexos:["Seleccione","Hombre","Mujer"],turnos:["Seleccione","Matutino","Vespertino"]};
const $=s=>document.querySelector(s);let manualCatalogUsed=false,newStudent=false,manualEnd=null,activeCorrection=null;let currentStart=null,timerId=null,remoteConfig=null,remoteRecords=[],savingAdvisory=false,secureUser=null;
function activeKey(){return `asesoria_activa_${String(currentUser()?.usuario||'').toLowerCase()}`}
function persistActiveSession(){if(!currentStart||!currentUser())return;const fields={};['matricula','nombre','sexo','carrera','grupo','turno','materia','motivo','psico','comentarios'].forEach(id=>fields[id]=$("#"+id)?.value||'');sessionStorage.setItem(activeKey(),JSON.stringify({start:currentStart.toISOString(),fields,newStudent,manualCatalogUsed,activeCorrection,manualEnd:manualEnd?.toISOString()}))}
function clearActiveSession(){if(currentUser())sessionStorage.removeItem(activeKey())}
function restoreActiveAdvisory(){if(!currentUser())return;let saved;try{saved=JSON.parse(sessionStorage.getItem(activeKey())||'null')}catch(error){}if(!saved?.start||!saved.fields)return;currentStart=new Date(saved.start);if(Number.isNaN(currentStart.getTime())){clearActiveSession();currentStart=null;return}activeCorrection=saved.activeCorrection||null;manualCatalogUsed=!!saved.manualCatalogUsed;newStudent=!!saved.newStudent;manualEnd=saved.manualEnd?new Date(saved.manualEnd):null;const f=saved.fields;ensureOption("carrera",f.carrera);for(const id of ['matricula','nombre','sexo','carrera'])if($("#"+id))$("#"+id).value=f[id]||'';updateGroupsForCareer();ensureOption("grupo",f.grupo);for(const id of ['grupo','turno','materia','motivo','psico','comentarios'])if($("#"+id))$("#"+id).value=f[id]||'';setStudentFields(false);$("#iniciar").disabled=true;$("#finalizar").disabled=false;$("#status").textContent='ASESORÍA EN CURSO';clearInterval(timerId);timerId=setInterval(updateTimer,1000);updateTimer()}
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
    const response=await fetch("/api/bootstrap?refresh="+Date.now(),{cache:"no-store",headers:{Accept:"application/json"}});
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
      period:currentPeriod,
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
  if(refreshingPeriodCatalog)return;
  refreshingPeriodCatalog=true;
  try{if(await loadRemoteConfig()){applyPeriodCatalog();updateGroupsForCareer(true);renderHistory()}}finally{refreshingPeriodCatalog=false}
}

// CAMPOS Y ALUMNOS: carga listas, vincula grupo con carrera y busca o presenta alumnos nuevos/existentes.
function records(){return Array.isArray(remoteRecords)?remoteRecords:[]}
function fill(id,arr){const e=$("#"+id);if(!e)return;e.replaceChildren(...arr.map(value=>{const option=document.createElement('option');option.value=String(value);option.textContent=String(value);return option}))}
function updateGroupsForCareer(preserveSelection=false){const career=$("#carrera")?.value,group=$("#grupo"),previous=group?.value;if(!remoteConfig?.groupsByCareer||!career||career==="Seleccione")return;fill("grupo",["Seleccione",...(remoteConfig.groupsByCareer[career]||[])]);if(preserveSelection&&group){if(newStudent&&previous)ensureOption("grupo",previous);if(Array.from(group.options).some(option=>option.value===previous))group.value=previous}}
function setStudentFields(editable){["sexo","carrera","grupo","turno"].forEach(id=>$("#"+id).disabled=!editable);$("#nombre").readOnly=!editable}
function showFoundStudent(f){manualCatalogUsed=false;newStudent=false;$("#manualCatalog").hidden=true;$("#nombre").value=f.nombre||f.full_name||"";$("#sexo").value=f.sexo||f.sex||"";$("#carrera").value=f.carrera||f.career||appConfig().careers[0];updateGroupsForCareer();$("#grupo").value=f.grupo||f.group_name||appConfig().groups[0];$("#turno").value=f.turno||f.shift||"Matutino";setStudentFields(false);$("#status").textContent="ALUMNO ENCONTRADO"}
function showNewStudent(){manualCatalogUsed=false;newStudent=true;$("#manualCatalog").hidden=false;$("#nombre").value="";$("#sexo").value="Seleccione";$("#carrera").value="Seleccione";$("#grupo").value="Seleccione";$("#turno").value="Seleccione";setStudentFields(true);$("#status").textContent="NUEVO ALUMNO";$("#nombre").focus();alert("Matrícula nueva. Capture los datos del alumno y seleccione el sexo.")}
async function findStudent(){const m=$("#matricula").value.trim();if(!m){alert("Capture una matrícula.");return}$("#status").textContent="BUSCANDO ALUMNO...";try{const response=await fetch("/api/students/"+encodeURIComponent(m),{headers:{Accept:"application/json"}});if(response.status===401){showLogin();alert("Su sesión terminó. Ingrese nuevamente.");return}if(response.ok){const payload=await response.json();if(payload.student)showFoundStudent(payload.student);else showNewStudent();return}throw new Error("database_error")}catch(error){$("#status").textContent="SIN CONEXIÓN";alert("No fue posible consultar PostgreSQL. Intente nuevamente antes de registrar la asesoría.")}}
// CICLO DE ASESORÍA: valida el alumno, inicia el cronómetro, guarda la asesoría y limpia el formulario.
function startSession(){if(!$("#matricula").value.trim()||!$("#nombre").value.trim()){alert("Primero capture/busque la matrícula y el nombre del alumno.");return}if(!$("#sexo").value||$("#sexo").value==="Seleccione"||
!$("#carrera").value||$("#carrera").value==="Seleccione"||
!$("#grupo").value||$("#grupo").value==="Seleccione"||
!$("#turno").value||$("#turno").value==="Seleccione"||
!$("#materia").value||$("#materia").value==="Seleccione"||
!$("#motivo").value||$("#motivo").value==="Seleccione"||
!$("#psico").value||$("#psico").value==="Seleccione"){
alert("Complete todas las casillas obligatorias antes de iniciar la asesoría.");
return}currentStart=new Date();$("#iniciar").disabled=true;$("#finalizar").disabled=false;$("#status").textContent="ASESORÍA EN CURSO";persistActiveSession();timerId=setInterval(updateTimer,1000);updateTimer()}
function updateTimer(){if(!currentStart)return;const total=Math.max(0,Math.floor(((manualEnd?+manualEnd:Date.now())-currentStart)/1000)),hours=Math.floor(total/3600),minutes=Math.floor(total%3600/60),seconds=total%60;$("#timer").textContent=`${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`}
function resetForm(focusMatricula=true){manualCatalogUsed=false;newStudent=false;manualEnd=null;activeCorrection=null;$("#manualCatalog").hidden=true;$("#matricula").value="";$("#sexo").selectedIndex=0;$("#nombre").value="";$("#sexo").value="Seleccione";$("#carrera").value="Seleccione";$("#grupo").value="Seleccione";$("#turno").value="Seleccione";$("#materia").value="Seleccione";$("#motivo").value="Seleccione";$("#psico").value="No";$("#comentarios").value="";setStudentFields(false);$("#status").textContent="SIN INICIAR";$("#timer").textContent="00:00:00";if(focusMatricula)$("#matricula").focus()}
async function finishSession(){
  if(!currentStart||savingAdvisory)return;savingAdvisory=true;
  const end=manualEnd||new Date(),start=currentStart,mins=Math.max(0,Math.round((end-start)/60000));
  const sd={matricula:$("#matricula").value.trim(),nombre:$("#nombre").value.trim(),sexo:$("#sexo").value,carrera:$("#carrera").value,grupo:$("#grupo").value,turno:$("#turno").value};
  const record={id:crypto.randomUUID(),...sd,materia:$("#materia").value,motivo:$("#motivo").value,comentarios:$("#comentarios").value,psico:$("#psico").value,asesor:(currentUser()?.usuario||$("#advisorName").textContent),periodo:appConfig().period,fecha:start.toLocaleDateString("es-MX"),inicio:start.toLocaleTimeString("es-MX"),fin:end.toLocaleTimeString("es-MX"),duracionMinutos:mins,estado:"FINALIZADA",creado:new Date().toISOString(),inicioIso:start.toISOString(),finIso:end.toISOString()};
  $("#finalizar").disabled=true;$("#status").textContent="GUARDANDO...";
  let savedRemote=false;
  try{
    const response=await fetch("/api/advisories",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({...record,nuevoCatalogo:newStudent&&manualCatalogUsed,activeCorrection,inicio:record.inicioIso,fin:record.finIso})});
    const payload=await response.json().catch(()=>({}));
    if(response.ok)savedRemote=true;
    else if(response.status===400){savingAdvisory=false;$("#finalizar").disabled=false;$("#status").textContent="REVISE LOS DATOS";alert(payload.message||"Revise los datos de la asesoría.");return}
    else if(response.status===401){savingAdvisory=false;$("#finalizar").disabled=false;showLogin();alert("Su sesión terminó. Ingrese nuevamente antes de guardar.");return}
    else {savingAdvisory=false;$("#finalizar").disabled=false;$("#status").textContent="ERROR AL GUARDAR";alert(payload.message||"No fue posible guardar en PostgreSQL. La información permanece en el formulario para volver a intentar.");return}
  }catch(error){savingAdvisory=false;$("#finalizar").disabled=false;$("#status").textContent="SIN CONEXIÓN";alert("No fue posible conectar con PostgreSQL. La información permanece en el formulario para volver a intentar.");return}
  if(savedRemote){await loadRemoteConfig();fill("carrera",appConfig().careers);await loadRemoteAdvisories();}
  clearActiveSession();clearInterval(timerId);timerId=null;currentStart=null;savingAdvisory=false;$("#iniciar").disabled=false;$("#finalizar").disabled=true;resetForm();renderHistory();
  alert("Asesoría guardada correctamente en la base de datos. El formulario está listo para el siguiente alumno.");
}
// HISTORIAL DEL ASESOR: aplica filtros, construye la tabla y prepara impresión/exportación CSV.
function inRange(x,r,period){const d=new Date(x.creado),n=new Date();if(r==="all")return true;if(r==="day")return d.toDateString()===n.toDateString();if(r==="week"){const w=new Date(n);w.setDate(n.getDate()-n.getDay());w.setHours(0,0,0,0);return d>=w}if(r==="month")return d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear();if(r==="quarter")return x.periodo===(period&&period!=="all"?period:appConfig().period);return true}
function fmt(m){m=Number(m)||0;return `${Math.floor(m/60)}h ${String(m%60).padStart(2,"0")}m`}
function escapeHTML(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function renderHistory(){const b=$("#history tbody");if(!b)return;const range=$("#rangeFilter").value,period=$("#periodFilter").value,rows=records().filter(x=>inRange(x,range,period)&&(period==="all"||x.periodo===period)),rowHTML=rows.map(x=>`<tr>${[x.fecha,x.inicio,x.fin,x.matricula,x.nombre,x.sexo||"",x.carrera,x.grupo,x.materia,x.motivo,x.comentarios||"",x.asesor,fmt(x.duracionMinutos),x.psico].map(v=>`<td>${escapeHTML(v)}</td>`).join("")}</tr>`).join("");b.innerHTML=rowHTML;const pb=$("#printTable tbody");if(pb)pb.innerHTML=rowHTML;Array.from(b.rows).forEach((tr,i)=>{const x=rows[i],td=tr.insertCell();if(x.asesor===currentUser()?.usuario){for(const [action,label] of [['edit','Editar'],['time','Horario'],['cancel','Anular']]){const btn=document.createElement('button');btn.type='button';btn.textContent=label;btn.addEventListener('click',()=>correctRecord(x,action));td.append(btn)}}});if($("#printSchoolName"))$("#printSchoolName").textContent=appConfig().schoolName;if($("#printPeriod"))$("#printPeriod").textContent="REGISTRO DE ASESORÍAS · "+(period==="all"?appConfig().period:period);if($("#printAdvisorName"))$("#printAdvisorName").textContent=$("#advisorName")?.textContent||""}
function filteredRecords(){const range=$("#rangeFilter")?.value||"all",period=$("#periodFilter")?.value||"all";return records().filter(x=>inRange(x,range,period)&&(period==="all"||x.periodo===period))}
function spreadsheetSafe(v){const text=String(v??'');return /^[=+\-@]/.test(text)?`'${text}`:text}
function exportCSV(){const h=["Fecha","Inicio","Fin","Matrícula","Alumno","Sexo","Carrera","Grupo","Turno","Materia","Motivo","Comentarios","Psicopedagogía","Asesor","Periodo","Duración minutos"],rows=filteredRecords(),csv=[h,...rows.map(x=>[x.fecha,x.inicio,x.fin,x.matricula,x.nombre,x.sexo,x.carrera,x.grupo,x.turno,x.materia,x.motivo,x.comentarios,x.psico,x.asesor,x.periodo,x.duracionMinutos])].map(a=>a.map(v=>`"${spreadsheetSafe(v).replaceAll('"','""')}"`).join(",")).join("\n");const a=document.createElement("a"),url=URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}));a.href=url;a.download="historial_asesorias.csv";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}

// ACCESO DEL ASESOR: inicia/restaura/cierra la sesión y sincroniza los registros con la API.
async function loadRemoteAdvisories(){
  try{
    const response=await fetch("/api/advisories",{headers:{Accept:"application/json"}});
    if(!response.ok)return false;
    const payload=await response.json();
    const databaseRecords=(payload.advisories||[]).map(x=>{const start=new Date(x.inicioIso),end=new Date(x.finIso);return {...x,fecha:start.toLocaleDateString("es-MX"),inicio:start.toLocaleTimeString("es-MX"),fin:end.toLocaleTimeString("es-MX")}});
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
    const response=await fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({username:user,password:pass})});
    const payload=await response.json().catch(()=>({}));
    if(response.ok&&payload.user){
      secureUser=payload.user;
      remoteRecords=[];
      if(msg)msg.textContent="";
      applySession();renderHistory();hideLogin();await loadRemoteAdvisories();restoreActiveAdvisory();return;
    }
    if(response.status===400||response.status===401){
      if(msg)msg.textContent=payload.message||(response.status===400?"Escriba su usuario.":"Usuario o contraseña incorrectos.");
      return;
    }
  }catch(error){if(msg)msg.textContent="No fue posible comunicarse con el servidor."}
}
async function restoreRemoteSession(){
  try{
    const response=await fetch("/api/session",{headers:{Accept:"application/json"}});
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
  if(currentStart&&!confirm("Hay una asesoría en curso. ¿Desea cerrar la sesión? La asesoría permanecerá guardada para continuar al volver a ingresar."))return;
  try{await fetch("/api/logout",{method:"POST",headers:{Accept:"application/json"}})}catch(error){}
  secureUser=null;
  remoteRecords=[];
  clearInterval(timerId); timerId=null; currentStart=null;
  resetForm(false);
  renderHistory();
  showLogin();
}

document.addEventListener("DOMContentLoaded",async()=>{['asesorias_demo','alumnos_demo','asesor_users_demo','asesor_session_persistente','asesor_session_backup'].forEach(key=>localStorage.removeItem(key));await loadRemoteConfig();const C=appConfig();if($("#schoolName"))$("#schoolName").textContent=C.schoolName;if($("#advisorName"))$("#advisorName").textContent="";fill("carrera",C.careers);fill("grupo",C.groups);fill("materia",C.subjects);fill("motivo",C.reasons);fill("turno",C.turnos||["Seleccione","Matutino","Vespertino"]);fill("sexo",C.sexos);applyPeriodCatalog();setStudentFields(false);renderHistory();
await restoreRemoteSession();applySession();if(currentUser()){await loadRemoteAdvisories();restoreActiveAdvisory()}
$("#loginBtn")?.addEventListener("click",doLogin);
$("#loginUser")?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();$("#loginPassword")?.focus()}});
$("#loginPassword")?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();doLogin()}});
$("#logoutBtn")?.addEventListener("click",logout);
document.querySelector('.grid')?.addEventListener('input',()=>{if(currentStart)persistActiveSession()});
$("#carrera")?.addEventListener("change",updateGroupsForCareer);
$("#buscar")?.addEventListener("click",findStudent);$("#matricula")?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();findStudent()}});$("#iniciar")?.addEventListener("click",startSession);$("#finalizar")?.addEventListener("click",finishSession);$("#rangeFilter")?.addEventListener("change",renderHistory);$("#periodFilter")?.addEventListener("change",renderHistory);$("#export")?.addEventListener("click",exportCSV);$("#print")?.addEventListener("click",()=>{renderHistory();window.print()})});
window.addEventListener("focus",refreshPeriodCatalog);
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")refreshPeriodCatalog()});
window.addEventListener('beforeunload',()=>{if(currentStart)persistActiveSession()});

function ensureOption(id,value){const el=$("#"+id);if(value&&!Array.from(el.options).some(o=>o.value===value))el.add(new Option(value,value));}
function localDateValue(date){const d=new Date(date);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,19)}
function askTime(start,end){const a=prompt('Inicio real (AAAA-MM-DDTHH:MM:SS, hora local del dispositivo)',localDateValue(start));if(a===null)return;const b=prompt('Fin real (AAAA-MM-DDTHH:MM:SS, hora local del dispositivo)',localDateValue(end));if(b===null)return;const x=new Date(a),y=new Date(b);if(!Number.isFinite(+x)||!Number.isFinite(+y)||y<x||+y>Date.now()||y-x>43200000){alert('Horario inválido.');return}return [x,y]}
async function correctRecord(x,action){const body={action};if(action==='cancel'&&!confirm('¿Anular esta asesoría? No se contabilizará en reportes.'))return;if(action==='time'){const t=askTime(x.inicioIso,x.finIso);if(!t)return;[body.inicio,body.fin]=t.map(d=>d.toISOString())}if(action==='edit'){for(const [k,label] of Object.entries({matricula:'Matrícula',nombre:'Nombre',sexo:'Sexo (Hombre/Mujer)',carrera:'Carrera',grupo:'Grupo',turno:'Turno',materia:'Materia',motivo:'Motivo',comentarios:'Comentarios',psico:'Psicopedagogía (Sí/No)'})){const v=prompt(label,x[k]||'');if(v===null)return;body[k]=v}}const reason=prompt('Motivo de la corrección (obligatorio)');if(!reason?.trim())return;body.justificacion=reason;try{const r=await fetch('/api/advisories/'+encodeURIComponent(x.id),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const p=await r.json();if(!r.ok)throw new Error(p.message||'No se pudo guardar');if(!await loadRemoteAdvisories())alert('Cambio guardado; actualice el historial.');else alert('Cambio guardado.')}catch(e){alert(e.message)}}
document.addEventListener('DOMContentLoaded',()=>{ $('#manualCatalog').addEventListener('click',()=>{if(!newStudent||currentStart)return;const c=prompt('Código de carrera', $('#carrera').value==='Seleccione'?'':$('#carrera').value);if(!c?.trim())return;const g=prompt('Grupo');if(!g?.trim())return;if(c.trim().length>30||g.trim().length>80){alert('Longitud inválida');return}ensureOption('carrera',c.trim());$('#carrera').value=c.trim();updateGroupsForCareer();ensureOption('grupo',g.trim());$('#grupo').value=g.trim();manualCatalogUsed=true;});$('#adjustActive').addEventListener('click',()=>{if(!currentStart||savingAdvisory)return;const t=askTime(currentStart,manualEnd||new Date());if(!t)return;const reason=prompt("Motivo del ajuste (obligatorio)");if(!reason?.trim()||reason.length>500)return;activeCorrection={reason,originalStart:activeCorrection?.originalStart||currentStart.toISOString(),originalEnd:activeCorrection?.originalEnd||(manualEnd||new Date()).toISOString()};[currentStart,manualEnd]=t;persistActiveSession();alert('Horario ajustado. Pulse FIN DE ASESORÍA para guardar.');});});
