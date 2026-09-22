# v41 · Fortalecimiento de seguridad

Esta versión conserva la estructura y las funciones de la v40. La v40 permanece como respaldo estable.

## Antes de desplegar

1. Ejecute `database/003_fortalecimiento_seguridad.sql` en el SQL Editor de Supabase.
2. En Render configure `SESSION_SECRET` con una cadena aleatoria de 64 caracteres o más.
3. Si el administrador todavía no tiene contraseña, configure temporalmente `ADMIN_INITIAL_PASSWORD` con una contraseña fuerte de 10 caracteres o más. Al iniciar una vez y comprobar el acceso, elimine esa variable de Render.
4. Mantenga `DATABASE_URL` únicamente en las variables privadas de Render. Nunca la coloque en GitHub ni en archivos del proyecto.
5. Configure `NODE_ENV=production` y, opcionalmente, `SESSION_MAX_AGE_SECONDS=43200` (12 horas).
6. En Supabase active la exigencia de SSL y prepare respaldos periódicos.

## Cambios aplicados

- Contraseñas obligatorias de al menos 10 caracteres.
- Hash bcrypt con costo 12; nunca se guarda la contraseña original.
- Sesiones firmadas, `HttpOnly`, `Secure`, `SameSite=Strict` y duración predeterminada de 12 horas.
- Bloqueo por 15 minutos después de cinco intentos fallidos de acceso.
- Validación del origen en operaciones que modifican información.
- Encabezados CSP, HSTS, anti-iframe, `nosniff`, privacidad de referencia y restricción de permisos.
- Eliminación del acceso local alternativo y de copias permanentes de alumnos, asesorías y sesiones en `localStorage`.
- La asesoría en curso usa `sessionStorage`: resiste F5, pero desaparece al cerrar la pestaña.
- Los datos del historial se escapan antes de insertarse en HTML para reducir riesgo XSS.
- Si PostgreSQL no responde, el formulario no se borra ni simula que guardó: permite volver a intentar.
- Migración para bitácora de seguridad y acciones administrativas.

## Transición de cuentas

La v41 no permite iniciar sesión con cuentas cuyo `password_hash` esté vacío. Antes de entregarla:

- Configure la contraseña administrativa mediante `ADMIN_INITIAL_PASSWORD`.
- Desde el catálogo de asesores cree las cuentas definitivas con una contraseña temporal fuerte.
- Entregue cada contraseña por un medio privado y solicite su cambio en una siguiente fase si se incorpora autoservicio.

## Respaldo y recuperación

- Conserve la v40 sin modificar.
- Use una base separada para pruebas.
- Programe exportaciones cifradas de PostgreSQL y pruebe periódicamente que puedan restaurarse.
- Si una credencial apareció alguna vez en GitHub, no basta con borrarla: debe rotarse en Supabase o Render.
