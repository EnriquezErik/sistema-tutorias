# v1.7.45 — Confiabilidad y revocación de sesiones

Base: v1.7.44. Correcciones Q-01 a Q-04.

- Q-01: manejador de errores de clientes inactivos del pool, sin registrar credenciales ni finalizar el proceso por ese evento. Las solicitudes siguen usando su manejo de excepciones.
- Q-02: identificador aleatorio por token firmado y revocación persistente del hash SHA-256 del token exacto, incluidos tokens válidos anteriores sin identificador aleatorio. La revocación se confirma antes de eliminar la cookie. Las otras sesiones no se revocan. El hash no se serializa en respuestas. Si no se puede consultar la revocación, no se autoriza la solicitud. Las operaciones ya autorizadas y en curso pueden terminar. La limpieza de revocaciones vencidas ocurre al cerrar sesión, no por temporizador.
- Q-03: GZIP asíncrono, con respuesta no comprimida si falla la compresión; se conserva la negociación y el formato de datos. JSON.stringify y la carga completa de reportes permanecen síncronos/en memoria.
- Q-04: pipeline de Node con manejo de errores de lectura y desconexión; si una transmisión ya comenzó y falla, se aborta sin derribar el servidor.

## Despliegue obligatorio

1. Conservar v1.7.44 y respaldo congelado v1.7.38. Obtener respaldo verificable de PostgreSQL y probar en ambiente aislado.
2. Aplicar solamente `database/010_revocacion_individual_sesiones.sql` en la base que ya tiene 001–009, con una cuenta autorizada. La migración crea una tabla privada de hashes y vencimientos, índice, RLS y entrada de control. No modifica alumnos, asesorías, catálogos ni borradores. Verificar que la cuenta de conexión del backend pueda SELECT, INSERT y DELETE en la nueva tabla; no otorgar permisos a anon/authenticated ni PUBLIC. Si la cuenta no es propietaria o no evita RLS de forma autorizada, configurar privilegios/política específica con el administrador de base de datos. No desactivar RLS para resolver permisos.
3. Subir todos los archivos manteniendo carpetas; Render usa Node 22.x y `npm ci --omit=dev && npm run verify:deploy`. Mantener CA, DATABASE_URL y SESSION_SECRET existentes. `/api/health` comprueba también acceso de lectura a la tabla nueva; si falta devuelve 503.
4. Validar en ambiente aislado: iniciar sesión con dos navegadores, cerrar uno, comprobar que otro conserva acceso; repetir para Administración. Comprobar revocación después de reiniciar servidor, error de base de datos, recuperación de borradores y reportes. No probar con registros reales sin autorización.
5. La migración es compatible con versiones anteriores en cuanto al esquema; pero v1.7.44 y anteriores NO comprueban la tabla de revocación. Si se necesita retroceder, coordinar rotación de SESSION_SECRET (invalida todas las cookies) y conservación de borradores antes de hacerlo; no borrar la tabla. Tokens antiguos idénticos, si existieran, se revocan juntos, pues son indistinguibles. Los tokens nuevos tienen identificador aleatorio.

## Límites

Pruebas locales con PostgreSQL y bcrypt simulados; no se ejecutó SQL real ni se certificó Render. N-06, N-07, N-08, N-10, P-06 permanecen como riesgos residuales; P-05 requiere validación del despliegue real.
