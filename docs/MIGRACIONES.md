# Migraciones y traslado institucional

Orden: 001 esquema inicial; 002 acceso administrativo; 003 auditoría y seguridad; 004 integridad y sesiones; 005 índices; 006 instantánea de datos del alumno; 007 identificador único por asesor y operación; 008 borradores privados. 009 revisión de borradores y huella de operaciones. No ejecutar legacy/.

1. Identificar origen y destino y consultar public.schema_migrations. Contrastar también objetos y permisos reales; la tabla no demuestra por sí sola integridad.
2. Obtener respaldo verificado y restaurarlo en instancia aislada. No ejecutar migraciones indiscriminadamente sobre producción.
3. Aplicar solamente las pendientes en orden, una por una, en la copia. Registrar fecha, archivo, hash, resultado y responsable. Ejecutar scripts/verificar_esquema.sql (solo lectura) como diagnóstico. Revisar los resultados manualmente.
4. Confirmar extensiones pgcrypto/citext y roles anon/authenticated (referenciados por los SQL); en PostgreSQL institucional deben adaptarse o provisionarse roles equivalentes, previa revisión de privilegios. No ejecutar scripts Supabase sin revisar compatibilidad.
5. Configurar Node.js con una versión LTS soportada, npm ci, DATABASE_URL, SESSION_SECRET, NODE_ENV=production y CA oficial si se requiere. Mantener TLS verificado, HTTPS y acceso restringido de red. No publicar contraseñas ni archivos de datos.
6. Comparar conteos por cuatrimestre/estado, duración, catálogos, permisos y muestras autorizadas. La migración 006 rellena con datos disponibles al migrar, no reconstruye datos históricos perdidos.
7. Probar aplicación en destino aislado, acordar ventana de corte, detener escrituras en origen, tomar respaldo final, migrar y comprobar nuevamente. No permitir escrituras simultáneas en dos bases. Conservar origen protegido hasta aceptación. Si hay fallo, detener escrituras y reconciliar datos nuevos antes de volver al origen.
