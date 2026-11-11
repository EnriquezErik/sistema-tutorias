# Auditoría integral del Sistema de Tutorías v42 · versión 1.7.15

**Fecha de revisión:** 11 de noviembre de 2026  
**Alcance:** paquete completo de la versión 1.7.14 y correcciones preventivas 1.7.15.  
**Principio de conservación:** no se eliminó, transformó ni reemplazó ningún registro de la base de datos. No se modificó el modelo funcional de Administración ni de Registro de Asesorías.

## Dictamen ejecutivo

El paquete quedó técnicamente apto para su validación final en el entorno desplegado. La sintaxis, las dependencias, la estructura adaptable, las exportaciones XLSX, las migraciones acumulativas, los controles de seguridad y las rutas públicas fueron comprobados. Las pruebas automatizadas terminan correctamente y `npm audit --omit=dev` informa **0 vulnerabilidades conocidas**.

Una auditoría no puede prometer ausencia absoluta de errores futuros. El resultado confirma que no se encontraron fallas críticas pendientes en el código revisado y deja controles reproducibles para detectar regresiones. Antes de sustituir la versión publicada debe realizarse la prueba funcional final con una copia o respaldo reciente de la base real.

## Hallazgos y correcciones aplicadas

| Prioridad | Hallazgo | Corrección | Impacto en datos |
|---|---|---|---|
| Alta preventiva | La consulta de alumnos comprobaba la firma de la sesión, pero no volvía a consultar si la cuenta del asesor había sido desactivada. | Se exige una sesión de asesor vigente y activa antes de devolver datos del alumno. | Ninguno. |
| Media | Un cuerpo JSON mayor al límite seguía concatenándose después del rechazo. | El lector deja de acumular inmediatamente y libera el contenido parcial. | Ninguno. |
| Media | Administración ordenaba cuatrimestres sólo por fecha de inicio; con varios periodos podía elegir uno futuro antes que el vigente. | Se prioriza: activo, fecha actual dentro del periodo y fecha de inicio. | Ninguno. |
| Media | Una asesoría guardada en la pestaña podía restaurarse después del máximo de 12 horas aceptado por el servidor. | Las sesiones locales vencidas se descartan y el formulario se restablece sin enviar datos inválidos. | No elimina asesorías de PostgreSQL; sólo limpia un borrador vencido de `sessionStorage`. |
| Baja | Persistían referencias visuales internas a 1.7.10/1.7.14. | HTML, recursos, pie de página, configuración y paquete se sincronizaron como 1.7.15. | Ninguno. |
| Baja | La guía afirmaba erróneamente que las dos copias de la migración 002 eran distintas. | Se documentó que son idénticas y que debe ejecutarse una sola copia. | Ninguno. |

## Revisión por componente

### Aplicación y servidor

- `server.js`: rutas, cookies firmadas, autorización por rol, revocación mediante `session_version`, límites de solicitud, consultas parametrizadas, validación de catálogos, transacciones, bitácora, limitación de intentos, archivos públicos y encabezados HTTP.
- `app.js`: acceso del asesor, restauración de sesión, búsqueda/alta de alumnos, cronómetro, persistencia temporal, guardado remoto, historial, filtros, CSV seguro, impresión y cierre de sesión.
- `admin.js`: acceso y recuperación, panel, estadísticas, historial, filtros, exportaciones XLSX auténticas, impresión ejecutiva, catálogos, periodos, grupos, cuentas y navegación por secciones.
- `index.html` y `admin.html`: formularios, etiquetas, autocompletado, recursos, IDs únicos, versión, accesibilidad básica y estructura adaptable.
- `styles.css`: escritorio, móvil, tablet, navegación fija, tablas desplazables, impresión y reglas para evitar desbordamientos.
- `exceljs.min.js`: dependencia local usada para generar libros `.xlsx` estándar sin cargar código externo.

### Base de datos

- `database/001_esquema_inicial_sistema_tutorias.sql`: esquema, relaciones, restricciones, índices iniciales, datos base y RLS.
- `database/002_acceso_administrador.sql` y `002_acceso_administrador.sql`: copias idénticas para acceso administrativo; no deben ejecutarse dos veces por necesidad operativa, aunque la migración es compatible.
- `database/003_fortalecimiento_seguridad.sql`: bitácora de auditoría e índices.
- `database/004_integridad_seguridad_crecimiento.sql`: versión de sesión, intentos de acceso y restricciones de longitud/consistencia.
- `database/005_indices_crecimiento.sql`: índices para consultas de crecimiento.

Las migraciones son acumulativas y no contienen instrucciones `DROP TABLE`, `TRUNCATE` ni borrado masivo de registros.

### Recursos y documentación

- `logo-bis-universities.png` y `assets/logo-bis-universities.png`: copias idénticas conservadas para compatibilidad de rutas.
- `README.md`, `GUIA_DEL_CODIGO.md`, `SEGURIDAD_Y_DESPLIEGUE.md`, `PRUEBAS_RESPONSIVAS.md`, `AUDITORIA_FASES_1_2_3.md` y notas de versión: revisados como documentación operativa e histórica.
- `package.json` y `package-lock.json`: versión y dependencias sincronizadas.
- `sistema-tutorias.code-workspace`: configuración de espacio de trabajo; no interviene en producción.

### Pruebas automatizadas

- `tests/security-check.js`: controles esenciales de seguridad.
- `tests/responsive-check.js`: estructura adaptable de ambas vistas.
- `tests/audit-regression-check.js`: correcciones funcionales y preventivas de auditoría.
- `tests/phase2-check.js` y `tests/phase2-growth-check.js`: integridad y crecimiento.
- `tests/phase3-integration-check.js`: integración técnica final.
- `tests/schema-compatibility-check.js`: compatibilidad con instalaciones anteriores.
- `tests/xlsx-export-check.js`: estructura real de libros Excel.

## Evidencia de verificación

| Comprobación | Resultado |
|---|---|
| `node --check` en servidor y scripts | Correcto |
| Suite `npm test` | Todas las pruebas correctas |
| `npm audit --omit=dev` | 0 vulnerabilidades conocidas |
| IDs duplicados en HTML | Ninguno |
| Recursos estáticos principales | HTTP 200 |
| Acceso directo a `server.js` y migraciones | HTTP 403 |
| Intento de recorrido de ruta | HTTP 403 |
| Solicitud POST desde origen ajeno | HTTP 403 |
| CSP, `nosniff`, anti-frame, referrer y permissions policy | Presentes |
| Exportaciones administrativas | XLSX estándar |
| Copias de migración 002 | Idénticas |
| Copias del logotipo | Idénticas |

La prueba local sin `DATABASE_URL` devuelve 503 en salud y APIs dependientes de PostgreSQL, comportamiento esperado: evita aparentar disponibilidad cuando la base no está configurada.

## Riesgos operativos que dependen del despliegue

El código no puede verificar por sí solo la configuración externa de Render, GitHub o PostgreSQL. Antes de publicar se debe confirmar:

1. `DATABASE_URL` apunta a la base correcta.
2. `SESSION_SECRET` tiene al menos 32 caracteres y no se publica en GitHub.
3. Las migraciones 001 a 005 están registradas/aplicadas en orden.
4. Existe un respaldo reciente y restaurable de PostgreSQL.
5. El servicio usa HTTPS y Node.js 18 o superior.
6. Se realiza una prueba real con un administrador y un asesor: acceso, búsqueda, inicio/fin, historial, estadísticas, Excel, impresión y cierre de sesión.
7. Se prueba al menos Chrome/Edge de escritorio y Safari/Chrome móvil. Las extensiones del navegador pueden producir mensajes `content.js` ajenos al sistema.

## Procedimiento recomendado de publicación

1. Conservar el ZIP estable anterior como reversión.
2. Respaldar la base de datos.
3. Subir todos los archivos de esta versión, no sólo los tres scripts principales.
4. Ejecutar `npm ci` y `npm test`.
5. Verificar variables de entorno y desplegar.
6. Hacer recarga completa del navegador para evitar recursos antiguos en caché.
7. Ejecutar la prueba funcional descrita arriba antes de habilitar el uso general.

## Conclusión

La versión 1.7.15 conserva la estructura, usuarios, contraseñas y asesorías existentes. Corrige los hallazgos preventivos detectados durante la revisión integral y deja una base verificable para reducir errores futuros. No requiere una migración nueva de datos.
