# v1.7.39 — 24 de noviembre de 2026
Base: v1.7.38 congelada. Candidata; no autorizada para producción.

- N-01: consulta de alumnos exige asesor activo y versión de sesión cuando el esquema la ofrece.
- N-02: nuevas operaciones requieren borrador existente, identificador y revisión coincidentes. Los reintentos ya confirmados se reconocen antes de esa exigencia.
- N-03: cierre de sesión exige confirmación de respaldo si hay una asesoría en curso; si falla, conserva el formulario.
- N-04: se fija el término antes de respaldar, se bloquea la edición durante el guardado, se comprueba el contenido y los metadatos del borrador en backend antes de insertar. Si no coinciden, se rechaza la operación. Reintentar conserva la hora de término elegida. No equivale a prueba de concurrencia real.
- N-15: captura de excepciones no controladas en el despacho HTTP, sin exponer detalles al cliente. No se probó caída real de PostgreSQL.
- N-05: filtros día/semana/mes utilizan inicioIso, con fecha de creación como respaldo para registros antiguos sin inicioIso; se conserva criterio de cuatrimestre.
- N-13: IEHL incorporado a impresión de historial y estadísticas administrativas. Pendiente revisión visual de impresión.
- N-14: instrucciones de recuperación TLS en docs/RESPALDO_Y_RECUPERACION.md; certificado y secretos no incluidos.

N-06 a N-10 siguen abiertos. Migraciones sin modificación. No se intervino producción. No se ejecutaron pruebas con PostgreSQL, navegadores reales ni múltiples asesores. La protección de borradores y reintentos requiere integración antes de desplegar.
