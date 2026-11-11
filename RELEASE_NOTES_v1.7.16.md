# Sistema de Tutorías v42 · versión 1.7.16

Corrección visual solicitada para Administración. No modifica la base de datos, los registros, las rutas de API ni las funciones de Registro.

## Corrección

- El encabezado institucional y la barra de navegación se agrupan en un único bloque fijo.
- Al desplazarse, sólo se mueve el contenido administrativo.
- El menú conserva desplazamiento horizontal en pantallas móviles.
- La presentación de impresión mantiene oculto el menú y no utiliza posición fija.
- Se actualizaron las referencias de caché y el número visible de versión.
- La prueba adaptable comprueba que encabezado y menú pertenezcan al bloque persistente.

## Despliegue

No requiere migraciones. Deben subirse todos los archivos del paquete y comprobar que Render entregue `styles.css?v=1.7.16` y `admin.js?v=1.7.16`.
