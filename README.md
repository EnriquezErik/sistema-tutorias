# Sistema de Asesorías Académicas · v1.4.0 / prototipo v16

Esta versión corrige la separación de datos que ocurre al abrir `index.html` y `admin.html` directamente con `file://` en algunos navegadores. Administración usa un puente oculto hacia `index.html?bridge=1` para leer los registros del Registro de Asesorías y sincronizar catálogos.

## Uso
1. Descomprima todos los archivos en la misma carpeta.
2. Abra `index.html` para registrar asesorías.
3. Abra `admin.html` para Administración.
4. Si acaba de registrar una asesoría, pulse **Actualizar datos** en Administración. También se hace sincronización automática periódica.

Configuración institucional no aparece como sección independiente en Administración.


Actualización v20 - Estadísticas Excel:
- Se retiró el botón y código exclusivo de Imprimir estadísticas.
- Se agregó Exportar a Excel en Estadísticas.
- El archivo Excel contiene 6 hojas, una por cada cuadro estadístico.
- No se modificó la impresión/exportación de Historial y reportes ni los catálogos.
