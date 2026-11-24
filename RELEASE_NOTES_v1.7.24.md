# v1.7.24 — candidata
- Expediente individual de solo lectura en Administración, por matrícula exacta, todos los periodos cargados, sin anuladas.
- Alta explícita de materia al finalizar una asesoría; reutiliza nombres existentes, no reactiva materias inactivas; alta y auditoría en la misma transacción.
- La edición de asesorías finalizadas conserva el selector existente; no crea materias nuevas desde esa ventana.
- Sin migración adicional; requiere 001–008 y configuración TLS previa.
- Pruebas locales estáticas y simulación del expediente; pendientes navegador, PostgreSQL real y concurrencia.
