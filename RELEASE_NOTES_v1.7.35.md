# v1.7.35 — 24 de noviembre de 2026
Base exacta: v1.7.34. Candidata de estabilización parcial; no autorización de producción.

## Cambios físicos
- L-05: Administración utiliza una única carga coherente de asesorías, alumnos, usuarios y catálogos mediante `/api/admin/data`. Las consultas de esta carga usan una misma conexión y una transacción PostgreSQL `REPEATABLE READ READ ONLY`; en caso de fallo se revierte la transacción y se libera la conexión. La respuesta se emite tras COMMIT. Orden de asesorías: fecha de creación e identificador descendentes, igual al criterio utilizado por la descarga previa por cursor. Se evita mezclar resultados de diferentes páginas en la carga principal. La API paginada permanece disponible, pero no ofrece una instantánea compartida entre solicitudes; ahora rechaza mezclar cursor y desplazamiento.
- Administración descarta respuestas obsoletas al coincidir actualizaciones o cerrar sesión, y rechaza una respuesta incompleta sin reemplazar los registros existentes.
- L-07: se elimina la cadena de solicitudes de páginas durante la carga principal, pero NO la transferencia de todos los registros. Esta decisión privilegia consistencia de reportes y comparaciones; puede aumentar memoria y tamaño de respuesta individual. Es una solución intermedia, no una optimización de escalabilidad comprobada. Pendiente implementar consultas agregadas, paginación de historial y exportación a demanda con consistencia verificable. No se recortan datos para aparentar mejora de rendimiento.
- H-11: se conserva la opción de consultas paginadas sin conteo.
- L-01, L-06, H-09, H-14: permanecen parcialmente atendidos; L-03 conserva la implementación anterior, que requiere validar periodos ambiguos y PostgreSQL real.
- Se agregó `tests/admin-snapshot-check.js`: simula transacción, rollback, liberación de conexión, carga completa, respuestas obsoletas y respuesta incompleta. Las comprobaciones estáticas existentes de versión y ruta de carga fueron adaptadas al cambio real.

## Validación
`npm test`: 25 scripts de comprobación y 3 verificaciones de sintaxis, salida 0 (ver PRUEBAS_v1.7.35.txt). No se ejecutaron consultas en PostgreSQL real ni pruebas con navegadores, carga, TLS o múltiples usuarios. La simulación no demuestra aislamiento real de transacciones. Sin cambios en CSS, SQL ni plataformas de producción. No se declara resuelto L-07 ni el cierre integral de la paginación de la API.
