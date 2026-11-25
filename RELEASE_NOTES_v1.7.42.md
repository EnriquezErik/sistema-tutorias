# v1.7.42 — 24 de noviembre de 2026
Base: v1.7.41. Respaldo operativo: v1.7.38, sin alteraciones.

- P-01: una consulta fallida de capacidades del esquema ya no desactiva la comprobación de la versión de sesión. Se rechaza la solicitud y se permite reintentar la detección. La compatibilidad con esquemas donde realmente no existe la columna se mantiene.
- P-02: recuperación local opcional de cambios pendientes con consentimiento explícito por asesoría, identificador de cuenta y copias separadas; se solicita confirmación al recuperar, se comprueba el estado de la operación en servidor antes de restaurar y se elimina la copia confirmada. Vencimiento de 24 horas, con limpieza al abrir el sistema. Los datos locales no se cifran: solo usar en equipos privados autorizados. No protege si el navegador borra el almacenamiento, si se deniega el consentimiento o si el dispositivo se pierde. Conflictos simultáneos y recuperación real aún requieren pruebas. No se garantiza conservación ilimitada.
- Se añadió id de cuenta a respuesta de login para separar copias locales; sin cambios al formato de cookies ni TLS.
- Se conserva el arranque corregido de v1.7.41. Sin modificaciones CSS ni SQL. No se ejecutaron migraciones ni se accedió a producción.
- Pruebas: npm test con Node 22.16.0; 31 comprobadores y tres verificaciones de sintaxis. Arranque HTTP con dependencias simuladas. Sin integración real PostgreSQL, navegadores o Render.
