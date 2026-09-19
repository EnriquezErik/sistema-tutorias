const http = require("http");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = __dirname;
const DATABASE_URL = process.env.DATABASE_URL || "";
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
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end("Método no permitido");
    return;
  }

  const requestUrl = new URL(request.url, "http://localhost");
  if (requestUrl.pathname === "/api/health") {
    const result = await databaseHealth();
    sendJson(response, result.statusCode, result.body, request.method === "HEAD");
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
