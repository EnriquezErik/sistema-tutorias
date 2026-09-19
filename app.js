const DATA={schoolName:"NOMBRE DE LA INSTITUCIÓN",period:"Septiembre-Diciembre 2026",advisors:[{usuario:"Erik",nombre:"Erik (demo)",requierePassword:false,password:""}],careers:["Seleccione","IAEV","ICM","IRC","ITIID","LTF","ISA"],groups:["Seleccione","IAEV-PA-08","IAEV-PA-07","ITIID-IA-02","ITIID-SM-02","ISA-SA-06","ICM-CYM-03","IRC-MPR-02","LTF 08","SW 28"],subjects:["Seleccione","Matemáticas","Física","Cálculo","Estadística","Programación","Álgebra"],reasons:["Seleccione","Motivos académicos","Motivos familiares","Motivos personales","Motivos sociales"],sexos:["Seleccione","Hombre","Mujer"],turnos:["Seleccione","Matutino","Vespertino"]};
const $=s=>document.querySelector(s),KEY="asesorias_demo";let currentStart=null,timerId=null,remoteConfig=null,remoteRecords=null;
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
    const response=await fetch("/api/bootstrap",{headers:{Accept:"application/json"}});
    if(!response.ok)return false;
    const payload=await response.json(),d=payload.data;
    if(!payload.ok||!d)return false;
    const periodNames=(d.periods||[]).map(x=>x.name);
    const careerCodes=new Map((d.careers||[]).map(x=>[x.id,x.code]));
    const groupsByCareer={};
    for(const group of d.groups||[]){const code=careerCodes.get(group.career_id);if(code)(groupsByCareer[code]||(groupsByCareer[code]=[])).push(group.name)}
    remoteConfig={
      ...DATA,
      schoolName:d.school?.school_name||DATA.schoolName,
      period:periodNames[0]||DATA.period,
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

function localRecords(){return JSON.parse(localStorage.getItem(KEY)||"[]")}
function recordsForAdvisor(rows,username){const user=String(username||'').trim().toLowerCase();if(!user)return[];return rows.filter(record=>String(record.asesor||'').trim().toLowerCase()===user)}
function records(){if(Array.isArray(remoteRecords))return remoteRecords;return recordsForAdvisor(localRecords(),currentUser()?.usuario)}
function saveRecords(r){localStorage.setItem(KEY,JSON.stringify(r))}function students(){return JSON.parse(localStorage.getItem("alumnos_demo")||"[]")}function saveStudents(r){localStorage.setItem("alumnos_demo",JSON.stringify(r))}
function fill(id,arr){const e=$("#"+id);if(e)e.innerHTML=arr.map(x=>`<option>${x}</option>`).join("")}
function updateGroupsForCareer(){const career=$("#carrera")?.value;if(!remoteConfig?.groupsByCareer||!career||career==="Seleccione")return;fill("grupo",["Seleccione",...(remoteConfig.groupsByCareer[career]||[])])}
function setStudentFields(editable){["sexo","carrera","grupo","turno"].forEach(id=>$("#"+id).disabled=!editable);$("#nombre").readOnly=!editable}
function showFoundStudent(f){$("#nombre").value=f.nombre||f.full_name||"";$("#sexo").value=f.sexo||f.sex||"";$("#carrera").value=f.carrera||f.career||appConfig().careers[0];updateGroupsForCareer();$("#grupo").value=f.grupo||f.group_name||appConfig().groups[0];$("#turno").value=f.turno||f.shift||"Matutino";setStudentFields(false);$("#status").textContent="ALUMNO ENCONTRADO"}
function showNewStudent(){$("#nombre").value="";$("#sexo").value="Seleccione";$("#carrera").value="Seleccione";$("#grupo").value="Seleccione";$("#turno").value="Seleccione";setStudentFields(true);$("#status").textContent="NUEVO ALUMNO";$("#nombre").focus();alert("Matrícula nueva. Capture los datos del alumno y seleccione el sexo.")}
async function findStudent(){const m=$("#matricula").value.trim();if(!m){alert("Capture una matrícula.");return}$("#status").textContent="BUSCANDO ALUMNO...";try{const response=await fetch("/api/students/"+encodeURIComponent(m),{headers:{Accept:"application/json"}});if(response.status===401){showLogin();alert("Su sesión terminó. Ingrese nuevamente.");return}if(response.ok){const payload=await response.json();if(payload.student)showFoundStudent(payload.student);else showNewStudent();return}}catch(error){}const f=students().find(x=>x.matricula.toLowerCase()===m.toLowerCase());if(f)showFoundStudent(f);else showNewStudent()}
function startSession(){if(!$("#matricula").value.trim()||!$("#nombre").value.trim()){alert("Primero capture/busque la matrícula y el nombre del alumno.");return}if(!$("#sexo").value||$("#sexo").value==="Seleccione"||
!$("#carrera").value||$("#carrera").value==="Seleccione"||
!$("#grupo").value||$("#grupo").value==="Seleccione"||
!$("#turno").value||$("#turno").value==="Seleccione"||
!$("#materia").value||$("#materia").value==="Seleccione"||
!$("#motivo").value||$("#motivo").value==="Seleccione"||
!$("#psico").value||$("#psico").value==="Seleccione"){
alert("Complete todas las casillas obligatorias antes de iniciar la asesoría.");
return}currentStart=new Date();$("#iniciar").disabled=true;$("#finalizar").disabled=false;$("#status").textContent="ASESORÍA EN CURSO";timerId=setInterval(updateTimer,1000);updateTimer()}
function updateTimer(){if(!currentStart)return;const s=Math.floor((Date.now()-currentStart)/1000);$("#timer").textContent=new Date(s*1000).toISOString().substring(11,19)}
function resetForm(){$("#matricula").value="";$("#sexo").selectedIndex=0;$("#nombre").value="";$("#sexo").value="Seleccione";$("#carrera").value="Seleccione";$("#grupo").value="Seleccione";$("#turno").value="Seleccione";$("#materia").value="Seleccione";$("#motivo").value="Seleccione";$("#psico").value="Seleccione";$("#comentarios").value="";setStudentFields(false);$("#status").textContent="SIN INICIAR";$("#timer").textContent="00:00:00";$("#matricula").focus()}
async function finishSession(){
  if(!currentStart)return;
  const end=new Date(),start=currentStart,mins=Math.max(0,Math.round((end-start)/60000));
  const sd={matricula:$("#matricula").value.trim(),nombre:$("#nombre").value.trim(),sexo:$("#sexo").value,carrera:$("#carrera").value,grupo:$("#grupo").value,turno:$("#turno").value};
  const record={id:crypto.randomUUID(),...sd,materia:$("#materia").value,motivo:$("#motivo").value,comentarios:$("#comentarios").value,psico:$("#psico").value,asesor:(currentUser()?.usuario||$("#advisorName").textContent),periodo:appConfig().period,fecha:start.toLocaleDateString("es-MX"),inicio:start.toLocaleTimeString("es-MX"),fin:end.toLocaleTimeString("es-MX"),duracionMinutos:mins,estado:"FINALIZADA",creado:new Date().toISOString(),inicioIso:start.toISOString(),finIso:end.toISOString()};
  $("#finalizar").disabled=true;$("#status").textContent="GUARDANDO...";
  let savedRemote=false,useLocalBackup=false;
  try{
    const response=await fetch("/api/advisories",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({...record,inicio:record.inicioIso,fin:record.finIso})});
    const payload=await response.json().catch(()=>({}));
    if(response.ok)savedRemote=true;
    else if(response.status===400){$("#finalizar").disabled=false;$("#status").textContent="REVISE LOS DATOS";alert(payload.message||"Revise los datos de la asesoría.");return}
    else if(response.status===401){$("#finalizar").disabled=false;showLogin();alert("Su sesión terminó. Ingrese nuevamente antes de guardar.");return}
    else useLocalBackup=true;
  }catch(error){useLocalBackup=true}
  const ss=students(),i=ss.findIndex(x=>x.matricula.toLowerCase()===sd.matricula.toLowerCase());if(i>=0)ss[i]={...ss[i],...sd};else ss.push(sd);saveStudents(ss);
  if(useLocalBackup){const local=localRecords();local.push(record);saveRecords(local);if(Array.isArray(remoteRecords))remoteRecords.push(record)}
  if(savedRemote)await loadRemoteAdvisories();
  clearInterval(timerId);timerId=null;currentStart=null;$("#iniciar").disabled=false;$("#finalizar").disabled=true;resetForm();renderHistory();
  alert(useLocalBackup?"PostgreSQL no respondió. La asesoría quedó guardada temporalmente en este navegador.":"Asesoría guardada correctamente en la base de datos. El formulario está listo para el siguiente alumno.");
}
function inRange(x,r,period){const d=new Date(x.creado),n=new Date();if(r==="all")return true;if(r==="day")return d.toDateString()===n.toDateString();if(r==="week"){const w=new Date(n);w.setDate(n.getDate()-n.getDay());w.setHours(0,0,0,0);return d>=w}if(r==="month")return d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear();if(r==="quarter")return x.periodo===(period&&period!=="all"?period:appConfig().period);return true}
function fmt(m){m=Number(m)||0;return `${Math.floor(m/60)}h ${String(m%60).padStart(2,"0")}m`}
function renderHistory(){const b=$("#history tbody");if(!b)return;const range=$("#rangeFilter").value,period=$("#periodFilter").value,rows=records().filter(x=>inRange(x,range,period)&&(period==="all"||x.periodo===period)),rowHTML=rows.map(x=>`<tr><td>${x.fecha}</td><td>${x.inicio}</td><td>${x.fin}</td><td>${x.matricula}</td><td>${x.nombre}</td><td>${x.sexo||""}</td><td>${x.carrera}</td><td>${x.grupo}</td><td>${x.materia}</td><td>${x.motivo}</td><td>${x.comentarios||""}</td><td>${x.asesor}</td><td>${fmt(x.duracionMinutos)}</td><td>${x.psico}</td></tr>`).join("");b.innerHTML=rowHTML;const pb=$("#printTable tbody");if(pb)pb.innerHTML=rowHTML;if($("#printSchoolName"))$("#printSchoolName").textContent=DATA.schoolName;if($("#printPeriod"))$("#printPeriod").textContent="REGISTRO DE ASESORÍAS · "+(period==="all"?appConfig().period:period);if($("#printAdvisorName"))$("#printAdvisorName").textContent=$("#advisorName")?.textContent||""}
function filteredRecords(){const range=$("#rangeFilter")?.value||"all",period=$("#periodFilter")?.value||"all";return records().filter(x=>inRange(x,range,period)&&(period==="all"||x.periodo===period))}
function exportCSV(){const h=["Fecha","Inicio","Fin","Matrícula","Alumno","Sexo","Carrera","Grupo","Turno","Materia","Motivo","Comentarios","Psicopedagogía","Asesor","Periodo","Duración minutos"],rows=filteredRecords(),csv=[h,...rows.map(x=>[x.fecha,x.inicio,x.fin,x.matricula,x.nombre,x.sexo,x.carrera,x.grupo,x.turno,x.materia,x.motivo,x.comentarios,x.psico,x.asesor,x.periodo,x.duracionMinutos])].map(a=>a.map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(",")).join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}));a.download="historial_asesorias.csv";a.click()}

async function loadRemoteAdvisories(){
  try{
    const response=await fetch("/api/advisories",{headers:{Accept:"application/json"}});
    if(!response.ok)return false;
    const payload=await response.json();
    const databaseRecords=(payload.advisories||[]).map(x=>{const start=new Date(x.inicioIso),end=new Date(x.finIso);return {...x,fecha:start.toLocaleDateString("es-MX"),inicio:start.toLocaleTimeString("es-MX"),fin:end.toLocaleTimeString("es-MX")}});
    const ids=new Set(databaseRecords.map(x=>x.id));
    const localAdvisorRecords=recordsForAdvisor(localRecords(),currentUser()?.usuario);
    remoteRecords=[...databaseRecords,...localAdvisorRecords.filter(x=>!ids.has(x.id))];
    renderHistory();return true;
  }catch(error){return false}
}

const USER_KEY="asesor_users_demo",SESSION_KEY="asesor_session_persistente",SESSION_BACKUP_KEY="asesor_session_backup";
function savePersistentSession(session){
  const data=JSON.stringify({...session,recordada:true});
  // La sesión queda guardada sin fecha de caducidad. Solo logout() la elimina.
  try{
    localStorage.setItem(SESSION_KEY,data);
    localStorage.setItem(SESSION_BACKUP_KEY,data);
  }catch(e){}
  try{
    document.cookie="asesor_session_local="+encodeURIComponent(data)+"; Max-Age=315360000; path=/; SameSite=Lax";
  }catch(e){}
}
function readCookie(name){try{const m=document.cookie.split("; ").find(x=>x.startsWith(name+"="));return m?decodeURIComponent(m.split("=").slice(1).join("=")):null}catch(e){return null}}
function defaultUsers(){
  const u=JSON.parse(localStorage.getItem(USER_KEY)||"null");
  if(Array.isArray(u)&&u.length)return u;
  const defaults=[{usuario:"Erik",nombre:"Erik (demo)",requierePassword:false,password:"",activo:true}];
  localStorage.setItem(USER_KEY,JSON.stringify(defaults)); return defaults;
}
function getUsers(){return defaultUsers()}
function parseSession(raw){
  if(!raw)return null;
  try{
    const u=typeof raw==="string"?JSON.parse(raw):raw;
    return u&&u.usuario?u:null;
  }catch(e){return null}
}
function currentUser(){
  const sources=[
    ()=>localStorage.getItem(SESSION_KEY),
    ()=>localStorage.getItem(SESSION_BACKUP_KEY),
    ()=>readCookie("asesor_session_local")
  ];
  for(const get of sources){
    try{
      const u=parseSession(get());
      if(u&&u.usuario){
        const normalized=JSON.stringify(u);
        try{
          localStorage.setItem(SESSION_KEY,normalized);
          localStorage.setItem(SESSION_BACKUP_KEY,normalized);
        }catch(e){}
        return u;
      }
    }catch(e){}
  }
  return null;
}
function showLogin(){
  const s=$("#loginScreen"); if(s)s.style.display="flex";
  document.body.classList.add("locked");
  $("#loginUser")?.focus();
}
function hideLogin(){
  const s=$("#loginScreen"); if(s)s.style.display="none";
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
      savePersistentSession(payload.user);
      remoteRecords=[];
      if(msg)msg.textContent="";
      applySession();renderHistory();hideLogin();await loadRemoteAdvisories();return;
    }
    if(response.status===400||response.status===401){
      if(msg)msg.textContent=payload.message||(response.status===400?"Escriba su usuario.":"Usuario o contraseña incorrectos.");
      return;
    }
  }catch(error){}
  // Respaldo temporal para trabajar si Render o PostgreSQL no están disponibles.
  const found=getUsers().find(u=>u.activo!==false&&u.usuario.toLowerCase()===user.toLowerCase());
  if(!found){if(msg)msg.textContent="Usuario no encontrado.";return}
  if(found.requierePassword && pass!==found.password){if(msg)msg.textContent="Contraseña incorrecta.";return}
  const session={usuario:found.usuario,nombre:found.nombre};
  savePersistentSession(session);
  remoteRecords=recordsForAdvisor(localRecords(),session.usuario);
  if(msg)msg.textContent="";
  applySession();renderHistory();hideLogin();
}
async function restoreRemoteSession(){
  try{
    const response=await fetch("/api/session",{headers:{Accept:"application/json"}});
    if(response.status===401){
      localStorage.removeItem(SESSION_KEY); localStorage.removeItem(SESSION_BACKUP_KEY);
      document.cookie="asesor_session_local=; Max-Age=0; path=/; SameSite=Lax";
      return false;
    }
    if(!response.ok)return false;
    const payload=await response.json();
    if(payload.ok&&payload.user){savePersistentSession(payload.user);return true}
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
  try{await fetch("/api/logout",{method:"POST",headers:{Accept:"application/json"}})}catch(error){}
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_BACKUP_KEY);
  document.cookie="asesor_session_local=; Max-Age=0; path=/; SameSite=Lax";
  remoteRecords=null;
  clearInterval(timerId); timerId=null; currentStart=null;
  renderHistory();
  showLogin();
}

document.addEventListener("DOMContentLoaded",async()=>{await loadRemoteConfig();const C=appConfig();if($("schoolName"))$("schoolName").textContent=C.schoolName;if($("periodName"))$("periodName").textContent=C.period;if($("advisorName"))$("advisorName").textContent="";fill("carrera",C.careers);fill("grupo",C.groups);fill("materia",C.subjects);fill("motivo",C.reasons);fill("turno",C.turnos||["Seleccione","Matutino","Vespertino"]);fill("sexo",C.sexos);if($("periodFilter"))$("periodFilter").innerHTML=`<option value="all">Todos los cuatrimestres</option>`+C.periods.map(p=>`<option value="${p}">${p}</option>`).join("");setStudentFields(false);renderHistory();
await restoreRemoteSession();applySession();if(currentUser())await loadRemoteAdvisories();
$("#loginBtn")?.addEventListener("click",doLogin);
$("#loginUser")?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();$("#loginPassword")?.focus()}});
$("#loginPassword")?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();doLogin()}});
$("#logoutBtn")?.addEventListener("click",logout);
$("#carrera")?.addEventListener("change",updateGroupsForCareer);
$("#buscar")?.addEventListener("click",findStudent);$("#matricula")?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();findStudent()}});$("#iniciar")?.addEventListener("click",startSession);$("#finalizar")?.addEventListener("click",finishSession);$("#rangeFilter")?.addEventListener("change",renderHistory);$("#periodFilter")?.addEventListener("change",renderHistory);$("#export")?.addEventListener("click",exportCSV);$("#print")?.addEventListener("click",()=>{renderHistory();window.print()})});
