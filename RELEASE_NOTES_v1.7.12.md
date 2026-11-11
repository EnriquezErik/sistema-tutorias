# Sistema de Tutorías v42 — Versión 1.7.12

## Descripción general

La versión **1.7.12** corresponde a la versión estable del Sistema de Tutorías utilizado para el registro, control, consulta y seguimiento de asesorías académicas. Se conserva la estructura funcional de la versión 42 y se incorporan las correcciones acumuladas de las fases de auditoría, seguridad, compatibilidad, diseño adaptable y exportación administrativa.

Esta actualización corrige definitivamente la generación de archivos de Excel en la página de Administración, sin modificar el funcionamiento de la página de Registro de Asesorías ni eliminar información almacenada en la base de datos.

## Alcance de la versión

El sistema mantiene dos interfaces principales:

1. **Registro de Asesorías:** utilizada por los asesores para iniciar sesión, registrar una asesoría y consultar su historial.
2. **Administración:** utilizada por la persona administradora para consultar indicadores, estadísticas, reportes, catálogos y opciones de seguridad.

## Características del Registro de Asesorías

- Inicio de sesión de asesores mediante usuario y contraseña, cuando corresponda.
- Conservación de la sesión conforme a la configuración de seguridad del sistema.
- Captura de matrícula y búsqueda de alumnos existentes.
- Registro y consulta de los siguientes datos:
  - matrícula;
  - nombre completo;
  - sexo;
  - carrera;
  - grupo;
  - turno;
  - materia;
  - motivo de la asesoría;
  - comentarios;
  - asesor responsable;
  - canalización a psicopedagogía;
  - cuatrimestre;
  - fecha, hora de inicio, hora de término y duración.
- Validación de campos obligatorios.
- Validación de correspondencia entre carrera y grupo.
- Cronómetro para medir la duración de la asesoría.
- Finalización y almacenamiento de asesorías en la base de datos.
- Consulta del historial del asesor.
- Filtros por periodo y rango de tiempo.
- Impresión y exportación del historial de acuerdo con las funciones disponibles en Registro.
- Diseño adaptable para computadoras, laptops, tablets y teléfonos inteligentes.

> **Importante:** los archivos funcionales de Registro (`index.html`, `app.js` y `styles.css`) permanecieron sin cambios en la corrección 1.7.12.

## Características de Administración

### Inicio y panel administrativo

- Selección del cuatrimestre que se desea consultar.
- Indicadores de alumnos, asesorías, tiempo acumulado, asesores, materias utilizadas y canalizaciones.
- Resumen del periodo seleccionado.
- Consulta del tiempo recibido por alumno.

### Estadísticas

- Tiempo y cantidad de asesorías por materia.
- Asesorías por motivo.
- Actividad por carrera y grupo.
- Tiempo y cantidad de asesorías por asesor.
- Canalizaciones a psicopedagogía.
- Distribución por sexo.
- Canalizaciones por sexo.
- Comparación de actividad por cuatrimestre.
- Impresión de estadísticas.
- Exportación completa a un libro Excel con una hoja independiente para cada tabla estadística.

### Historial y reportes

- Consulta centralizada de las asesorías registradas.
- Filtros por:
  - cuatrimestre;
  - día, semana, mes o todos los registros;
  - asesor;
  - carrera;
  - grupo;
  - materia;
  - motivo;
  - matrícula o nombre del alumno.
- Visualización del número de registros encontrados.
- Cálculo de la duración total de los registros filtrados.
- Impresión del reporte filtrado.
- Exportación del historial filtrado a Excel.
- Inclusión de fecha, horario, alumno, sexo, carrera, grupo, materia, motivo, comentarios, asesor, duración, canalización y cuatrimestre.

### Catálogos

- Consulta y administración de alumnos.
- Alta, búsqueda, activación e inactivación de asesores.
- Alta de carreras mediante clave o abreviatura y nombre completo.
- Administración de grupos asociados con una carrera.
- Administración de materias.
- Administración de motivos.
- Administración de cuatrimestres con fechas de inicio y término.
- Activación e inactivación de elementos sin eliminar el historial relacionado.

### Seguridad administrativa

- Acceso exclusivo de la cuenta administradora.
- Contraseña administrativa obligatoria.
- Cambio de contraseña.
- Configuración de clave de recuperación.
- Control de sesión administrativa.
- Limitación de intentos de inicio de sesión.
- Cookies de sesión protegidas.
- Encabezados HTTP de seguridad.
- Protección contra contenido interpretado como fórmula en hojas de cálculo.

## Corrección principal de la versión 1.7.12

### Problema identificado

Las exportaciones administrativas anteriores utilizaban archivos con extensión `.xls` o una estructura `.xlsx` incompleta. Microsoft Excel mostraba mensajes como:

- “El formato y la extensión del archivo no coinciden”.
- “Hemos encontrado un problema con parte del contenido”.
- “Este tipo de archivo no es compatible con esta versión de Office”.

El problema se presentaba únicamente en la página de Administración, dentro de **Estadísticas** y **Historial y reportes**. La exportación disponible en Registro no presentaba esta falla.

### Solución aplicada

- Se sustituyó el generador anterior por **ExcelJS 4.4.0**, incluido localmente en `exceljs.min.js`.
- Se generan libros `.xlsx` con estructura Office Open XML válida.
- Cada tabla estadística se almacena en una hoja independiente.
- Se aplican encabezados identificables, anchos de columna calculados y fila superior inmovilizada.
- La descarga utiliza un archivo binario con el tipo MIME oficial de Excel.
- Se reforzó la descarga mediante un enlace temporal compatible con navegadores de escritorio y móviles.
- Se mantienen los acentos, la letra ñ y los textos registrados.
- Los valores que comienzan con `=`, `+`, `-` o `@` se neutralizan para evitar su ejecución como fórmulas.

## Compatibilidad

La interfaz conserva un diseño adaptable para:

- computadoras de escritorio;
- laptops;
- tablets;
- teléfonos inteligentes.

La exportación administrativa fue preparada para archivos `.xlsx` compatibles con aplicaciones modernas de hojas de cálculo, incluyendo Microsoft Excel de escritorio y Office móvil. La visualización final puede variar ligeramente según la versión de la aplicación instalada.

## Base de datos y conservación de información

- La versión 1.7.12 no elimina alumnos, asesores, asesorías, catálogos ni cuatrimestres.
- La corrección de Excel no requiere una migración nueva de la base de datos.
- Se conservan las migraciones existentes `001` a `005`.
- Los registros históricos permanecen relacionados aunque un catálogo, grupo, periodo o asesor sea inactivado.
- La base de datos debe mantenerse respaldada antes de cualquier despliegue o cambio de infraestructura.

## Archivos relevantes de esta actualización

| Archivo | Función |
| --- | --- |
| `admin.js` | Generación de libros Excel, estadísticas, reportes y funciones administrativas. |
| `admin.html` | Carga del generador de Excel y referencia a la versión 1.7.12. |
| `exceljs.min.js` | Biblioteca local encargada de producir archivos `.xlsx` válidos. |
| `server.js` | Autoriza la entrega segura de `exceljs.min.js` desde el servidor. |
| `package.json` | Identifica la versión 1.7.12 y las pruebas disponibles. |
| `package-lock.json` | Conserva las versiones exactas de las dependencias del servidor. |
| `tests/xlsx-export-check.js` | Verifica la creación, apertura, hojas y contenido de los libros Excel. |
| `README.md` | Resume el estado y las características principales del proyecto. |

## Archivos que no deben omitirse al publicar

Los siguientes archivos deben estar visibles en la raíz del repositorio:

```text
admin.html
admin.js
app.js
exceljs.min.js
index.html
logo-bis-universities.png
package.json
package-lock.json
server.js
styles.css
```

También deben conservarse las carpetas:

```text
assets/
database/
tests/
```

Si `exceljs.min.js` no se publica, los botones de exportación de Administración no podrán generar los libros Excel.

## Instalación local

Requisitos:

- Node.js 18 o posterior;
- PostgreSQL o la base de datos compatible configurada para el proyecto;
- variables de entorno del servidor.

Instalación:

```bash
npm install
npm test
npm start
```

## Variables de entorno principales

El despliegue debe conservar las variables definidas para el sistema, principalmente:

- `DATABASE_URL`;
- `SESSION_SECRET`;
- `SESSION_MAX_AGE_SECONDS`, cuando se utilice un tiempo personalizado;
- `NODE_ENV=production` en el servicio publicado.

La variable `SESSION_SECRET` debe contener al menos 32 caracteres en producción.

## Publicación en GitHub y Render

1. Respaldar la versión estable anterior y la base de datos.
2. Extraer el ZIP completo de la versión 1.7.12.
3. Sustituir en GitHub todos los archivos del proyecto, sin dejar el contenido dentro de una carpeta adicional.
4. Confirmar que `admin.html`, `admin.js`, `exceljs.min.js`, `server.js` y `package.json` estén en la raíz.
5. Confirmar que las carpetas `database` y `tests` estén presentes.
6. Publicar los cambios en la rama utilizada por Render.
7. Ejecutar un nuevo despliegue en Render.
8. Verificar que el despliegue haya finalizado correctamente.
9. Abrir Administración y comprobar que el pie muestre **Versión 1.7.12**.
10. Actualizar el navegador con `Ctrl + F5` o borrar la caché del sitio.

## Pruebas recomendadas después del despliegue

1. Iniciar sesión en Registro con un asesor existente.
2. Consultar el historial sin alterar registros.
3. Iniciar sesión en Administración.
4. Confirmar los indicadores del cuatrimestre activo.
5. Exportar las estadísticas y abrir el archivo `.xlsx`.
6. Verificar que el archivo contenga las ocho hojas estadísticas.
7. Aplicar filtros en Historial y reportes.
8. Exportar el historial filtrado y abrir el archivo `.xlsx`.
9. Confirmar que los datos exportados correspondan con los filtros aplicados.
10. Repetir la exportación desde un teléfono o tablet.

## Validaciones técnicas realizadas

- Sintaxis de `server.js`, `app.js` y `admin.js`.
- Controles de seguridad esenciales.
- Diseño adaptable de Registro y Administración.
- Pruebas de regresión de la auditoría.
- Pruebas correspondientes a las fases 1, 2 y 3.
- Compatibilidad con el esquema existente de la base de datos.
- Creación y reapertura programática del libro `.xlsx`.
- Conservación de múltiples hojas y caracteres acentuados.
- Apertura y conversión del libro mediante una aplicación de hoja de cálculo.
- Integridad del paquete ZIP.
- Auditoría de dependencias con **0 vulnerabilidades conocidas** al momento de generar esta versión.

## Resultado de la actualización

La versión 1.7.12 queda establecida como respaldo funcional posterior a la versión 1.7.10. Resuelve la incompatibilidad de Excel detectada en Administración y conserva la estructura, la información y las funciones previamente aceptadas del sistema.

## Historial breve de cambios

| Versión | Cambio principal |
| --- | --- |
| 1.7.10 | Consolidación de auditoría, compatibilidad, favicon y correcciones previas. |
| 1.7.11 | Primer cambio de la exportación administrativa a `.xlsx`; se detectó una incompatibilidad interna con Microsoft Excel. |
| 1.7.12 | Sustitución definitiva del generador por ExcelJS, validación del libro y compatibilidad correcta con Excel. |

---

**Proyecto:** Sistema web para el control y seguimiento de asesorías académicas.  
**Base funcional:** Sistema de Tutorías v42.  
**Versión documentada:** 1.7.12.  
**Fecha de documentación:** 11 de noviembre de 2026.
