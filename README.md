# Sistema de Asesorías Académicas · versión estable: v42

La v42 mantiene el registro de asesorías, catálogos, estadísticas, filtros, impresión y exportación. Incorpora protección visual y funcional de las pantallas de acceso, validación de sesiones y presentación institucional.

La Administración utiliza navegación por vistas: Inicio y Estadísticas permanecen juntos; Historial y reportes, Catálogos y Seguridad se presentan por separado desde la parte superior, sin recorridos verticales entre áreas.

En dispositivos móviles, el encabezado administrativo distribuye el logotipo, el nombre institucional y las acciones de sesión en filas independientes para evitar superposiciones.

La versión 1.7.14 parte de la versión estable 1.7.13 y conserva la estructura funcional. Organiza las migraciones ejecutables en `database/`, archiva fuera de esa ruta la copia duplicada de la migración 002 y coloca los comprobadores existentes en `tests/`, como ya esperaba el comando `npm test`. También actualiza las referencias de versión de los archivos de interfaz. No ejecuta migraciones ni modifica datos de PostgreSQL. La prueba real de migración desde una base limpia y desde una base anterior sigue pendiente de un entorno PostgreSQL desechable.

Para orientarse entre archivos y funciones, consulte [`GUIA_DEL_CODIGO.md`](GUIA_DEL_CODIGO.md). Abra la carpeta raíz o `sistema-tutorias.code-workspace` en Visual Studio Code.

El archivo `logo-bis-universities.png` debe permanecer en la carpeta raíz junto a `index.html`, `admin.html` y `server.js`. La aplicación utiliza una ruta pública absoluta para mostrarlo en los accesos, encabezados e impresiones de ambas páginas.

Para conocer la función de cada archivo y los grupos principales de funciones, consulte [`GUIA_DEL_CODIGO.md`](GUIA_DEL_CODIGO.md). Abra la carpeta raíz o `sistema-tutorias.code-workspace` en Visual Studio Code.

## Seguridad incorporada

- Contraseñas obligatorias de al menos 10 caracteres.
- Sesiones firmadas mediante cookie `HttpOnly`, `Secure` y `SameSite=Strict`, con duración predeterminada de 12 horas.
- Bloqueo temporal después de cinco intentos fallidos de acceso.
- Bloqueo temporal de intentos fallidos de recuperación administrativa.
- Ocultamiento y limpieza de la información administrativa cuando no existe una sesión válida.
- Validación del origen de las operaciones de escritura.
- Encabezados CSP, HSTS, anti-iframe, `nosniff`, política de referencia y permisos restringidos.
- Sin acceso alternativo local cuando PostgreSQL no está disponible.
- Sin copias permanentes de alumnos, historial o identidad de sesión en `localStorage`.
- Escapado de información mostrada en el historial para reducir el riesgo de inyección de código.
- Conservación temporal de una asesoría en curso al presionar F5 mediante `sessionStorage`.
- Si PostgreSQL no responde, el formulario conserva la información y permite volver a intentar.
- Tabla de bitácora para acciones de seguridad.

## Base de datos

La secuencia canónica disponible contiene las migraciones 001 a 005 en `database/`. Para una instalación nueva, ejecútelas en orden. Para actualizar una base existente, confirma primero su versión y aplica únicamente las migraciones pendientes. Antes de cualquier ejecución crea un respaldo verificable. La secuencia no se ejecutó como parte de esta preparación; usa primero una base PostgreSQL desechable.

## Publicación

Consulte `SEGURIDAD_Y_DESPLIEGUE.md`. Son obligatorias en Render las variables `DATABASE_URL`, `SESSION_SECRET` y `NODE_ENV=production`. Si la cuenta administrativa existente todavía no tiene contraseña, use temporalmente `ADMIN_INITIAL_PASSWORD` como se explica en la guía.

## Comprobaciones

- `npm test` valida sintaxis, controles estáticos, compatibilidad del esquema, estructura de migraciones y exportación XLSX. No sustituye la ejecución de 001→005 en PostgreSQL desechable.
- `/api/health` confirma la conexión con PostgreSQL.
- `/api/bootstrap` entrega los catálogos activos.

La v40 debe conservarse sin modificaciones como punto de recuperación.

## Actualización v1.7.21
Consultar RELEASE_NOTES_v1.7.21.md antes de desplegar; requiere migración 007 y validación TLS.

### v1.7.24
Expediente individual en Administración y alta de materia desde Registro al finalizar. Requiere migraciones 001–008; sin nueva migración. Véase RELEASE_NOTES_v1.7.24.md.

## v1.7.33 — candidata institucional
Consultar `docs/ARQUITECTURA.md`, `docs/MIGRACIONES.md`, `docs/RESPALDO_Y_RECUPERACION.md`, `docs/LISTA_LIBERACION.md` y `ESTADO_DE_LIBERACION.md`. Diagnóstico manual de solo lectura: `scripts/verificar_esquema.sql`.

## v1.7.34 — candidata parcial
Consultar RELEASE_NOTES_v1.7.34.md y PRUEBAS_v1.7.34.txt.

## v1.7.37 — candidata parcial
Consultar RELEASE_NOTES_v1.7.37.md y PRUEBAS_v1.7.37.txt. La carga administrativa es una lectura transaccional única; la transferencia masiva sigue pendiente de optimización.

## v1.7.38
Corrección visual IEHL; ver RELEASE_NOTES_v1.7.38.md y PRUEBAS_v1.7.38.txt.

## v1.7.39
Candidata de correcciones prioritarias; ver RELEASE_NOTES_v1.7.39.md y PRUEBAS_v1.7.39.txt. Mantener v1.7.38 como respaldo operativo. Configuración TLS de Render documentada en docs/RESPALDO_Y_RECUPERACION.md.

## v1.7.40
Candidata parcial; consultar RELEASE_NOTES_v1.7.40.md y PRUEBAS_v1.7.40.txt. No autorizada para producción.

## v1.7.41
Corrección de arranque; consultar RELEASE_NOTES_v1.7.41.md y PRUEBAS_v1.7.41.txt. Pendiente de validación en Render.

## v1.7.42
Correcciones prioritarias P-01 y P-02. Consultar RELEASE_NOTES_v1.7.42.md y PRUEBAS_v1.7.42.txt. Candidata para validación controlada.

## v1.7.43
Consultar RELEASE_NOTES_v1.7.43.md y PRUEBAS_v1.7.43.txt. Candidata; preflight real y validación funcional pendientes.

## v1.7.44
Consultar RELEASE_NOTES_v1.7.44.md y PRUEBAS_v1.7.44.txt. Módulo HTTP único; despliegue real pendiente.

## v1.7.45
Consultar RELEASE_NOTES_v1.7.45.md. Aplicar migración aditiva 010 antes del despliegue.
