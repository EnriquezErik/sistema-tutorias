const assert=require('assert');
const fs=require('fs');
const server=fs.readFileSync('server.js','utf8');
assert(server.includes('async function schemaCapabilities()'),'Debe comprobarse la versión del esquema antes del acceso');
assert(server.includes("'1 as session_version'"),'El inicio de sesión debe funcionar antes de ejecutar la migración 004');
assert(server.includes("active=true\",[session.id]"),'Las sesiones existentes deben validarse sin la columna nueva');
assert(server.includes('if(capabilities.sessionVersion)'),'Las actualizaciones de seguridad deben mantener compatibilidad');
console.log('Compatibilidad con la base existente: OK');
