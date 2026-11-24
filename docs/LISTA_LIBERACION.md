# Lista de liberación — v1.7.30

Todos los ensayos reales están pendientes hasta registrar evidencia. Responsable actual: desarrollador; autorización institucional pendiente.

| ID | Ensayo | Criterio |
|---|---|---|
| R01 | Instalación npm ci y npm test | Sin errores |
| R02 | TLS y salud en servicio aislado | Certificado válido, HTTP 200 |
| R03 | Respaldo y restauración | Conteos y permisos coinciden |
| R04 | Migraciones desde versión real y base limpia | 001–009, sin pérdida |
| R05 | Login, cierre, recarga, permisos | Acceso correspondiente al rol |
| R06 | Registro nuevo/existente, materia, carrera, grupo, horario | Guarda una vez y valida campos |
| R07 | Doble clic, respuesta perdida, reintento concurrente | Una asesoría por operación |
| R08 | Borrador, caída de red, otro dispositivo | Recupera último respaldo; no expone borradores ajenos |
| R09 | Edición, anulación, restauración | Justificación y auditoría; conserva periodo |
| R10 | Historial y cuatrimestres inactivos | Coincide con SQL |
| R11 | Reportes, impresión, Excel | Totales y columnas correctos |
| R12 | Expediente, indicadores, comparación y base cero | Totales correctos; excluye anulados |
| R13 | Safari/iPhone y navegadores de escritorio | Operación y presentación correctas |
| R14 | Carga con datos representativos y escrituras concurrentes | Sin omisiones; tiempos aceptados por institución |
| R15 | Reversión y entrega | Procedimiento ensayado; manuales y responsables aprobados |

Evidencia por caso: fecha, versión/commit, entorno, datos ficticios o anonimizados, resultado esperado/real, captura sin datos personales, incidencia y responsable. No autorizar producción con fallos críticos ni sin respaldo restaurado. Registrar aprobación expresa y ventana de cambio.
