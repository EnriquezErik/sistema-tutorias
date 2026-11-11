const assert=require('assert');
const fs=require('fs');
const read=file=>fs.readFileSync(file,'utf8');
const index=read('index.html'),admin=read('admin.html'),app=read('app.js'),adminJs=read('admin.js'),server=read('server.js');

assert(index.includes('id="schoolName"'),'Registro debe permitir actualizar el nombre institucional');
assert(admin.includes('id="newCareerCode"')&&admin.includes('id="newCareerName"'),'Carreras requiere clave y nombre completo');
assert(server.includes('insert into public.careers(code,name,active) values($1,$2,true)'),'La API debe guardar clave y nombre separados');
assert(!server.includes('limit 5000')&&!server.includes('limit 1000'),'Los reportes no deben truncarse silenciosamente');
assert(server.includes('invalid_advisory_time')&&server.includes('advisory_outside_period'),'La API debe validar tiempo y cuatrimestre');
assert(app.includes('spreadsheetSafe')&&adminJs.includes('spreadsheetSafe'),'Las exportaciones deben neutralizar fórmulas');
assert(adminJs.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),'Administración debe generar archivos XLSX auténticos');
assert(adminJs.includes("'reporte_asesorias.xlsx'")&&adminJs.includes('estadisticas_asesorias_${safePeriod}.xlsx'),'Ambas exportaciones administrativas deben usar la extensión XLSX');
assert(!adminJs.includes("application/vnd.ms-excel")&&!adminJs.includes(".xls'"),'Administración no debe disfrazar HTML o XML antiguo como XLS');
assert(adminJs.includes('document.body.appendChild(link)')&&adminJs.includes('URL.revokeObjectURL(url)'),'La descarga administrativa debe ser compatible con navegadores móviles y liberar recursos');
assert(app.includes('resetForm(false)'),'El cierre de sesión debe limpiar la vista');
assert(app.includes('$("#psico").value="No"'),'Psicopedagogía debe restablecerse a una opción existente');
assert.strictEqual(read('002_acceso_administrador.sql'),read('database/002_acceso_administrador.sql'),'Las copias de migración 002 deben ser idénticas');
console.log('Correcciones derivadas de auditoría: OK');
