# Sistema de Asesorías Académicas · prototipo v24

Esta versión guarda en PostgreSQL los alumnos, las asesorías y el historial personal de cada asesor.

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
