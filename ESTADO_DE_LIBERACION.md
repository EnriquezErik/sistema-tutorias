# Estado de liberación — v1.7.15

**DICTAMEN: CANDIDATA; NO AUTORIZADA PARA SUSTITUIR PRODUCCIÓN.**

## Integración con plataformas
- GitHub: `.gitignore` excluye credenciales, respaldos y dependencias; revisar historial Git antes de publicar.
- Render: `render.yaml` incluye instalación reproducible, arranque, ruta de salud y secretos configurados fuera del repositorio. Revisar el plan y el nombre del servicio antes de usar el Blueprint.
- Supabase: conexión PostgreSQL mediante `DATABASE_URL`; no se ejecutan migraciones automáticamente. Hacer respaldo y restauración de prueba antes de aplicar 001–005 según estado real del esquema.

## Bloqueantes verificados en código
1. `admin.js` sigue consumiendo `/api/admin/data`, que descarga todas las asesorías; la paginación del servidor no está integrada de extremo a extremo.
2. No se ha ejecutado una prueba funcional con una copia real de Supabase/PostgreSQL.
3. No hay evidencia de pruebas de navegadores, dispositivos, recarga, doble clic y caída de red.
4. No se ha verificado la restauración de respaldo ni la reversión del despliegue.

## Pruebas para liberar
- Ejecutar `npm ci` y `npm test`.
- Restaurar respaldo anonimizado en proyecto Supabase aislado; comprobar conteos antes/después y migraciones no destructivas.
- Ejecutar flujos de asesor y administrador, exportaciones, impresión, filtros, seguridad, permisos y sesiones.
- Comprobar Render en servicio separado, sin enlazar la base productiva.
- Autorizar despliegue únicamente después de documentar evidencia y aprobar todos los criterios del plan de correcciones.
