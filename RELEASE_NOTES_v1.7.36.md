# v1.7.36 — 24 de noviembre de 2026
Base: ZIP v1.7.35. Candidata parcial, no autorizada para producción.

- L-01: exige confirmación del respaldo antes de finalizar; si falla, mantiene el formulario. Compara contenido incluso con revisiones iguales; conserva copia de conflicto por operación en sessionStorage. El servidor rechaza revisiones inválidas o no iniciales cuando no existe borrador. Pendiente recuperación duradera de copias, interfaz de resolución completa y prueba multiusuario.
- L-06: filtros de Registro y Administración construyen fechas ISO explícitas mediante formatToParts, sin depender del formato localizado. Pendiente verificar navegadores y otros usos de fechas.
- H-09: reemplazo de AbortSignal.timeout por AbortController y temporizador, conserva cancelación externa y límite aunque exista señal externa. 12 s Registro, 30 s Administración. El límite del cliente no garantiza cancelación de una operación ya iniciada en PostgreSQL. Pendiente verificar tiempos reales y colas.
- L-05: se conserva la carga transaccional de v1.7.35; no se implementó instantánea compartida entre solicitudes de la API paginada.
- L-07: no se implementó la sustitución de la descarga completa por agregación/paginación. Se conserva el alcance de reportes y exportaciones.
- H-14: no se amplió la modularización en esta versión.
- L-03 y H-11: se conservan las implementaciones previas.

Pruebas: npm test finalizó con código 0: 26 scripts de comprobación y 3 verificaciones de sintaxis. Nueva prueba draft-sync-runtime-check.js simula rechazo de finalización sin respaldo y cancelación por límite o señal externa. No se ejecutó PostgreSQL, navegador real, TLS, concurrencia real ni producción. No se modifican SQL, CSS ni plataformas remotas.
