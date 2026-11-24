# v1.7.21 — candidata
Identificador por asesoría conservado en sessionStorage; bloqueo transaccional e índice único por asesor y operación. Un reintento de una operación ya guardada devuelve el ID existente. No detecta asesorías independientes duplicadas ni recupera sesiones tras pérdida de sessionStorage.
## Despliegue
Respaldar PostgreSQL y verificar restauración. Aplicar únicamente database/007_operacion_unica.sql después de 006. Configurar DATABASE_CA_CERT en Render con el certificado CA oficial de la conexión Supabase si la cadena no es reconocida por Node. TLS exige certificado válido; no desactivar la verificación. Se ignoran parámetros SSL de DATABASE_URL para evitar que sustituyan esta configuración. Comprobar conexión antes de liberar. La migración conserva registros existentes y admite NULL para versiones anteriores.
## Validación
Pruebas locales estáticas y simulación de reintento; pendientes PostgreSQL real, concurrencia, conexión TLS y regresión de navegador. No se ejecutó SQL productivo. Conservar v1.7.20 y v1.7.16.
