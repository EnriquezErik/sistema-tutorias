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
        (select count(*)::int from public.periods) as periods
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
