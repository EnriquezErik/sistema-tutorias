# v1.7.30 — Correcciones acumulativas
Base: ZIP v1.7.27 aportado por el usuario. Se conserva el CSS y las migraciones 001–008. Migración 009 aditiva, sin borrar asesorías.

| ID | Cambio físico y limitación |
|---|---|
| A-01 | Revisión optimista de borradores y bloqueo transaccional; conflictos requieren recarga. |
| A-02 | Consulta del estado de operación antes de recuperar copia local; sin conexión no se restaura. |
| A-03 | Botón de descarte confirmado, bitácora y bloqueo de reutilización; solo elimina borrador. |
| A-04 | Cursor por fecha e ID y corte de creación; no es una instantánea MVCC ante ediciones concurrentes. |
| A-05 | Inserción y consulta del alumno en sentencias separadas, comprobación de fila. |
| A-06 | Reintento reconocido antes de validaciones y huella para operaciones nuevas; anteriores sin huella. |
| A-07 | Periodo ID conservado en borradores nuevos; antiguos sin ID requieren revisión. |
| M-01 | Debounce 600 ms y guardado inmediato al finalizar. |
| M-02 | Timeout de 12 s por solicitud de borrador; no limita toda la cola. Parcial. |
| M-03 | Bitácora de creación dentro de la transacción. |
| M-04 | Validación de duración, fechas, futuro y periodo original en restauración. |
| M-05 | Zona institucional en presentación administrativa de fechas; revisar entradas manuales. Parcial. |
| M-06 | Pendiente: el navegador sigue reuniendo todos los bloques para mantener estadísticas y exportaciones. |
| B-01 | Advertencia de periodo no concluido. |
| B-02 | Extracción del helper de paginación; modularización restante pendiente. |

No se realizaron pruebas reales PostgreSQL, concurrencia multiusuario, navegadores, TLS, respaldo ni producción. No declarar estable. Aplicar 009 primero en copia aislada y comprobar conteos históricos. Las pruebas existentes se adaptaron a la revisión, cursor, módulo y validación de restauración; no equivalen a integración real.
