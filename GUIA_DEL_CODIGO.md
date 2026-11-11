# Guía para leer el código del sistema de asesorías

## 1. Qué incluye

El sistema se divide en tres capas: **interfaz web** (HTML y CSS), **lógica del navegador** (`app.js` y `admin.js`) y **servidor/base de datos** (`server.js` y SQL). El navegador llama rutas `/api/...`; el servidor valida sesión y permisos, consulta PostgreSQL y devuelve JSON; la página actualiza lo que muestra.

## 2. Mapa de archivos

| Archivo | Función |
|---|---|
| `index.html` | Acceso del asesor, captura de asesoría, historial personal y área de impresión. |
| `app.js` | Catálogos, búsqueda de alumno, cronómetro, captura, guardado, historial, filtros, CSV e inicio/cierre de sesión. |
| `admin.html` | Acceso/recuperación, Inicio, Estadísticas, Historial y reportes, Catálogos, resumen por alumno y seguridad. |
| `admin.js` | Carga de datos, indicadores, tablas/gráficas, filtros, gestión de catálogos/asesores, exportación e impresión. |
| `logo-bis-universities.png` | Logotipo institucional servido desde la raíz para Registro, Administración y reportes impresos. |
| `styles.css` | Presentación de ambas pantallas, formularios, tablas, adaptación a pantalla e impresión. |
| `server.js` | Servidor HTTP, API, autenticación/autorización, validaciones, conexión PostgreSQL y protecciones HTTP. |
| `database/001_esquema_inicial_sistema_tutorias.sql` | Migración inicial: tablas, relaciones, índices, triggers, RLS y catálogos iniciales. |
| `database/002_acceso_administrador.sql` | Migración 002 documentada: acceso administrativo y recuperación. |
| `database/003_fortalecimiento_seguridad.sql` | Migración de bitácora y fortalecimiento de seguridad asociada a v41. |
| `002_acceso_administrador.sql` | Copia antigua diferente del SQL en `database/`; contiene una nota de v25. Se conserva como referencia; no ejecutar las dos versiones. |
| `package.json` / `package-lock.json` | Metadatos, dependencias y comandos Node.js (`npm start`, `npm test`). |
| `tests/security-check.js` | Comprobación estática que acompaña al proyecto; no equivale a una prueba integral con base de datos. |
| `README.md` | Resumen, instalación y orden de migraciones indicado por el proyecto. |
| `SEGURIDAD_Y_DESPLIEGUE.md` | Variables de entorno y recomendaciones de instalación/despliegue. |
| `sistema-tutorias.code-workspace` | Acceso rápido a esta carpeta y preferencias básicas para VS Code. |

## 3. Registro: `app.js`

Los comentarios insertados en el archivo separan configuración, alumnos, ciclo de asesoría, historial y acceso.

### Configuración y asesoría en curso

- `activeKey`, `persistActiveSession`, `clearActiveSession`, `restoreActiveAdvisory`: guardan/restauran temporalmente los datos de una asesoría no finalizada en `sessionStorage`.
- `appConfig`, `loadRemoteConfig`, `applyPeriodCatalog`, `refreshPeriodCatalog`: combinan valores de respaldo y configuración remota, incluyendo catálogos y cuatrimestre activo.
- `records`: devuelve los registros descargados del servidor.

### Alumno y captura

- `fill`, `updateGroupsForCareer`, `setStudentFields`: preparan opciones, filtran grupos según carrera y controlan campos editables.
- `showFoundStudent`, `showNewStudent`, `findStudent`: presentan alumno existente, permiten capturar uno nuevo o consultan la matrícula en `/api/students/:matricula`.
- `startSession`, `updateTimer`, `finishSession`, `resetForm`: validan e inician, miden, guardan en `/api/advisories` y limpian una asesoría.

### Historial y sesión

- `inRange`, `filteredRecords`: aplican filtros por fecha y cuatrimestre.
- `fmt`, `escapeHTML`: convierten duración y codifican caracteres especiales antes de mostrar texto.
- `renderHistory`: dibuja el historial y prepara su tabla de impresión.
- `exportCSV`: descarga los datos filtrados en CSV.
- `loadRemoteAdvisories`: consulta registros al servidor.
- `currentUser`, `showLogin`, `hideLogin`, `doLogin`, `restoreRemoteSession`, `applySession`, `logout`: consultan usuario, muestran pantallas y administran la sesión del asesor.

## 4. Administración: `admin.js`

- **Datos y catálogos base:** `adminRead`, `adminWrite`, `adminRecords`, `adminStudents`, `adminUsers`, `allAdvisors`, `registeredAdvisors`, `schoolConfig`, `catalogs`, `periods`, `activePeriodName`, `adminPeriods`, `adminGroups`; `saveAdvisor` crea cuenta de asesor.
- **Filtros y formato:** `fmtAdmin`, `escapeHTML`, `selectedPeriod`, `periodRecords`, `rangeMatch`, `getAdminFiltered`, `fillSelect`, `fillPeriodSelect`, `fillAdminFilters`.
- **Inicio y estadísticas:** `sumBy`, `renderRows`, `renderDashboard`, `statsChartBars`, `statsChartGroup`, `statsChartReferral`, `renderStatisticsVisuals`, `renderStatistics`, `renderStudentSummary` generan indicadores, agregados por categoría, visualizaciones y horas por alumno.
- **Historial:** `renderAdminReport` llena la tabla con los filtros activos.
- **Catálogos:** `renderCatalogStudents`, `renderCatalogAdvisors`, `toggleAdvisorStatus`, `formatPeriodDate`, `renderCatalogPeriods`, `renderCatalogGroups`, `renderCatalogs`, `renderSimpleCatalog`, `addCatalog`, `toggleSimpleCatalog`, `savePeriod`, `togglePeriodStatus`, `saveGroup`, `toggleGroupStatus` muestran y actualizan listas y estados activo/inactivo.
- **Salidas y actualización:** `renderAll` refresca las vistas; `exportExcel`, `exportStatsExcel`, `printStatistics`, `printReport` preparan exportaciones e impresión.
- **Acceso/seguridad:** `applySchool`, `showAdminLogin`, `hideAdminLogin`, `setAdminMessage`, `loadAdminData`, `adminLogin`, `checkAdminSession`, `adminLogout`, `recoverAdminAccess`, `saveAdminSecurity`.
- **Navegación:** `showCatalog` abre el panel elegido; los manejadores al final del archivo enlazan controles y eventos con estas funciones.

## 5. Servidor: `server.js`

- **Dependencias y configuración:** módulos Node, puerto, archivos públicos, variables secretas y pool PostgreSQL.
- **Archivos/respuestas:** `resolveRequestPath` limita las rutas públicas; `sendJson` produce JSON; el servidor HTTP despacha solicitudes.
- **Protecciones:** `setSecurityHeaders`, `requestIp`, `sameOrigin`, `loginRateKey`, `loginBlocked`, `recordLoginFailure`, `readJsonBody` gestionan encabezados, origen, identificación de intentos, bloqueo temporal y cuerpo recibido.
- **Bitácora/sesión:** `audit`, `parseCookies`, `signSession`, `readSession`, `isActiveAdvisorSession`, `isActiveAdminSession` registran acciones y verifican cookies/usuarios.
- **Carga inicial y login:** `getBootstrap`, `apiLogin`, `requireAdmin`, `apiAdminData`.
- **Administración:** `apiCreateSimpleCatalog`, `apiSetSimpleCatalogActive`, `apiCreateGroup`, `apiSetGroupActive`, `apiCreatePeriod`, `apiSetPeriodActive`, `apiCreateUser`, `apiSetUserActive`.
- **Credenciales:** `apiAccountSecurity`, `apiRecoverAccess`.
- **Asesorías:** `requireSession`, `advisoryRow`, `apiFindStudent`, `apiListAdvisories`, `apiCreateAdvisory`.
- **Operación:** `databaseHealth`, `startServer`, `shutdown`.

Para ubicar una ruta, busca `/api/` en `server.js`. Ejemplos utilizados por la interfaz: `/api/login`, `/api/bootstrap`, `/api/students/:matricula`, `/api/advisories` y rutas `/api/admin/...`.

## 6. Base de datos

La migración inicial crea nueve tablas funcionales y una tabla de control de migraciones: `schema_migrations` (versiones SQL), `institution_settings` (institución), `periods` (cuatrimestres), `careers`, `student_groups`, `subjects`, `advisory_reasons`, `app_users` (asesores/administrador), `students` y `advisories` (sesiones registradas). También añade índices, actualización de fechas y RLS. PostgreSQL se conecta desde el servidor por `DATABASE_URL`; el navegador no consulta directamente la base.

Las migraciones son acumulativas. Para instalación nueva, el README indica el orden. Para actualizar una base existente, confirma primero su versión y sigue el procedimiento de esa versión; no ejecutes SQL a ciegas.

## 7. Abrir en Visual Studio Code

1. Descarga el ZIP y extráelo.
2. En VS Code selecciona **Archivo → Abrir carpeta…** y abre la carpeta que contiene `package.json`, o abre `sistema-tutorias.code-workspace`.
3. Empieza por esta guía; después sigue `index.html` → `app.js` y `admin.html` → `admin.js`. Para seguir el guardado ve a `server.js`; para revisar tablas abre `database/001_esquema_inicial_sistema_tutorias.sql`.
4. Para ejecutar la aplicación se necesita Node.js 18+, dependencias instaladas, variables de entorno y PostgreSQL configurado. Abrir el HTML en el navegador por sí solo no inicia el servidor.

## 8. Observaciones de la copia recibida

- El proyecto corresponde a la línea estable v42 y `package.json` declara la versión técnica 1.7.12. La exportación administrativa produce libros `.xlsx` mediante una biblioteca estándar incluida en el proyecto; Registro conserva su funcionamiento anterior.
- Hay dos `002_acceso_administrador.sql` diferentes. El README referencia la carpeta `database/` para la secuencia de migraciones. No ejecutes ambos archivos.
- La carpeta `tests/` ya venía en el ZIP. En esta preparación se añadieron comentarios y documentación; no se ejecutaron pruebas ni se alteró el comportamiento del sistema.
