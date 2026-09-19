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

function readSession(request) {
  const token = parseCookies(request).advisor_session;
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
    database.query("select id, name, starts_on, ends_on from public.periods where active = true order by starts_on desc"),
    database.query("select id, code::text, name from public.careers where active = true order by code"),
    database.query("select id, name::text, career_id from public.student_groups where active = true order by name"),
    database.query("select id, name::text from public.subjects where active = true order by name"),
    database.query("select id, name::text from public.advisory_reasons where active = true order by name")
  ]);
  return {
    school: institution.rows[0] || {},
    periods: periods.rows,
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

  const token = signSession(user);
  response.setHeader("Set-Cookie", `advisor_session=${encodeURIComponent(token)}; Max-Age=31536000; Path=/; HttpOnly; Secure; SameSite=Lax`);
  sendJson(response, 200, { ok: true, user: { usuario: user.username, nombre: user.full_name, rol: user.role } });
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
    const catalogs = await client.query(`
      select
        (select id from public.careers where active = true and lower(code::text) = lower($1) limit 1) as career_id,
        (select id from public.subjects where active = true and lower(name::text) = lower($2) limit 1) as subject_id,
        (select id from public.advisory_reasons where active = true and lower(name::text) = lower($3) limit 1) as reason_id,
        (select id from public.periods where active = true and lower(name) = lower($4) limit 1) as period_id
    `, [data.career, data.subject, data.reason, data.period]);
    const ids = catalogs.rows[0];
    if (!ids.career_id || !ids.subject_id || !ids.reason_id || !ids.period_id) throw Object.assign(new Error("invalid_catalog"), { statusCode: 400 });
    const group = await client.query(
      "select id from public.student_groups where active = true and career_id = $1 and lower(name::text) = lower($2) limit 1",
      [ids.career_id, data.group]
    );
    if (!group.rows[0]) throw Object.assign(new Error("invalid_group_for_career"), { statusCode: 400 });

    const student = await client.query(`
      insert into public.students (enrollment, full_name, sex, career_id, group_id, shift, active)
      values ($1, $2, $3, $4, $5, $6, true)
      on conflict (enrollment) do update set
        full_name = excluded.full_name, sex = excluded.sex, career_id = excluded.career_id,
        group_id = excluded.group_id, shift = excluded.shift, active = true
      returning id
    `, [data.enrollment, data.fullName, data.sex, ids.career_id, group.rows[0].id, data.shift]);
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
    if (error.statusCode === 400) { sendJson(response, 400, { ok: false, code: error.message, message: "Revise que el grupo corresponda a la carrera seleccionada." }); return; }
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
    sendJson(response, session ? 200 : 401, session ? { ok: true, user: session } : { ok: false });
    return;
  }

  if (requestUrl.pathname === "/api/logout") {
    if (request.method !== "POST") { sendJson(response, 405, { ok: false }); return; }
    response.setHeader("Set-Cookie", "advisor_session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax");
    sendJson(response, 200, { ok: true });
    return;
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
