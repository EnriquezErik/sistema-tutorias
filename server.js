const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = __dirname;
const DATABASE_URL = process.env.DATABASE_URL || "";
const SESSION_SECRET = process.env.SESSION_SECRET || (DATABASE_URL
  ? crypto.createHash("sha256").update(DATABASE_URL).digest("hex")
  : crypto.randomBytes(32).toString("hex"));
const database = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    })
  : null;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function resolveRequestPath(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl, "http://localhost").pathname);
  const requestedFile = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const absolutePath = path.resolve(PUBLIC_DIR, requestedFile);
  return absolutePath.startsWith(PUBLIC_DIR + path.sep) ? absolutePath : null;
}

function sendJson(response, statusCode, body, headOnly = false) {
  const payload = JSON.stringify(body, null, 2);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(payload)
  });
  response.end(headOnly ? undefined : payload);
}

function parseCookies(request) {
  const cookies = {};
  for (const part of String(request.headers.cookie || "").split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

function signSession(user) {
  const payload = Buffer.from(JSON.stringify({
    id: user.id,
    usuario: user.username,
    nombre: user.full_name,
    rol: user.role,
    exp: Date.now() + 365 * 24 * 60 * 60 * 1000
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function readSession(request, cookieName = "advisor_session") {
  const token = parseCookies(request)[cookieName];
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return session.exp > Date.now() ? session : null;
  } catch (error) {
    return null;
  }
}

async function isActiveAdvisorSession(session){
  if(!session||session.rol!=="advisor"||!database)return false;
  const result=await database.query("select 1 from public.app_users where id=$1 and role='advisor' and active=true",[session.id]);
  return result.rowCount===1;
}

function readJsonBody(request, limit = 16384) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", chunk => {
      body += chunk;
      if (Buffer.byteLength(body) > limit) reject(new Error("payload_too_large"));
    });
    request.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (error) { reject(new Error("invalid_json")); }
    });
    request.on("error", reject);
  });
}

async function getBootstrap() {
  const [institution, periods, careers, groups, subjects, reasons] = await Promise.all([
    database.query("select school_name, footer_text, timezone from public.institution_settings where id = true"),
    database.query("select id, name, starts_on, ends_on, active from public.periods order by active desc, (current_date between starts_on and ends_on) desc, starts_on desc"),
    database.query("select id, code::text, name from public.careers where active = true order by code"),
    database.query("select id, name::text, career_id from public.student_groups where active = true order by name"),
    database.query("select id, name::text from public.subjects where active = true order by name"),
    database.query("select id, name::text from public.advisory_reasons where active = true order by name")
  ]);
  return {
    school: institution.rows[0] || {},
    periods: periods.rows,
    current_period: periods.rows.find(period => period.active) || null,
    careers: careers.rows,
    groups: groups.rows,
    subjects: subjects.rows,
    reasons: reasons.rows
  };
}

async function apiLogin(request, response) {
  if (!database) {
    sendJson(response, 503, { ok: false, code: "database_not_configured" });
    return;
  }
  let body;
  try { body = await readJsonBody(request); }
  catch (error) { sendJson(response, 400, { ok: false, code: error.message }); return; }
  const username = String(body.username || "").trim();
  const password = String(body.password || "");
  const area = body.area === "admin" ? "admin" : "advisor";
  if (!username) { sendJson(response, 400, { ok: false, code: "username_required" }); return; }

  const result = await database.query(
    "select id, username::text, full_name, password_hash, role from public.app_users where active = true and lower(username::text) = lower($1) limit 1",
    [username]
  );
  const user = result.rows[0];
  const validPassword = user && (!user.password_hash || await bcrypt.compare(password, user.password_hash));
  if (!user || !validPassword) {
    sendJson(response, 401, { ok: false, code: "invalid_credentials", message: "Usuario o contraseña incorrectos." });
    return;
  }
  if (area === "admin" && user.role !== "admin") { sendJson(response,403,{ok:false,code:"admin_required",message:"Este usuario no tiene permisos de administración."}); return; }
  if (area === "advisor" && user.role !== "advisor") { sendJson(response,403,{ok:false,code:"advisor_required",message:"Este usuario corresponde al área administrativa."}); return; }

  const token = signSession(user);
  const cookieName = area === "admin" ? "admin_session" : "advisor_session";
  response.setHeader("Set-Cookie", `${cookieName}=${encodeURIComponent(token)}; Max-Age=31536000; Path=/; HttpOnly; Secure; SameSite=Lax`);
  sendJson(response, 200, { ok: true, user: { usuario: user.username, nombre: user.full_name, rol: user.role } });
}

function requireAdmin(request, response) {
  const session = readSession(request, "admin_session");
  if (!session) { sendJson(response, 401, { ok: false, code: "unauthorized" }); return null; }
  if (session.rol !== "admin") { sendJson(response, 403, { ok: false, code: "admin_required" }); return null; }
  return session;
}

async function apiAdminData(request, response) {
  if (!requireAdmin(request, response)) return;
  const session = readSession(request, "admin_session");
  const [advisories, students, users, bootstrap, periodsAdmin, groupsAdmin] = await Promise.all([
    database.query(`
      select a.id, s.enrollment::text, s.full_name as student_name, s.sex, s.shift,
             c.code::text as career_code, g.name::text as group_name,
             sub.name::text as subject_name, r.name::text as reason_name,
             p.name as period_name, u.username::text as advisor_username,
             a.comments, a.referred_to_psychopedagogy, a.started_at, a.ended_at,
             a.duration_minutes, a.status, a.created_at
        from public.advisories a
        join public.students s on s.id = a.student_id
        join public.careers c on c.id = s.career_id
        join public.student_groups g on g.id = s.group_id
        join public.subjects sub on sub.id = a.subject_id
        join public.advisory_reasons r on r.id = a.reason_id
        join public.periods p on p.id = a.period_id
        join public.app_users u on u.id = a.advisor_id
       order by a.started_at desc limit 5000
    `),
    database.query(`select s.enrollment::text as matricula, s.full_name as nombre, s.sex as sexo,
                           c.code::text as carrera, g.name::text as grupo, s.shift as turno
                      from public.students s join public.careers c on c.id=s.career_id
                      join public.student_groups g on g.id=s.group_id where s.active=true order by s.full_name`),
    database.query(`select id, username::text as usuario, full_name as nombre, role as rol, active as activo,
                           (password_hash is not null) as "requierePassword",
                           (recovery_code_hash is not null) as "recuperacionConfigurada"
                      from public.app_users order by role, full_name`),
    getBootstrap(),
    database.query("select id, name, starts_on, ends_on, active from public.periods order by starts_on desc"),
    database.query(`select g.id, g.name::text, g.career_id, g.active, c.code::text as career_code
                      from public.student_groups g left join public.careers c on c.id=g.career_id
                     order by c.code nulls last, g.name`)
  ]);
  sendJson(response, 200, { ok: true, user: session, data: {
    advisories: advisories.rows.map(advisoryRow), students: students.rows, users: users.rows,
    catalogs: bootstrap, periodsAdmin: periodsAdmin.rows, groupsAdmin: groupsAdmin.rows
  }});
}

async function apiCreateGroup(request,response){
  if(!requireAdmin(request,response))return;
  let body;try{body=await readJsonBody(request)}catch(error){sendJson(response,400,{ok:false,message:"Solicitud inválida."});return}
  const name=String(body.name||"").trim(),careerCode=String(body.careerCode||"").trim();
  if(!name||!careerCode){sendJson(response,400,{ok:false,message:"Capture el grupo y seleccione su carrera."});return}
  const career=await database.query("select id from public.careers where active=true and lower(code::text)=lower($1) limit 1",[careerCode]);
  if(!career.rowCount){sendJson(response,400,{ok:false,message:"La carrera seleccionada no es válida o está inactiva."});return}
  try{
    const result=await database.query("insert into public.student_groups(name,career_id,active) values($1,$2,true) returning id,name::text,career_id,active",[name,career.rows[0].id]);
    sendJson(response,201,{ok:true,group:result.rows[0]});
  }catch(error){if(error.code==='23505'){sendJson(response,409,{ok:false,message:"Ya existe un grupo con ese nombre."});return}throw error}
}

async function apiSetGroupActive(request,response,groupId){
  if(!requireAdmin(request,response))return;
  let body;try{body=await readJsonBody(request)}catch(error){sendJson(response,400,{ok:false,message:"Solicitud inválida."});return}
  if(typeof body.active!=="boolean"){sendJson(response,400,{ok:false,message:"Indique el estado del grupo."});return}
  const result=await database.query("update public.student_groups set active=$1,updated_at=now() where id=$2::uuid returning id,name::text,career_id,active",[body.active,groupId]);
  if(!result.rowCount){sendJson(response,404,{ok:false,message:"No se encontró el grupo."});return}
  sendJson(response,200,{ok:true,group:result.rows[0]});
}

async function apiCreatePeriod(request,response){
  if(!requireAdmin(request,response))return;
  let body;try{body=await readJsonBody(request)}catch(error){sendJson(response,400,{ok:false,message:"Solicitud inválida."});return}
  const name=String(body.name||"").trim(),startsOn=String(body.startsOn||""),endsOn=String(body.endsOn||"");
  if(!name||!/^\d{4}-\d{2}-\d{2}$/.test(startsOn)||!/^\d{4}-\d{2}-\d{2}$/.test(endsOn)){sendJson(response,400,{ok:false,message:"Capture el nombre, la fecha inicial y la fecha final."});return}
  if(endsOn<startsOn){sendJson(response,400,{ok:false,message:"La fecha final no puede ser anterior a la fecha inicial."});return}
  const overlap=await database.query("select name from public.periods where active=true and starts_on <= $2::date and ends_on >= $1::date limit 1",[startsOn,endsOn]);
  if(overlap.rowCount){sendJson(response,409,{ok:false,message:`Las fechas se traslapan con ${overlap.rows[0].name}.`});return}
  try{
    const result=await database.query("insert into public.periods(name,starts_on,ends_on,active) values($1,$2::date,$3::date,true) returning id,name,starts_on,ends_on,active",[name,startsOn,endsOn]);
    sendJson(response,201,{ok:true,period:result.rows[0]});
  }catch(error){if(error.code==='23505'){sendJson(response,409,{ok:false,message:"Ya existe un cuatrimestre con ese nombre."});return}throw error}
}

async function apiSetPeriodActive(request,response,periodId){
  if(!requireAdmin(request,response))return;
  let body;try{body=await readJsonBody(request)}catch(error){sendJson(response,400,{ok:false,message:"Solicitud inválida."});return}
  if(typeof body.active!=="boolean"){sendJson(response,400,{ok:false,message:"Indique el estado del cuatrimestre."});return}
  if(body.active){
    const current=await database.query("select starts_on,ends_on from public.periods where id=$1::uuid",[periodId]);
    if(!current.rowCount){sendJson(response,404,{ok:false,message:"No se encontró el cuatrimestre."});return}
    const overlap=await database.query("select name from public.periods where id<>$1::uuid and active=true and starts_on <= $3::date and ends_on >= $2::date limit 1",[periodId,current.rows[0].starts_on,current.rows[0].ends_on]);
    if(overlap.rowCount){sendJson(response,409,{ok:false,message:`No puede reactivarse porque sus fechas se traslapan con ${overlap.rows[0].name}.`});return}
  }
  const result=await database.query("update public.periods set active=$1,updated_at=now() where id=$2::uuid returning id,name,starts_on,ends_on,active",[body.active,periodId]);
  if(!result.rowCount){sendJson(response,404,{ok:false,message:"No se encontró el cuatrimestre."});return}
  sendJson(response,200,{ok:true,period:result.rows[0]});
}

async function apiAccountSecurity(request, response) {
  const session = requireAdmin(request, response); if (!session) return;
  let body; try { body = await readJsonBody(request); } catch (error) { sendJson(response, 400, { ok:false, code:error.message }); return; }
  const currentPassword=String(body.currentPassword||""), newPassword=String(body.newPassword||""), recoveryCode=String(body.recoveryCode||"");
  if (newPassword && newPassword.length < 8) { sendJson(response,400,{ok:false,message:"La contraseña debe tener al menos 8 caracteres."}); return; }
  if (recoveryCode.length < 10) { sendJson(response,400,{ok:false,message:"La clave de recuperación debe tener al menos 10 caracteres."}); return; }
  const result=await database.query("select password_hash from public.app_users where id=$1 and active=true",[session.id]);
  const user=result.rows[0]; if(!user){sendJson(response,401,{ok:false});return}
  if(user.password_hash && !await bcrypt.compare(currentPassword,user.password_hash)){sendJson(response,401,{ok:false,message:"La contraseña actual es incorrecta."});return}
  const passwordHash=newPassword?await bcrypt.hash(newPassword,12):null;
  const recoveryHash=await bcrypt.hash(recoveryCode,12);
  await database.query("update public.app_users set password_hash=$1,recovery_code_hash=$2 where id=$3",[passwordHash,recoveryHash,session.id]);
  sendJson(response,200,{ok:true,message:newPassword?"Contraseña y recuperación configuradas.":"Acceso sin contraseña y recuperación configurada."});
}

async function apiRecoverAccess(request,response){
  let body; try{body=await readJsonBody(request)}catch(error){sendJson(response,400,{ok:false});return}
  const username=String(body.username||"").trim(), recoveryCode=String(body.recoveryCode||""), newPassword=String(body.newPassword||"");
  if(!username||recoveryCode.length<10||newPassword.length<8){sendJson(response,400,{ok:false,message:"Complete los datos; la contraseña nueva requiere 8 caracteres."});return}
  const result=await database.query("select id,recovery_code_hash from public.app_users where active=true and role='admin' and lower(username::text)=lower($1) limit 1",[username]);
  const user=result.rows[0];
  if(!user||!user.recovery_code_hash||!await bcrypt.compare(recoveryCode,user.recovery_code_hash)){sendJson(response,401,{ok:false,message:"Usuario o clave de recuperación incorrectos."});return}
  const passwordHash=await bcrypt.hash(newPassword,12);
  await database.query("update public.app_users set password_hash=$1,recovery_code_hash=null where id=$2",[passwordHash,user.id]);
  sendJson(response,200,{ok:true,message:"Contraseña restablecida. Ingrese y configure una nueva clave de recuperación."});
}

async function apiCreateUser(request,response){
  if(!requireAdmin(request,response))return;
  let body;try{body=await readJsonBody(request)}catch(error){sendJson(response,400,{ok:false});return}
  const username=String(body.username||"").trim(),fullName=String(body.fullName||"").trim(),password=String(body.password||"");
  if(!username||!fullName){sendJson(response,400,{ok:false,message:"Capture nombre y usuario."});return}
  if(password&&password.length<8){sendJson(response,400,{ok:false,message:"La contraseña debe tener al menos 8 caracteres o quedar vacía."});return}
  const hash=password?await bcrypt.hash(password,12):null;
  try{
    await database.query("insert into public.app_users(username,full_name,password_hash,role,active) values($1,$2,$3,'advisor',true)",[username,fullName,hash]);
    sendJson(response,201,{ok:true});
  }catch(error){if(error.code==='23505'){sendJson(response,409,{ok:false,message:"Ese usuario ya existe."});return}throw error}
}

async function apiSetUserActive(request,response,userId){
  if(!requireAdmin(request,response))return;
  let body;try{body=await readJsonBody(request)}catch(error){sendJson(response,400,{ok:false,message:"Solicitud inválida."});return}
  if(typeof body.active!=="boolean"){sendJson(response,400,{ok:false,message:"Indique el estado de la cuenta."});return}
  const result=await database.query("update public.app_users set active=$1 where id=$2::uuid and role='advisor' returning username::text as usuario, active as activo",[body.active,userId]);
  if(!result.rowCount){sendJson(response,404,{ok:false,message:"No se encontró la cuenta del asesor."});return}
  sendJson(response,200,{ok:true,user:result.rows[0]});
}

function requireSession(request, response) {
  const session = readSession(request);
  if (!session) sendJson(response, 401, { ok: false, code: "unauthorized", message: "La sesión no es válida." });
  return session;
}

function advisoryRow(row) {
  return {
    id: row.id,
    matricula: row.enrollment,
    nombre: row.student_name,
    sexo: row.sex,
    carrera: row.career_code,
    grupo: row.group_name,
    turno: row.shift,
    materia: row.subject_name,
    motivo: row.reason_name,
    comentarios: row.comments || "",
    psico: row.referred_to_psychopedagogy ? "Sí" : "No",
    asesor: row.advisor_username,
    periodo: row.period_name,
    inicioIso: row.started_at,
    finIso: row.ended_at,
    duracionMinutos: row.duration_minutes,
    estado: row.status,
    creado: row.created_at
  };
}

async function apiFindStudent(request, response, enrollment) {
  if (!requireSession(request, response)) return;
  const result = await database.query(`
    select s.enrollment::text, s.full_name, s.sex, s.shift,
           c.code::text as career, g.name::text as group_name
      from public.students s
      join public.careers c on c.id = s.career_id
      join public.student_groups g on g.id = s.group_id
     where s.active = true and lower(s.enrollment::text) = lower($1)
     limit 1
  `, [enrollment]);
  sendJson(response, 200, { ok: true, student: result.rows[0] || null });
}

async function apiListAdvisories(request, response, session) {
  const result = await database.query(`
    select a.id, s.enrollment::text, s.full_name as student_name, s.sex, s.shift,
           c.code::text as career_code, g.name::text as group_name,
           sub.name::text as subject_name, r.name::text as reason_name,
           p.name as period_name, u.username::text as advisor_username,
           a.comments, a.referred_to_psychopedagogy, a.started_at, a.ended_at,
           a.duration_minutes, a.status, a.created_at
      from public.advisories a
      join public.students s on s.id = a.student_id
      join public.careers c on c.id = s.career_id
      join public.student_groups g on g.id = s.group_id
      join public.subjects sub on sub.id = a.subject_id
      join public.advisory_reasons r on r.id = a.reason_id
      join public.periods p on p.id = a.period_id
      join public.app_users u on u.id = a.advisor_id
     where ($2::boolean or a.advisor_id = $1::uuid)
     order by a.started_at desc
     limit 1000
  `, [session.id, session.rol === "admin"]);
  sendJson(response, 200, { ok: true, advisories: result.rows.map(advisoryRow) });
}

async function apiCreateAdvisory(request, response, session) {
  let body;
  try { body = await readJsonBody(request, 32768); }
  catch (error) { sendJson(response, 400, { ok: false, code: error.message }); return; }

  const data = {
    enrollment: String(body.matricula || "").trim(),
    fullName: String(body.nombre || "").trim(),
    sex: String(body.sexo || "").trim(),
    career: String(body.carrera || "").trim(),
    group: String(body.grupo || "").trim(),
    shift: String(body.turno || "").trim(),
    subject: String(body.materia || "").trim(),
    reason: String(body.motivo || "").trim(),
    comments: String(body.comentarios || "").trim(),
    referred: body.psico === true || body.psico === "Sí" || body.psico === "Si",
    period: String(body.periodo || "").trim(),
    startedAt: new Date(body.inicio),
    endedAt: new Date(body.fin)
  };
  const requiredText = [data.enrollment, data.fullName, data.sex, data.career, data.group, data.shift, data.subject, data.reason, data.period];
  if (requiredText.some(value => !value || value === "Seleccione") || Number.isNaN(data.startedAt.getTime()) || Number.isNaN(data.endedAt.getTime())) {
    sendJson(response, 400, { ok: false, code: "invalid_advisory", message: "Faltan datos obligatorios de la asesoría." }); return;
  }
  if (!['Hombre', 'Mujer'].includes(data.sex) || !['Matutino', 'Vespertino'].includes(data.shift) || data.endedAt < data.startedAt) {
    sendJson(response, 400, { ok: false, code: "invalid_advisory", message: "Los datos de la asesoría no son válidos." }); return;
  }

  const client = await database.connect();
  try {
    await client.query("begin");
    const group = await client.query(`
      select g.id, c.id as career_id
        from public.student_groups g
        join public.careers c on c.id = g.career_id
       where g.active = true
         and c.active = true
         and lower(trim(c.code::text)) = lower(trim($1))
         and lower(trim(g.name::text)) = lower(trim($2))
       limit 1
    `, [data.career, data.group]);
    if (!group.rows[0]) {
      throw Object.assign(new Error("invalid_group_for_career"), {
        statusCode: 400,
        publicMessage: `El grupo "${data.group}" no está activo o no pertenece a la carrera "${data.career}".`
      });
    }

    const catalogs = await client.query(`
      select
        (select id from public.subjects where active = true and lower(trim(name::text)) = lower(trim($1)) limit 1) as subject_id,
        (select id from public.advisory_reasons where active = true and lower(trim(name::text)) = lower(trim($2)) limit 1) as reason_id,
        (select id from public.periods where active = true and lower(trim(name)) = lower(trim($3)) limit 1) as period_id
    `, [data.subject, data.reason, data.period]);
    const ids = catalogs.rows[0];
    if (!ids.subject_id) throw Object.assign(new Error("invalid_subject"), { statusCode: 400, publicMessage: "La materia seleccionada ya no está activa. Actualice la página y selecciónela nuevamente." });
    if (!ids.reason_id) throw Object.assign(new Error("invalid_reason"), { statusCode: 400, publicMessage: "El motivo seleccionado ya no está activo. Actualice la página y selecciónelo nuevamente." });
    if (!ids.period_id) throw Object.assign(new Error("invalid_period"), { statusCode: 400, publicMessage: "El cuatrimestre seleccionado ya no está activo. Actualice la página antes de registrar la asesoría." });

    const student = await client.query(`
      insert into public.students (enrollment, full_name, sex, career_id, group_id, shift, active)
      values ($1, $2, $3, $4, $5, $6, true)
      on conflict (enrollment) do update set
        full_name = excluded.full_name, sex = excluded.sex, career_id = excluded.career_id,
        group_id = excluded.group_id, shift = excluded.shift, active = true
      returning id
    `, [data.enrollment, data.fullName, data.sex, group.rows[0].career_id, group.rows[0].id, data.shift]);
    const duration = Math.max(0, Math.round((data.endedAt - data.startedAt) / 60000));
    const inserted = await client.query(`
      insert into public.advisories
        (student_id, advisor_id, subject_id, reason_id, period_id, comments,
         referred_to_psychopedagogy, started_at, ended_at, duration_minutes, status)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'FINALIZADA')
      returning id
    `, [student.rows[0].id, session.id, ids.subject_id, ids.reason_id, ids.period_id,
        data.comments, data.referred, data.startedAt.toISOString(), data.endedAt.toISOString(), duration]);
    await client.query("commit");
    sendJson(response, 201, { ok: true, id: inserted.rows[0].id });
  } catch (error) {
    await client.query("rollback");
    if (error.statusCode === 400) {
      sendJson(response, 400, {
        ok: false,
        code: error.message,
        message: error.publicMessage || "Revise los datos de la asesoría e intente nuevamente."
      });
      return;
    }
    throw error;
  } finally {
    client.release();
  }
}

async function databaseHealth() {
  if (!database) {
    return {
      statusCode: 503,
      body: {
        ok: false,
        app: "sistema-tutorias",
        database: "not_configured",
        message: "Falta configurar DATABASE_URL en Render."
      }
    };
  }

  try {
    const result = await database.query(`
      select
        current_database() as database_name,
        (select count(*)::int from public.app_users) as users,
        (select count(*)::int from public.careers) as careers,
        (select count(*)::int from public.student_groups) as student_groups,
        (select count(*)::int from public.subjects) as subjects,
        (select count(*)::int from public.advisory_reasons) as advisory_reasons,
        (select count(*)::int from public.periods) as periods,
        (select count(*)::int from public.students) as students,
        (select count(*)::int from public.advisories) as advisories
    `);

    return {
      statusCode: 200,
      body: {
        ok: true,
        app: "sistema-tutorias",
        database: "connected",
        catalogs: result.rows[0]
      }
    };
  } catch (error) {
    console.error("No fue posible comprobar PostgreSQL:", error.message);
    return {
      statusCode: 503,
      body: {
        ok: false,
        app: "sistema-tutorias",
        database: "connection_failed",
        message: "No fue posible conectar con PostgreSQL. Revise DATABASE_URL."
      }
    };
  }
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, "http://localhost");
  if (requestUrl.pathname === "/api/health") {
    if (request.method !== "GET" && request.method !== "HEAD") { sendJson(response, 405, { ok: false }); return; }
    const result = await databaseHealth();
    sendJson(response, result.statusCode, result.body, request.method === "HEAD");
    return;
  }

  if (requestUrl.pathname === "/api/bootstrap") {
    if (request.method !== "GET") { sendJson(response, 405, { ok: false }); return; }
    if (!database) { sendJson(response, 503, { ok: false, code: "database_not_configured" }); return; }
    try { sendJson(response, 200, { ok: true, data: await getBootstrap() }); }
    catch (error) { console.error("Error al cargar catálogos:", error.message); sendJson(response, 503, { ok: false, code: "database_error" }); }
    return;
  }

  if (requestUrl.pathname === "/api/login") {
    if (request.method !== "POST") { sendJson(response, 405, { ok: false }); return; }
    try { await apiLogin(request, response); }
    catch (error) { console.error("Error de inicio de sesión:", error.message); sendJson(response, 503, { ok: false, code: "database_error" }); }
    return;
  }

  if (requestUrl.pathname === "/api/session") {
    if (request.method !== "GET") { sendJson(response, 405, { ok: false }); return; }
    const session = readSession(request);
    const valid=session&&await isActiveAdvisorSession(session);
    sendJson(response, valid ? 200 : 401, valid ? { ok: true, user: session } : { ok: false });
    return;
  }

  if (requestUrl.pathname === "/api/admin/session") {
    if (request.method !== "GET") { sendJson(response, 405, { ok: false }); return; }
    const session = readSession(request, "admin_session");
    sendJson(response, session && session.rol === "admin" ? 200 : 401, session && session.rol === "admin" ? { ok:true,user:session } : { ok:false });
    return;
  }

  if (requestUrl.pathname === "/api/admin/data") {
    if (request.method !== "GET") { sendJson(response,405,{ok:false}); return; }
    if (!database) { sendJson(response,503,{ok:false,code:"database_not_configured"}); return; }
    try { await apiAdminData(request,response); } catch(error) { console.error("Error administrativo:",error.message); sendJson(response,503,{ok:false,code:"database_error"}); }
    return;
  }

  if (requestUrl.pathname === "/api/admin/security") {
    if (request.method !== "POST") { sendJson(response,405,{ok:false}); return; }
    if (!database) { sendJson(response,503,{ok:false}); return; }
    try { await apiAccountSecurity(request,response); } catch(error) { console.error("Error de seguridad:",error.message); sendJson(response,503,{ok:false}); }
    return;
  }

  if (requestUrl.pathname === "/api/admin/recover") {
    if (request.method !== "POST") { sendJson(response,405,{ok:false}); return; }
    if (!database) { sendJson(response,503,{ok:false}); return; }
    try { await apiRecoverAccess(request,response); } catch(error) { console.error("Error de recuperación:",error.message); sendJson(response,503,{ok:false}); }
    return;
  }

  if (requestUrl.pathname === "/api/admin/users") {
    if (request.method !== "POST") { sendJson(response,405,{ok:false}); return; }
    if (!database) { sendJson(response,503,{ok:false}); return; }
    try { await apiCreateUser(request,response); } catch(error) { console.error("Error al crear usuario:",error.message); sendJson(response,503,{ok:false}); }
    return;
  }

  if (requestUrl.pathname === "/api/admin/periods") {
    if (request.method !== "POST") { sendJson(response,405,{ok:false}); return; }
    if (!database) { sendJson(response,503,{ok:false}); return; }
    try { await apiCreatePeriod(request,response); } catch(error) { console.error("Error al crear cuatrimestre:",error.message); sendJson(response,503,{ok:false,message:"No fue posible guardar el cuatrimestre."}); }
    return;
  }

  if (requestUrl.pathname === "/api/admin/groups") {
    if (request.method !== "POST") { sendJson(response,405,{ok:false}); return; }
    if (!database) { sendJson(response,503,{ok:false}); return; }
    try { await apiCreateGroup(request,response); } catch(error) { console.error("Error al crear grupo:",error.message); sendJson(response,503,{ok:false,message:"No fue posible guardar el grupo."}); }
    return;
  }

  const adminGroupActiveMatch=requestUrl.pathname.match(/^\/api\/admin\/groups\/([^/]+)\/active$/);
  if(adminGroupActiveMatch){
    if(request.method!=="PATCH"){sendJson(response,405,{ok:false});return}
    if(!database){sendJson(response,503,{ok:false});return}
    try{await apiSetGroupActive(request,response,decodeURIComponent(adminGroupActiveMatch[1]));}
    catch(error){console.error("Error al cambiar estado del grupo:",error.message);sendJson(response,503,{ok:false,message:"No fue posible actualizar el grupo."});}
    return;
  }

  const adminPeriodActiveMatch=requestUrl.pathname.match(/^\/api\/admin\/periods\/([^/]+)\/active$/);
  if(adminPeriodActiveMatch){
    if(request.method!=="PATCH"){sendJson(response,405,{ok:false});return}
    if(!database){sendJson(response,503,{ok:false});return}
    try{await apiSetPeriodActive(request,response,decodeURIComponent(adminPeriodActiveMatch[1]));}
    catch(error){console.error("Error al cambiar estado del cuatrimestre:",error.message);sendJson(response,503,{ok:false,message:"No fue posible actualizar el cuatrimestre."});}
    return;
  }

  const adminUserActiveMatch=requestUrl.pathname.match(/^\/api\/admin\/users\/([^/]+)\/active$/);
  if(adminUserActiveMatch){
    if(request.method!=="PATCH"){sendJson(response,405,{ok:false});return}
    if(!database){sendJson(response,503,{ok:false});return}
    try{await apiSetUserActive(request,response,decodeURIComponent(adminUserActiveMatch[1]));}
    catch(error){console.error("Error al cambiar estado del asesor:",error.message);sendJson(response,503,{ok:false,message:"No fue posible actualizar la cuenta."});}
    return;
  }

  if (requestUrl.pathname === "/api/logout") {
    if (request.method !== "POST") { sendJson(response, 405, { ok: false }); return; }
    response.setHeader("Set-Cookie", "advisor_session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax");
    sendJson(response, 200, { ok: true });
    return;
  }

  if (requestUrl.pathname === "/api/admin/logout") {
    if (request.method !== "POST") { sendJson(response,405,{ok:false}); return; }
    response.setHeader("Set-Cookie", "admin_session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax");
    sendJson(response,200,{ok:true}); return;
  }

  const studentMatch = requestUrl.pathname.match(/^\/api\/students\/([^/]+)$/);
  if (studentMatch) {
    if (request.method !== "GET") { sendJson(response, 405, { ok: false }); return; }
    if (!database) { sendJson(response, 503, { ok: false, code: "database_not_configured" }); return; }
    try { await apiFindStudent(request, response, decodeURIComponent(studentMatch[1])); }
    catch (error) { console.error("Error al buscar alumno:", error.message); sendJson(response, 503, { ok: false, code: "database_error" }); }
    return;
  }

  if (requestUrl.pathname === "/api/advisories") {
    if (!database) { sendJson(response, 503, { ok: false, code: "database_not_configured" }); return; }
    const session = requireSession(request, response);
    if (!session) return;
    if(!await isActiveAdvisorSession(session)){sendJson(response,403,{ok:false,code:"inactive_account",message:"La cuenta del asesor está inactiva."});return}
    try {
      if (request.method === "GET") await apiListAdvisories(request, response, session);
      else if (request.method === "POST") await apiCreateAdvisory(request, response, session);
      else sendJson(response, 405, { ok: false });
    } catch (error) {
      console.error("Error en asesorías:", error.message);
      sendJson(response, 503, { ok: false, code: "database_error", message: "No fue posible comunicarse con PostgreSQL." });
    }
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end("Método no permitido");
    return;
  }

  let filePath;
  try {
    filePath = resolveRequestPath(request.url);
  } catch (error) {
    response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Solicitud no válida");
    return;
  }

  if (!filePath) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Acceso no permitido");
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Archivo no encontrado");
      return;
    }

    const contentType = MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    response.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-cache"
    });

    if (request.method === "HEAD") {
      response.end();
      return;
    }

    fs.createReadStream(filePath).pipe(response);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Sistema de asesorías disponible en el puerto ${PORT}`);
});

async function shutdown() {
  server.close(async () => {
    if (database) await database.end();
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
