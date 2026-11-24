# v1.7.18 — candidata
Base: v1.7.17 edición unificada. Inicio del cronómetro sin datos; validación al finalizar. Campos del alumno editables, búsqueda por matrícula conservada y captura de carrera/grupo durante la sesión. Los cambios de datos maestros se auditan y las asesorías guardan una copia de sus datos académicos.

## Despliegue
1. Respaldar Supabase y comprobar recuperación. Pausar escrituras y despliegue automático.
2. Ejecutar únicamente database/006_historial_datos_alumno.sql en SQL Editor antes de desplegar. Es aditiva y rellena registros previos con los datos disponibles actualmente; no reconstruye datos históricos ya alterados.
3. Verificar que no queden snapshots nulos; desplegar y probar en entorno controlado. No se ejecutó SQL real en esta revisión.
4. Si se revierte a código anterior, este no usa snapshots. Antes de volver a esta versión, repetir 006 con escrituras pausadas. No eliminar la columna.

Pruebas locales: npm test. Pendiente PostgreSQL real, navegador y regresión funcional. No declarar estable todavía.
