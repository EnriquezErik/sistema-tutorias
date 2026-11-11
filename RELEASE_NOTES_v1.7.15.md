# Sistema de Tutorías v42 · versión 1.7.15

Versión de auditoría integral y fortalecimiento preventivo. No elimina ni transforma registros y no requiere una migración nueva.

## Cambios

- La consulta de alumnos vuelve a validar que la cuenta del asesor continúe activa.
- Los cuerpos JSON que exceden el límite dejan de acumularse en memoria.
- Administración prioriza correctamente el cuatrimestre activo y vigente.
- Registro descarta borradores temporales con más de 12 horas, en congruencia con la sesión del servidor.
- Se sincronizaron versión, recursos con control de caché y documentación.
- Se amplió la prueba de regresión para cubrir estas correcciones.

## Validación

- Sintaxis: correcta.
- Suite automatizada: correcta.
- Exportaciones XLSX: correctas.
- Adaptación de Registro y Administración: correcta.
- Dependencias vulnerables conocidas: 0.
- Integridad del paquete: correcta.

Consulte `AUDITORIA_INTEGRAL_v1.7.15.md` antes de publicar.
