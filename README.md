# Sistema de Asesorías Académicas · versión 40

Esta versión guarda en PostgreSQL los alumnos, las asesorías y el historial personal de cada asesor.

## Novedades v40

- Carreras, materias y motivos se crean, inactivan y reactivan directamente en PostgreSQL.
- Los catálogos activos se actualizan en el formulario de Registro de Asesorías al volver a cargarlo.
- Estadísticas administrativas de asesorías por sexo y canalizaciones por sexo.
- Las estadísticas nuevas se incluyen en la impresión y en la exportación a Excel.
- Protección contra envíos repetidos al finalizar una asesoría.
- Una asesoría en curso se conserva en el navegador si se actualiza o cierra accidentalmente la página.
- Advertencia antes de cerrar sesión cuando existe una asesoría en curso.
- Las contraseñas de asesores continúan siendo opcionales.
- No se agregó la clasificación individual/grupal, conforme a lo acordado.

## Corrección v39: validación de carrera y grupo

- La carrera y el grupo se validan juntos mediante su relación real en PostgreSQL.
- La comparación admite diferencias accidentales de mayúsculas y espacios exteriores.
- Si el problema corresponde a materia, motivo o cuatrimestre, la página ahora muestra el dato exacto que debe actualizarse en lugar de atribuirlo al grupo.
- No modifica ni elimina carreras, grupos, alumnos ni asesorías existentes.

## Novedad v31: estado de las cuentas de asesores

- El catálogo de asesores muestra cuentas activas e inactivas.
- El administrador puede inactivar o reactivar cada cuenta con confirmación.
- Un asesor inactivo no puede iniciar sesión ni utilizar una sesión anterior.
- El historial del asesor se conserva y permanece disponible en los reportes.
- Los conteos y filtros operativos incluyen únicamente asesores activos.

## Novedades de Administración

- Cuenta independiente `Administrador`, inicialmente sin contraseña.
- Sesión administrativa persistente y separada de la sesión del asesor.
- Historial, estadísticas, alumnos y asesores cargados desde PostgreSQL.
- Creación central de nuevos asesores con contraseña opcional.
- Configuración posterior de contraseña administrativa.
- Clave de recuperación almacenada únicamente como hash bcrypt.
- Recuperación de contraseña desde la pantalla de acceso.
- La clave de recuperación queda invalidada después de utilizarse y debe configurarse nuevamente.

## Paso obligatorio antes de publicar

1. Abra **Supabase → SQL Editor → New query**.
2. Copie y ejecute todo el archivo `002_acceso_administrador.sql`.
3. Confirme que el resultado muestre el usuario `Administrador` con rol `admin`.
4. Después suba los archivos de esta versión a GitHub.

La primera entrada a `admin.html` se realiza con el usuario `Administrador` y la contraseña vacía. Inmediatamente después configure una clave de recuperación desde la sección **Seguridad**. La contraseña puede permanecer vacía durante el prototipo.

## Qué ya utiliza la base de datos

- Inicio de sesión de asesores mediante `app_users`.
- Nombre de la institución.
- Cuatrimestres activos.
- Carreras, grupos, materias y motivos de asesoría.
- Sesión segura del servidor mediante cookie `HttpOnly`.
- Búsqueda de alumnos por matrícula desde cualquier equipo.
- Alta o actualización automática del alumno al finalizar una asesoría.
- Registro central de cada asesoría en `advisories`.
- Historial obtenido desde PostgreSQL y limitado al asesor conectado (Administración puede consultar el conjunto completo mediante la API).
- Validación de que el grupo corresponda a la carrera seleccionada.

Si Render o PostgreSQL no están disponibles temporalmente, la página conserva los últimos catálogos descargados. Una asesoría que no pueda enviarse se guarda temporalmente en ese navegador y muestra un aviso explícito.

## Publicación en Render

1. Suba todos los archivos de esta carpeta a la raíz del repositorio de GitHub.
2. Render instalará las dependencias definidas en `package.json` y ejecutará `node server.js`.
3. Mantenga configurada la variable secreta `DATABASE_URL` con la cadena de conexión de Supabase.
4. Se recomienda agregar `SESSION_SECRET` con un valor largo y aleatorio. Si no existe, el servidor obtiene una clave estable a partir de `DATABASE_URL` para que el prototipo pueda funcionar.

## Comprobaciones

- `/api/health`: confirma la conexión y muestra los totales de los catálogos.
- `/api/bootstrap`: entrega a la página los catálogos activos de PostgreSQL.
- El catálogo **Cuatrimestres** del panel administrativo ya guarda directamente en `public.periods` (nombre, fecha inicial y fecha final). También permite inactivar o reactivar sin eliminar el historial.
- Se rechazan nombres duplicados, fechas inválidas y rangos que se traslapen con otro cuatrimestre activo.
- El encabezado del registro, los filtros del historial y los selectores del dashboard se alimentan de la misma tabla `public.periods`. El encabezado usa el cuatrimestre activo y los filtros conservan también los periodos históricos inactivos.
- La página del asesor vuelve a consultar los cuatrimestres al regresar a su pestaña, por lo que los cambios del administrador se reflejan sin cerrar la sesión ni presionar F5.
- El catálogo **Grupos** guarda directamente en `public.student_groups`, sin un límite fijo de registros. Cada grupo se relaciona con una carrera, puede inactivarse sin borrar historiales y aparece en Registro de Asesorías al seleccionar la carrera correspondiente.
- `/api/session`: confirma si existe una sesión válida.
- `/api/students/{matrícula}`: busca al alumno para autocompletar sus datos.
- `/api/advisories`: registra una asesoría o devuelve el historial autorizado.

Después del despliegue, abra la página en una ventana privada. El usuario inicial es `Erik`; mientras su campo `password_hash` esté vacío, no requiere contraseña. Registre una asesoría de prueba y confirme en Supabase que aumentaron las tablas `students` y `advisories`. Antes de una prueba institucional se debe asignar una contraseña y proteger el panel administrativo.

## Desarrollo local

```bash
npm install
npm start
```

Abra `http://localhost:3000`. Sin `DATABASE_URL`, la interfaz seguirá disponible en modo local y `/api/health` indicará que falta configurar la base de datos.

## Archivos principales

- `server.js`: servidor web y API.
- `app.js`: página del asesor y consumo de catálogos remotos.
- `admin.js`: administración actual del prototipo.
- `database/001_esquema_inicial_sistema_tutorias.sql`: esquema inicial de PostgreSQL/Supabase.

La migración SQL ya fue aplicada en Supabase. No es necesario volver a ejecutarla para publicar esta versión.
