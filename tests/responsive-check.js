// Comprobación estática de la estructura adaptable en Registro y Administración.
const fs=require('fs');
const assert=require('assert');
const index=fs.readFileSync('index.html','utf8');
const admin=fs.readFileSync('admin.html','utf8');
const styles=fs.readFileSync('styles.css','utf8');

for(const [name,html] of [['Registro',index],['Administración',admin]]){
  assert(html.includes('name="viewport"'),`${name} debe declarar un viewport adaptable`);
  assert(html.includes('styles.css?v=1.7.6'),`${name} debe cargar los estilos adaptables actuales`);
}
assert(styles.includes('@media(max-width:900px)'), 'Falta soporte para teléfonos horizontales y tabletas pequeñas');
assert(styles.includes('@media(max-width:800px)'), 'Falta adaptación principal para tabletas y móviles');
assert(styles.includes('@media(max-width:600px)'), 'Falta adaptación para teléfonos');
assert(styles.includes('@media(max-width:420px)'), 'Falta adaptación para teléfonos estrechos');
assert(styles.includes('@media(max-height:700px)'), 'Falta adaptación de los accesos para poca altura');
assert(styles.includes('@media(min-width:1700px)'), 'Falta adaptación para pantallas amplias');
assert(styles.includes('.topbar:not(.admin-topbar)'), 'El encabezado de Registro debe adaptarse por separado');
assert(styles.includes('.admin-topbar>.admin-head-actions'), 'El encabezado administrativo debe separar las acciones de sesión');
assert(styles.includes('font-size:16px'), 'Los campos móviles deben evitar la ampliación automática de Safari/iOS');
assert(styles.includes('-webkit-overflow-scrolling:touch'), 'Las tablas deben admitir desplazamiento táctil fluido');
assert(styles.includes('.actions{display:grid'), 'Los controles de asesoría deben apilarse en teléfonos');
assert(styles.includes('.admin-filters{grid-template-columns:1fr}'), 'Los filtros administrativos deben apilarse en teléfonos');
console.log('Estructura adaptable de Registro y Administración: OK');
