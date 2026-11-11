# Sistema de Asesorías Académicas · versión estable: v42

La v42 mantiene el registro de asesorías, catálogos, estadísticas, filtros, impresión y exportación. Incorpora protección visual y funcional de las pantallas de acceso, validación de sesiones y presentación institucional.

La Administración utiliza navegación por vistas: Inicio y Estadísticas permanecen juntos; Historial y reportes, Catálogos y Seguridad se presentan por separado desde la parte superior, sin recorridos verticales entre áreas.

En dispositivos móviles, el encabezado administrativo distribuye el logotipo, el nombre institucional y las acciones de sesión en filas independientes para evitar superposiciones.

La versión 1.7.16 conserva la estructura y todas las correcciones anteriores. En Administración, las exportaciones de estadísticas e historial se generan mediante una biblioteca XLSX estándar incluida localmente, compatible con Excel de escritorio y Office móvil. La impresión de Estadísticas incorpora un resumen ejecutivo profesional. El encabezado institucional y la barra de navegación permanecen juntos durante el desplazamiento; en móviles el menú funciona como una fila horizontal desplazable. La auditoría integral añadió validaciones preventivas de sesión, límites de solicitud, vigencia del cronómetro y selección del cuatrimestre actual. Ninguno de estos cambios elimina registros existentes.

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

Para una instalación nueva ejecute, en orden:

1. `database/001_esquema_inicial_sistema_tutorias.sql`
2. `database/002_acceso_administrador.sql`
3. `database/003_fortalecimiento_seguridad.sql`

La versión 1.7.10 puede publicarse después de las migraciones o, gracias a su compatibilidad, antes de ejecutarlas sin bloquear el acceso. Ambas migraciones son acumulativas y no eliminan registros.

## Publicación

Consulte `SEGURIDAD_Y_DESPLIEGUE.md`. Son obligatorias en Render las variables `DATABASE_URL`, `SESSION_SECRET` y `NODE_ENV=production`. Si la cuenta administrativa existente todavía no tiene contraseña, use temporalmente `ADMIN_INITIAL_PASSWORD` como se explica en la guía.

## Comprobaciones

- `npm test` valida sintaxis y controles esenciales de seguridad.
- `/api/health` confirma la conexión con PostgreSQL.
- `/api/bootstrap` entrega los catálogos activos.

La v40 debe conservarse sin modificaciones como punto de recuperación.
