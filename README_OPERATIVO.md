# Sistema de Tutorías v42 · paquete operativo limpio · v1.7.51

Este ZIP contiene los archivos necesarios para ejecutar las dos interfaces web (Registro y Administración), el servidor que las entrega y conecta con PostgreSQL, los recursos visuales y las dependencias de ejecución.

## Archivos incluidos
- `index.html`: página de Registro.
- `admin.html`: página de Administración.
- `app.js`, `admin.js`, `styles.css`: lógica y estilos de las páginas.
- `server.js`: servidor y API.
- `lib/`: módulos locales requeridos por el servidor.
- `exceljs.min.js`: biblioteca de exportación a Excel usada por Administración.
- Logotipos institucionales.
- `package.json`, `package-lock.json`, `render.yaml` y `.env.example`: instalación y configuración.

## Ejecución
Requiere Node.js 22.x y una base PostgreSQL existente. Instale dependencias con `npm ci` y configure las variables de entorno indicadas en `.env.example` (no use credenciales reales en archivos públicos). Inicie con `npm start`.

Este paquete no contiene datos de alumnos, credenciales, ni migraciones SQL. Tampoco incluye notas históricas, auditorías, pruebas, respaldos o archivos de desarrollo; esos materiales deben conservarse por separado en el archivo maestro/respaldo.

La limpieza no modifica el esquema ni los datos de PostgreSQL.
