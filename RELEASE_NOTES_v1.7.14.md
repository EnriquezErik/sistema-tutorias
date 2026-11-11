# Sistema de Tutorías v42 — Versión 1.7.14

## Base y objetivo

Esta versión candidata parte de la copia estable fija 1.7.13. Atiende la organización de las migraciones y sus comprobaciones, conservando la estructura de Registro y Administración y las funciones existentes.

## Cambios aplicados

- Se concentran las migraciones ejecutables 001 a 005 en `database/`.
- Se conserva la copia duplicada de la migración 002 como archivo archivado fuera de la ruta ejecutable.
- Se organizan bajo `tests/` los comprobadores que ya invocaba el comando `npm test`.
- Se añade una comprobación estática de la ruta y secuencia canónica de migraciones.
- Se actualiza la versión técnica a 1.7.14 y se renuevan referencias de caché de las páginas.
- Se actualizan las instrucciones para distinguir migraciones ejecutables y archivo histórico.

## Alcance y conservación

- No se cambió el diseño general ni el flujo funcional de Registro o Administración.
- No se conectó ni se modificó una base de datos.
- No se ejecutaron migraciones ni la batería de comprobación.
- No se eliminaron registros ni se agregaron cambios destructivos a SQL.

## Estado de la validación de migraciones

La comprobación nueva valida que exista una sola secuencia local 001–005 y que la copia archivada sea idéntica a la migración 002 canónica. Esta revisión es estática: aún falta ejecutar la secuencia desde una base vacía y actualizar una copia anterior con datos en PostgreSQL desechable, registrar conteos antes/después y verificar la restauración. Por ello, esta copia es candidata para revisión y no debe considerarse liberada hasta completar esa validación.

## Hallazgos del plan en la base 1.7.13

La inspección del código encontró implementaciones previas para A-01, A-02, A-04, A-05, A-06 y M-01. A-03 ya no presenta los topes fijos de 1,000/5,000 y existen rutas de consulta paginada/agregada; la integración completa de esas rutas con la interfaz administrativa no se verificó contra una base con más de 5,000 registros. A-07 motivó la organización y comprobación estática incluida en esta versión; la prueba de actualización en PostgreSQL sigue pendiente.

---

**Versión técnica:** 1.7.14 candidata.  
**Versión base:** Sistema de Tutorías v42 · 1.7.13 estable.  
**Fecha:** 11 de noviembre de 2026.
