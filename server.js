// DEPENDENCIAS Y CONFIGURACIÓN: servidor HTTP, archivos, criptografía, PostgreSQL y variables de entorno.
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const {positiveInteger}=require("./lib/pagination");
const {resolveDraftPeriod}=require("./lib/draft-period");

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = __dirname;
const DATABASE_URL = process.env.DATABASE_URL || "";
const SESSION_SECRET = process.env.SESSION_SECRET || "";
const SESSION_MAX_AGE_SECONDS = Math.max(900, Number(process.env.SESSION_MAX_AGE_SECONDS) || 43200);
const TRUST_PROXY_HTTPS = process.env.NODE_ENV === "production";
const loginAttempts = new Map();
if (process.env.NODE_ENV === "production" && SESSION_SECRET.length < 32) {
  console.error("SESSION_SECRET debe contener al menos 32 caracteres en producción.");
  process.exit(1);
}
const effectiveSessionSecret = SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const database = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL ? (() => { const u = new URL(DATABASE_URL); for (const k of ["sslmode","sslcert","sslkey","sslrootcert","ssl"]) u.searchParams.delete(k); return u.toString(); })() : "",
      ssl: { rejectUnauthorized: true, ...(process.env.DATABASE_CA_CERT ? { ca: process.env.DATABASE_CA_CERT.replace(/\\n/g, "\n") } : {}) },
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      statement_timeout: 25000,
      lock_timeout: 10000,
      idle_in_transaction_session_timeout: 60000
    })
  : null;
// pg emite errores de clientes inactivos fuera de las solicitudes HTTP.
if (database) database.on('error', error => {
  console.error('Error de conexión inactiva del pool PostgreSQL:', error.code || 'unknown');
});
let schemaCapabilitiesPromise = null;

async function schemaCapabilities() {
  if (!database) throw new Error("database_not_configured");
  if (!schemaCapabilitiesPromise) {
    schemaCapabilitiesPromise = database.query(`
      select exists(
        select 1 from information_schema.columns
         where table_schema='public' and table_name='app_users' and column_name='session_version'
      ) as session_version
    `).then(result => ({ sessionVersion: result.rows[0]?.session_version === true }))
      .catch(error => {
        schemaCapabilitiesPromise = null;
        console.warn('No fue posible comprobar la versión del esquema:', error.message);
        throw error;
      });
  }
  return schemaCapabilitiesPromise;
}

// BEGIN HTTP UTILITIES (inline, no external local module)
function createHttpUtilities(PUBLIC_DIR, TRUST_PROXY_HTTPS) {
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
const PUBLIC_FILES = new Set(["index.html","admin.html","styles.css","app.js","admin.js","exceljs.min.js","favicon.ico","logo-bis-universities.png","logo-iehl.jpg"]);

// ARCHIVOS PÚBLICOS Y RESPUESTAS: resuelve rutas permitidas y construye respuestas HTTP/JSON.
function resolveRequestPath(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl, "http://localhost").pathname);
  const requestedFile = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  if (!PUBLIC_FILES.has(requestedFile) && !requestedFile.startsWith("assets/")) return null;
  const absolutePath = path.resolve(PUBLIC_DIR, requestedFile);
  return absolutePath.startsWith(PUBLIC_DIR + path.sep) ? absolutePath : null;
}

function sendJson(response, statusCode, body, headOnly = false, request = null) {
  let payload = JSON.stringify(body);
  const encoding = String(request?.headers?.["accept-encoding"] || "");
  const gzip = !headOnly && Buffer.byteLength(payload) >= 16384 && encoding.split(",").some(part=>{const [name,...params]=part.trim().split(";");return name.toLowerCase()==="gzip" && !params.some(p=>/^\s*q\s*=\s*0(?:\.0+)?\s*$/i.test(p))});
  const write = (payload, compressed) => {
  if(response.destroyed || response.writableEnded) return;
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(payload),
    ...(request ? {Vary:'Accept-Encoding'} : {}),
    ...(compressed ? {'Content-Encoding':'gzip'} : {})
  });
  response.end(headOnly ? undefined : payload);
  };
  if (!gzip) return write(payload, false);
  return new Promise((resolve,reject)=>{
    require('node:zlib').gzip(payload,(error,compressed)=>{
      try { write(error ? payload : compressed, !error); resolve(); } catch(e) { reject(e); }
    });
  });
}

// PROTECCIONES HTTP: encabezados, origen de solicitudes, límite de intentos y bitácora.
function setSecurityHeaders(response) {
  response.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (TRUST_PROXY_HTTPS) response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
}

function requestIp(request) {
  // Solo confiar en el proxy frontal cuando se ha configurado explícitamente.
  const forwarded = process.env.TRUST_PROXY === 'true' ? request.headers['x-forwarded-for'] : null;
  const candidate = String(forwarded || request.socket.remoteAddress || '').split(',')[0].trim();
  const normalized = candidate.startsWith('::ffff:') ? candidate.slice(7) : candidate;
  return require('net').isIP(normalized) ? normalized : '127.0.0.1';
}
function sameOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return true;
  const proto = String(request.headers["x-forwarded-proto"] || (request.socket.encrypted ? "https" : "http")).split(",")[0];
  return origin === `${proto}://${request.headers.host}`;
}
return { MIME_TYPES, resolveRequestPath, sendJson, setSecurityHeaders, requestIp, sameOrigin };
}
// END HTTP UTILITIES
const { MIME_TYPES, resolveRequestPath, sendJson, setSecurityHeaders, requestIp, sameOrigin } = createHttpUtilities(PUBLIC_DIR, TRUST_PROXY_HTTPS);

// PROTECCIONES HTTP: límite de intentos y bitácora.
function loginRateKey(request, username, area) { return crypto.createHash('sha256').update(`${requestIp(request)}|${area}|${String(username).toLowerCase()}`).digest('hex'); }
async function loginBlocked(key) {
  if(database){try{const result=await database.query("select blocked_until>now() as blocked from public.login_attempts where rate_key=$1",[key]);return result.rows[0]?.blocked===true}catch(error){console.warn('Control persistente no disponible:',error.message)}}
  const s=loginAttempts.get(key);if(!s)return false;if(s.blockedUntil>Date.now())return true;if(s.blockedUntil)loginAttempts.delete(key);return false;
}
async function recordLoginFailure(key) {
  if(database){try{await database.query(`insert into public.login_attempts(rate_key,attempts,first_attempt_at,blocked_until,updated_at) values($1,1,now(),null,now()) on conflict(rate_key) do update set attempts=case when public.login_attempts.first_attempt_at<now()-interval '15 minutes' then 1 else public.login_attempts.attempts+1 end,first_attempt_at=case when public.login_attempts.first_attempt_at<now()-interval '15 minutes' then now() else public.login_attempts.first_attempt_at end,blocked_until=case when (case when public.login_attempts.first_attempt_at<now()-interval '15 minutes' then 1 else public.login_attempts.attempts+1 end)>=5 then now()+interval '15 minutes' else null end,updated_at=now()`,[key]);return}catch(error){console.warn('No fue posible persistir el intento:',error.message)}}
  const now=Date.now(),s=loginAttempts.get(key)||{count:0,first:now,blockedUntil:0};if(now-s.first>900000){s.count=0;s.first=now}s.count++;if(s.count>=5)s.blockedUntil=now+900000;loginAttempts.set(key,s);
}
async function clearLoginFailures(key){loginAttempts.delete(key);if(database){try{await database.query('delete from public.login_attempts where rate_key=$1',[key])}catch(error){console.warn('No fue posible limpiar intentos:',error.message)}}}
async function audit(request, user, action, entityType=null, entityId=null, details={}) {
  if(!database)return;
  try{await database.query(`insert into public.audit_log(user_id,username,action,entity_type,entity_id,ip_address,details)
    values($1,$2,$3,$4,$5,nullif($6,'')::inet,$7::jsonb)`,[user?.id||null,user?.username||user?.usuario||null,action,entityType,entityId,requestIp(request),JSON.stringify(details)]);}catch(error){console.warn("No fue posible registrar la bitácora:",error.message)}
}

// SESIONES: lectura y firma de cookies, validación de cuentas y límites del cuerpo JSON.
function parseCookies(request) {
  const cookies = {};
  for (const part of String(request.headers.cookie || "").split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key) { try { cookies[key] = decodeURIComponent(value); } catch (_) { /* Cookie dañada: ignorar sin derribar la solicitud. */ } }
  }
  return cookies;
}

function signSession(user) {
  const payload = Buffer.from(JSON.stringify({
    id: user.id,
    usuario: user.username,
    nombre: user.full_name,
    rol: user.role,
    sv: Number(user.session_version)||1,
    jti: crypto.randomUUID(),
    exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", effectiveSessionSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function readSession(request, cookieName = "advisor_session") {
  const token = parseCookies(request)[cookieName];
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  if (!/^[A-Za-z0-9_-]{1,4096}$/.test(payload) || !/^[A-Za-z0-9_-]{43}$/.test(signature)) return null;
  const expected = crypto.createHmac("sha256", effectiveSessionSecret).update(payload).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!(session && typeof session === "object" && typeof session.id === "string" && ["admin","advisor"].includes(session.rol) && Number.isFinite(session.exp) && session.exp > Date.now())) return null;
    // Hash del token firmado, también compatible con cookies anteriores sin jti.
    Object.defineProperty(session, 'tokenHash', {value: crypto.createHash('sha256').update(token).digest('hex')});
    return session;
  } catch (error) {
    return null;
  }
}

async function isSessionRevoked(session) {
  if (!session?.tokenHash) return true;
  const result = await database.query('select 1 from public.revoked_sessions where token_hash=$1 and expires_at>now()', [session.tokenHash]);
  return result.rowCount > 0;
}
async function revokeSession(session) {
  if (!session) return;
  if (!database) throw Error('database_not_configured');
  await database.query('insert into public.revoked_sessions(token_hash,expires_at) values($1,to_timestamp($2::double precision/1000)) on conflict(token_hash) do nothing', [session.tokenHash,session.exp]);
  // Limpieza oportunista, no condiciona la revocación ya confirmada.
  try { await database.query('delete from public.revoked_sessions where expires_at<=now()'); } catch(error) { console.warn('Limpieza de sesiones vencidas pendiente:',error.code||'unknown'); }
}
async function isActiveAdvisorSession(session){
  if(!session||session.rol!=="advisor"||!database)return false;
  const capabilities=await schemaCapabilities();
  const result=capabilities.sessionVersion
    ? await database.query("select 1 from public.app_users where id=$1 and role='advisor' and active=true and session_version=$2",[session.id,session.sv||1])
    : await database.query("select 1 from public.app_users where id=$1 and role='advisor' and active=true",[session.id]);
  return result.rowCount===1 && !await isSessionRevoked(session);
}

function readJsonBody(request, limit = 16384) {
  return new Promise((resolve, reject) => {
    let body = "",settled=false;
    request.setEncoding("utf8");
    request.on("data", chunk => {
      if (settled) return;
      body += chunk;
      if(Buffer.byteLength(body)>limit){settled=true;body="";reject(new Error("payload_too_large"));}
    });
    request.on("end", () => {
      if(settled)return;settled=true;try { resolve(body ? JSON.parse(body) : {}); }
      catch (error) { reject(new Error("invalid_json")); }
    });
    request.on("error", reject);
  });
}

// DATOS INICIALES Y AUTENTICACIÓN: catálogos para Registro e inicio de sesión.
async function getBootstrap(queryable = database) {
  const [institution, periods, careers, groups, subjects, reasons] = await Promise.all([
    queryable.query("select school_name, footer_text, timezone from public.institution_settings where id = true"),
    queryable.query("select id, name, starts_on, ends_on, active from public.periods order by active desc, (current_date between starts_on and ends_on) desc, starts_on desc"),
    queryable.query("select id, code::text, name from public.careers where active = true order by code"),
    queryable.query("select id, name::text, career_id from public.student_groups where active = true order by name"),
    queryable.query("select id, name::text from public.subjects where active = true order by name"),
    queryable.query("select id, name::text from public.advisory_reasons where active = true order by name")
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
  if (!username||username.length>80||password.length>128) { sendJson(response, 400, { ok: false, code: "invalid_credentials_format", message:"Revise el usuario y la contraseña." }); return; }
  const rateKey = loginRateKey(request, username, area);
  if (await loginBlocked(rateKey)) { sendJson(response,429,{ok:false,code:"too_many_attempts",message:"Demasiados intentos. Espere 15 minutos antes de volver a intentar."}); return; }

  const capabilities=await schemaCapabilities();
  const sessionColumn=capabilities.sessionVersion?'session_version':'1 as session_version';
  const result = await database.query(
    `select id, username::text, full_name, password_hash, role, ${sessionColumn} from public.app_users where active = true and lower(username::text) = lower($1) limit 1`,
    [username]
  );
  const user = result.rows[0];
  const validPassword = user && user.password_hash && password && await bcrypt.compare(password, user.password_hash);
  if (!user || !validPassword) {
    await recordLoginFailure(rateKey);
    await audit(request,{username},"LOGIN_FAILED","account",null,{area});
    sendJson(response, 401, { ok: false, code: "invalid_credentials", message: "Usuario o contraseña incorrectos." });
    return;
  }
  if (area === "admin" && user.role !== "admin") { sendJson(response,403,{ok:false,code:"admin_required",message:"Este usuario no tiene permisos de administración."}); return; }
  if (area === "advisor" && user.role !== "advisor") { sendJson(response,403,{ok:false,code:"advisor_required",message:"Este usuario corresponde al área administrativa."}); return; }

  await clearLoginFailures(rateKey);
  await audit(request,user,"LOGIN_SUCCESS","account",user.id,{area});
  await database.query("select token_hash from public.revoked_sessions limit 0");
    // LIMIT 0 valida existencia, columnas y permisos de lectura sin transferir datos.
    await database.query(`select
      (select operation_fingerprint from public.advisories limit 0),
      (select operation_id from public.advisories limit 0),
      (select student_snapshot from public.advisories limit 0),
      (select revision from public.advisory_drafts limit 0),
      (select payload from public.advisory_drafts limit 0),
      (select id from public.app_users limit 0),
      (select id from public.students limit 0),
      (select id from public.careers limit 0),
      (select id from public.student_groups limit 0),
      (select id from public.periods limit 0),
      (select id from public.subjects limit 0),
      (select id from public.advisory_reasons limit 0),
      (select timezone from public.institution_settings limit 0),
      (select id from public.audit_log limit 0)`);
  const token = signSession(user);
  const cookieName = area === "admin" ? "admin_session" : "advisor_session";
  response.setHeader("Set-Cookie", `${cookieName}=${encodeURIComponent(token)}; Max-Age=${SESSION_MAX_AGE_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Strict`);
  sendJson(response, 200, { ok: true, user: { id: user.id, usuario: user.username, nombre: user.full_name, rol: user.role } });
}

// ÁREA ADMINISTRATIVA: autoriza el rol administrador y atiende datos, catálogos y cuentas.
async function requireAdmin(request, response) {
  const session = readSession(request, "admin_session");
  if (!session) { sendJson(response, 401, { ok: false, code: "unauthorized" }); return null; }
  if (session.rol !== "admin") { sendJson(response, 403, { ok: false, code: "admin_required" }); return null; }
  if (!await isActiveAdminSession(session)) { sendJson(response, 403, { ok: false, code: "inactive_account" }); return null; }
  return session;
}

async function isActiveAdminSession(session){
  if(!session||session.rol!=="admin"||!database)return false;
  const capabilities=await schemaCapabilities();
  const result=capabilities.sessionVersion
    ? await database.query("select 1 from public.app_users where id=$1 and role='admin' and active=true and session_version=$2",[session.id,session.sv||1])
    : await database.query("select 1 from public.app_users where id=$1 and role='admin' and active=true",[session.id]);
  return result.rowCount===1 && !await isSessionRevoked(session);
}

// Presupuesto monotónico de transacción: las sentencias comparten un límite,
// incluyendo la espera de conexión. ROLLBACK queda permitido aun si vence.
async function connectTransaction(pool, budgetMs = 45000, clock = () => performance.now()) {
  const deadline = clock() + budgetMs;
  const raw = await pool.connect();
  let tail = Promise.resolve(), failure = null, active = false, released = false;
  const query = (sql, args) => {
    const command = String(sql).trim().toUpperCase();
    const rollback = command === 'ROLLBACK';
    const run = tail.catch(() => {}).then(async () => {
      if (released) throw Error('transaction_released');
      if (rollback) { const result = await raw.query(sql, args); active = false; failure = null; return result; }
      if (failure) throw failure;
      try {
        const remaining = Math.floor(deadline - clock());
        if (remaining <= 0) throw Object.assign(Error('transaction_deadline'), {code:'57014'});
        if (active) await raw.query("select set_config('statement_timeout',$1,true)", [String(Math.min(25000, remaining))]);
        if (clock() >= deadline) throw Object.assign(Error('transaction_deadline'), {code:'57014'});
        const result = await raw.query(sql, args);
        if (command.startsWith('BEGIN')) active = true;
        if (command === 'COMMIT') active = false;
        return result;
      } catch (error) { failure = error; throw error; }
    });
    tail = run;
    return run;
  };
  return {query, release() { if (released) return; released = true; raw.release(active || failure ? Error('transaction_not_clean') : undefined); }};
}

async function apiAdminData(request, response) {
  if (!await requireAdmin(request, response)) return;
  const session = readSession(request, "admin_session");
  const params = new URL(request.url, "http://localhost").searchParams;
  const periodFilter = params.get("period");
  const scopedPeriod = periodFilter && periodFilter !== "all";
  const client = await connectTransaction(database);
  let payload;
  try {
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const [advisories, students, users, bootstrap, periodsAdmin, groupsAdmin, careersAdmin, subjectsAdmin, reasonsAdmin] = await Promise.all([
    (params.get("metadata") === "1" ? Promise.resolve({rows:[]}) : client.query(`
      select a.id, s.enrollment::text, coalesce(a.student_snapshot->>'name',s.full_name) as student_name, coalesce(a.student_snapshot->>'sex',s.sex) as sex, coalesce(a.student_snapshot->>'shift',s.shift) as shift,
             coalesce(a.student_snapshot->>'career',c.code::text) as career_code, coalesce(a.student_snapshot->>'group',g.name::text) as group_name,
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
       where a.status <> 'CANCELADA'
         ${scopedPeriod ? "and p.name=$1" : ""}
       order by a.created_at desc, a.id desc
    `, scopedPeriod ? [periodFilter] : [])),
    client.query(`select s.enrollment::text as matricula, s.full_name as nombre, s.sex as sexo,
                           c.code::text as carrera, g.name::text as grupo, s.shift as turno
                      from public.students s join public.careers c on c.id=s.career_id
                      join public.student_groups g on g.id=s.group_id where s.active=true order by s.full_name`),
    client.query(`select id, username::text as usuario, full_name as nombre, role as rol, active as activo,
                           (password_hash is not null) as "requierePassword",
                           (recovery_code_hash is not null) as "recuperacionConfigurada"
                      from public.app_users order by role, full_name`),
    getBootstrap(client),
    client.query("select id, name, starts_on, ends_on, active from public.periods order by starts_on desc"),
    client.query(`select g.id, g.name::text, g.career_id, g.active, c.code::text as career_code
                      from public.student_groups g left join public.careers c on c.id=g.career_id
                     order by c.code nulls last, g.name`),
    client.query("select id,code::text as code,name,active from public.careers order by code"),
    client.query("select id,name::text,active from public.subjects order by name"),
    client.query("select id,name::text,active from public.advisory_reasons order by name")
  ]);
  await client.query("COMMIT");
  payload = { ok: true, user: session, data: {
    advisories: advisories.rows.map(advisoryRow), students: students.rows, users: users.rows,
    catalogs: bootstrap, periodsAdmin: periodsAdmin.rows, groupsAdmin: groupsAdmin.rows,
    catalogItems: { carreras: careersAdmin.rows, materias: subjectsAdmin.rows, motivos: reasonsAdmin.rows }
  }};
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch (_) {}
    throw error;
  } finally { client.release(); }
  await sendJson(response, 200, payload, false, request);
}

// CONSULTAS ESCALABLES: servicios opcionales para reportes paginados y estadísticas agregadas.
// La respuesta histórica de /api/admin/data se conserva para no alterar la interfaz estable.


async function apiAdminAdvisoriesPage(request, response, requestUrl) {
  if (!await requireAdmin(request, response)) return;
  const limit = Math.max(1, positiveInteger(requestUrl.searchParams.get("limit"), 50, 200));
  const offset = positiveInteger(requestUrl.searchParams.get("offset"), 0, 1000000);
  const filters = ["a.status <> 'CANCELADA'"], values = [];
  const addFilter = (value, sql) => {
    const clean = String(value || "").trim();
    if (!clean || clean === "all") return;
    values.push(clean); filters.push(sql.replace("?", `$${values.length}`));
  };
  addFilter(requestUrl.searchParams.get("period"), "p.name = ?");
  addFilter(requestUrl.searchParams.get("advisor"), "u.username::text = ?");
  addFilter(requestUrl.searchParams.get("career"), "coalesce(a.student_snapshot->>'career',c.code::text) = ?");
  addFilter(requestUrl.searchParams.get("group"), "coalesce(a.student_snapshot->>'group',g.name::text) = ?");
  addFilter(requestUrl.searchParams.get("subject"), "sub.name::text = ?");
  addFilter(requestUrl.searchParams.get("reason"), "r.name::text = ?");
  const search = String(requestUrl.searchParams.get("search") || "").trim();
  if (search) {
    values.push(`%${search}%`);
    filters.push(`(s.enrollment::text ilike $${values.length} or coalesce(a.student_snapshot->>'name',s.full_name) ilike $${values.length})`);
  }
  const cursor=requestUrl.searchParams.get('cursor');
  if(cursor && offset) return sendJson(response,400,{ok:false,code:'mixed_pagination'});
  if((cursor || offset) && !requestUrl.searchParams.get('cutoff'))return sendJson(response,400,{ok:false,code:'cutoff_required'});
  const cutoff=requestUrl.searchParams.get('cutoff')||new Date().toISOString();
  if(!Number.isFinite(Date.parse(cutoff)) || Date.parse(cutoff)>Date.now()+60000)return sendJson(response,400,{ok:false});
  {values.push(cutoff);filters.push(`a.created_at <= $${values.length}::timestamptz`);}
  const baseFilters = filters.slice(), baseValues = values.slice();
  if(cursor){const parts=cursor.split('|');if(parts.length!==2||!Number.isFinite(Date.parse(parts[0]))||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parts[1]))return sendJson(response,400,{ok:false});values.push(...parts);filters.push(`(a.created_at,a.id)<($${values.length-1}::timestamptz,$${values.length}::uuid)`);}
  const countRequested=requestUrl.searchParams.get("count")!=="0";
  values.push(limit+(countRequested?0:1), offset);
  const where = filters.length ? `where ${filters.join(" and ")}` : "";
  const client = await connectTransaction(database);
  let payload;
  try {
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const result = await client.query(`
    select a.id, s.enrollment::text, coalesce(a.student_snapshot->>'name',s.full_name) as student_name, coalesce(a.student_snapshot->>'sex',s.sex) as sex, coalesce(a.student_snapshot->>'shift',s.shift) as shift,
           coalesce(a.student_snapshot->>'career',c.code::text) as career_code, coalesce(a.student_snapshot->>'group',g.name::text) as group_name,
           sub.name::text as subject_name, r.name::text as reason_name,
           p.name as period_name, u.username::text as advisor_username,
           a.comments, a.referred_to_psychopedagogy, a.started_at, a.ended_at,
           a.duration_minutes, a.status, a.created_at, a.created_at::text as cursor_time, ${countRequested ? "count(*) over()::integer" : "null::integer"} as total_count
      from public.advisories a
      join public.students s on s.id=a.student_id
      join public.careers c on c.id=s.career_id
      join public.student_groups g on g.id=s.group_id
      join public.subjects sub on sub.id=a.subject_id
      join public.advisory_reasons r on r.id=a.reason_id
      join public.periods p on p.id=a.period_id
      join public.app_users u on u.id=a.advisor_id
      ${where}
     order by a.created_at desc, a.id desc
     limit $${values.length - 1} offset $${values.length}
  `, values);
  // El conteo de ventana mide las filas restantes desde el cursor.
  const remaining = result.rows[0]?.total_count ?? 0;
  let total = countRequested ? remaining : null;
  if (countRequested && (cursor || !result.rows.length)) {
    const countValues = baseValues;
    const countResult = await client.query(`
      select count(*)::integer as total
        from public.advisories a
        join public.students s on s.id=a.student_id
        join public.careers c on c.id=s.career_id
        join public.student_groups g on g.id=s.group_id
        join public.subjects sub on sub.id=a.subject_id
        join public.advisory_reasons r on r.id=a.reason_id
        join public.periods p on p.id=a.period_id
        join public.app_users u on u.id=a.advisor_id
        where ${baseFilters.join(" and ")}
    `, countValues);
    total = countResult.rows[0]?.total || 0;
  }
  const hasMore=countRequested?offset+result.rows.length<(cursor?remaining:total):result.rows.length>limit;
  if(!countRequested)result.rows=result.rows.slice(0,limit);
  await client.query("COMMIT");
  payload = { ok:true, page:{limit,offset,total,remaining:countRequested?(cursor?remaining:Math.max(0,total-offset)):null,cutoff,nextCursor:result.rows.length?result.rows.at(-1).cursor_time+'|'+result.rows.at(-1).id:null,hasMore}, advisories:result.rows.map(advisoryRow) };
  } catch(error) { try { await client.query("ROLLBACK"); } catch (_) {} throw error; } finally { client.release(); }
  await sendJson(response, 200, payload);
}

async function apiAdminStatistics(request, response, requestUrl) {
  if (!await requireAdmin(request, response)) return;
  const period = String(requestUrl.searchParams.get("period") || "").trim();
  const values = period && period !== "all" ? [period] : [];
  const where = "where a.status <> 'CANCELADA'" + (values.length ? " and p.name=$1" : "");
  const base = `from public.advisories a join public.periods p on p.id=a.period_id`;
  const [summary, bySubject, byReason, byAdvisor, byGroup] = await Promise.all([
    database.query(`select count(*)::integer as sessions,count(distinct a.student_id)::integer as students,count(distinct a.advisor_id)::integer as advisors,coalesce(sum(a.duration_minutes),0)::integer as minutes,count(*) filter(where a.referred_to_psychopedagogy)::integer as referrals ${base} ${where}`, values),
    database.query(`select s.name::text as label,count(*)::integer as sessions,coalesce(sum(a.duration_minutes),0)::integer as minutes ${base} join public.subjects s on s.id=a.subject_id ${where} group by s.name order by minutes desc,label`, values),
    database.query(`select r.name::text as label,count(*)::integer as sessions,coalesce(sum(a.duration_minutes),0)::integer as minutes ${base} join public.advisory_reasons r on r.id=a.reason_id ${where} group by r.name order by minutes desc,label`, values),
    database.query(`select u.username::text as label,count(*)::integer as sessions,coalesce(sum(a.duration_minutes),0)::integer as minutes ${base} join public.app_users u on u.id=a.advisor_id ${where} group by u.username order by minutes desc,label`, values),
    database.query(`select coalesce(a.student_snapshot->>'career',c.code::text) as career,coalesce(a.student_snapshot->>'group',g.name::text) as group_name,count(*)::integer as sessions,coalesce(sum(a.duration_minutes),0)::integer as minutes ${base} join public.students st on st.id=a.student_id join public.careers c on c.id=st.career_id join public.student_groups g on g.id=st.group_id ${where} group by 1,2 order by minutes desc,1,2`, values)
  ]);
  sendJson(response, 200, {ok:true,period:period||"all",summary:summary.rows[0],bySubject:bySubject.rows,byReason:byReason.rows,byAdvisor:byAdvisor.rows,byGroup:byGroup.rows});
}

const simpleCatalogs={carreras:{table:"careers",column:"code",label:"carrera"},materias:{table:"subjects",column:"name",label:"materia"},motivos:{table:"advisory_reasons",column:"name",label:"motivo"}};
async function apiCreateSimpleCatalog(request,response,key){
  const session=await requireAdmin(request,response);if(!session)return;const cfg=simpleCatalogs[key];
  let body;try{body=await readJsonBody(request)}catch(error){sendJson(response,400,{ok:false,message:"Solicitud inválida."});return}
  const name=String(body.name||"").trim();if(!name){sendJson(response,400,{ok:false,message:`Capture la ${cfg.label}.`});return}
  const code=String(body.code||"").trim().toUpperCase();
  if(key==='carreras'&&(!code||code.length>30||name.length>160)){sendJson(response,400,{ok:false,message:"Capture una clave y un nombre completo válidos."});return}
  if(key!=='carreras'&&name.length>160){sendJson(response,400,{ok:false,message:`La ${cfg.label} es demasiado extensa.`});return}
  try{const sql=key==='carreras'?"insert into public.careers(code,name,active) values($1,$2,true) returning id,code::text as code,name,active":`insert into public.${cfg.table}(${cfg.column},active) values($1,true) returning id,${cfg.column}::text as name,active`;const params=key==='carreras'?[code,name]:[name];const result=await database.query(sql,params);await audit(request,session,"CATALOG_CREATED",key,result.rows[0].id,{name,code:code||undefined});sendJson(response,201,{ok:true,item:result.rows[0]})}
  catch(error){if(error.code==='23505'){sendJson(response,409,{ok:false,message:`Ya existe esa ${cfg.label}.`});return}throw error}
}
async function apiSetSimpleCatalogActive(request,response,key,id){
  const session=await requireAdmin(request,response);if(!session)return;const cfg=simpleCatalogs[key];
  let body;try{body=await readJsonBody(request)}catch(error){sendJson(response,400,{ok:false,message:"Solicitud inválida."});return}
  if(typeof body.active!=="boolean"){sendJson(response,400,{ok:false,message:"Indique el estado."});return}
  const returning=key==='carreras'?'id,code::text as code,name,active':`id,${cfg.column}::text as name,active`;
  const result=await database.query(`update public.${cfg.table} set active=$1,updated_at=now() where id=$2::uuid returning ${returning}`,[body.active,id]);
  if(!result.rowCount){sendJson(response,404,{ok:false,message:"No se encontró el registro."});return}await audit(request,session,body.active?"CATALOG_REACTIVATED":"CATALOG_DEACTIVATED",key,id,{});sendJson(response,200,{ok:true,item:result.rows[0]});
}

async function apiCreateGroup(request,response){
  const session=await requireAdmin(request,response);if(!session)return;
  let body;try{body=await readJsonBody(request)}catch(error){sendJson(response,400,{ok:false,message:"Solicitud inválida."});return}
  const name=String(body.name||"").trim(),careerCode=String(body.careerCode||"").trim();
  if(!name||name.length>80||!careerCode||careerCode.length>30){sendJson(response,400,{ok:false,message:"Capture un grupo y una carrera válidos."});return}
  const career=await database.query("select id from public.careers where active=true and lower(code::text)=lower($1) limit 1",[careerCode]);
  if(!career.rowCount){sendJson(response,400,{ok:false,message:"La carrera seleccionada no es válida o está inactiva."});return}
  try{
    const result=await database.query("insert into public.student_groups(name,career_id,active) values($1,$2,true) returning id,name::text,career_id,active",[name,career.rows[0].id]);
    await audit(request,session,"GROUP_CREATED","group",result.rows[0].id,{name,careerCode});sendJson(response,201,{ok:true,group:result.rows[0]});
  }catch(error){if(error.code==='23505'){sendJson(response,409,{ok:false,message:"Ya existe un grupo con ese nombre."});return}throw error}
}

async function apiSetGroupActive(request,response,groupId){
  const session=await requireAdmin(request,response);if(!session)return;
  let body;try{body=await readJsonBody(request)}catch(error){sendJson(response,400,{ok:false,message:"Solicitud inválida."});return}
  if(typeof body.active!=="boolean"){sendJson(response,400,{ok:false,message:"Indique el estado del grupo."});return}
  const result=await database.query("update public.student_groups set active=$1,updated_at=now() where id=$2::uuid returning id,name::text,career_id,active",[body.active,groupId]);
  if(!result.rowCount){sendJson(response,404,{ok:false,message:"No se encontró el grupo."});return}
  await audit(request,session,body.active?"GROUP_REACTIVATED":"GROUP_DEACTIVATED","group",groupId,{name:result.rows[0].name});sendJson(response,200,{ok:true,group:result.rows[0]});
}

async function apiCreatePeriod(request,response){
  const session=await requireAdmin(request,response);if(!session)return;
  let body;try{body=await readJsonBody(request)}catch(error){sendJson(response,400,{ok:false,message:"Solicitud inválida."});return}
  const name=String(body.name||"").trim(),startsOn=String(body.startsOn||""),endsOn=String(body.endsOn||"");
  if(!name||name.length>160||!/^\d{4}-\d{2}-\d{2}$/.test(startsOn)||!/^\d{4}-\d{2}-\d{2}$/.test(endsOn)){sendJson(response,400,{ok:false,message:"Capture un nombre y fechas válidos."});return}
  if(endsOn<startsOn){sendJson(response,400,{ok:false,message:"La fecha final no puede ser anterior a la fecha inicial."});return}
  const overlap=await database.query("select name from public.periods where active=true and starts_on <= $2::date and ends_on >= $1::date limit 1",[startsOn,endsOn]);
  if(overlap.rowCount){sendJson(response,409,{ok:false,message:`Las fechas se traslapan con ${overlap.rows[0].name}.`});return}
  try{
    const result=await database.query("insert into public.periods(name,starts_on,ends_on,active) values($1,$2::date,$3::date,true) returning id,name,starts_on,ends_on,active",[name,startsOn,endsOn]);
    await audit(request,session,"PERIOD_CREATED","period",result.rows[0].id,{name,startsOn,endsOn});sendJson(response,201,{ok:true,period:result.rows[0]});
  }catch(error){if(error.code==='23505'){sendJson(response,409,{ok:false,message:"Ya existe un cuatrimestre con ese nombre."});return}throw error}
}

async function apiSetPeriodActive(request,response,periodId){
  const session=await requireAdmin(request,response);if(!session)return;
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
  await audit(request,session,body.active?"PERIOD_REACTIVATED":"PERIOD_DEACTIVATED","period",periodId,{name:result.rows[0].name});sendJson(response,200,{ok:true,period:result.rows[0]});
}

// CREDENCIALES ADMINISTRATIVAS: cambio de contraseña y recuperación de acceso.
async function apiAccountSecurity(request, response) {
  const session = await requireAdmin(request, response); if (!session) return;
  let body; try { body = await readJsonBody(request); } catch (error) { sendJson(response, 400, { ok:false, code:error.message }); return; }
  const currentPassword=String(body.currentPassword||""), newPassword=String(body.newPassword||""), recoveryCode=String(body.recoveryCode||"");
  if (newPassword.length < 10||newPassword.length>128) { sendJson(response,400,{ok:false,message:"La contraseña debe contener entre 10 y 128 caracteres."}); return; }
  if (recoveryCode.length < 10||recoveryCode.length>128) { sendJson(response,400,{ok:false,message:"La clave de recuperación debe contener entre 10 y 128 caracteres."}); return; }
  const result=await database.query("select password_hash from public.app_users where id=$1 and active=true",[session.id]);
  const user=result.rows[0]; if(!user){sendJson(response,401,{ok:false});return}
  if(user.password_hash && !await bcrypt.compare(currentPassword,user.password_hash)){sendJson(response,401,{ok:false,message:"La contraseña actual es incorrecta."});return}
  const passwordHash=await bcrypt.hash(newPassword,12);
  const recoveryHash=await bcrypt.hash(recoveryCode,12);
  const capabilities=await schemaCapabilities();
  if(capabilities.sessionVersion)await database.query("update public.app_users set password_hash=$1,recovery_code_hash=$2,session_version=session_version+1 where id=$3",[passwordHash,recoveryHash,session.id]);
  else await database.query("update public.app_users set password_hash=$1,recovery_code_hash=$2 where id=$3",[passwordHash,recoveryHash,session.id]);
  await audit(request,session,"ACCOUNT_SECURITY_CHANGED","account",session.id,{});
  sendJson(response,200,{ok:true,message:"Contraseña y recuperación configuradas."});
}

async function apiRecoverAccess(request,response){
  let body; try{body=await readJsonBody(request)}catch(error){sendJson(response,400,{ok:false});return}
  const username=String(body.username||"").trim(), recoveryCode=String(body.recoveryCode||""), newPassword=String(body.newPassword||"");
  if(!username||username.length>80||recoveryCode.length<10||recoveryCode.length>128||newPassword.length<10||newPassword.length>128){sendJson(response,400,{ok:false,message:"Revise los datos y las longitudes permitidas."});return}
  const rateKey=loginRateKey(request,username,"admin-recovery");
  if(await loginBlocked(rateKey)){sendJson(response,429,{ok:false,code:"too_many_attempts",message:"Demasiados intentos. Espere 15 minutos antes de volver a intentar."});return}
  const result=await database.query("select id,recovery_code_hash from public.app_users where active=true and role='admin' and lower(username::text)=lower($1) limit 1",[username]);
  const user=result.rows[0];
  if(!user||!user.recovery_code_hash||!await bcrypt.compare(recoveryCode,user.recovery_code_hash)){await recordLoginFailure(rateKey);await audit(request,{username},"RECOVERY_FAILED","account",null,{});sendJson(response,401,{ok:false,message:"Usuario o clave de recuperación incorrectos."});return}
  const passwordHash=await bcrypt.hash(newPassword,12);
  const capabilities=await schemaCapabilities();
  if(capabilities.sessionVersion)await database.query("update public.app_users set password_hash=$1,recovery_code_hash=null,session_version=session_version+1 where id=$2",[passwordHash,user.id]);
  else await database.query("update public.app_users set password_hash=$1,recovery_code_hash=null where id=$2",[passwordHash,user.id]);
  await clearLoginFailures(rateKey);await audit(request,{id:user.id,username},"RECOVERY_SUCCESS","account",user.id,{});
  sendJson(response,200,{ok:true,message:"Contraseña restablecida. Ingrese y configure una nueva clave de recuperación."});
}

async function apiCreateUser(request,response){
  if(!await requireAdmin(request,response))return;
  let body;try{body=await readJsonBody(request)}catch(error){sendJson(response,400,{ok:false});return}
  const username=String(body.username||"").trim(),fullName=String(body.fullName||"").trim(),password=String(body.password||"");
  if(!username||username.length>80||!fullName||fullName.length>160){sendJson(response,400,{ok:false,message:"Capture nombre y usuario con longitudes válidas."});return}
  if(password.length<10||password.length>128){sendJson(response,400,{ok:false,message:"La contraseña debe contener entre 10 y 128 caracteres."});return}
  const hash=await bcrypt.hash(password,12);
  try{
    const created=await database.query("insert into public.app_users(username,full_name,password_hash,role,active) values($1,$2,$3,'advisor',true) returning id",[username,fullName,hash]);
    await audit(request,readSession(request,'admin_session'),"ADVISOR_CREATED","account",created.rows[0].id,{username});
    sendJson(response,201,{ok:true});
  }catch(error){if(error.code==='23505'){sendJson(response,409,{ok:false,message:"Ese usuario ya existe."});return}throw error}
}

async function apiSetUserActive(request,response,userId){
  if(!await requireAdmin(request,response))return;
  let body;try{body=await readJsonBody(request)}catch(error){sendJson(response,400,{ok:false,message:"Solicitud inválida."});return}
  if(typeof body.active!=="boolean"){sendJson(response,400,{ok:false,message:"Indique el estado de la cuenta."});return}
  const capabilities=await schemaCapabilities();
  const result=capabilities.sessionVersion
    ? await database.query("update public.app_users set active=$1,session_version=case when $1=false then session_version+1 else session_version end where id=$2::uuid and role='advisor' returning username::text as usuario, active as activo",[body.active,userId])
    : await database.query("update public.app_users set active=$1 where id=$2::uuid and role='advisor' returning username::text as usuario, active as activo",[body.active,userId]);
  if(!result.rowCount){sendJson(response,404,{ok:false,message:"No se encontró la cuenta del asesor."});return}
  await audit(request,readSession(request,'admin_session'),body.active?"ADVISOR_REACTIVATED":"ADVISOR_DEACTIVATED","account",userId,{username:result.rows[0].usuario});sendJson(response,200,{ok:true,user:result.rows[0]});
}

// REGISTRO DE ASESORÍAS: autorización, búsqueda de alumnos, consulta y alta de asesorías.
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

async function apiFindStudent(request, response, searchTerm) {
  const session = requireSession(request, response);
  if (!session) return;
  if (!await isActiveAdvisorSession(session)) return sendJson(response,403,{ok:false,code:"inactive_account"});
  const term = String(searchTerm || "").trim();
  if (!term) return sendJson(response, 200, { ok: true, student: null, matches: [] });
  const result = await database.query(`
    select s.enrollment::text, s.full_name, s.sex, s.shift,
           c.code::text as career, g.name::text as group_name,
           (select sub.name::text from public.advisories a
              join public.subjects sub on sub.id = a.subject_id
             where a.student_id = s.id and a.status = 'FINALIZADA'
             order by a.ended_at desc, a.created_at desc, a.id desc limit 1) as last_subject
      from public.students s
      join public.careers c on c.id = s.career_id
      join public.student_groups g on g.id = s.group_id
     where s.active = true
       and (lower(s.enrollment::text) = lower($1)
            or s.full_name ilike ('%' || $1 || '%'))
     order by case when lower(s.enrollment::text) = lower($1) then 0 else 1 end,
              s.full_name
     limit 20
  `, [term]);
  const matches = result.rows || [];
  if (matches.length === 1) return sendJson(response, 200, { ok: true, student: matches[0], matches });
  sendJson(response, 200, { ok: true, student: null, matches });
}

async function apiListAdvisories(request, response, session) {
  const result = await database.query(`
    select a.id, s.enrollment::text, coalesce(a.student_snapshot->>'name',s.full_name) as student_name, coalesce(a.student_snapshot->>'sex',s.sex) as sex, coalesce(a.student_snapshot->>'shift',s.shift) as shift,
           coalesce(a.student_snapshot->>'career',c.code::text) as career_code, coalesce(a.student_snapshot->>'group',g.name::text) as group_name,
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
     where ($2::boolean or a.advisor_id = $1::uuid) and a.status <> 'CANCELADA'
     order by a.started_at desc
  `, [session.id, session.rol === "admin"]);
  sendJson(response, 200, { ok: true, advisories: result.rows.map(advisoryRow) });
}

// Borrador privado por asesor. La operación finalizada nunca se vuelve a abrir.
async function apiDraft(request,response,session){
  if(request.method==='GET'){
    const op=new URL(request.url||'/','http://localhost').searchParams.get('operationId');
    const r=await database.query(`select d.payload,d.revision,exists(select 1 from public.advisories where advisor_id=$1 and operation_id::text=$2) as completed,exists(select 1 from public.audit_log where user_id=$1 and action='DRAFT_DISCARDED' and entity_id=$2) as discarded from (select 1) seed left join public.advisory_drafts d on d.advisor_id=$1 and not exists(select 1 from public.advisories a where a.advisor_id=d.advisor_id and a.operation_id=d.operation_id)`,[session.id,op]);
    const row=r.rows[0]||{};return sendJson(response,200,{ok:true,completed:!!row.completed,discarded:!!row.discarded,draft:row.payload?{...row.payload,revision:row.revision||0}:null});
  }
  if(!['PUT','DELETE'].includes(request.method))return sendJson(response,405,{ok:false});
  const b=await readJsonBody(request,32768).catch(()=>null);
  if(!b||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(b.operationId||'')||(request.method==='PUT'&&(!Number.isFinite(Date.parse(b.start))||!b.fields||typeof b.fields!=='object')))return sendJson(response,400,{ok:false});
  const fields={};for(const k of ['matricula','nombre','sexo','carrera','grupo','turno','materia','motivo','psico','comentarios'])fields[k]=String(b.fields?.[k]||'').slice(0,2000);
  const payload={operationId:b.operationId,start:b.start,fields,newStudent:!!b.newStudent,manualCatalogUsed:!!b.manualCatalogUsed,newSubject:!!b.newSubject,activeCorrection:b.activeCorrection||null,manualEnd:b.manualEnd||null,period:b.period||null,periodId:b.periodId||null};
  const c=await connectTransaction(database);try{await c.query('begin');await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[session.id+':draft']);
    const done=await c.query('select id from public.advisories where advisor_id=$1 and operation_id=$2',[session.id,b.operationId]);
    if(done.rows.length){await c.query('commit');return sendJson(response,200,{ok:true,completed:true});}
    const old=(await c.query('select operation_id,revision,payload from public.advisory_drafts where advisor_id=$1 for update',[session.id])).rows[0];
    const cancelled=await c.query("select 1 from public.audit_log where user_id=$1 and action='DRAFT_DISCARDED' and entity_id=$2",[session.id,b.operationId]);
    if(cancelled.rowCount){await c.query('commit');return sendJson(response,409,{ok:false,discarded:true});}
    if(!Number.isSafeInteger(Number(b.revision||0))||Number(b.revision||0)<0||(!old&&Number(b.revision||0)!==0)||(old&&(old.operation_id!==b.operationId||Number(old.revision)!==Number(b.revision||0)))){await c.query('rollback');return sendJson(response,409,{ok:false,code:'draft_conflict'});}
    if(request.method==='DELETE'){
      await c.query("insert into public.audit_log(user_id,username,action,entity_type,entity_id,details) values($1,$2,'DRAFT_DISCARDED','draft',$3,'{}'::jsonb)",[session.id,session.usuario,b.operationId]);
      await c.query('delete from public.advisory_drafts where advisor_id=$1 and operation_id=$2',[session.id,b.operationId]);
      await c.query('commit');return sendJson(response,200,{ok:true});
    }
    const period=await resolveDraftPeriod(c,payload,old?.payload);
    if(!period){await c.query('rollback');return sendJson(response,400,{ok:false,code:'ambiguous_period',message:'No existe un cuatrimestre inequívoco para la fecha original del borrador.'});}
    payload.period=period.name;payload.periodId=period.id;
    const r=await c.query(`insert into public.advisory_drafts(advisor_id,operation_id,payload,revision) values($1,$2,$3::jsonb,1) on conflict(advisor_id) do update set payload=excluded.payload,updated_at=now(),revision=advisory_drafts.revision+1 returning revision`,[session.id,b.operationId,JSON.stringify(payload)]);
    await c.query('commit');return sendJson(response,200,{ok:true,revision:r.rows[0].revision,period:payload.period,periodId:payload.periodId});
  }catch(e){await c.query('rollback');throw e}finally{c.release()}
}

// Alta explícita de materia dentro de la transacción de la asesoría.
async function ensureAdvisorySubject(client,session,name){
  if(!name||name==='Seleccione'||name.length>160) throw Object.assign(new Error('invalid_subject'),{statusCode:400,publicMessage:'Capture una materia válida.'});
  const existing=await client.query('select id,active from public.subjects where name=$1',[name]);
  if(existing.rows[0]){if(!existing.rows[0].active)throw Object.assign(new Error('inactive_subject'),{statusCode:400,publicMessage:'La materia está inactiva. Solicite su reactivación a Administración.'});return;}
  const inserted=await client.query('insert into public.subjects(name,active) values($1,true) on conflict(name) do nothing returning id',[name]);
  if(inserted.rows[0])await client.query('insert into public.audit_log(user_id,username,action,entity_type,entity_id,details) values($1,$2,$3,$4,$5,$6::jsonb)',[session.id,session.usuario,'CATALOG_CREATED','materias',inserted.rows[0].id,JSON.stringify({name})]);
  const verified=await client.query('select id from public.subjects where name=$1 and active=true',[name]);
  if(!verified.rowCount)throw Object.assign(new Error('inactive_subject'),{statusCode:400,publicMessage:'La materia no está activa.'});
}

function matchesFinalDraft(payload, body) {
  if (!payload || !payload.fields || !payload.manualEnd) return false;
  const keys=['matricula','nombre','sexo','carrera','grupo','turno','materia','motivo','psico','comentarios'];
  const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
  return keys.every(k=>String(payload.fields[k]??'').trim()===String(body[k]??'').trim()) &&
    Number.isFinite(Date.parse(payload.start)) && Date.parse(payload.start)===Date.parse(body.inicio) &&
    Number.isFinite(Date.parse(payload.manualEnd)) && Date.parse(payload.manualEnd)===Date.parse(body.fin) &&
    payload.periodId===body.periodId && payload.period===body.periodo &&
    !!payload.manualCatalogUsed===(body.nuevoCatalogo===true) && !!payload.newSubject===(body.nuevaMateria===true) &&
    JSON.stringify(canonical(payload.activeCorrection||null))===JSON.stringify(canonical(body.activeCorrection||null));
}

async function apiCreateAdvisory(request, response, session) {
  let body;
  try { body = await readJsonBody(request, 32768); }
  catch (error) { sendJson(response, 400, { ok: false, code: error.message }); return; }

  const operationId = String(body.id || "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(operationId)) { sendJson(response,400,{ok:false,message:"Actualice la página antes de guardar."}); return; }
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
  const client = await connectTransaction(database);
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))",[session.id+":"+operationId]);
    await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))",[session.id+":draft"]);
    const existing = await client.query("select id,operation_fingerprint from public.advisories where advisor_id=$1 and operation_id=$2",[session.id,operationId]);
    const legacyFingerprint=require('crypto').createHash('sha256').update(JSON.stringify(data)).digest('hex');
    const fingerprint='v2:'+require('crypto').createHash('sha256').update(JSON.stringify({data,periodId:body.periodId||null,nuevoCatalogo:body.nuevoCatalogo===true,nuevaMateria:body.nuevaMateria===true,activeCorrection:body.activeCorrection||null})).digest('hex');
    if(existing.rows[0]) { if(existing.rows[0].operation_fingerprint&&existing.rows[0].operation_fingerprint!==(existing.rows[0].operation_fingerprint.startsWith('v2:')?fingerprint:legacyFingerprint)){await client.query('commit');return sendJson(response,409,{ok:false,code:'operation_mismatch',message:'La operación ya fue guardada con otros datos. Consulte el historial.'});} await client.query("commit"); sendJson(response,200,{ok:true,id:existing.rows[0].id,replayed:true}); return; }
  const requiredText = [data.enrollment, data.fullName, data.sex, data.career, data.group, data.shift, data.subject, data.reason, data.period];
  if (requiredText.some(value => !value || value === "Seleccione") || Number.isNaN(data.startedAt.getTime()) || Number.isNaN(data.endedAt.getTime())) {
    await client.query("rollback"); sendJson(response, 400, { ok: false, code: "invalid_advisory", message: "Faltan datos obligatorios de la asesoría." }); return;
  }
  if (!['Hombre', 'Mujer'].includes(data.sex) || !['Matutino', 'Vespertino'].includes(data.shift) || data.endedAt < data.startedAt) {
    await client.query("rollback"); sendJson(response, 400, { ok: false, code: "invalid_advisory", message: "Los datos de la asesoría no son válidos." }); return;
  }
  if(data.enrollment.length>40||data.fullName.length>160||data.career.length>30||data.group.length>80||data.subject.length>160||data.reason.length>160||data.period.length>160||data.comments.length>2000){await client.query("rollback");sendJson(response,400,{ok:false,code:"invalid_length",message:"Uno o más datos exceden la longitud permitida."});return}

    const draft=(await client.query('select payload,revision,operation_id from public.advisory_drafts where advisor_id=$1',[session.id])).rows[0];
    if(!draft||draft.operation_id!==operationId||!Number.isSafeInteger(body.revision)||Number(draft.revision)!==body.revision||!matchesFinalDraft(draft.payload,body))throw Object.assign(new Error('draft_conflict'),{statusCode:400,publicMessage:'No existe un respaldo confirmado que coincida con la asesoría. Respalde los datos o recargue antes de guardar.'});
    if((await client.query("select 1 from public.audit_log where user_id=$1 and action='DRAFT_DISCARDED' and entity_id=$2",[session.id,operationId])).rowCount)throw Object.assign(new Error('discarded'),{statusCode:400,publicMessage:'El borrador fue descartado.'});
    const periodId=draft?.payload.periodId||body.periodId||null;
    if (body.nuevoCatalogo === true) await ensureStudentCatalog(client,data.career,data.group);
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

    if(body.nuevaMateria===true) await ensureAdvisorySubject(client,session,data.subject);
    const catalogs = await client.query(`
      select
        (select id from public.subjects where active = true and lower(trim(name::text)) = lower(trim($1)) limit 1) as subject_id,
        (select id from public.advisory_reasons where active = true and lower(trim(name::text)) = lower(trim($2)) limit 1) as reason_id,
        (select id from public.periods where (($4::uuid is not null and id=$4) or ($4::uuid is null and active=true and lower(trim(name))=lower(trim($3)))) limit 1) as period_id,
        (select to_char(starts_on,'YYYY-MM-DD') from public.periods where (($4::uuid is not null and id=$4) or ($4::uuid is null and active=true and lower(trim(name))=lower(trim($3)))) limit 1) as period_start,
        (select to_char(ends_on,'YYYY-MM-DD') from public.periods where (($4::uuid is not null and id=$4) or ($4::uuid is null and active=true and lower(trim(name))=lower(trim($3)))) limit 1) as period_end
    `, [data.subject, data.reason, data.period,periodId]);
    const ids = catalogs.rows[0];
    if (!ids.subject_id) throw Object.assign(new Error("invalid_subject"), { statusCode: 400, publicMessage: "La materia seleccionada ya no está activa. Actualice la página y selecciónela nuevamente." });
    if (!ids.reason_id) throw Object.assign(new Error("invalid_reason"), { statusCode: 400, publicMessage: "El motivo seleccionado ya no está activo. Actualice la página y selecciónelo nuevamente." });
    if (!ids.period_id) throw Object.assign(new Error("invalid_period"), { statusCode: 400, publicMessage: "El cuatrimestre seleccionado ya no está activo. Actualice la página antes de registrar la asesoría." });
    const durationMs=data.endedAt-data.startedAt,now=Date.now();
    if(data.endedAt.getTime()>now+5*60*1000||durationMs>12*60*60*1000){throw Object.assign(new Error("invalid_advisory_time"),{statusCode:400,publicMessage:"La hora de la asesoría no es válida. Revise el reloj del dispositivo y la duración."})}
    const localDates=await client.query(`select (($1::timestamptz at time zone coalesce(i.timezone,'America/Mexico_City'))::date between p.starts_on and p.ends_on) as start_valid,(($2::timestamptz at time zone coalesce(i.timezone,'America/Mexico_City'))::date between p.starts_on and p.ends_on) as end_valid from public.periods p cross join public.institution_settings i where p.id=$3`,[data.startedAt.toISOString(),data.endedAt.toISOString(),ids.period_id]);
    if(!localDates.rows[0]?.start_valid||!localDates.rows[0]?.end_valid){throw Object.assign(new Error("advisory_outside_period"),{statusCode:400,publicMessage:"La fecha local de la asesoría no corresponde al cuatrimestre seleccionado."})}

    await client.query(`insert into public.students (enrollment,full_name,sex,career_id,group_id,shift,active) values ($1,$2,$3,$4,$5,$6,true) on conflict (enrollment) do nothing`,[data.enrollment,data.fullName,data.sex,group.rows[0].career_id,group.rows[0].id,data.shift]);
    const student=await client.query('select id from public.students where enrollment=$1',[data.enrollment]);
    if(!student.rows[0])throw Error('student_not_found');
    const previous = (await client.query('select * from public.students where id=$1 for update',[student.rows[0].id])).rows[0];
    const updated = [data.fullName,data.sex,group.rows[0].career_id,group.rows[0].id,data.shift];
    if ([previous.full_name,previous.sex,previous.career_id,previous.group_id,previous.shift].some((v,i)=>v!==updated[i])) {
      await client.query('update public.students set full_name=$2,sex=$3,career_id=$4,group_id=$5,shift=$6 where id=$1',[previous.id,...updated]);
      await client.query('insert into public.audit_log(user_id,username,action,entity_type,entity_id,details) values($1,$2,$3,$4,$5,$6::jsonb)',[session.id,session.usuario,'STUDENT_UPDATED_AT_REGISTRATION','student',previous.id,JSON.stringify({before:previous,after:updated})]);
    }
    const duration = Math.max(0, Math.round((data.endedAt - data.startedAt) / 60000));
    const inserted = await client.query(`
      insert into public.advisories
        (student_id, advisor_id, subject_id, reason_id, period_id, comments,
         referred_to_psychopedagogy, started_at, ended_at, duration_minutes, status, student_snapshot, operation_id, operation_fingerprint)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'FINALIZADA', $11::jsonb, $12, $13)
      returning id
    `, [student.rows[0].id, session.id, ids.subject_id, ids.reason_id, ids.period_id,
        data.comments, data.referred, data.startedAt.toISOString(), data.endedAt.toISOString(), duration, JSON.stringify({name:data.fullName,sex:data.sex,shift:data.shift,career:data.career,group:data.group}), operationId,fingerprint]);
    if(body.activeCorrection){const correction=body.activeCorrection;if(typeof correction.reason!=='string'||!correction.reason.trim()||correction.reason.length>500)throw Object.assign(new Error('invalid_correction'),{statusCode:400,publicMessage:'Indique el motivo del ajuste.'});await client.query('insert into public.audit_log(user_id,username,action,entity_type,entity_id,details) values($1,$2,$3,$4,$5,$6::jsonb)',[session.id,session.usuario,'ADVISORY_TIME_AT_CREATION','advisory',inserted.rows[0].id,JSON.stringify(correction)]);}
    await client.query('delete from public.advisory_drafts where advisor_id=$1 and operation_id=$2',[session.id,operationId]);
    await client.query("insert into public.audit_log(user_id,username,action,entity_type,entity_id,details) values($1,$2,'ADVISORY_CREATED','advisory',$3,$4::jsonb)",[session.id,session.usuario,inserted.rows[0].id,JSON.stringify({enrollment:data.enrollment,period:data.period})]);
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

async function ensureStudentCatalog(client, career, group) {
  await client.query('insert into public.careers(code,name) values($1,$1) on conflict(code) do nothing',[career]);
  await client.query('insert into public.student_groups(name,career_id) select $2,id from public.careers where code=$1 and active=true on conflict(name) do nothing',[career,group]);
}
async function apiCorrectAdvisory(request,response,session,id) {
  const body=await readJsonBody(request,32768).catch(()=>null);
  const reason=String(body?.justificacion||'').trim();
  if(!body || !reason || reason.length>500) return sendJson(response,400,{ok:false,message:'Indique un motivo de hasta 500 caracteres.'});
  const client=await connectTransaction(database);
  const fail=(message)=>{throw Object.assign(new Error(message),{statusCode:400})};
  try {
    await client.query('begin');
    const result=await client.query(`select a.*,s.enrollment::text,s.full_name,s.sex,s.shift,c.code::text as career,g.name::text as group_name from public.advisories a join public.students s on s.id=a.student_id join public.careers c on c.id=s.career_id join public.student_groups g on g.id=s.group_id where a.id=$1 and ($2::boolean or a.advisor_id=$3) and a.status='FINALIZADA' for update of a`,[id,session.rol==='admin',session.id]);
    const old=result.rows[0]; if(!old) fail('Registro no disponible o sin permiso.');
    if(body.action==='cancel') await client.query("update public.advisories set status='CANCELADA' where id=$1",[id]);
    else if(body.action==='time'||(body.action==='edit'&&body.inicio!==undefined&&body.fin!==undefined)) {
      const start=new Date(body.inicio),end=new Date(body.fin);
      if(!body.inicio||!body.fin||!Number.isFinite(+start)||!Number.isFinite(+end)) fail('Introduzca fechas y horas válidas.');
      if(end<start) fail('La hora de término no puede ser anterior al inicio.');
      if(end-start>43200000) fail('La duración no puede superar 12 horas.');
      if(+end>Date.now()+300000) fail('La hora de término está en el futuro respecto al servidor. Revise el reloj y la zona horaria del dispositivo.');
      const valid=await client.query(`select (($1::timestamptz at time zone i.timezone)::date between p.starts_on and p.ends_on) and (($2::timestamptz at time zone i.timezone)::date between p.starts_on and p.ends_on) as ok from public.periods p cross join public.institution_settings i where p.id=$3`,[start,end,old.period_id]);
      if(!valid.rows[0]?.ok) fail('El horario debe pertenecer al cuatrimestre original.');
      await client.query('update public.advisories set started_at=$2,ended_at=$3,duration_minutes=$4 where id=$1',[id,start,end,Math.round((end-start)/60000)]);
    }
    if(body.action==='edit') {
      const fields=['matricula','nombre','sexo','carrera','grupo','turno','materia','motivo','comentarios'].map(k=>String(body[k]??'').trim());
      const [enrollment,name,sex,career,group,shift,subject,motive,comments]=fields;
      if(fields.slice(0,8).some(x=>!x||x==='Seleccione')||fields.some((x,i)=>x.length>[40,160,10,30,80,20,160,160,2000][i])||!['Hombre','Mujer'].includes(sex)||!['Matutino','Vespertino'].includes(shift)) fail('Datos inválidos.');
      const cat=await client.query(`select g.id as gid,c.id as cid,(select id from public.subjects where name=$3) as sid,(select id from public.advisory_reasons where name=$4) as rid from public.student_groups g join public.careers c on c.id=g.career_id where c.code=$1 and g.name=$2`,[career,group,subject,motive]);
      const x=cat.rows[0];if(!x?.sid||!x?.rid) fail('Revise carrera, grupo, materia y motivo.');
      const target=await client.query('select * from public.students where enrollment=$1 for update',[enrollment]);
      let student=target.rows[0];
      if(student){if(student.full_name!==name||student.sex!==sex||student.shift!==shift||student.career_id!==x.cid||student.group_id!==x.gid){
        if(student.id!==old.student_id) fail('La matrícula pertenece a otro alumno con datos distintos.');
        const shared=await client.query('select 1 from public.advisories where student_id=$1 and id<>$2 limit 1',[student.id,id]);
        if(!shared.rowCount)
        await client.query('update public.students set full_name=$2,sex=$3,shift=$4,career_id=$5,group_id=$6 where id=$1',[student.id,name,sex,shift,x.cid,x.gid]);
      }}else{student=(await client.query('insert into public.students(enrollment,full_name,sex,career_id,group_id,shift) values($1,$2,$3,$4,$5,$6) returning id',[enrollment,name,sex,x.cid,x.gid,shift])).rows[0]}
      await client.query('update public.advisories set student_id=$2,subject_id=$3,reason_id=$4,comments=$5,referred_to_psychopedagogy=$6,student_snapshot=$7::jsonb where id=$1',[id,student.id,x.sid,x.rid,comments,body.psico==='Sí',JSON.stringify({name,sex,shift,career,group})]);
    }else if(!['time','cancel'].includes(body.action)) fail('Acción inválida.');
    const after=(await client.query('select * from public.advisories where id=$1',[id])).rows[0];
    await client.query('insert into public.audit_log(user_id,username,action,entity_type,entity_id,details) values($1,$2,$3,$4,$5,$6::jsonb)',[session.id,session.usuario,'ADVISORY_'+body.action.toUpperCase(),'advisory',id,JSON.stringify({reason,before:old,after,changes:body})]);
    await client.query('commit');sendJson(response,200,{ok:true});
  }catch(error){await client.query('rollback');if(error.statusCode===400)sendJson(response,400,{ok:false,message:error.message});else throw error;}finally{client.release()}
}

// Bitácora y restauración: acceso exclusivo del administrador activo.
async function apiAdminAudit(request,response,url) {
  const session=await requireAdmin(request,response);if(!session)return;
  const offset=Number(url.searchParams.get('offset')||0);
  if(!Number.isSafeInteger(offset)||offset<0||offset>1000000)return sendJson(response,400,{ok:false});
  const cancelled=url.searchParams.get('view')==='cancelled';
  const result=await database.query(cancelled?`select a.id,s.enrollment::text,coalesce(a.student_snapshot->>'name',s.full_name) as student_name,u.username::text as advisor,p.name as period,a.started_at,a.ended_at,a.duration_minutes,sub.name::text as subject,log.details->>'reason' as reason from public.advisories a join public.students s on s.id=a.student_id join public.app_users u on u.id=a.advisor_id join public.periods p on p.id=a.period_id join public.subjects sub on sub.id=a.subject_id left join lateral (select details from public.audit_log where entity_type='advisory' and entity_id=a.id::text and action='ADVISORY_CANCEL' order by id desc limit 1) log on true where a.status='CANCELADA' order by a.started_at desc,a.id desc limit 51 offset $1`:`select id::text,username,action,entity_type,entity_id,created_at,details from public.audit_log order by created_at desc,id desc limit 51 offset $1`,[offset]);
  sendJson(response,200,{ok:true,items:result.rows.slice(0,50),hasMore:result.rows.length>50});
}
async function apiRestoreAdvisory(request,response,id) {
  const session=await requireAdmin(request,response);if(!session)return;
  const body=await readJsonBody(request,32768).catch(()=>null);
  const reason=typeof body?.reason==='string'?body.reason.trim():'';
  if(!reason||reason.length>500)return sendJson(response,400,{ok:false,message:'Indique un motivo de hasta 500 caracteres.'});
  const client=await connectTransaction(database);
  try {
    await client.query('begin');
    const before=(await client.query("select * from public.advisories where id=$1 and status='CANCELADA' for update",[id])).rows[0];
    if(!before){await client.query('rollback');return sendJson(response,409,{ok:false,message:'El registro ya no está anulado o no existe.'});}
    if(!before.ended_at||!before.started_at||new Date(before.ended_at)<new Date(before.started_at)||before.duration_minutes==null||before.duration_minutes<0){await client.query('rollback');return sendJson(response,409,{ok:false,message:'El registro tiene un horario inconsistente; requiere revisión técnica.'});}
    const span=+new Date(before.ended_at)-+new Date(before.started_at);
    const valid=await client.query(`select (($1::timestamptz at time zone i.timezone)::date between p.starts_on and p.ends_on) and (($2::timestamptz at time zone i.timezone)::date between p.starts_on and p.ends_on) as ok from public.periods p cross join public.institution_settings i where p.id=$3`,[before.started_at,before.ended_at,before.period_id]);
    if(!Number.isFinite(span)||span>43200000||+new Date(before.ended_at)>Date.now()+300000||Math.round(span/60000)!==before.duration_minutes||!valid.rows[0]?.ok){await client.query('rollback');return sendJson(response,409,{ok:false,message:'Horario histórico inconsistente; requiere revisión técnica.'});}
    const after=(await client.query("update public.advisories set status='FINALIZADA' where id=$1 returning *",[id])).rows[0];
    await client.query('insert into public.audit_log(user_id,username,action,entity_type,entity_id,details) values($1,$2,$3,$4,$5,$6::jsonb)',[session.id,session.usuario,'ADVISORY_RESTORE','advisory',id,JSON.stringify({reason,before,after})]);
    await client.query('commit');sendJson(response,200,{ok:true});
  }catch(error){await client.query('rollback');throw error;}finally{client.release();}
}

// SALUD DE BASE DE DATOS: comprueba la conexión y construye el estado del servicio.
async function databaseHealth() {
  if (!database) {
    return {
      statusCode: 503,
      body: {
        ok: false,
        status: "unavailable"
      }
    };
  }

  try {
    await database.query("select token_hash from public.revoked_sessions limit 0");
    // LIMIT 0 valida existencia, columnas y permisos de lectura sin transferir datos.
    await database.query(`select
      (select operation_fingerprint from public.advisories limit 0),
      (select operation_id from public.advisories limit 0),
      (select student_snapshot from public.advisories limit 0),
      (select revision from public.advisory_drafts limit 0),
      (select payload from public.advisory_drafts limit 0),
      (select id from public.app_users limit 0),
      (select id from public.students limit 0),
      (select id from public.careers limit 0),
      (select id from public.student_groups limit 0),
      (select id from public.periods limit 0),
      (select id from public.subjects limit 0),
      (select id from public.advisory_reasons limit 0),
      (select timezone from public.institution_settings limit 0),
      (select id from public.audit_log limit 0)`);
    return {
      statusCode: 200,
      body: {
        ok: true,
        status: "ok"
      }
    };
  } catch (error) {
    console.error("No fue posible comprobar PostgreSQL:", error.message);
    return {
      statusCode: 503,
      body: {
        ok: false,
        status: "unavailable"
      }
    };
  }
}

// ENRUTADOR HTTP: dirige cada método y URL a su función/API o entrega los archivos web.
async function handleRequest(request, response) {
  setSecurityHeaders(response);
  let requestUrl;
  try { requestUrl = new URL(request.url, "http://localhost"); }
  catch (_) { sendJson(response, 400, {ok:false,code:'invalid_url'}); return; }
  if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method) && !sameOrigin(request)) {
    sendJson(response,403,{ok:false,code:"invalid_origin",message:"Solicitud bloqueada por seguridad."}); return;
  }
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
    try{const session=readSession(request);const valid=session&&await isActiveAdvisorSession(session);sendJson(response,valid?200:401,valid?{ok:true,user:session}:{ok:false})}catch(error){console.error('Error al validar sesión:',error.message);sendJson(response,503,{ok:false,code:'database_error'})}
    return;
  }

  if (requestUrl.pathname === "/api/admin/session") {
    if (request.method !== "GET") { sendJson(response, 405, { ok: false }); return; }
    try{const session=readSession(request,"admin_session");const valid=await isActiveAdminSession(session);sendJson(response,valid?200:401,valid?{ok:true,user:session}:{ok:false})}catch(error){console.error('Error al validar sesión administrativa:',error.message);sendJson(response,503,{ok:false,code:'database_error'})}
    return;
  }

  if (requestUrl.pathname === "/api/admin/data") {
    if (request.method !== "GET") { sendJson(response,405,{ok:false}); return; }
    if (!database) { sendJson(response,503,{ok:false,code:"database_not_configured"}); return; }
    try { await apiAdminData(request,response); } catch(error) { console.error("Error administrativo:",error.message); sendJson(response,503,{ok:false,code:"database_error"}); }
    return;
  }

  if (requestUrl.pathname === "/api/admin/advisories") {
    if (request.method !== "GET") { sendJson(response,405,{ok:false}); return; }
    if (!database) { sendJson(response,503,{ok:false,code:"database_not_configured"}); return; }
    try { await apiAdminAdvisoriesPage(request,response,requestUrl); } catch(error) { console.error("Error en reporte paginado:",error.message); sendJson(response,503,{ok:false,code:"database_error"}); }
    return;
  }

  if (requestUrl.pathname === '/api/admin/audit') {
    if(request.method!=='GET')return sendJson(response,405,{ok:false});
    try{await apiAdminAudit(request,response,requestUrl);}catch(error){console.error('Bitácora:',error.message);sendJson(response,503,{ok:false});}return;
  }
  const restoreMatch=requestUrl.pathname.match(/^\/api\/admin\/advisories\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/restore$/i);
  if(restoreMatch){if(request.method!=='POST')return sendJson(response,405,{ok:false});try{await apiRestoreAdvisory(request,response,restoreMatch[1]);}catch(error){console.error('Restauración:',error.message);sendJson(response,503,{ok:false,message:'No fue posible restaurar.'});}return;}

  if (requestUrl.pathname === "/api/admin/statistics") {
    if (request.method !== "GET") { sendJson(response,405,{ok:false}); return; }
    if (!database) { sendJson(response,503,{ok:false,code:"database_not_configured"}); return; }
    try { await apiAdminStatistics(request,response,requestUrl); } catch(error) { console.error("Error en estadísticas agregadas:",error.message); sendJson(response,503,{ok:false,code:"database_error"}); }
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

  const simpleCatalogMatch=requestUrl.pathname.match(/^\/api\/admin\/catalogs\/(carreras|materias|motivos)$/);
  if(simpleCatalogMatch){if(request.method!=="POST"){sendJson(response,405,{ok:false});return}if(!database){sendJson(response,503,{ok:false});return}try{await apiCreateSimpleCatalog(request,response,simpleCatalogMatch[1])}catch(error){console.error("Error de catálogo:",error.message);sendJson(response,503,{ok:false,message:"No fue posible guardar el registro."})}return}
  const simpleCatalogActiveMatch=requestUrl.pathname.match(/^\/api\/admin\/catalogs\/(carreras|materias|motivos)\/([^/]+)\/active$/);
  if(simpleCatalogActiveMatch){if(request.method!=="PATCH"){sendJson(response,405,{ok:false});return}if(!database){sendJson(response,503,{ok:false});return}try{await apiSetSimpleCatalogActive(request,response,simpleCatalogActiveMatch[1],decodeURIComponent(simpleCatalogActiveMatch[2]))}catch(error){console.error("Error de catálogo:",error.message);sendJson(response,503,{ok:false,message:"No fue posible actualizar el registro."})}return}

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
    const session=readSession(request);await revokeSession(session);if(session)await audit(request,session,"LOGOUT","account",session.id,{});response.setHeader("Set-Cookie", "advisor_session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict");
    sendJson(response, 200, { ok: true });
    return;
  }

  if (requestUrl.pathname === "/api/admin/logout") {
    if (request.method !== "POST") { sendJson(response,405,{ok:false}); return; }
    const session=readSession(request,'admin_session');await revokeSession(session);if(session)await audit(request,session,"LOGOUT","account",session.id,{});response.setHeader("Set-Cookie", "admin_session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict");
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

  const correctionMatch=requestUrl.pathname.match(/^\/api\/advisories\/([0-9a-f-]{36})$/i);
  if(correctionMatch){
    if(request.method!=='PATCH') return sendJson(response,405,{ok:false});
    if(!database) return sendJson(response,503,{ok:false});
    const advisor=readSession(request),admin=readSession(request,'admin_session');
    const session=await isActiveAdvisorSession(advisor)?advisor:await isActiveAdminSession(admin)?admin:null;
    if(!session)return sendJson(response,403,{ok:false});
    try{await apiCorrectAdvisory(request,response,session,correctionMatch[1]);}catch(error){console.error('Corrección:',error.message);sendJson(response,503,{ok:false,message:'No se pudo guardar la corrección.'})}return;
  }
  if(requestUrl.pathname==='/api/advisory-draft'){
    if(!database)return sendJson(response,503,{ok:false});
    const session=requireSession(request,response);if(!session)return;
    if(!await isActiveAdvisorSession(session))return sendJson(response,403,{ok:false});
    try{await apiDraft(request,response,session)}catch(e){console.error('Draft:',e.message);sendJson(response,503,{ok:false})}return;
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

    require('node:stream').pipeline(fs.createReadStream(filePath), response, error => {
      if (error && error.code !== 'ERR_STREAM_PREMATURE_CLOSE') console.error('Error de transmisión de archivo:', error.code || 'unknown');
    });
  });
}
const server = http.createServer((request,response)=>{
  handleRequest(request,response).catch(error=>{
    console.error('Error de solicitud:',error.message);
    if(response.writableEnded||response.destroyed)return;
    if(response.headersSent){response.destroy();return;}
    sendJson(response,503,{ok:false,code:'service_unavailable'});
  });
});

// CICLO DE VIDA: inicia el servidor y cierra correctamente el pool de PostgreSQL.
async function startServer(){
  if(database&&process.env.ADMIN_INITIAL_PASSWORD){
    const pending=await database.query("select id from public.app_users where role='admin' and password_hash is null");
    if(pending.rowCount){
      const hash=await bcrypt.hash(process.env.ADMIN_INITIAL_PASSWORD,12);
      await database.query("update public.app_users set password_hash=$1 where role='admin' and password_hash is null",[hash]);
      console.log("Contraseña administrativa inicial configurada de forma segura.");
    }
  }
  server.listen(PORT,"0.0.0.0",()=>console.log(`Sistema de asesorías disponible en el puerto ${PORT}`));
}
startServer().catch(error=>{console.error("No fue posible iniciar el sistema:",error.message);process.exit(1)});

async function shutdown() {
  server.close(async () => {
    if (database) await database.end();
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
