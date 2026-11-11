# Auditoría interna y fases de corrección 1 2 y 3

## Propósito

Este registro documenta la revisión integral del Sistema de Tutorías, las correcciones aplicadas sin modificar su estructura funcional y las comprobaciones necesarias antes de publicar la versión 1.7.9. Su contenido se preparó como evidencia técnica para el Reto 5.

## Alcance y protección de la información

- Se mantuvieron las páginas de Registro y Administración, sus catálogos, filtros, impresión y exportación.
- No se ejecutaron operaciones sobre la base de datos real durante la corrección.
- Las migraciones 004 y 005 son acumulativas e idempotentes.
- No se incluyeron instrucciones `DROP` ni `TRUNCATE`.
- La versión 1.7.4 se conserva como respaldo previo y la 1.7.5 como avance intermedio.

## Auditoría interna aplicada

Se revisaron archivos HTML, CSS, JavaScript del cliente, servidor Node.js, migraciones SQL, dependencias, rutas públicas, autenticación, sesiones, consultas, formularios, navegación, impresión, exportación y adaptación de pantalla. Los principales riesgos localizados fueron sesiones que no podían revocarse inmediatamente, protección de acceso limitada a memoria, dependencia de la hora UTC, posibilidad de sobrescribir datos maestros de alumnos, ausencia de límites uniformes, exposición innecesaria en salud, consultas administrativas completas y falta de índices orientados a reportes.

## Fase 1 correcciones de integridad y compatibilidad

La fase 1 conservó la estructura de las vistas y corrigió presentación adaptable, encabezados, logotipos, bloqueo visual del contenido privado, navegación administrativa por áreas, validaciones de catálogos, guardado de carreras con clave y nombre, cálculo de horas y minutos, exportación segura e impresión. También se verificó que Registro y Administración mantuvieran sus funciones existentes.

Resultado interno: concluida y comprobada mediante pruebas de seguridad, estructura adaptable y regresión.

## Fase 2 fortalecimiento y crecimiento

### Bloque 1 seguridad e integridad

- Versionado de sesión para revocar accesos al cambiar contraseña o inactivar una cuenta.
- Control persistente de intentos de acceso con respaldo temporal en memoria.
- Validación de fechas según la zona horaria institucional.
- Protección de datos maestros del alumno: una nueva asesoría no sobrescribe automáticamente su expediente.
- Límites de longitud en usuarios, nombres, matrículas, catálogos y comentarios.
- Bitácora para altas, cambios de estado, seguridad, cierres de sesión y creación de asesorías.
- Respuesta mínima del servicio de salud.
- Migración 004 no destructiva.

### Bloque 2 rendimiento y escalabilidad

- Servicio administrativo paginado con límites de 1 a 200 registros por solicitud.
- Filtros parametrizados por cuatrimestre, asesor, carrera, grupo, materia, motivo y alumno.
- Total de resultados y señal de continuación de página.
- Servicio de estadísticas agregadas calculadas en PostgreSQL.
- Índices para fecha, cuatrimestre, asesor, alumno, materia, motivo y búsqueda de nombre.
- Migración 005 no destructiva.
- La respuesta administrativa anterior se conserva temporalmente para no romper la interfaz estable.

Resultado interno: concluida. La activación progresiva de la interfaz paginada puede realizarse posteriormente sin cambiar el modelo de datos.

## Fase 3 validación integral

### Incidencia de compatibilidad detectada durante el despliegue

Al publicar la versión 1.7.6 antes de ejecutar la migración 004, el acceso administrativo mostró el mensaje «No fue posible ingresar» y el Registro permaneció en «Verificando acceso». La causa fue que el servidor consultaba la columna `session_version`, todavía inexistente en la base desplegada. No se perdieron usuarios, contraseñas ni asesorías.

La versión 1.7.7 corrigió esta regresión mediante detección automática del esquema. Cuando la columna existe, utiliza sesiones revocables; cuando aún no existe, conserva temporalmente la validación compatible con la base anterior. Se añadió una prueba de regresión específica para impedir que una actualización vuelva a bloquear ambos accesos.

### Advertencias del navegador y alineación del historial

Durante una revisión con las herramientas de desarrollador se identificó que Chrome advertía que varios campos de contraseña no estaban contenidos en formularios. También se observó que «Exportar CSV» podía dividirse en dos líneas al reducir y volver a ampliar la ventana. Las versiones 1.7.8 y 1.7.9 incorporaron formularios semánticos en Registro, acceso administrativo, recuperación y seguridad; añadieron nombres y atributos de autocompletado; y estabilizaron la distribución de las acciones del historial. Los mensajes atribuidos a `content.js` pertenecen al contexto de extensiones del navegador y deben diferenciarse de los archivos del sistema.

### Comprobaciones automatizadas aprobadas

- Sintaxis de servidor, Registro y Administración.
- Encabezados y patrones esenciales de seguridad.
- Sesiones revocables y control persistente de intentos.
- Adaptación desde teléfonos estrechos hasta pantallas amplias.
- Navegación administrativa sin desplazamiento tipo carrusel.
- Presencia de logotipos y rutas públicas autorizadas.
- Conservación de impresión y exportación.
- Neutralización de fórmulas en CSV y Excel.
- Integridad de migraciones y ausencia de instrucciones destructivas.
- Servicios paginados y agregación estadística.
- Dependencias sin vulnerabilidades conocidas al momento de la revisión.

### Validaciones obligatorias en el entorno real

Estas pruebas requieren desplegar primero en un entorno de prueba conectado a una copia o respaldo de Supabase. No deben marcarse como aprobadas únicamente con análisis estático.

1. Ejecutar las migraciones 004 y 005 en orden y confirmar su registro en `schema_migrations`.
2. Iniciar sesión como administrador y asesor; actualizar la página y cerrar y abrir el navegador.
3. Registrar una asesoría de prueba y confirmar que aparece en ambos historiales.
4. Comprobar alumno nuevo y existente sin sobrescritura inesperada.
5. Agregar, inactivar y reactivar una carrera, grupo, materia, motivo, cuatrimestre y asesor.
6. Validar estadísticas, filtros, impresión y exportaciones.
7. Probar Chrome, Edge, Firefox y Safari actuales.
8. Probar teléfono Android, iPhone, tableta y computadora en orientación vertical y horizontal.
9. Revisar consola del navegador, registros de Render y consultas de Supabase.
10. Verificar tiempos de respuesta con el volumen real de información.

## Criterio de cierre

Las fases 1 y 2 se consideran concluidas en código. La fase 3 queda técnicamente preparada y con pruebas automatizadas aprobadas; su cierre operativo exige completar y firmar la matriz de pruebas reales después del despliegue controlado. Cualquier hallazgo deberá registrarse con fecha, dispositivo, navegador, evidencia, resultado esperado, resultado obtenido y corrección aplicada.

## Integración sugerida al Reto 5

En el apartado Desarrollo de las acciones puede describirse la auditoría, la clasificación de hallazgos, la aplicación gradual de correcciones y la metodología de pruebas. En Resultados obtenidos puede utilizarse la lista de comprobaciones automatizadas y, después del despliegue, completar la matriz del entorno real. En Conclusiones y recomendaciones debe señalarse que la versión mejora seguridad, integridad, compatibilidad y crecimiento, pero requiere conservar respaldos, documentar incidencias y repetir las pruebas antes de cada actualización.

Como hallazgo organizacional, puede explicarse que este proyecto integra funciones que normalmente se distribuyen entre análisis, desarrollo, base de datos, seguridad, pruebas, diseño, documentación y despliegue. Al ser desarrollado por una sola persona, la revisión por fases permitió reducir el riesgo de omitir aspectos técnicos y estableció un mecanismo de control comparable con la separación de responsabilidades de un equipo multidisciplinario.

## Orden de instalación

1. Conservar la versión estable anterior.
2. Crear y verificar respaldo de la base de datos.
3. Ejecutar migración 004.
4. Ejecutar migración 005.
5. Publicar la versión 1.7.9.
6. Ejecutar las pruebas de fase 3.
7. Autorizar producción únicamente si no existen fallas críticas.
