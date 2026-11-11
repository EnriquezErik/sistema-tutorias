# Matriz de revisión adaptable · versión 1.7.9

Esta versión conserva la lógica y los registros del sistema. Los cambios se limitan a la presentación adaptable de Registro y Administración.

| Tipo de pantalla | Ancho de referencia | Comportamiento previsto |
| --- | ---: | --- |
| Teléfono estrecho | 320–420 px | Encabezados apilados, formularios en una columna, acciones y filtros sin desbordamiento. |
| Teléfono común | 390–480 px | Navegación táctil, tarjetas adaptadas y tablas con desplazamiento interno. |
| Teléfono horizontal | 640–900 px | Encabezado apilado, campos legibles y acceso utilizable con poca altura. |
| Tableta | 600–1024 px | Controles reorganizados, catálogos y estadísticas ajustados al espacio disponible. |
| Laptop | 1024–1440 px | Distribución normal de escritorio sin superposiciones. |
| Escritorio | 1440–1699 px | Contenido centrado y tablas aprovechando el ancho disponible. |
| Pantalla amplia o TV | 1700 px o más | Área administrativa ampliada de forma controlada, sin estirar excesivamente los formularios. |

## Componentes revisados

- Acceso de asesor y acceso administrativo.
- Encabezados, logotipo, nombre institucional, usuario y cierre de sesión.
- Formulario de registro, búsqueda de matrícula, cronómetro y botones de asesoría.
- Historial, filtros, tablas y desplazamiento táctil.
- Navegación administrativa por áreas.
- Panel, indicadores y estadísticas.
- Historial y reportes administrativos.
- Catálogos, formularios de alta y acciones de estado.
- Seguridad de la cuenta administrativa.
- Impresión y exportación, sin cambios en su lógica.

## Validación posterior al despliegue

Después de publicar, realice una prueba breve en Chrome, Edge, Firefox y Safari cuando estén disponibles. Registre dispositivo, sistema operativo, navegador, orientación, resultado y evidencia. Las tablas extensas conservan desplazamiento horizontal interno porque contienen más columnas de las que caben físicamente en una pantalla móvil.
