const assert = require('assert');
const fs = require('fs');
const path = require('path');

const migrations = fs.readdirSync('database').filter(name => /^00[1-5]_.*\.sql$/.test(name)).sort();
assert.deepStrictEqual(migrations, [
  '001_esquema_inicial_sistema_tutorias.sql',
  '002_acceso_administrador.sql',
  '003_fortalecimiento_seguridad.sql',
  '004_integridad_seguridad_crecimiento.sql',
  '005_indices_crecimiento.sql'
], 'La ruta de ejecución debe contener una sola secuencia canónica 001–005.');
assert(fs.existsSync('legacy/002_acceso_administrador_duplicate.sql.archived'), 'Debe conservarse la copia duplicada fuera de la ruta ejecutable.');
assert.strictEqual(fs.readFileSync('legacy/002_acceso_administrador_duplicate.sql.archived','utf8'), fs.readFileSync(path.join('database',migrations[1]),'utf8'), 'La copia archivada debe ser idéntica a la migración canónica 002.');
assert(!fs.existsSync('002_acceso_administrador.sql'), 'No debe quedar una migración 002 ejecutable en la raíz.');
console.log('Ubicación y secuencia de migraciones: OK (comprobación estática; no ejecuta SQL).');
