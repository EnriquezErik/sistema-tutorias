# Sistema de Tutorías v42 — v1.7.15, candidata de validación

## Base conservada
Se partió exclusivamente de v1.7.14. Se conservan las pantallas de Registro y Administración, sus estilos, catálogos, historial, impresión, exportaciones, autenticación, endpoints existentes y migraciones SQL 001–005. No se accedió a Supabase ni se modificaron datos reales.

## Correcciones de esta iteración
1. La paginación administrativa ahora recupera el total de registros con una consulta COUNT parametrizada cuando una página está vacía (antes reportaba incorrectamente total cero si el desplazamiento superaba el último registro).
2. Se endureció la interpretación de `limit` y `offset` para evitar valores parciales como `25abc` y valores no enteros; se mantienen los límites previos.
3. La ruta pública `/api/health` ahora responde únicamente `ok` y `status` (ok/unavailable) sin divulgar nombres de variables de entorno, proveedores o detalles de la conexión.
4. Se sincronizó la versión mostrada por las páginas y la configuración administrativa con v1.7.15.
5. Se añadió una prueba automatizada específica para estas regresiones.

## Comprobación
`npm test` superó las comprobaciones de sintaxis y las diez pruebas estáticas incluidas, incluida la nueva prueba de endurecimiento. Estas pruebas NO sustituyen pruebas integrales con PostgreSQL ni en navegadores reales.

## Pendientes antes de publicar
- Integrar completamente paginación y agregados SQL con la interfaz administrativa, que sigue consultando el conjunto completo de asesorías en `/api/admin/data`.
- Validar la secuencia de migraciones en una base de pruebas y restauración de respaldo; verificar datos anteriores y posterior a la migración.
- Ejecutar pruebas de acceso, sesiones, catálogos, historial, estadísticas, impresión, exportación, rendimiento, concurrencia, dispositivos y navegadores con datos de prueba.
- Verificar la aplicación efectiva de reglas de integridad y seguridad en la base desplegada.

**Estado: candidata técnica, NO autorizada para sustituir la versión publicada.**
