const assert=require('assert');
const fs=require('fs');
const server=fs.readFileSync('server.js','utf8');
const migration=fs.readFileSync('database/004_integridad_seguridad_crecimiento.sql','utf8');
const index=fs.readFileSync('index.html','utf8');

assert(migration.includes('session_version'),'La migración debe permitir revocar sesiones');
assert(migration.includes('create table if not exists public.login_attempts'),'Debe existir control persistente de intentos');
assert(!/\btruncate\b|\bdelete\s+from\s+public\.(students|advisories|app_users)\b/i.test(migration),'La migración no debe eliminar registros funcionales');
assert(server.includes('session_version=$2'),'La sesión debe compararse con su versión vigente');
assert(server.includes("at time zone coalesce(i.timezone,'America/Mexico_City')"),'Las fechas deben validarse en la zona institucional');
assert(server.includes('on conflict (enrollment) do nothing'),'Una asesoría no debe sobrescribir datos maestros del alumno');
assert(server.includes('await database.query("select 1")'),'La salud pública debe hacer una comprobación mínima');
assert(!server.includes('current_database() as database_name'),'La salud pública no debe exponer el nombre de la base');
assert(server.includes('CATALOG_CREATED')&&server.includes('ADVISOR_DEACTIVATED')&&server.includes('ACCOUNT_SECURITY_CHANGED'),'La bitácora debe cubrir acciones administrativas');
assert(index.includes('maxlength="2000"'),'Comentarios debe limitarse también en la interfaz');
console.log('Controles de fase 2 bloque 1: OK');
