# v1.7.16 — candidata de correcciones de Registro
Base: ZIP v1.7.15 entregado por el usuario. No requiere nueva migración si ya existe audit_log (003) y el estado CANCELADA (001). No ejecutar SQL de reinicio.
- Historial: editar, corregir horario y anular registros propios. La API también admite administrador autenticado; no se añade interfaz administrativa en esta versión.
- Edición: no cambia datos maestros compartidos con otras asesorías; en ese caso se rechaza la modificación para proteger el historial. Se permite vincular otro alumno o crear uno con matrícula nueva.
- Anulación lógica: excluida de consultas de Registro y Administración, paginación y estadísticas. Bitácora transaccional obligatoria.
- Alta manual de código de carrera y grupo para matrícula nueva: crea catálogos activos si no existen, en la transacción de guardado. No reasigna grupos existentes ni reactiva catálogos inactivos.
- Horario en curso: ajuste antes de guardar, motivo obligatorio; recuperación de borrador depende de sessionStorage del navegador. No garantiza recuperación tras apagado.
- Validación pendiente: probar en base aislada con migraciones existentes, edición propia y ajena, anulación, estadísticas, impresión/exportación, horarios, alta manual, recarga y concurrencia. No publicar como estable hasta completar estas pruebas. Las pruebas npm son estáticas y de sintaxis, no prueban PostgreSQL real.
