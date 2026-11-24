# v1.7.40 — candidata de optimización parcial
- N-07: ambos clientes esperan hasta 45 s incluyendo lectura del cuerpo. No es un límite global de transacción; integración real pendiente.
- N-08: lectura y conteo de respaldo en una misma transacción REPEATABLE READ READ ONLY; cursor exige corte. No congela cambios entre peticiones.
- N-09: finally libera temporizador y listener externo tras éxito, fallo o cancelación; probado con simulaciones.
- N-10: módulo lib/http-response.js extraído; separación integral pendiente.
- N-06: JSON compacto y parámetro opcional period en /api/admin/data. La interfaz aún solicita todo el historial para conservar cálculos y exportaciones. No se cierra la descarga masiva.
- Sin cambios en CSS, TLS ni migraciones. No se accedió a producción. Pruebas locales no equivalen a integración real.
