# Sistema de Tutorías — v1.7.48

## Cambios
- Búsqueda de alumnos por matrícula exacta o por coincidencia de nombre completo.
- Cuando hay varias coincidencias por nombre, se solicita seleccionar al alumno correcto; se muestra nombre y matrícula.
- La búsqueda exacta por matrícula conserva prioridad.
- Campo de búsqueda acepta matrícula o nombre; también se puede escribir un nombre en el campo Nombre completo y presionar Enter para buscar.
- Se agregó control Ver/Ocultar contraseña en el acceso de asesor y en el acceso de administración.

## Alcance y conservación
- No se modificó el esquema de PostgreSQL ni se agregó una migración.
- No se alteran ni eliminan registros de alumnos, asesorías, asesores o catálogos.
- La búsqueda por nombre usa el catálogo activo de alumnos y conserva la matrícula como identificador.
- Se mantuvo la estructura visual y los flujos existentes, con cambios puntuales en los campos de búsqueda y acceso.

## Verificación técnica
- `node --check` correcto para app.js, admin.js y server.js.
- La validación de funcionamiento con datos reales requiere probar la versión en el entorno conectado a Supabase/PostgreSQL.
