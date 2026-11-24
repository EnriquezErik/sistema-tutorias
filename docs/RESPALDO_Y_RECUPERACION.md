# Respaldo y recuperación

Propuesta pendiente de autorización: respaldo diario y antes de despliegues; retención y tiempos de recuperación definidos por la universidad. Responsable actual: desarrollador; futuro custodio: área de sistemas por confirmar.

Para PostgreSQL, usar cliente compatible y conexión autenticada con TLS verificado (PGSERVICE/PGPASSFILE protegidos fuera del repositorio). Ejemplo de copia lógica del esquema de aplicación, ejecutar en estación autorizada:

    pg_dump --dbname=service=tutorias_origen --format=custom --schema=public --file=tutorias.dump
    pg_restore --list tutorias.dump

Validar código de salida, advertencias, tamaño y SHA-256. Esta copia no cubre roles globales ni otros esquemas; inventariar extensiones, roles, permisos y cualquier dependencia externa por separado. Guardar cifrado, acceso limitado y copia separada; nunca GitHub. No considerar respaldo válido solo por existir archivo.

Restauración de ensayo exclusivamente en base desechable vacía, con roles/extensiones compatibles y destino confirmado:

    pg_restore --dbname=service=tutorias_pruebas --exit-on-error --single-transaction tutorias.dump

No usar --clean ni ejecutar en producción. Si roles o propietarios no coinciden, diseñar y revisar equivalencias antes de restaurar. Comparar conteos, restricciones, permisos, duración y muestras; comprobar login, registro, reportes y restauración lógica. Registrar tiempo real y pérdida potencial de datos. Los comandos no se ejecutaron en esta entrega.

Reversión de aplicación: conservar ZIP y commit desplegado previos, detener nuevas escrituras si procede, verificar compatibilidad del esquema y volver al commit validado. No restaurar respaldo antiguo sobre datos nuevos sin reconciliación. El ZIP no contiene datos ni recupera asesorías por sí solo.

Referencias: https://www.postgresql.org/docs/current/app-pgdump.html y https://www.postgresql.org/docs/current/app-pgrestore.html
