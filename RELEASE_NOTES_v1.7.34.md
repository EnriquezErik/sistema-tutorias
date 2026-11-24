# v1.7.34 — 24 de noviembre de 2026
Base exacta: v1.7.33. Candidata parcial, no autorización de producción.

- L-03: recuperación del periodo original a partir del borrador persistido, fecha original y nombre/ID disponibles, incluso si el periodo está inactivo. Si no hay coincidencia única, se conserva el formulario y se bloquea el guardado sin periodo identificado. Pendiente integración PostgreSQL y casos ambiguos que necesitan revisión humana.
- L-06: los campos datetime-local de corrección de Registro convierten desde y hacia la zona institucional. Rechazan horas inválidas o ambiguas por cambios de horario. Prueba aislada aprobada; falta revisión integral de zonas horarias en ambas interfaces.
- L-01: comparación del contenido del borrador incluye fechas, ajustes y campos; se conserva el periodo remoto al recuperar una revisión coincidente. Continúa pendiente recuperación durable y reconciliación integral de conflictos.
- H-09: límites PostgreSQL de sentencia (25 s), bloqueo (10 s) y transacción inactiva (60 s). No son un límite global por solicitud; validar en base aislada.
- H-14: extracción de resolveDraftPeriod a lib/draft-period.js. Modularización general pendiente.
- L-05 y L-07: pendientes; sin cambio a la arquitectura de reportes.
- H-11: optimización anterior conservada.

Pruebas: npm test (24 comprobadores y 3 verificaciones de sintaxis), código de salida 0. Simulaciones y análisis estático; no se ejecutó PostgreSQL ni navegadores. No se cambió CSS ni SQL ni producción.
